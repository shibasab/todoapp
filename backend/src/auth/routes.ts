import type { PrismaClient } from "@prisma/client";
import { err, ok, type Result } from "@todoapp/shared";
import { Hono } from "hono";
import { assertNever } from "../shared/error";
import { createAuthService, type AuthServiceError } from "./service";
import type { AuthConfig, LoginInput, RegisterInput } from "./types";

export type AuthRouteDependencies = Readonly<{
  prisma: PrismaClient;
  authConfig: AuthConfig;
  authServiceOverride?: ReturnType<typeof createAuthService>;
}>;

const parseRecord = (value: unknown): Result<Readonly<Record<string, unknown>>, "invalid_body"> => {
  if (typeof value !== "object" || value == null || Array.isArray(value)) {
    return err("invalid_body");
  }

  const parsed: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    parsed[key] = entry;
  }
  return ok(parsed);
};

const parseNonEmptyString = (value: unknown): Result<string, "invalid_body"> =>
  typeof value === "string" && value.trim() !== "" ? ok(value.trim()) : err("invalid_body");

const parseRegisterInput = (body: unknown): Result<RegisterInput, "invalid_body"> => {
  const record = parseRecord(body);
  if (!record.ok) {
    return record;
  }

  const username = parseNonEmptyString(record.data.username);
  const password = parseNonEmptyString(record.data.password);
  const emailValue = record.data.email;
  if (!username.ok || !password.ok || (typeof emailValue !== "string" && emailValue != null)) {
    return err("invalid_body");
  }

  return ok({
    username: username.data,
    password: password.data,
    email: emailValue ?? "",
  });
};

const parseLoginInput = (body: unknown): Result<LoginInput, "invalid_body"> => {
  const record = parseRecord(body);
  if (!record.ok) {
    return record;
  }

  const username = parseNonEmptyString(record.data.username);
  const password = parseNonEmptyString(record.data.password);
  if (!username.ok || !password.ok) {
    return err("invalid_body");
  }

  return ok({
    username: username.data,
    password: password.data,
  });
};

const readBearerToken = (
  authorizationHeader: string | undefined,
): Result<string, "unauthorized"> => {
  if (authorizationHeader == null || authorizationHeader === "") {
    return err("unauthorized");
  }

  if (!authorizationHeader.startsWith("Bearer ")) {
    return err("unauthorized");
  }

  const token = authorizationHeader.slice("Bearer ".length).trim();
  return token === "" ? err("unauthorized") : ok(token);
};

const readJsonBody = async (
  context: Readonly<{
    req: Readonly<{
      json: () => Promise<unknown>;
    }>;
  }>,
): Promise<Result<unknown, "invalid_body">> => {
  try {
    return ok(await context.req.json());
  } catch {
    return err("invalid_body");
  }
};

export const createAuthRoutes = (dependencies: AuthRouteDependencies): Hono => {
  const router = new Hono();
  const authService =
    dependencies.authServiceOverride ??
    createAuthService(dependencies.prisma, dependencies.authConfig);

  const toRegisterErrorResponse = (
    errorValue: AuthServiceError,
  ): Readonly<{ status: 400 | 500; body: Readonly<{ detail: string }> }> => {
    switch (errorValue.type) {
      case "InternalError":
        return {
          status: 500,
          body: {
            detail: "Internal server error",
          },
        };
      case "DuplicateUsername":
      case "InvalidCredentials":
      case "Unauthorized":
        return {
          status: 400,
          body: {
            detail: errorValue.detail,
          },
        };
      default:
        return assertNever(errorValue, "AuthServiceError.type");
    }
  };

  router.post("/register", async (context) => {
    const rawBody = await readJsonBody(context);
    if (!rawBody.ok) {
      return context.json(
        {
          detail: "Validation error",
        },
        422,
      );
    }

    const parsedBody = parseRegisterInput(rawBody.data);
    if (!parsedBody.ok) {
      return context.json(
        {
          detail: "Validation error",
        },
        422,
      );
    }

    const registered = await authService.register(parsedBody.data);
    if (!registered.ok) {
      const errorResponse = toRegisterErrorResponse(registered.error);
      return context.json(errorResponse.body, errorResponse.status);
    }

    return context.json(registered.data);
  });

  router.post("/login", async (context) => {
    const rawBody = await readJsonBody(context);
    if (!rawBody.ok) {
      return context.json(
        {
          detail: "Validation error",
        },
        422,
      );
    }

    const parsedBody = parseLoginInput(rawBody.data);
    if (!parsedBody.ok) {
      return context.json(
        {
          detail: "Validation error",
        },
        422,
      );
    }

    const loginResult = await authService.login(parsedBody.data);
    if (!loginResult.ok) {
      return context.json({ detail: loginResult.error.detail }, 400);
    }

    return context.json(loginResult.data);
  });

  router.post("/logout", async (context) => {
    const token = readBearerToken(context.req.header("Authorization"));
    if (!token.ok) {
      return context.json({ detail: "Could not validate credentials" }, 401);
    }

    const authenticated = await authService.authenticate(token.data);
    if (!authenticated.ok) {
      return context.json({ detail: "Could not validate credentials" }, 401);
    }

    return context.json({ detail: "Successfully logged out" });
  });

  router.get("/user", async (context) => {
    const token = readBearerToken(context.req.header("Authorization"));
    if (!token.ok) {
      return context.json({ detail: "Could not validate credentials" }, 401);
    }

    const authenticated = await authService.authenticate(token.data);
    if (!authenticated.ok) {
      return context.json({ detail: "Could not validate credentials" }, 401);
    }

    return context.json(authenticated.data);
  });

  return router;
};
