import type { TodoProgressStatus, TodoRecurrenceType } from "./types";

export const isTodoProgressStatus = (value: unknown): value is TodoProgressStatus =>
  value === "not_started" || value === "in_progress" || value === "completed";

export const isTodoRecurrenceType = (value: unknown): value is TodoRecurrenceType =>
  value === "none" || value === "daily" || value === "weekly" || value === "monthly";

export const toTodoProgressStatus = (value: string): TodoProgressStatus =>
  isTodoProgressStatus(value) ? value : "not_started";

export const toTodoRecurrenceType = (value: string): TodoRecurrenceType =>
  isTodoRecurrenceType(value) ? value : "none";
