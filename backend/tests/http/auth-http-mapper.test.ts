import { describe, expect, it } from "vitest";
import { toAuthHttpError } from "../../src/http/auth/to-http-error";

describe("auth http error mapper", () => {
  it("AuthUseCaseErrorの各ユニオン値をHTTPエラーへ変換する", () => {
    const validation = toAuthHttpError({
      type: "ValidationError",
      detail: "Validation error",
      errors: [
        {
          field: "username",
          reason: "invalid_format",
        },
      ],
    });
    const unauthorized = toAuthHttpError({
      type: "Unauthorized",
      detail: "Could not validate credentials",
    });
    const conflict = toAuthHttpError({
      type: "Conflict",
      detail: "Username already registered",
    });
    const notFound = toAuthHttpError({
      type: "NotFound",
      detail: "Not found",
    });
    const internal = toAuthHttpError({
      type: "InternalError",
      detail: "Internal server error",
    });

    expect(validation.status).toBe(422);
    expect(validation.body).toEqual({
      status: 422,
      type: "validation_error",
      detail: "Validation error",
      errors: [
        {
          field: "username",
          reason: "invalid_format",
        },
      ],
    });
    expect(unauthorized.status).toBe(401);
    expect(conflict.status).toBe(409);
    expect(notFound.status).toBe(404);
    expect(internal.status).toBe(500);
  });

  it("未定義のユニオン値はNotExhaustiveErrorを投げる", () => {
    expect(() =>
      toAuthHttpError({
        type: "Unknown",
        detail: "unknown",
      } as never),
    ).toThrowError(/Not exhaustive/);
  });
});
