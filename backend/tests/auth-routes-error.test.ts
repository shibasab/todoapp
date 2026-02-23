import type { PrismaClient } from "@prisma/client";
import { err } from "@todoapp/shared";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import type { AuthService } from "../src/auth/service";
import { createAuthRoutes } from "../src/auth/routes";

type ErrorBody = Readonly<{
  detail: string;
}>;

const readJson = async <T>(response: Response): Promise<T> => (await response.json()) as T;

const createAuthServiceStub = (
  registerError:
    | Readonly<{ type: "InternalError"; detail: string }>
    | Readonly<{ type: "DuplicateUsername"; detail: string }>
    | Readonly<{ type: "Unauthorized"; detail: string }> = {
    type: "InternalError",
    detail: "Internal server error",
  },
): AuthService => ({
  register: async () => err(registerError),
  login: async () =>
    err({
      type: "InvalidCredentials",
      detail: "Incorrect Credentials",
    }),
  authenticate: async () =>
    err({
      type: "Unauthorized",
      detail: "Could not validate credentials",
    }),
});

describe("auth routes internal error handling", () => {
  it("POST /api/auth/register はInternalErrorを500へ変換する", async () => {
    const app = new Hono();
    app.route(
      "/api/auth",
      createAuthRoutes({
        prisma: {} as PrismaClient,
        authConfig: {
          jwtSecret: "route-test-secret",
          jwtAccessTokenExpireMinutes: 30,
        },
        authServiceOverride: createAuthServiceStub(),
      }),
    );

    const response = await app.request("http://localhost/api/auth/register", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username: "user",
        email: "user@example.com",
        password: "password",
      }),
    });
    const body = await readJson<ErrorBody>(response);

    expect(response.status).toBe(500);
    expect(body).toEqual({
      detail: "Internal server error",
    });
  });

  it("POST /api/auth/register はDuplicateUsernameを400へ変換する", async () => {
    const app = new Hono();
    app.route(
      "/api/auth",
      createAuthRoutes({
        prisma: {} as PrismaClient,
        authConfig: {
          jwtSecret: "route-test-secret",
          jwtAccessTokenExpireMinutes: 30,
        },
        authServiceOverride: createAuthServiceStub({
          type: "DuplicateUsername",
          detail: "Username already registered",
        }),
      }),
    );

    const response = await app.request("http://localhost/api/auth/register", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username: "user",
        email: "user@example.com",
        password: "password",
      }),
    });
    const body = await readJson<ErrorBody>(response);

    expect(response.status).toBe(400);
    expect(body).toEqual({
      detail: "Username already registered",
    });
  });

  it("POST /api/auth/register はUnauthorizedを400へ変換する", async () => {
    const app = new Hono();
    app.route(
      "/api/auth",
      createAuthRoutes({
        prisma: {} as PrismaClient,
        authConfig: {
          jwtSecret: "route-test-secret",
          jwtAccessTokenExpireMinutes: 30,
        },
        authServiceOverride: createAuthServiceStub({
          type: "Unauthorized",
          detail: "Could not validate credentials",
        }),
      }),
    );

    const response = await app.request("http://localhost/api/auth/register", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username: "user",
        email: "user@example.com",
        password: "password",
      }),
    });
    const body = await readJson<ErrorBody>(response);

    expect(response.status).toBe(400);
    expect(body).toEqual({
      detail: "Could not validate credentials",
    });
  });
});
