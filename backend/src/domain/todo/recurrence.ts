import type { TodoRecurrenceType } from "./types";

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export const addOneMonth = (baseDate: Date): Date => {
  const year =
    baseDate.getUTCMonth() === 11 ? baseDate.getUTCFullYear() + 1 : baseDate.getUTCFullYear();
  const month = baseDate.getUTCMonth() === 11 ? 0 : baseDate.getUTCMonth() + 1;
  const day = baseDate.getUTCDate();
  const endOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  return new Date(Date.UTC(year, month, Math.min(day, endOfMonth)));
};

export const calculateNextDueDate = (recurrenceType: TodoRecurrenceType, baseDate: Date): Date => {
  if (recurrenceType === "daily") {
    return new Date(baseDate.getTime() + DAY_IN_MILLISECONDS);
  }

  if (recurrenceType === "weekly") {
    return new Date(baseDate.getTime() + 7 * DAY_IN_MILLISECONDS);
  }

  if (recurrenceType === "monthly") {
    return addOneMonth(baseDate);
  }

  return baseDate;
};
