import type { TodoRecurrenceType } from "./types";

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export class NotExhaustiveError extends Error {
  constructor(unexpectedValue: never, target: string) {
    super(`Not exhaustive: ${target} (${String(unexpectedValue)})`);
    this.name = "NotExhaustiveError";
  }
}

export const addOneMonth = (baseDate: Date): Date => {
  const year =
    baseDate.getUTCMonth() === 11 ? baseDate.getUTCFullYear() + 1 : baseDate.getUTCFullYear();
  const month = baseDate.getUTCMonth() === 11 ? 0 : baseDate.getUTCMonth() + 1;
  const day = baseDate.getUTCDate();
  const endOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  return new Date(Date.UTC(year, month, Math.min(day, endOfMonth)));
};

export const calculateNextDueDate = (recurrenceType: TodoRecurrenceType, baseDate: Date): Date => {
  switch (recurrenceType) {
    case "daily":
      return new Date(baseDate.getTime() + DAY_IN_MILLISECONDS);
    case "weekly":
      return new Date(baseDate.getTime() + 7 * DAY_IN_MILLISECONDS);
    case "monthly":
      return addOneMonth(baseDate);
    case "none":
      return baseDate;
    default: {
      const exhaustiveCheck: never = recurrenceType;
      throw new NotExhaustiveError(exhaustiveCheck, "recurrenceType");
    }
  }
};
