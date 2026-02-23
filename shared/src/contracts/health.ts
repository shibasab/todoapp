import { z } from "zod";

export const HealthResponseSchema = z
  .object({
    status: z.literal("ok"),
  })
  .readonly();

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
