import { err, fromPromise, ok, type TaskResult } from "@todoapp/shared";
import { toTodoListItem } from "../../domain/todo/assembler";
import { calculateNextDueDate } from "../../domain/todo/recurrence";
import type {
  TodoProgressStatus,
  TodoRecurrenceType,
  TodoValidationError,
} from "../../domain/todo/types";
import type { ClockPort } from "../../ports/clock-port";
import type { TodoRepoPort } from "../../ports/todo-repo-port";
import type { TodoUseCaseError } from "./errors";
import type { UpdateTodoInput } from "./types";

const toValidationError = (errors: readonly TodoValidationError[]): TodoUseCaseError => ({
  type: "ValidationError",
  detail: "Validation error",
  errors,
});

const toConflictError = (detail: string): TodoUseCaseError => ({
  type: "Conflict",
  detail,
});

const toNotFoundError = (): TodoUseCaseError => ({
  type: "NotFound",
  detail: "Todo not found",
});

const toInternalError = (): TodoUseCaseError => ({
  type: "InternalError",
  detail: "Internal server error",
});

const hasErrorCode = (
  errorValue: unknown,
): errorValue is Readonly<{ code: string; meta?: unknown }> => {
  if (typeof errorValue !== "object" || errorValue == null || !("code" in errorValue)) {
    return false;
  }

  return typeof errorValue.code === "string";
};

const isUniqueConstraintError = (errorValue: unknown): boolean =>
  hasErrorCode(errorValue) && errorValue.code === "P2002";

const isPreviousTodoUniqueConstraintError = (errorValue: unknown): boolean => {
  if (!hasErrorCode(errorValue) || errorValue.code !== "P2002") {
    return false;
  }

  if (
    typeof errorValue.meta !== "object" ||
    errorValue.meta == null ||
    !("target" in errorValue.meta)
  ) {
    return false;
  }

  const target = errorValue.meta.target;
  if (typeof target === "string") {
    return target === "previousTodoId" || target === "previous_todo_id";
  }

  if (!Array.isArray(target)) {
    return false;
  }

  return target.includes("previousTodoId") || target.includes("previous_todo_id");
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
      return err(toNotFoundError());
    }

    const nextDueDate = input.dueDate === undefined ? target.dueDate : input.dueDate;
    const nextRecurrenceType: TodoRecurrenceType =
      input.recurrenceType === undefined ? target.recurrenceType : input.recurrenceType;

    if (nextRecurrenceType !== "none" && nextDueDate == null) {
      return err(
        toValidationError([
          {
            field: "dueDate",
            reason: "required",
          },
        ]),
      );
    }

    if (target.parentId != null && nextRecurrenceType !== "none") {
      return err(toConflictError("サブタスクには繰り返し設定できません"));
    }

    if (input.name != null) {
      const duplicated = await dependencies.todoRepo.findDuplicateActiveName(
        input.userId,
        input.name,
        target.id,
      );
      if (duplicated != null) {
        return err(
          toValidationError([
            {
              field: "name",
              reason: "unique_violation",
            },
          ]),
        );
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
        return err(toConflictError("未完了のサブタスクがあるため完了できません"));
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

        if (shouldGenerateSuccessor) {
          try {
            await transactionRepo.create({
              ownerId: input.userId,
              name: updated.name,
              detail: updated.detail,
              dueDate: calculateNextDueDate(
                nextRecurrenceType,
                toUtcToday(dependencies.clock.now()),
              ),
              progressStatus: "not_started",
              recurrenceType: updated.recurrenceType,
              parentId: null,
              previousTodoId: updated.id,
              activeName: updated.name,
            });
          } catch (errorValue) {
            if (!isPreviousTodoUniqueConstraintError(errorValue)) {
              throw errorValue;
            }
          }
        }

        return updated;
      }),
      (errorValue): TodoUseCaseError =>
        isUniqueConstraintError(errorValue)
          ? toValidationError([
              {
                field: "name",
                reason: "unique_violation",
              },
            ])
          : toInternalError(),
    );

    if (!updatedResult.ok) {
      return err(updatedResult.error);
    }

    const [totalSubtaskCount, completedSubtaskCount] = await Promise.all([
      dependencies.todoRepo.countByParentId(updatedResult.data.id, input.userId),
      dependencies.todoRepo.countCompletedByParentId(updatedResult.data.id, input.userId),
    ]);

    return ok(
      toTodoListItem(updatedResult.data, {
        completedSubtaskCount,
        totalSubtaskCount,
      }),
    );
  };
};
