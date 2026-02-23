import { err, fromPromise, ok, type TaskResult } from "@todoapp/shared";
import { toTodoListItem } from "../../domain/todo/assembler";
import type { TodoRepoPort } from "../../ports/todo-repo-port";
import type { TodoUseCaseError } from "./errors";
import type { GetTodoInput } from "./types";

const toNotFoundError = (): TodoUseCaseError => ({
  type: "NotFound",
  detail: "Todo not found",
});

const toInternalError = (): TodoUseCaseError => ({
  type: "InternalError",
  detail: "Internal server error",
});

export const createGetTodoUseCase = (
  dependencies: Readonly<{
    todoRepo: TodoRepoPort;
  }>,
): ((input: GetTodoInput) => TaskResult<ReturnType<typeof toTodoListItem>, TodoUseCaseError>) => {
  return async (input) => {
    const execution = await fromPromise(
      (async () => {
        const todo = await dependencies.todoRepo.findByIdForOwner(input.todoId, input.userId);
        if (todo == null) {
          return err(toNotFoundError());
        }

        const [totalSubtaskCount, completedSubtaskCount] = await Promise.all([
          dependencies.todoRepo.countByParentId(todo.id, input.userId),
          dependencies.todoRepo.countCompletedByParentId(todo.id, input.userId),
        ]);

        return ok(
          toTodoListItem(todo, {
            completedSubtaskCount,
            totalSubtaskCount,
          }),
        );
      })(),
      () => toInternalError(),
    );

    if (!execution.ok) {
      return err(execution.error);
    }

    return execution.data.ok ? ok(execution.data.data) : err(execution.data.error);
  };
};
