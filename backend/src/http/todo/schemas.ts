import { z } from "zod";
import {
  CreateTodoRequestSchema,
  ListTodoQuerySchema,
  UpdateTodoRequestSchema,
} from "@todoapp/shared";

export const todoIdParamSchema = z.object({
  todoId: z.coerce.number().int().positive(),
});

export const createTodoBodySchema = CreateTodoRequestSchema;
export const updateTodoBodySchema = UpdateTodoRequestSchema;
export const listTodoQuerySchema = ListTodoQuerySchema;
