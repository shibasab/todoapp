import { z } from "zod";

export const todoProgressStatuses = ["not_started", "in_progress", "completed"] as const;
export const todoRecurrenceTypes = ["none", "daily", "weekly", "monthly"] as const;
export const todoDueDateFilters = ["all", "today", "this_week", "overdue", "none"] as const;

const isValidDateOnly = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const dateValue = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(dateValue.getTime()) && dateValue.toISOString().slice(0, 10) === value;
};

const optionalDateStringSchema = z
  .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()])
  .refine((value) => value == null || isValidDateOnly(value), {
    message: "invalid_date",
  })
  .optional()
  .transform((value) => (value === undefined ? undefined : value));

export const TodoSchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string(),
    detail: z.string(),
    dueDate: z.string().nullable(),
    createdAt: z.string(),
    progressStatus: z.enum(todoProgressStatuses),
    recurrenceType: z.enum(todoRecurrenceTypes),
    parentId: z.number().int().positive().nullable(),
    parentTitle: z.string().nullable(),
    completedSubtaskCount: z.number().int().nonnegative(),
    totalSubtaskCount: z.number().int().nonnegative(),
    subtaskProgressPercent: z.number().int().min(0).max(100),
  })
  .readonly();

export const CreateTodoRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    detail: z.string().max(500).optional().default(""),
    dueDate: optionalDateStringSchema,
    progressStatus: z.enum(todoProgressStatuses).optional().default("not_started"),
    recurrenceType: z.enum(todoRecurrenceTypes).optional().default("none"),
    parentId: z.number().int().positive().nullable().optional().default(null),
  })
  .readonly();

export const UpdateTodoRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    detail: z.string().max(500).nullable().optional(),
    dueDate: optionalDateStringSchema,
    progressStatus: z.enum(todoProgressStatuses).optional(),
    recurrenceType: z.enum(todoRecurrenceTypes).optional(),
  })
  .readonly();

export const ListTodoQuerySchema = z
  .object({
    keyword: z.string().optional(),
    progressStatus: z.enum(todoProgressStatuses).optional(),
    dueDate: z.enum(todoDueDateFilters).optional(),
    parentId: z.coerce.number().int().positive().optional(),
  })
  .strict()
  .readonly();

export type TodoProgressStatus = (typeof todoProgressStatuses)[number];
export type TodoRecurrenceType = (typeof todoRecurrenceTypes)[number];
export type TodoDueDateFilter = (typeof todoDueDateFilters)[number];

export type Todo = z.infer<typeof TodoSchema>;
export type CreateTodoRequest = z.infer<typeof CreateTodoRequestSchema>;
export type UpdateTodoRequest = z.infer<typeof UpdateTodoRequestSchema>;
export type ListTodoQuery = z.infer<typeof ListTodoQuerySchema>;
