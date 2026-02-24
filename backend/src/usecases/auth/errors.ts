import type { AuthValidationError } from "../../domain/auth/types";

export type AuthUseCaseError =
  | Readonly<{
      type: "ValidationError";
      detail: string;
      errors: readonly AuthValidationError[];
    }>
  | Readonly<{
      type: "Unauthorized";
      detail: string;
    }>
  | Readonly<{
      type: "Conflict";
      detail: string;
    }>
  | Readonly<{
      type: "NotFound";
      detail: string;
    }>
  | Readonly<{
      type: "InternalError";
      detail: string;
    }>;

export const toAuthValidationError = (
  errors: readonly AuthValidationError[],
  detail = "Validation error",
): AuthUseCaseError => ({
  type: "ValidationError",
  detail,
  errors,
});

export const toAuthUnauthorizedError = (
  detail = "Could not validate credentials",
): AuthUseCaseError => ({
  type: "Unauthorized",
  detail,
});

export const toAuthInvalidCredentialsError = (
  detail = "Incorrect Credentials",
): AuthUseCaseError => ({
  type: "Unauthorized",
  detail,
});

export const toAuthConflictError = (detail: string): AuthUseCaseError => ({
  type: "Conflict",
  detail,
});

export const toAuthNotFoundError = (detail = "Not found"): AuthUseCaseError => ({
  type: "NotFound",
  detail,
});

export const toAuthInternalError = (detail = "Internal server error"): AuthUseCaseError => ({
  type: "InternalError",
  detail,
});
