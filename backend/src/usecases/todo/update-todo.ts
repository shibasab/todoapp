import { err, fromPromise, ok, type TaskResult } from "@todoapp/shared";
import { toTodoListItem } from "../../domain/todo/assembler";
import { calculateNextDueDate } from "../../domain/todo/recurrence";
import type { TodoProgressStatus, TodoRecurrenceType } from "../../domain/todo/types";
import type { ClockPort } from "../../ports/clock-port";
import type {
  TodoRepoCreateError,
  TodoRepoPort,
  TodoRepoUpdateError,
} from "../../ports/todo-repo-port";
import { assertNever } from "../../shared/error";
import {
  toTodoConflictError,
  toTodoInternalError,
  toTodoNotFoundError,
  toTodoValidationError,
  type TodoUseCaseError,
} from "./errors";
import type { UpdateTodoInput } from "./types";

const toNameUniqueViolation = () =>
  toTodoValidationError([
    {
      field: "name",
      reason: "unique_violation",
    },
  ]);

const mapUpdateErrorToUseCaseError = (errorValue: TodoRepoUpdateError): TodoUseCaseError => {
  switch (errorValue.type) {
    case "DuplicateActiveName":
      return toNameUniqueViolation();
    case "Unexpected":
      return toTodoInternalError();
    default:
      return assertNever(errorValue, "TodoRepoUpdateError.type");
  }
};

const mapCreateErrorToUseCaseError = (
  errorValue: TodoRepoCreateError,
): Readonly<{ ignore: boolean; error?: TodoUseCaseError }> => {
  switch (errorValue.type) {
    case "DuplicatePreviousTodo":
      return { ignore: true };
    case "DuplicateActiveName":
      return { ignore: false, error: toNameUniqueViolation() };
    case "Unexpected":
      return { ignore: false, error: toTodoInternalError() };
    default:
      return assertNever(errorValue, "TodoRepoCreateError.type");
  }
};

const toUtcToday = (now: Date): Date =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

export const createUpdateTodoUseCase = (
  dependencies: Readonly<{
    todoRepo: TodoRepoPort;
    clock: ClockPort;
  }>,
): ((
  input: UpdateTodoInput,
) => TaskResult<ReturnType<typeof toTodoListItem>, TodoUseCaseError>) => {
  return async (input) => {
    const target = await dependencies.todoRepo.findByIdForOwner(input.todoId, input.userId);
    if (target == null) {
      return err(toTodoNotFoundError());
    }

    const nextDueDate = input.dueDate === undefined ? target.dueDate : input.dueDate;
    const nextRecurrenceType: TodoRecurrenceType =
      input.recurrenceType === undefined ? target.recurrenceType : input.recurrenceType;

    if (nextRecurrenceType !== "none" && nextDueDate == null) {
      return err(
        toTodoValidationError([
          {
            field: "dueDate",
            reason: "required",
          },
        ]),
      );
    }

    if (target.parentId != null && nextRecurrenceType !== "none") {
      return err(toTodoConflictError("サブタスクには繰り返し設定できません"));
    }

    if (input.name != null) {
      const duplicated = await dependencies.todoRepo.findDuplicateActiveName(
        input.userId,
        input.name,
        target.id,
      );
      if (duplicated != null) {
        return err(toNameUniqueViolation());
      }
    }

    const nextProgressStatus: TodoProgressStatus =
      input.progressStatus === undefined ? target.progressStatus : input.progressStatus;

    if (
      target.parentId == null &&
      target.progressStatus !== "completed" &&
      nextProgressStatus === "completed"
    ) {
      const incompleteSubtask = await dependencies.todoRepo.findIncompleteSubtask(
        target.id,
        input.userId,
      );
      if (incompleteSubtask != null) {
        return err(toTodoConflictError("未完了のサブタスクがあるため完了できません"));
      }
    }

    const nextName = input.name === undefined ? target.name : input.name;
    const shouldGenerateSuccessor =
      target.progressStatus !== "completed" &&
      nextProgressStatus === "completed" &&
      nextRecurrenceType !== "none" &&
      nextDueDate != null;

    const updatedResult = await fromPromise(
      dependencies.todoRepo.runInTransaction(async (transactionRepo) => {
        const updated = await transactionRepo.update({
          id: target.id,
          ownerId: input.userId,
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.detail === undefined ? {} : { detail: input.detail }),
          ...(input.dueDate === undefined ? {} : { dueDate: input.dueDate }),
          ...(input.progressStatus === undefined ? {} : { progressStatus: input.progressStatus }),
          ...(input.recurrenceType === undefined ? {} : { recurrenceType: input.recurrenceType }),
          activeName: nextProgressStatus === "completed" ? null : nextName,
        });
        if (!updated.ok) {
          return err(mapUpdateErrorToUseCaseError(updated.error));
        }

        if (shouldGenerateSuccessor) {
          const successor = await transactionRepo.create({
            ownerId: input.userId,
            name: updated.data.name,
            detail: updated.data.detail,
            dueDate: calculateNextDueDate(nextRecurrenceType, toUtcToday(dependencies.clock.now())),
            progressStatus: "not_started",
            recurrenceType: updated.data.recurrenceType,
            parentId: null,
            previousTodoId: updated.data.id,
            activeName: updated.data.name,
          });
          if (!successor.ok) {
            const mapped = mapCreateErrorToUseCaseError(successor.error);
            if (!mapped.ignore) {
              return err(mapped.error ?? toTodoInternalError());
            }
          }
        }

        return ok(updated.data);
      }),
      () => toTodoInternalError(),
    );
    if (!updatedResult.ok) {
      return err(updatedResult.error);
    }
    if (!updatedResult.data.ok) {
      return err(updatedResult.data.error);
    }

    const [totalSubtaskCount, completedSubtaskCount] = await Promise.all([
      dependencies.todoRepo.countByParentId(updatedResult.data.data.id, input.userId),
      dependencies.todoRepo.countCompletedByParentId(updatedResult.data.data.id, input.userId),
    ]);

    return ok(
      toTodoListItem(updatedResult.data.data, {
        completedSubtaskCount,
        totalSubtaskCount,
      }),
    );
  };
};
