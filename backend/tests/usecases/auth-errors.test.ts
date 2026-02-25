import { describe, expect, it } from "vitest";
import {
  toAuthConflictError,
  toAuthInternalError,
  toAuthInvalidCredentialsError,
  toAuthNotFoundError,
  toAuthUnauthorizedError,
  toAuthValidationError,
} from "../../src/usecases/auth/errors";

describe("auth usecase errors", () => {
  it("toXxxErrorは既定のdetailを返す", () => {
    expect(toAuthUnauthorizedError()).toEqual({
      type: "Unauthorized",
      detail: "Could not validate credentials",
    });
    expect(toAuthInvalidCredentialsError()).toEqual({
      type: "Unauthorized",
      detail: "Incorrect Credentials",
    });
    expect(toAuthNotFoundError()).toEqual({
      type: "NotFound",
      detail: "Not found",
    });
    expect(toAuthInternalError()).toEqual({
      type: "InternalError",
      detail: "Internal server error",
    });
  });

  it("toXxxErrorは明示detailを反映し、ValidationErrorにerrorsを保持する", () => {
    const validation = toAuthValidationError(
      [
        {
          field: "username",
          reason: "required",
        },
      ],
      "Bad request",
    );

    expect(validation).toEqual({
      type: "ValidationError",
      detail: "Bad request",
      errors: [
        {
          field: "username",
          reason: "required",
        },
      ],
    });
    expect(toAuthConflictError("already used")).toEqual({
      type: "Conflict",
      detail: "already used",
    });
    expect(toAuthUnauthorizedError("token invalid")).toEqual({
      type: "Unauthorized",
      detail: "token invalid",
    });
    expect(toAuthInvalidCredentialsError("wrong pair")).toEqual({
      type: "Unauthorized",
      detail: "wrong pair",
    });
    expect(toAuthNotFoundError("missing")).toEqual({
      type: "NotFound",
      detail: "missing",
    });
    expect(toAuthInternalError("internal")).toEqual({
      type: "InternalError",
      detail: "internal",
    });
  });
});
