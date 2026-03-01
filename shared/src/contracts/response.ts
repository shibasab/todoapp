import { z } from "zod";

export const DetailErrorResponseSchema = z
  .object({
    detail: z.string(),
  })
  .readonly();

export const ValidationIssueSchema = z
  .object({
    field: z.string(),
    reason: z.string(),
  })
  .readonly();

export const ValidationErrorResponseSchema = z
  .object({
    status: z.literal(422),
    type: z.literal("validation_error"),
    detail: z.string(),
    errors: z.array(ValidationIssueSchema).readonly(),
  })
  .readonly();

export const ConflictErrorResponseSchema = z
  .object({
    status: z.literal(409),
    type: z.literal("conflict_error"),
    detail: z.string(),
  })
  .readonly();

export type DetailErrorResponse = z.infer<typeof DetailErrorResponseSchema>;
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;
export type ValidationErrorResponse = z.infer<typeof ValidationErrorResponseSchema>;
export type ConflictErrorResponse = z.infer<typeof ConflictErrorResponseSchema>;
