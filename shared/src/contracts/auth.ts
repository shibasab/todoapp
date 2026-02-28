import { z } from "zod";

const optionalEmailSchema = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => value ?? "");

export const LoginRequestSchema = z
  .object({
    username: z.string().trim().min(1),
    password: z.string().trim().min(1),
  })
  .readonly();

export const RegisterRequestSchema = z
  .object({
    username: z.string().trim().min(1),
    password: z.string().trim().min(1),
    email: optionalEmailSchema,
  })
  .readonly();

export const UserSchema = z
  .object({
    id: z.number().int().positive(),
    username: z.string(),
    email: z.string(),
  })
  .readonly();

export const AuthResponseSchema = z
  .object({
    user: UserSchema,
    token: z.string(),
  })
  .readonly();

export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type User = z.infer<typeof UserSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
