import { assertNever } from "../../shared/error";
import type { AuthUseCaseError } from "../../usecases/auth/errors";

export type HttpError = Readonly<{
  status: number;
  body: Readonly<Record<string, unknown>>;
}>;

export const toAuthHttpError = (errorValue: AuthUseCaseError): HttpError => {
  switch (errorValue.type) {
    case "ValidationError":
      return {
        status: 422,
        body: {
          status: 422,
          type: "validation_error",
          detail: errorValue.detail,
          errors: errorValue.errors,
        },
      };
    case "Unauthorized":
      return {
        status: 401,
        body: {
          detail: errorValue.detail,
        },
      };
    case "Conflict":
      return {
        status: 409,
        body: {
          detail: errorValue.detail,
        },
      };
    case "NotFound":
      return {
        status: 404,
        body: {
          detail: errorValue.detail,
        },
      };
    case "InternalError":
      return {
        status: 500,
        body: {
          detail: errorValue.detail,
        },
      };
    default:
      return assertNever(errorValue, "AuthUseCaseError.type");
  }
};
