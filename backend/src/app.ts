import { Hono } from "hono";
import type { HealthResponse } from "@todoapp/shared";
import type { PrismaClient } from "@prisma/client";
import { createAuthRoutes } from "./auth/routes";
import type { AuthConfig } from "./auth/types";
import { createPrismaClient, resolveDatabaseUrl } from "./infra/prisma/client";
import { createTodoRoutes } from "./todo/routes";

const buildHealthResponse = (): HealthResponse => ({
  status: "ok",
});

type RuntimeEnv = Readonly<Record<string, string | undefined>>;

export type AppDependencies = Readonly<{
  prisma: PrismaClient;
  authConfig: AuthConfig;
}>;

const readRuntimeEnv = (): RuntimeEnv => {
  const bunEnv = (globalThis as { Bun?: { env: RuntimeEnv } }).Bun?.env;
  return bunEnv ?? process.env;
};

const readJwtAccessTokenExpireMinutes = (rawValue: string | undefined): number => {
  if (rawValue == null || rawValue === "") {
    return 30;
  }

  const parsed = Number(rawValue);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 30;
};

const createDefaultDependencies = (): AppDependencies => {
  const runtimeEnv = readRuntimeEnv();
  return {
    prisma: createPrismaClient(resolveDatabaseUrl(runtimeEnv.DATABASE_URL)),
    authConfig: {
      jwtSecret: runtimeEnv.JWT_SECRET_KEY ?? runtimeEnv.SECRET_KEY ?? "development-secret-key",
      jwtAccessTokenExpireMinutes: readJwtAccessTokenExpireMinutes(
        runtimeEnv.JWT_ACCESS_TOKEN_EXPIRE_MINUTES,
      ),
    },
  };
};

export const createApp = (dependencies: AppDependencies = createDefaultDependencies()): Hono => {
  const app = new Hono({ strict: false });

  app.get("/health", (context) => {
    return context.json(buildHealthResponse());
  });

  app.route("/api/auth", createAuthRoutes(dependencies));
  app.route("/api/todo", createTodoRoutes(dependencies));

  return app;
};
