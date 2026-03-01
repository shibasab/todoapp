import { describe, expect, it } from "vitest";
import { ListTodoQuerySchema, TodoSchema } from "../src/contracts/todo";

describe("todo contract schema", () => {
  it("TodoSchema は parentTitle を必須で受け取る", () => {
    const parsed = TodoSchema.safeParse({
      id: 1,
      name: "task",
      detail: "",
      dueDate: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      progressStatus: "not_started",
      recurrenceType: "none",
      parentId: null,
      parentTitle: null,
      completedSubtaskCount: 0,
      totalSubtaskCount: 0,
      subtaskProgressPercent: 0,
    });
    expect(parsed.success).toBe(true);
  });

  it("ListTodoQuerySchema は parentId を受け取れる", () => {
    const parsed = ListTodoQuerySchema.safeParse({
      keyword: "test",
      parentId: "10",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.parentId).toBe(10);
    }
  });
});
