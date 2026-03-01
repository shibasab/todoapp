import type { AuthResponse, LoginRequest, RegisterRequest, User } from "./auth";
import type { DetailErrorResponse, ValidationErrorResponse } from "./response";
import type { CreateTodoRequest, ListTodoQuery, Todo, UpdateTodoRequest } from "./todo";

export type TodoPath = `/todo/${number}/`;

const buildTodoPath = (todoId: number): TodoPath => `/todo/${todoId}/`;

export const todoPath = (todoId: number): TodoPath => buildTodoPath(todoId);

type TodoPathContracts<TContract extends object> = {
  [path in TodoPath]: TContract;
};

export type ApiContracts = {
  get: {
    "/todo/": { query: ListTodoQuery; response: readonly Todo[] };
    "/auth/user": { response: User };
  } & TodoPathContracts<{ response: Todo }>;
  post: {
    "/todo/": {
      request: CreateTodoRequest;
      response: Todo;
      error: ValidationErrorResponse;
    };
    "/auth/login": {
      request: LoginRequest;
      response: AuthResponse;
      error: ValidationErrorResponse;
    };
    "/auth/register": {
      request: RegisterRequest;
      response: AuthResponse;
      error: ValidationErrorResponse;
    };
    "/auth/logout": { response: DetailErrorResponse };
  };
  put: TodoPathContracts<{
    request: UpdateTodoRequest;
    response: Todo;
    error: ValidationErrorResponse;
  }>;
  delete: TodoPathContracts<{ response: void }>;
};

export type ApiMethod = keyof ApiContracts;

export type ApiEndpoint<M extends ApiMethod> = keyof ApiContracts[M];

type EndpointContract<M extends ApiMethod, E extends ApiEndpoint<M>> = ApiContracts[M][E];

export type ApiResponse<M extends ApiMethod, E extends ApiEndpoint<M>> =
  EndpointContract<M, E> extends {
    response: infer TResponse;
  }
    ? TResponse
    : never;

export type ApiQuery<M extends ApiMethod, E extends ApiEndpoint<M>> =
  EndpointContract<M, E> extends {
    query: infer TQuery;
  }
    ? TQuery
    : undefined;

export type ApiRequest<M extends ApiMethod, E extends ApiEndpoint<M>> =
  EndpointContract<M, E> extends {
    request: infer TRequest;
  }
    ? TRequest
    : undefined;

export type ApiError<M extends ApiMethod, E extends ApiEndpoint<M>> =
  EndpointContract<M, E> extends {
    error: infer TError;
  }
    ? TError
    : never;

export type GetEndpoint = ApiEndpoint<"get">;
export type PostEndpoint = ApiEndpoint<"post">;
export type PutEndpoint = ApiEndpoint<"put">;
export type DeleteEndpoint = ApiEndpoint<"delete">;
