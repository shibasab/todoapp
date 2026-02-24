import type { AuthValidationError } from "./types";

export const toAuthInvalidFormatError = (field: string): AuthValidationError => ({
  field,
  reason: "invalid_format",
});

export const toAuthRequiredError = (field: string): AuthValidationError => ({
  field,
  reason: "required",
});
