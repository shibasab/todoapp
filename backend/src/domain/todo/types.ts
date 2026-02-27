import type {
  Todo as TodoListItem,
  TodoDueDateFilter,
  TodoProgressStatus,
  TodoRecurrenceType,
} from "@todoapp/shared";

export { todoDueDateFilters, todoProgressStatuses, todoRecurrenceTypes } from "@todoapp/shared";

export type TodoValidationErrorReason =
  | "required"
  | "unique_violation"
  | "max_length"
  | "invalid_format";

export type TodoValidationError = Readonly<{
  field: string;
  reason: TodoValidationErrorReason;
  limit?: number;
}>;

export type TodoItem = Readonly<{
  id: number;
  ownerId: number;
  name: string;
  detail: string;
  dueDate: Date | null;
  createdAt: Date;
  progressStatus: TodoProgressStatus;
  recurrenceType: TodoRecurrenceType;
  parentId: number | null;
  previousTodoId: number | null;
}>;

export type { TodoDueDateFilter, TodoListItem, TodoProgressStatus, TodoRecurrenceType };
