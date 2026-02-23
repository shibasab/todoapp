import { err, fromPromise, ok, type TaskResult } from "@todoapp/shared";
import { toTodoListItem } from "../../domain/todo/assembler";
import type { TodoValidationError } from "../../domain/todo/types";
import type { TodoRepoPort } from "../../ports/todo-repo-port";
import type { TodoUseCaseError } from "./errors";
import type { CreateTodoInput } from "./types";

const toValidationError = (errors: readonly TodoValidationError[]): TodoUseCaseError => ({
  type: "ValidationError",
  detail: "Validation error",
  errors,
});

const toConflictError = (detail: string): TodoUseCaseError => ({
  type: "Conflict",
  detail,
});

const toInternalError = (): TodoUseCaseError => ({
  type: "InternalError",
  detail: "Internal server error",
});

const hasUniqueConstraint = (errorValue: unknown): boolean => {
  if (typeof errorValue !== "object" || errorValue == null || !("code" in errorValue)) {
    return false;
  }

  return typeof errorValue.code === "string" && errorValue.code === "P2002";
};

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
        toValidationError([
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
        return err(toConflictError("親タスクが存在しません"));
      }

      if (parent.parentId != null) {
        return err(toConflictError("サブタスクを親として指定できません"));
      }

      if (input.recurrenceType !== "none") {
        return err(toConflictError("サブタスクには繰り返し設定できません"));
      }
    }

    const duplicated = await dependencies.todoRepo.findDuplicateActiveName(
      input.userId,
      input.name,
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
          ? toValidationError([
              {
                field: "name",
                reason: "unique_violation",
              },
            ])
          : toInternalError(),
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
