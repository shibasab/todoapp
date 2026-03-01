import type { TaskResult } from "@todoapp/shared";
import type {
  TodoDueDateFilter,
  TodoListItem,
  TodoProgressStatus,
  TodoRecurrenceType,
} from "../../domain/todo/types";
import type { TodoUseCaseError } from "./errors";

export type ListTodosInput = Readonly<{
  userId: number;
  keyword?: string;
  progressStatus?: TodoProgressStatus;
  dueDateFilter?: TodoDueDateFilter;
  parentId?: number;
}>;

export type GetTodoInput = Readonly<{
  userId: number;
  todoId: number;
}>;

export type CreateTodoInput = Readonly<{
  userId: number;
  name: string;
  detail: string;
  dueDate: Date | null;
  progressStatus: TodoProgressStatus;
  recurrenceType: TodoRecurrenceType;
  parentId: number | null;
}>;

export type UpdateTodoInput = Readonly<{
  userId: number;
  todoId: number;
  name?: string;
  detail?: string;
  dueDate?: Date | null;
  progressStatus?: TodoProgressStatus;
  recurrenceType?: TodoRecurrenceType;
}>;

export type DeleteTodoInput = Readonly<{
  userId: number;
  todoId: number;
}>;

export type ListTodosUseCase = (
  input: ListTodosInput,
) => TaskResult<readonly TodoListItem[], TodoUseCaseError>;
export type GetTodoUseCase = (input: GetTodoInput) => TaskResult<TodoListItem, TodoUseCaseError>;
export type CreateTodoUseCase = (
  input: CreateTodoInput,
) => TaskResult<TodoListItem, TodoUseCaseError>;
export type UpdateTodoUseCase = (
  input: UpdateTodoInput,
) => TaskResult<TodoListItem, TodoUseCaseError>;
export type DeleteTodoUseCase = (
  input: DeleteTodoInput,
) => TaskResult<Readonly<{ status: 204 }>, TodoUseCaseError>;
