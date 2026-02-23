import { err, fromPromise, ok, type TaskResult } from "@todoapp/shared";
import { toTodoListItem } from "../../domain/todo/assembler";
import type { ClockPort } from "../../ports/clock-port";
import type { TodoRepoPort } from "../../ports/todo-repo-port";
import { toTodoInternalError, toTodoNotFoundError, type TodoUseCaseError } from "./errors";
import type { GetTodoInput, ListTodosInput } from "./types";

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
      () => toTodoInternalError(),
    );

    return execution.ok ? ok(execution.data) : err(execution.error);
  };
};

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
          return err(toTodoNotFoundError());
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
      () => toTodoInternalError(),
    );

    if (!execution.ok) {
      return err(execution.error);
    }

    return execution.data.ok ? ok(execution.data.data) : err(execution.data.error);
  };
};
