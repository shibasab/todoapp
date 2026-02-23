export const todoProgressStatuses = ["not_started", "in_progress", "completed"] as const;
export type TodoProgressStatus = (typeof todoProgressStatuses)[number];

export const todoRecurrenceTypes = ["none", "daily", "weekly", "monthly"] as const;
export type TodoRecurrenceType = (typeof todoRecurrenceTypes)[number];

export const todoDueDateFilters = ["all", "today", "this_week", "overdue", "none"] as const;
export type TodoDueDateFilter = (typeof todoDueDateFilters)[number];

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

export type TodoListItem = Readonly<{
  id: number;
  name: string;
  detail: string;
  dueDate: string | null;
  created_at: string;
  progressStatus: TodoProgressStatus;
  recurrenceType: TodoRecurrenceType;
  parentId: number | null;
  completedSubtaskCount: number;
  totalSubtaskCount: number;
  subtaskProgressPercent: number;
}>;
