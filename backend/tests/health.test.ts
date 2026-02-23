import { describe, expect, it } from "vitest";

import { createApp } from "../src/app";

describe("health check", () => {
  it("GET /health で稼働状態を返す", async () => {
    const app = createApp();

    const response = await app.request("/health");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "ok" });
  });
});
