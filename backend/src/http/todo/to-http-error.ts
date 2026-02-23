import type { TodoUseCaseError } from "../../usecases/todo/errors";

export type HttpError = Readonly<{
  status: number;
  body: Readonly<Record<string, unknown>>;
}>;

export const toTodoHttpError = (errorValue: TodoUseCaseError): HttpError => {
  if (errorValue.type === "ValidationError") {
    return {
      status: 422,
      body: {
        status: 422,
        type: "validation_error",
        detail: errorValue.detail,
        errors: errorValue.errors,
      },
    };
  }

  if (errorValue.type === "Unauthorized") {
    return {
      status: 401,
      body: {
        detail: errorValue.detail,
      },
    };
  }

  if (errorValue.type === "NotFound") {
    return {
      status: 404,
      body: {
        detail: errorValue.detail,
      },
    };
  }

  if (errorValue.type === "Conflict") {
    return {
      status: 409,
      body: {
        detail: errorValue.detail,
      },
    };
  }

  return {
    status: 500,
    body: {
      detail: errorValue.detail,
    },
  };
};
