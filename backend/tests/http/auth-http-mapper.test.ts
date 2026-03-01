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

    expect(validation).toEqual({
      status: 422,
      body: {
        status: 422,
        type: "validation_error",
        detail: "Validation error",
        errors: [
          {
            field: "username",
            reason: "invalid_format",
          },
        ],
      },
    });
    expect(unauthorized).toEqual({
      status: 401,
      body: {
        detail: "Could not validate credentials",
      },
    });
    expect(conflict).toEqual({
      status: 409,
      body: {
        status: 409,
        type: "conflict_error",
        detail: "Username already registered",
      },
    });
    expect(notFound).toEqual({
      status: 404,
      body: {
        detail: "Not found",
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
    expect(() =>
      toAuthHttpError({
        type: "Unknown",
        detail: "unknown",
      } as never),
    ).toThrowError(/Not exhaustive/);
  });
});
