import { describe, expect, it } from "vitest";
import { toTodoDto, toTodoListDto } from "../../src/http/todo/mappers";

describe("todo mappers", () => {
  it("toTodoDto は Date を shared Todo DTO 形式へ変換する", () => {
    expect(
      toTodoDto({
        id: 1,
        name: "task",
        detail: "detail",
        dueDate: new Date("2026-01-15T00:00:00.000Z"),
        createdAt: new Date("2026-01-01T09:30:45.000Z"),
        progressStatus: "in_progress",
        recurrenceType: "weekly",
        parentId: null,
        completedSubtaskCount: 1,
        totalSubtaskCount: 2,
        subtaskProgressPercent: 50,
      }),
    ).toEqual({
      id: 1,
      name: "task",
      detail: "detail",
      dueDate: "2026-01-15",
      createdAt: "2026-01-01T09:30:45.000Z",
      progressStatus: "in_progress",
      recurrenceType: "weekly",
      parentId: null,
      completedSubtaskCount: 1,
      totalSubtaskCount: 2,
      subtaskProgressPercent: 50,
    });
  });

  it("toTodoListDto は optional/null を維持する", () => {
    expect(
      toTodoListDto([
        {
          id: 2,
          name: "n1",
          detail: "",
          dueDate: null,
          createdAt: "2026-02-01T00:00:00.000Z",
          progressStatus: "not_started",
          recurrenceType: "none",
          parentId: 1,
          completedSubtaskCount: 0,
          totalSubtaskCount: 0,
          subtaskProgressPercent: 0,
        },
      ]),
    ).toEqual([
      {
        id: 2,
        name: "n1",
        detail: "",
        dueDate: null,
        createdAt: "2026-02-01T00:00:00.000Z",
        progressStatus: "not_started",
        recurrenceType: "none",
        parentId: 1,
        completedSubtaskCount: 0,
        totalSubtaskCount: 0,
        subtaskProgressPercent: 0,
      },
    ]);
  });
});
