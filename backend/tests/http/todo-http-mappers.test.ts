import { describe, expect, it } from "vitest";
import { toTodoHttpError } from "../../src/http/todo/to-http-error";
import { createTodoBodySchema, updateTodoBodySchema } from "../../src/http/todo/schemas";

describe("todo http helpers", () => {
  it("toTodoHttpError は各エラー型をHTTPへ変換する", () => {
    expect(
      toTodoHttpError({
        type: "ValidationError",
        detail: "Validation error",
        errors: [{ field: "name", reason: "required" }],
      }),
    ).toEqual({
      status: 422,
      body: {
        status: 422,
        type: "validation_error",
        detail: "Validation error",
        errors: [{ field: "name", reason: "required" }],
      },
    });

    expect(toTodoHttpError({ type: "Unauthorized", detail: "unauthorized" }).status).toBe(401);
    expect(toTodoHttpError({ type: "NotFound", detail: "not found" }).status).toBe(404);
    expect(toTodoHttpError({ type: "Conflict", detail: "conflict" }).status).toBe(409);
    expect(toTodoHttpError({ type: "InternalError", detail: "internal" }).status).toBe(500);
  });

  it("zod schema は不正日付を弾く", () => {
    const createParsed = createTodoBodySchema.safeParse({
      name: "task",
      dueDate: "2025-02-30",
    });
    expect(createParsed.success).toBe(false);

    const updateParsed = updateTodoBodySchema.safeParse({
      dueDate: "2025-13-01",
    });
    expect(updateParsed.success).toBe(false);
  });
});
