import type {
  ConflictErrorResponse,
  DetailErrorResponse,
  ValidationErrorResponse,
  ValidationIssue,
} from "@todoapp/shared";
import { assertNever } from "../../shared/error";
import type { AuthUseCaseError } from "../../usecases/auth/errors";

export type HttpError =
  | Readonly<{
      status: 422;
      body: ValidationErrorResponse;
    }>
  | Readonly<{
      status: 409;
      body: ConflictErrorResponse;
    }>
  | Readonly<{
      status: 401 | 404 | 500;
      body: DetailErrorResponse;
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
          errors: errorValue.errors.map(
            (error): ValidationIssue => ({
              field: error.field,
              reason: error.reason,
            }),
          ),
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
          status: 409,
          type: "conflict_error",
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
