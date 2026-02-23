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

  it("JWT有効期限設定が不正でもアプリ生成できる", async () => {
    const originalValue = process.env.JWT_ACCESS_TOKEN_EXPIRE_MINUTES;
    process.env.JWT_ACCESS_TOKEN_EXPIRE_MINUTES = "invalid";

    try {
      const app = createApp();
      const response = await app.request("/health");
      expect(response.status).toBe(200);
    } finally {
      if (originalValue == null) {
        delete process.env.JWT_ACCESS_TOKEN_EXPIRE_MINUTES;
      } else {
        process.env.JWT_ACCESS_TOKEN_EXPIRE_MINUTES = originalValue;
      }
    }
  });

  it("JWT有効期限設定が正の整数ならその値でアプリ生成できる", async () => {
    const originalValue = process.env.JWT_ACCESS_TOKEN_EXPIRE_MINUTES;
    process.env.JWT_ACCESS_TOKEN_EXPIRE_MINUTES = "60";

    try {
      const app = createApp();
      const response = await app.request("/health");
      expect(response.status).toBe(200);
    } finally {
      if (originalValue == null) {
        delete process.env.JWT_ACCESS_TOKEN_EXPIRE_MINUTES;
      } else {
        process.env.JWT_ACCESS_TOKEN_EXPIRE_MINUTES = originalValue;
      }
    }
  });

  it("SECRET_KEYのみ設定時でもアプリ生成できる", async () => {
    const originalJwtSecret = process.env.JWT_SECRET_KEY;
    const originalSecret = process.env.SECRET_KEY;
    delete process.env.JWT_SECRET_KEY;
    process.env.SECRET_KEY = "legacy-secret-key";

    try {
      const app = createApp();
      const response = await app.request("/health");
      expect(response.status).toBe(200);
    } finally {
      if (originalJwtSecret == null) {
        delete process.env.JWT_SECRET_KEY;
      } else {
        process.env.JWT_SECRET_KEY = originalJwtSecret;
      }
      if (originalSecret == null) {
        delete process.env.SECRET_KEY;
      } else {
        process.env.SECRET_KEY = originalSecret;
      }
    }
  });
});
