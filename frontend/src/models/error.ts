import type { ValidationErrorResponse as SharedValidationErrorResponse, ValidationIssue } from '@todoapp/shared'

type ValidationErrorBase = Readonly<{
  field: string
  reason: string
  limit?: number
}>

export type RequiredError = ValidationErrorBase &
  Readonly<{
    reason: 'required'
  }>

export type UniqueViolationError = ValidationErrorBase &
  Readonly<{
    reason: 'unique_violation'
  }>

export type MaxLengthError = ValidationErrorBase &
  Readonly<{
    reason: 'max_length'
    limit: number
  }>

export type MinLengthError = ValidationErrorBase &
  Readonly<{
    reason: 'min_length'
    limit: number
  }>

export type InvalidFormatError = ValidationErrorBase &
  Readonly<{
    reason: 'invalid_format'
  }>

export type ValidationError = ValidationErrorBase

export type ValidationErrorResponse = SharedValidationErrorResponse

export const toValidationError = (issue: ValidationIssue): ValidationError => ({
  field: issue.field,
  reason: issue.reason,
})

export const toValidationErrors = (issues: readonly ValidationIssue[]): readonly ValidationError[] =>
  issues.map((issue) => toValidationError(issue))
