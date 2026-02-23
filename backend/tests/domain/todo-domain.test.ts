import { describe, expect, it } from "vitest";
import { calculateNextDueDate } from "../../src/domain/todo/recurrence";
import {
  isTodoProgressStatus,
  isTodoRecurrenceType,
  toTodoProgressStatus,
  toTodoRecurrenceType,
} from "../../src/domain/todo/normalization";

describe("todo domain functions", () => {
  it("unknown progress statusはnot_startedへ正規化する", () => {
    expect(toTodoProgressStatus("in_progress")).toBe("in_progress");
    expect(toTodoProgressStatus("unknown")).toBe("not_started");
    expect(isTodoProgressStatus("completed")).toBe(true);
    expect(isTodoProgressStatus("done")).toBe(false);
  });

  it("unknown recurrence typeはnoneへ正規化する", () => {
    expect(toTodoRecurrenceType("monthly")).toBe("monthly");
    expect(toTodoRecurrenceType("yearly")).toBe("none");
    expect(isTodoRecurrenceType("weekly")).toBe(true);
    expect(isTodoRecurrenceType("yearly")).toBe(false);
  });

  it("monthlyの次回日付は月末を丸めて算出する", () => {
    const baseDate = new Date("2024-01-31T00:00:00.000Z");
    const next = calculateNextDueDate("monthly", baseDate);

    expect(next.toISOString()).toBe("2024-02-29T00:00:00.000Z");
  });

  it("daily/weekly/noneの次回日付を算出する", () => {
    const baseDate = new Date("2025-02-10T00:00:00.000Z");

    expect(calculateNextDueDate("daily", baseDate).toISOString()).toBe("2025-02-11T00:00:00.000Z");
    expect(calculateNextDueDate("weekly", baseDate).toISOString()).toBe("2025-02-17T00:00:00.000Z");
    expect(calculateNextDueDate("none", baseDate).toISOString()).toBe("2025-02-10T00:00:00.000Z");
  });
});
