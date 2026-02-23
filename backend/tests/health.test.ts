import { describe, expect, it } from "vitest";

import { HealthResponseSchema } from "@todoapp/shared";
import { createApp } from "../src/app";

describe("health check", () => {
  it("GET /health で稼働状態を返す", async () => {
    const app = createApp();

    const response = await app.request("/health");
    const body = await response.json();
    const parsed = HealthResponseSchema.safeParse(body);

    expect(response.status).toBe(200);
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      throw new Error(parsed.error.message);
    }
    expect(parsed.data).toEqual({ status: "ok" });
  });
});
