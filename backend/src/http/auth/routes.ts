import type { PrismaClient } from "@prisma/client";
import { LoginRequestSchema, RegisterRequestSchema } from "@todoapp/shared";
import { Hono } from "hono";
import { toAuthInvalidFormatError } from "../../domain/auth/errors";
import type { AuthConfig } from "../../domain/auth/types";
import { bcryptPasswordPort } from "../../infra/auth/bcrypt-password-port";
import { jwtTokenPort } from "../../infra/auth/jwt-token-port";
import { createPrismaAuthUserRepoPort } from "../../infra/auth/prisma-auth-user-repo-port";
import { createAuthenticateUseCase } from "../../usecases/auth/authenticate";
import { toAuthValidationError, type AuthUseCaseError } from "../../usecases/auth/errors";
import { createLoginUseCase, createRegisterUseCase } from "../../usecases/auth/register-login";
import type { AuthUseCases } from "../../usecases/auth/types";
import { readJsonBody, readValidationField, type JsonResponder } from "../shared/request-utils";
import { toAuthHttpError } from "./to-http-error";

export type AuthHttpRouteDependencies = Readonly<{
  prisma: PrismaClient;
  authConfig: AuthConfig;
  authUseCasesOverride?: AuthUseCases;
}>;

const respondError = (context: JsonResponder, errorValue: AuthUseCaseError): Response => {
  const httpError = toAuthHttpError(errorValue);
  return context.json(httpError.body, {
    status: httpError.status,
  });
};

const createDefaultAuthUseCases = (dependencies: AuthHttpRouteDependencies): AuthUseCases => {
  const authUserRepo = createPrismaAuthUserRepoPort(dependencies.prisma);
  return {
    register: createRegisterUseCase({
      authUserRepo,
      passwordPort: bcryptPasswordPort,
      tokenPort: jwtTokenPort,
      authConfig: dependencies.authConfig,
    }),
    login: createLoginUseCase({
      authUserRepo,
      passwordPort: bcryptPasswordPort,
      tokenPort: jwtTokenPort,
      authConfig: dependencies.authConfig,
    }),
    authenticate: createAuthenticateUseCase({
      authUserRepo,
      tokenPort: jwtTokenPort,
      authConfig: dependencies.authConfig,
    }),
  };
};

export const createAuthRoutes = (dependencies: AuthHttpRouteDependencies): Hono => {
  const router = new Hono();
  const authUseCases = dependencies.authUseCasesOverride ?? createDefaultAuthUseCases(dependencies);

  router.post("/register", async (context) => {
    const rawBody = await readJsonBody(context);
    if (!rawBody.ok) {
      return respondError(context, toAuthValidationError([toAuthInvalidFormatError("body")]));
    }

    const parsedBody = RegisterRequestSchema.safeParse(rawBody.data);
    if (!parsedBody.success) {
      return respondError(
        context,
        toAuthValidationError([toAuthInvalidFormatError(readValidationField(parsedBody.error))]),
      );
    }

    const registered = await authUseCases.register(parsedBody.data);
    if (!registered.ok) {
      return respondError(context, registered.error);
    }

    return context.json(registered.data);
  });

  router.post("/login", async (context) => {
    const rawBody = await readJsonBody(context);
    if (!rawBody.ok) {
      return respondError(context, toAuthValidationError([toAuthInvalidFormatError("body")]));
    }

    const parsedBody = LoginRequestSchema.safeParse(rawBody.data);
    if (!parsedBody.success) {
      return respondError(
        context,
        toAuthValidationError([toAuthInvalidFormatError(readValidationField(parsedBody.error))]),
      );
    }

    const loggedIn = await authUseCases.login(parsedBody.data);
    if (!loggedIn.ok) {
      return respondError(context, loggedIn.error);
    }

    return context.json(loggedIn.data);
  });

  router.post("/logout", async (context) => {
    const authenticated = await authUseCases.authenticate(context.req.header("Authorization"));
    if (!authenticated.ok) {
      return respondError(context, authenticated.error);
    }

    return context.json({ detail: "Successfully logged out" });
  });

  router.get("/user", async (context) => {
    const authenticated = await authUseCases.authenticate(context.req.header("Authorization"));
    if (!authenticated.ok) {
      return respondError(context, authenticated.error);
    }

    return context.json(authenticated.data);
  });

  return router;
};
