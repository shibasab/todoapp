import { z } from "zod";

export {
  CreateTodoRequestSchema as createTodoBodySchema,
  ListTodoQuerySchema as listTodoQuerySchema,
  UpdateTodoRequestSchema as updateTodoBodySchema,
} from "@todoapp/shared";

export const todoIdParamSchema = z.object({
  todoId: z.coerce.number().int().positive(),
});
