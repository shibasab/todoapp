import { z } from "zod";

export const todoIdParamSchema = z.object({
  todoId: z.coerce.number().int().positive(),
});

const optionalDateString = z
  .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()])
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

export const listTodoQuerySchema = z.object({
  keyword: z.string().optional(),
  progress_status: z.enum(["not_started", "in_progress", "completed"]).optional(),
  due_date: z.enum(["all", "today", "this_week", "overdue", "none"]).optional(),
});
