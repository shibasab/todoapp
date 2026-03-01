import { describe, expect, it } from "vitest";
import { toTodoHttpError } from "../src/http/todo/to-http-error";
import type { TodoUseCaseError } from "../src/usecases/todo/errors";

describe("todo http error mapper", () => {
  it("TodoUseCaseErrorの各ユニオン値をHTTPエラーへ変換する", () => {
    const validation = toTodoHttpError({
      type: "ValidationError",
      detail: "Validation error",
      errors: [{ field: "name", reason: "required" }],
    });
    const unauthorized = toTodoHttpError({
      type: "Unauthorized",
      detail: "Could not validate credentials",
    });
    const notFound = toTodoHttpError({
      type: "NotFound",
      detail: "Todo not found",
    });
    const conflict = toTodoHttpError({
      type: "Conflict",
      detail: "Conflict error",
    });
    const internal = toTodoHttpError({
      type: "InternalError",
      detail: "Internal server error",
    });

    expect(validation).toEqual({
      status: 422,
      body: {
        status: 422,
        type: "validation_error",
        detail: "Validation error",
        errors: [{ field: "name", reason: "required" }],
      },
    });
    expect(unauthorized).toEqual({
      status: 401,
      body: {
        detail: "Could not validate credentials",
      },
    });
    expect(notFound).toEqual({
      status: 404,
      body: {
        detail: "Todo not found",
      },
    });
    expect(conflict).toEqual({
      status: 409,
      body: {
        status: 409,
        type: "conflict_error",
        detail: "Conflict error",
      },
    });
    expect(internal).toEqual({
      status: 500,
      body: {
        detail: "Internal server error",
      },
    });
  });

  it("未定義のユニオン値はNotExhaustiveErrorを投げる", () => {
    const invalidError = {
      type: "UnknownError",
      detail: "unknown",
    } as unknown as TodoUseCaseError;

    expect(() => toTodoHttpError(invalidError)).toThrow("TodoUseCaseError.type");
  });
});
