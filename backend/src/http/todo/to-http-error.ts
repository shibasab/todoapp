import type {
  DetailErrorResponse,
  ValidationErrorResponse,
  ValidationIssue,
} from "@todoapp/shared";
import { assertNever } from "../../shared/error";
import type { TodoUseCaseError } from "../../usecases/todo/errors";

export type HttpError =
  | Readonly<{
      status: 422;
      body: ValidationErrorResponse;
    }>
  | Readonly<{
      status: 401 | 404 | 409 | 500;
      body: DetailErrorResponse;
    }>;

export const toTodoHttpError = (errorValue: TodoUseCaseError): HttpError => {
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
    case "NotFound":
      return {
        status: 404,
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
    case "InternalError":
      return {
        status: 500,
        body: {
          detail: errorValue.detail,
        },
      };
    default:
      return assertNever(errorValue, "TodoUseCaseError.type");
  }
};
