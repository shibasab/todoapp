import { z } from "zod";

export const TodoRecurrenceTypeSchema = z.enum(["none", "daily", "weekly", "monthly"]);
export const TodoProgressStatusSchema = z.enum(["not_started", "in_progress", "completed"]);

const TodoBaseSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  detail: z.string(),
  dueDate: z.string().nullable(),
  progressStatus: TodoProgressStatusSchema,
  recurrenceType: TodoRecurrenceTypeSchema,
});

export const TodoSchema = TodoBaseSchema.readonly();
export const CreateTodoRequestSchema = TodoBaseSchema.omit({ id: true }).readonly();
export const UpdateTodoRequestSchema = TodoBaseSchema.omit({ id: true }).readonly();

export const TodoStatusFilterSchema = z.union([z.literal("all"), TodoProgressStatusSchema]);
export const TodoDueDateFilterSchema = z.enum(["all", "today", "this_week", "overdue", "none"]);

export const TodoSearchParamStatusSchema = z.enum(["not_started", "in_progress", "completed"]);
export const TodoSearchParamDueDateSchema = z.enum(["today", "this_week", "overdue", "none"]);

export const TodoSearchQuerySchema = z
  .object({
    keyword: z.string().optional(),
    progress_status: TodoSearchParamStatusSchema.optional(),
    due_date: TodoSearchParamDueDateSchema.optional(),
  })
  .readonly();

export type TodoRecurrenceType = z.infer<typeof TodoRecurrenceTypeSchema>;
export type TodoProgressStatus = z.infer<typeof TodoProgressStatusSchema>;
export type Todo = z.infer<typeof TodoSchema>;
export type CreateTodoRequest = z.infer<typeof CreateTodoRequestSchema>;
export type UpdateTodoRequest = z.infer<typeof UpdateTodoRequestSchema>;
export type TodoStatusFilter = z.infer<typeof TodoStatusFilterSchema>;
export type TodoDueDateFilter = z.infer<typeof TodoDueDateFilterSchema>;
export type TodoSearchParamStatus = z.infer<typeof TodoSearchParamStatusSchema>;
export type TodoSearchParamDueDate = z.infer<typeof TodoSearchParamDueDateSchema>;
export type TodoSearchQuery = z.infer<typeof TodoSearchQuerySchema>;
