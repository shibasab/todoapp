import { describe, expect, expectTypeOf, it } from "vitest";

import type {
  ApiEndpoint,
  ApiError,
  ApiQuery,
  ApiRequest,
  ApiResponse,
} from "../src/contracts/api";
import {
  type CreateTodoRequest,
  type DetailErrorResponse,
  type ListTodoQuery,
  type Todo,
  type UpdateTodoRequest,
  type ValidationErrorResponse,
  todoPath,
} from "../src";

describe("API contract", () => {
  it("todoPathでTODO詳細URLを生成できる", () => {
    expect(todoPath(42)).toBe("/todo/42/");
  });

  it("POST /todo/ の入出力契約を取得できる", () => {
    expectTypeOf<ApiRequest<"post", "/todo/">>().toEqualTypeOf<CreateTodoRequest>();
    expectTypeOf<ApiResponse<"post", "/todo/">>().toEqualTypeOf<Todo>();
    expectTypeOf<ApiError<"post", "/todo/">>().toEqualTypeOf<ValidationErrorResponse>();
  });

  it("PUT /todo/:id/ の入出力契約を取得できる", () => {
    expectTypeOf<ApiEndpoint<"put">>().toEqualTypeOf<`/todo/${number}/`>();
    expectTypeOf<ApiRequest<"put", `/todo/${number}/`>>().toEqualTypeOf<UpdateTodoRequest>();
    expectTypeOf<ApiResponse<"put", `/todo/${number}/`>>().toEqualTypeOf<Todo>();
    expectTypeOf<ApiError<"put", `/todo/${number}/`>>().toEqualTypeOf<ValidationErrorResponse>();
  });

  it("GET /todo/ のクエリ契約を取得できる", () => {
    expectTypeOf<ApiQuery<"get", "/todo/">>().toEqualTypeOf<ListTodoQuery>();
    expectTypeOf<ApiResponse<"get", "/todo/">>().toEqualTypeOf<readonly Todo[]>();
  });

  it("POST /auth/logout のレスポンス契約を取得できる", () => {
    expectTypeOf<ApiResponse<"post", "/auth/logout">>().toEqualTypeOf<DetailErrorResponse>();
  });
});
