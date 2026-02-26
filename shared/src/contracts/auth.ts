import { z } from "zod";

export const UserSchema = z
  .object({
    id: z.number().int(),
    username: z.string(),
    email: z.string(),
  })
  .readonly();

export const AuthSchema = z
  .object({
    user: UserSchema,
    token: z.string(),
  })
  .readonly();

export type User = z.infer<typeof UserSchema>;
export type Auth = z.infer<typeof AuthSchema>;
