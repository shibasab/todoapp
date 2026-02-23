import { err, fromPromise, ok, type TaskResult } from "@todoapp/shared";
import { toTodoListItem } from "../../domain/todo/assembler";
import type { TodoValidationError } from "../../domain/todo/types";
import type { TodoRepoPort } from "../../ports/todo-repo-port";
import {
  toTodoConflictError,
  toTodoInternalError,
  toTodoNotFoundError,
  toTodoValidationError,
  type TodoUseCaseError,
} from "./errors";
import type { CreateTodoInput, DeleteTodoInput } from "./types";

const hasUniqueConstraint = (errorValue: unknown): boolean => {
  if (typeof errorValue !== "object" || errorValue == null || !("code" in errorValue)) {
    return false;
  }

  return typeof errorValue.code === "string" && errorValue.code === "P2002";
};

const toNameUniqueViolation = (): readonly TodoValidationError[] => [
  {
    field: "name",
    reason: "unique_violation",
  },
];

export const createCreateTodoUseCase = (
  dependencies: Readonly<{
    todoRepo: TodoRepoPort;
  }>,
): ((
  input: CreateTodoInput,
) => TaskResult<ReturnType<typeof toTodoListItem>, TodoUseCaseError>) => {
  return async (input) => {
    if (input.recurrenceType !== "none" && input.dueDate == null) {
      return err(
        toTodoValidationError([
          {
            field: "dueDate",
            reason: "required",
          },
        ]),
      );
    }

    if (input.parentId != null) {
      const parent = await dependencies.todoRepo.findByIdForOwner(input.parentId, input.userId);
      if (parent == null) {
        return err(toTodoConflictError("親タスクが存在しません"));
      }

      if (parent.parentId != null) {
        return err(toTodoConflictError("サブタスクを親として指定できません"));
      }

      if (input.recurrenceType !== "none") {
        return err(toTodoConflictError("サブタスクには繰り返し設定できません"));
      }
    }

    const duplicated = await dependencies.todoRepo.findDuplicateActiveName(
      input.userId,
      input.name,
    );
    if (duplicated != null) {
      return err(toTodoValidationError(toNameUniqueViolation()));
    }

    const created = await fromPromise(
      dependencies.todoRepo.create({
        ownerId: input.userId,
        name: input.name,
        detail: input.detail,
        dueDate: input.dueDate,
        progressStatus: input.progressStatus,
        recurrenceType: input.recurrenceType,
        parentId: input.parentId,
        activeName: input.progressStatus === "completed" ? null : input.name,
      }),
      (errorValue): TodoUseCaseError =>
        hasUniqueConstraint(errorValue)
          ? toTodoValidationError(toNameUniqueViolation())
          : toTodoInternalError(),
    );

    if (!created.ok) {
      return err(created.error);
    }

    const [totalSubtaskCount, completedSubtaskCount] = await Promise.all([
      dependencies.todoRepo.countByParentId(created.data.id, input.userId),
      dependencies.todoRepo.countCompletedByParentId(created.data.id, input.userId),
    ]);

    return ok(
      toTodoListItem(created.data, {
        completedSubtaskCount,
        totalSubtaskCount,
      }),
    );
  };
};

export const createDeleteTodoUseCase = (
  dependencies: Readonly<{
    todoRepo: TodoRepoPort;
  }>,
): ((input: DeleteTodoInput) => TaskResult<Readonly<{ status: 204 }>, TodoUseCaseError>) => {
  return async (input) => {
    const target = await dependencies.todoRepo.findByIdForOwner(input.todoId, input.userId);
    if (target == null) {
      return err(toTodoNotFoundError());
    }

    const deleted = await fromPromise(
      dependencies.todoRepo.deleteById(input.todoId, input.userId),
      () => toTodoInternalError(),
    );
    if (!deleted.ok) {
      return err(deleted.error);
    }

    return ok({ status: 204 as const });
  };
};
