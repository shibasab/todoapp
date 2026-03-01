import type { Todo } from "@todoapp/shared";
import type { TodoListItem } from "../../domain/todo/types";

type TodoDateValue = Date | string;

type TodoResponseSource = Omit<TodoListItem, "dueDate" | "createdAt"> & {
  readonly dueDate: TodoDateValue | null;
  readonly createdAt: TodoDateValue;
};

const toIsoDate = (dateValue: TodoDateValue): string =>
  dateValue instanceof Date ? dateValue.toISOString() : dateValue;

const toDateOnly = (dateValue: TodoDateValue | null): string | null => {
  if (dateValue == null) {
    return null;
  }

  const iso = toIsoDate(dateValue);
  return iso.slice(0, 10);
};

export const toTodoDto = (todo: TodoResponseSource): Todo => ({
  id: todo.id,
  name: todo.name,
  detail: todo.detail,
  dueDate: toDateOnly(todo.dueDate),
  createdAt: toIsoDate(todo.createdAt),
  progressStatus: todo.progressStatus,
  recurrenceType: todo.recurrenceType,
  parentId: todo.parentId,
  parentTitle: todo.parentTitle,
  completedSubtaskCount: todo.completedSubtaskCount,
  totalSubtaskCount: todo.totalSubtaskCount,
  subtaskProgressPercent: todo.subtaskProgressPercent,
});

export const toTodoListDto = (todos: readonly TodoResponseSource[]): readonly Todo[] =>
  todos.map((todo) => toTodoDto(todo));
