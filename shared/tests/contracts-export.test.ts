import { describe, expect, it } from "vitest";

import {
  AuthSchema,
  CreateTodoRequestSchema,
  InvalidFormatErrorSchema,
  MaxLengthErrorSchema,
  MinLengthErrorSchema,
  RequiredErrorSchema,
  TodoDueDateFilterSchema,
  TodoProgressStatusSchema,
  TodoRecurrenceTypeSchema,
  TodoSchema,
  TodoSearchParamDueDateSchema,
  TodoSearchParamStatusSchema,
  TodoSearchQuerySchema,
  TodoStatusFilterSchema,
  UniqueViolationErrorSchema,
  UpdateTodoRequestSchema,
  UserSchema,
  ValidationErrorResponseSchema,
  ValidationErrorSchema,
} from "../src";
import * as authContracts from "../src/contracts/auth";
import * as errorContracts from "../src/contracts/error";
import * as todoContracts from "../src/contracts/todo";

describe("contracts export", () => {
  it("todo contractsをindexから再エクスポートしている", () => {
    expect(TodoRecurrenceTypeSchema).toBe(todoContracts.TodoRecurrenceTypeSchema);
    expect(TodoProgressStatusSchema).toBe(todoContracts.TodoProgressStatusSchema);
    expect(TodoSchema).toBe(todoContracts.TodoSchema);
    expect(CreateTodoRequestSchema).toBe(todoContracts.CreateTodoRequestSchema);
    expect(UpdateTodoRequestSchema).toBe(todoContracts.UpdateTodoRequestSchema);
    expect(TodoStatusFilterSchema).toBe(todoContracts.TodoStatusFilterSchema);
    expect(TodoDueDateFilterSchema).toBe(todoContracts.TodoDueDateFilterSchema);
    expect(TodoSearchParamStatusSchema).toBe(todoContracts.TodoSearchParamStatusSchema);
    expect(TodoSearchParamDueDateSchema).toBe(todoContracts.TodoSearchParamDueDateSchema);
    expect(TodoSearchQuerySchema).toBe(todoContracts.TodoSearchQuerySchema);
  });

  it("auth contractsをindexから再エクスポートしている", () => {
    expect(UserSchema).toBe(authContracts.UserSchema);
    expect(AuthSchema).toBe(authContracts.AuthSchema);
  });

  it("error contractsをindexから再エクスポートしている", () => {
    expect(RequiredErrorSchema).toBe(errorContracts.RequiredErrorSchema);
    expect(UniqueViolationErrorSchema).toBe(errorContracts.UniqueViolationErrorSchema);
    expect(MaxLengthErrorSchema).toBe(errorContracts.MaxLengthErrorSchema);
    expect(MinLengthErrorSchema).toBe(errorContracts.MinLengthErrorSchema);
    expect(InvalidFormatErrorSchema).toBe(errorContracts.InvalidFormatErrorSchema);
    expect(ValidationErrorSchema).toBe(errorContracts.ValidationErrorSchema);
    expect(ValidationErrorResponseSchema).toBe(errorContracts.ValidationErrorResponseSchema);
  });
});
