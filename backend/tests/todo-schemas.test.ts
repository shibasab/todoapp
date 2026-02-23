import { describe, expect, it } from "vitest";
import { listTodoQuerySchema } from "../src/http/todo/schemas";

describe("todo schemas", () => {
  it("listTodoQuerySchema は camelCase のクエリを受け入れる", () => {
    const parsed = listTodoQuerySchema.safeParse({
      keyword: "task",
      progressStatus: "completed",
      dueDate: "today",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual({
        keyword: "task",
        progressStatus: "completed",
        dueDate: "today",
      });
    }
  });

  it("listTodoQuerySchema は snake_case のクエリを拒否する", () => {
    const parsed = listTodoQuerySchema.safeParse({
      keyword: "task",
      progress_status: "completed",
      due_date: "today",
    });

    expect(parsed.success).toBe(false);
  });
});
