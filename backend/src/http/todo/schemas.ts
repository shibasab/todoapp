import { z } from "zod";

export const todoIdParamSchema = z.object({
  todoId: z.coerce.number().int().positive(),
});

const isValidDateOnly = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const dateValue = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(dateValue.getTime()) && dateValue.toISOString().slice(0, 10) === value;
};

const optionalDateString = z
  .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()])
  .refine((value) => value == null || isValidDateOnly(value), {
    message: "invalid_date",
  })
  .optional()
  .transform((value) => (value === undefined ? undefined : value));

export const createTodoBodySchema = z.object({
  name: z.string().trim().min(1).max(100),
  detail: z.string().max(500).optional().default(""),
  dueDate: optionalDateString,
  progressStatus: z
    .enum(["not_started", "in_progress", "completed"])
    .optional()
    .default("not_started"),
  recurrenceType: z.enum(["none", "daily", "weekly", "monthly"]).optional().default("none"),
  parentId: z.number().int().positive().nullable().optional().default(null),
});

export const updateTodoBodySchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    detail: z.string().max(500).nullable().optional(),
    dueDate: optionalDateString,
    progressStatus: z.enum(["not_started", "in_progress", "completed"]).optional(),
    recurrenceType: z.enum(["none", "daily", "weekly", "monthly"]).optional(),
  })
  .strict();

export const listTodoQuerySchema = z
  .object({
    keyword: z.string().optional(),
    progressStatus: z.enum(["not_started", "in_progress", "completed"]).optional(),
    dueDate: z.enum(["all", "today", "this_week", "overdue", "none"]).optional(),
  })
  .strict();
