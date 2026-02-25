import type { PrismaClient } from "@prisma/client";
import { err } from "@todoapp/shared";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { createAuthRoutes } from "../src/http/auth/routes";
import type { AuthUseCaseError } from "../src/usecases/auth/errors";
import type { AuthUseCases } from "../src/usecases/auth/types";

type ErrorBody = Readonly<{
  detail: string;
}>;

const readJson = async <T>(response: Response): Promise<T> => (await response.json()) as T;

const createAuthUseCasesStub = (
  registerError: AuthUseCaseError = {
    type: "InternalError",
    detail: "Internal server error",
  },
): AuthUseCases => ({
  register: async () => err(registerError),
  login: async () =>
    err({
      type: "Unauthorized",
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
        authUseCasesOverride: createAuthUseCasesStub(),
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

  it("POST /api/auth/register はConflictを409へ変換する", async () => {
    const app = new Hono();
    app.route(
      "/api/auth",
      createAuthRoutes({
        prisma: {} as PrismaClient,
        authConfig: {
          jwtSecret: "route-test-secret",
          jwtAccessTokenExpireMinutes: 30,
        },
        authUseCasesOverride: createAuthUseCasesStub({
          type: "Conflict",
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

    expect(response.status).toBe(409);
    expect(body).toEqual({
      detail: "Username already registered",
    });
  });

  it("POST /api/auth/register はUnauthorizedを401へ変換する", async () => {
    const app = new Hono();
    app.route(
      "/api/auth",
      createAuthRoutes({
        prisma: {} as PrismaClient,
        authConfig: {
          jwtSecret: "route-test-secret",
          jwtAccessTokenExpireMinutes: 30,
        },
        authUseCasesOverride: createAuthUseCasesStub({
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

    expect(response.status).toBe(401);
    expect(body).toEqual({
      detail: "Could not validate credentials",
    });
  });
});
