import { z } from "zod";

const optionalEmailSchema = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => value ?? "");

export const registerBodySchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().trim().min(1),
  email: optionalEmailSchema,
});

export const loginBodySchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().trim().min(1),
});
