import type { TodoItem, TodoListItem } from "./types";

export const toDateOnlyString = (dateValue: Date | null): string | null =>
  dateValue == null ? null : dateValue.toISOString().slice(0, 10);

export const toTodoListItem = (
  todo: TodoItem,
  stats: Readonly<{
    completedSubtaskCount: number;
    totalSubtaskCount: number;
  }>,
): TodoListItem => {
  const subtaskProgressPercent =
    stats.totalSubtaskCount === 0
      ? 0
      : Math.floor((stats.completedSubtaskCount * 100) / stats.totalSubtaskCount);

  return {
    id: todo.id,
    name: todo.name,
    detail: todo.detail,
    dueDate: toDateOnlyString(todo.dueDate),
    createdAt: todo.createdAt.toISOString(),
    progressStatus: todo.progressStatus,
    recurrenceType: todo.recurrenceType,
    parentId: todo.parentId,
    completedSubtaskCount: stats.completedSubtaskCount,
    totalSubtaskCount: stats.totalSubtaskCount,
    subtaskProgressPercent,
  };
};
