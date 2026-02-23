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

    expect(validation.status).toBe(422);
    expect(validation.body).toMatchObject({
      type: "validation_error",
    });
    expect(unauthorized.status).toBe(401);
    expect(notFound.status).toBe(404);
    expect(conflict.status).toBe(409);
    expect(internal.status).toBe(500);
  });

  it("未定義のユニオン値はNotExhaustiveErrorを投げる", () => {
    const invalidError = {
      type: "UnknownError",
      detail: "unknown",
    } as unknown as TodoUseCaseError;

    expect(() => toTodoHttpError(invalidError)).toThrow("TodoUseCaseError.type");
  });
});
