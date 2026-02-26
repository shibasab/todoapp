import { z } from "zod";

export const RequiredErrorSchema = z
  .object({
    field: z.string(),
    reason: z.literal("required"),
  })
  .readonly();

export const UniqueViolationErrorSchema = z
  .object({
    field: z.string(),
    reason: z.literal("unique_violation"),
  })
  .readonly();

export const MaxLengthErrorSchema = z
  .object({
    field: z.string(),
    reason: z.literal("max_length"),
    limit: z.number(),
  })
  .readonly();

export const MinLengthErrorSchema = z
  .object({
    field: z.string(),
    reason: z.literal("min_length"),
    limit: z.number(),
  })
  .readonly();

export const InvalidFormatErrorSchema = z
  .object({
    field: z.string(),
    reason: z.literal("invalid_format"),
  })
  .readonly();

export const ValidationErrorSchema = z.union([
  RequiredErrorSchema,
  UniqueViolationErrorSchema,
  MaxLengthErrorSchema,
  MinLengthErrorSchema,
  InvalidFormatErrorSchema,
]);

export const ValidationErrorResponseSchema = z
  .object({
    status: z.number(),
    type: z.literal("validation_error"),
    errors: z.array(ValidationErrorSchema),
    detail: z.string().optional(),
  })
  .readonly();

export type RequiredError = z.infer<typeof RequiredErrorSchema>;
export type UniqueViolationError = z.infer<typeof UniqueViolationErrorSchema>;
export type MaxLengthError = z.infer<typeof MaxLengthErrorSchema>;
export type MinLengthError = z.infer<typeof MinLengthErrorSchema>;
export type InvalidFormatError = z.infer<typeof InvalidFormatErrorSchema>;
export type ValidationError = z.infer<typeof ValidationErrorSchema>;
export type ValidationErrorResponse = z.infer<typeof ValidationErrorResponseSchema>;
