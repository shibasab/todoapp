import type {
  AuthResponse,
  CreateTodoRequest,
  ListTodoQuery,
  LoginRequest,
  RegisterRequest,
  Todo,
  UpdateTodoRequest,
  User,
  ValidationErrorResponse,
} from '@todoapp/shared'

export type ApiEndpoints = {
  get: {
    '/todo/': { query: ListTodoQuery; response: readonly Todo[] }
    '/auth/user': { response: User }
  }
  post: {
    '/todo/': { request: CreateTodoRequest; response: Todo; error: ValidationErrorResponse }
    '/auth/login': { request: LoginRequest; response: AuthResponse }
    '/auth/register': { request: RegisterRequest; response: AuthResponse }
    '/auth/logout': { response: void }
  }
  put: {
    '/todo/{id}/': { request: UpdateTodoRequest; response: Todo; error: ValidationErrorResponse }
  }
  delete: {
    '/todo/{id}/': { response: void }
  }
}

export type GetEndpoints = keyof ApiEndpoints['get']
export type PostEndpoints = keyof ApiEndpoints['post']
export type PutEndpoints = keyof ApiEndpoints['put']
export type DeleteEndpoints = keyof ApiEndpoints['delete']

export type ApiResponse<M extends keyof ApiEndpoints, E extends keyof ApiEndpoints[M]> = ApiEndpoints[M][E] extends {
  response: infer R
}
  ? R
  : never

export type ApiQuery<M extends keyof ApiEndpoints, E extends keyof ApiEndpoints[M]> = ApiEndpoints[M][E] extends {
  query: infer Q
}
  ? Q
  : undefined

export type ApiRequest<M extends keyof ApiEndpoints, E extends keyof ApiEndpoints[M]> = ApiEndpoints[M][E] extends {
  request: infer R
}
  ? R
  : undefined

export type ApiError<M extends keyof ApiEndpoints, E extends keyof ApiEndpoints[M]> = ApiEndpoints[M][E] extends {
  error: infer R
}
  ? R
  : never
