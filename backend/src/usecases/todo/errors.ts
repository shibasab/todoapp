import type { TodoValidationError } from "../../domain/todo/types";

export type TodoUseCaseError =
  | Readonly<{
      type: "ValidationError";
      detail: string;
      errors: readonly TodoValidationError[];
    }>
  | Readonly<{
      type: "Unauthorized";
      detail: string;
    }>
  | Readonly<{
      type: "NotFound";
      detail: string;
    }>
  | Readonly<{
      type: "Conflict";
      detail: string;
    }>
  | Readonly<{
      type: "InternalError";
      detail: string;
    }>;

export const toTodoValidationError = (
  errors: readonly TodoValidationError[],
  detail = "Validation error",
): TodoUseCaseError => ({
  type: "ValidationError",
  detail,
  errors,
});

export const toTodoUnauthorizedError = (
  detail = "Could not validate credentials",
): TodoUseCaseError => ({
  type: "Unauthorized",
  detail,
});

export const toTodoNotFoundError = (detail = "Todo not found"): TodoUseCaseError => ({
  type: "NotFound",
  detail,
});

export const toTodoConflictError = (detail: string): TodoUseCaseError => ({
  type: "Conflict",
  detail,
});

export const toTodoInternalError = (detail = "Internal server error"): TodoUseCaseError => ({
  type: "InternalError",
  detail,
});
