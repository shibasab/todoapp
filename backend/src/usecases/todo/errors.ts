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
