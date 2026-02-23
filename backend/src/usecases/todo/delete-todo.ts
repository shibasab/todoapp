import { err, fromPromise, ok, type TaskResult } from "@todoapp/shared";
import type { TodoRepoPort } from "../../ports/todo-repo-port";
import type { TodoUseCaseError } from "./errors";
import type { DeleteTodoInput } from "./types";

const toNotFoundError = (): TodoUseCaseError => ({
  type: "NotFound",
  detail: "Todo not found",
});

const toInternalError = (): TodoUseCaseError => ({
  type: "InternalError",
  detail: "Internal server error",
});

export const createDeleteTodoUseCase = (
  dependencies: Readonly<{
    todoRepo: TodoRepoPort;
  }>,
): ((input: DeleteTodoInput) => TaskResult<Readonly<{ status: 204 }>, TodoUseCaseError>) => {
  return async (input) => {
    const target = await dependencies.todoRepo.findByIdForOwner(input.todoId, input.userId);
    if (target == null) {
      return err(toNotFoundError());
    }

    const deleted = await fromPromise(
      dependencies.todoRepo.deleteById(input.todoId, input.userId),
      () => toInternalError(),
    );
    if (!deleted.ok) {
      return err(deleted.error);
    }

    return ok({ status: 204 as const });
  };
};
