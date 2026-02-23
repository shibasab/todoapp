import { err, fromPromise, ok, type TaskResult } from "@todoapp/shared";
import { toTodoListItem } from "../../domain/todo/assembler";
import type { ClockPort } from "../../ports/clock-port";
import type { TodoRepoPort } from "../../ports/todo-repo-port";
import type { TodoUseCaseError } from "./errors";
import type { ListTodosInput } from "./types";

const toInternalError = (): TodoUseCaseError => ({
  type: "InternalError",
  detail: "Internal server error",
});

const normalizeKeyword = (keyword: string | undefined): string =>
  keyword == null ? "" : keyword.trim();

export const createListTodosUseCase = (
  dependencies: Readonly<{
    todoRepo: TodoRepoPort;
    clock: ClockPort;
  }>,
): ((
  input: ListTodosInput,
) => TaskResult<readonly ReturnType<typeof toTodoListItem>[], TodoUseCaseError>) => {
  return async (input) => {
    const execution = await fromPromise(
      (async () => {
        const todos = await dependencies.todoRepo.listByOwner({
          ownerId: input.userId,
          now: dependencies.clock.now(),
          ...(input.progressStatus === undefined ? {} : { progressStatus: input.progressStatus }),
          ...(input.dueDateFilter === undefined ? {} : { dueDateFilter: input.dueDateFilter }),
        });

        const keyword = normalizeKeyword(input.keyword);
        const keywordFilteredTodos =
          keyword === ""
            ? todos
            : todos.filter((todo) => todo.name.includes(keyword) || todo.detail.includes(keyword));

        const responses = await Promise.all(
          keywordFilteredTodos.map(async (todo) => {
            const [totalSubtaskCount, completedSubtaskCount] = await Promise.all([
              dependencies.todoRepo.countByParentId(todo.id, input.userId),
              dependencies.todoRepo.countCompletedByParentId(todo.id, input.userId),
            ]);

            return toTodoListItem(todo, {
              completedSubtaskCount,
              totalSubtaskCount,
            });
          }),
        );

        return responses;
      })(),
      () => toInternalError(),
    );

    return execution.ok ? ok(execution.data) : err(execution.error);
  };
};
