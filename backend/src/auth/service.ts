import type { PrismaClient } from "@prisma/client";
import { err, mapError, ok, type TaskResult } from "@todoapp/shared";
import { assertNever } from "../shared/error";
import { createAuthRepository, type AuthRepository, type RepositoryError } from "./repository";
import { hashPassword, verifyPassword } from "./password";
import { createAccessToken, verifyAccessToken } from "./token";
import type { AuthConfig, AuthTokenResponse, LoginInput, PublicUser, RegisterInput } from "./types";

type RegisterError = Readonly<{
  type: "DuplicateUsername";
  detail: string;
}>;

type InvalidCredentialsError = Readonly<{
  type: "InvalidCredentials";
  detail: string;
}>;

type UnauthorizedError = Readonly<{
  type: "Unauthorized";
  detail: string;
}>;

type InternalError = Readonly<{
  type: "InternalError";
  detail: string;
}>;

export type AuthServiceError =
  | RegisterError
  | InvalidCredentialsError
  | UnauthorizedError
  | InternalError;

export type AuthService = Readonly<{
  register: (input: RegisterInput) => TaskResult<AuthTokenResponse, AuthServiceError>;
  login: (input: LoginInput) => TaskResult<AuthTokenResponse, AuthServiceError>;
  authenticate: (
    authorizationHeaderOrToken: string | undefined,
  ) => TaskResult<PublicUser, AuthServiceError>;
}>;

const toPublicUser = (
  user: Readonly<{ id: number; username: string; email: string }>,
): PublicUser => ({
  id: user.id,
  username: user.username,
  email: user.email,
});

const duplicateUsernameError = (): RegisterError => ({
  type: "DuplicateUsername",
  detail: "Username already registered",
});

const invalidCredentialsError = (): InvalidCredentialsError => ({
  type: "InvalidCredentials",
  detail: "Incorrect Credentials",
});

const unauthorizedError = (): UnauthorizedError => ({
  type: "Unauthorized",
  detail: "Could not validate credentials",
});

const internalServerError = (): InternalError => ({
  type: "InternalError",
  detail: "Internal server error",
});

const toToken = (authorizationHeaderOrToken: string | undefined): string | null => {
  if (authorizationHeaderOrToken == null || authorizationHeaderOrToken === "") {
    return null;
  }

  if (authorizationHeaderOrToken.startsWith("Bearer ")) {
    const bearerToken = authorizationHeaderOrToken.slice("Bearer ".length).trim();
    return bearerToken === "" ? null : bearerToken;
  }

  return authorizationHeaderOrToken.includes(" ") ? null : authorizationHeaderOrToken;
};

const mapRepositoryErrorToAuthServiceError = (errorValue: RepositoryError): AuthServiceError => {
  switch (errorValue.type) {
    case "DuplicateKey":
      return duplicateUsernameError();
    case "Unexpected":
      return internalServerError();
    default:
      return assertNever(errorValue, "RepositoryError.type");
  }
};

export const createAuthServiceFromRepository = (
  repository: AuthRepository,
  authConfig: AuthConfig,
): AuthService => {
  return {
    register: async (input) => {
      const existingUser = await repository.findUserByUsername(input.username);
      if (existingUser != null) {
        return err(duplicateUsernameError());
      }

      const hashedPassword = await hashPassword(input.password);
      const createdUserResult = mapError(
        await repository.createUser({
          username: input.username,
          email: input.email,
          hashedPassword,
        }),
        mapRepositoryErrorToAuthServiceError,
      );
      if (!createdUserResult.ok) {
        return createdUserResult;
      }

      const token = await createAccessToken({ sub: String(createdUserResult.data.id) }, authConfig);

      return ok({
        user: toPublicUser(createdUserResult.data),
        token,
      });
    },
    login: async (input) => {
      const user = await repository.findUserByUsername(input.username);
      if (user == null) {
        return err(invalidCredentialsError());
      }

      const passwordMatches = await verifyPassword(input.password, user.hashedPassword);
      if (!passwordMatches) {
        return err(invalidCredentialsError());
      }

      const token = await createAccessToken({ sub: String(user.id) }, authConfig);
      return ok({
        user: toPublicUser(user),
        token,
      });
    },
    authenticate: async (authorizationHeaderOrToken) => {
      const token = toToken(authorizationHeaderOrToken);
      if (token == null) {
        return err(unauthorizedError());
      }

      const verifiedToken = await verifyAccessToken(token, authConfig);
      if (!verifiedToken.ok) {
        return err(unauthorizedError());
      }

      const userId = Number(verifiedToken.data);
      if (!Number.isInteger(userId) || userId <= 0) {
        return err(unauthorizedError());
      }

      const user = await repository.findUserById(userId);
      if (user == null || !user.isActive) {
        return err(unauthorizedError());
      }

      return ok(toPublicUser(user));
    },
  };
};

export const createAuthService = (prisma: PrismaClient, authConfig: AuthConfig): AuthService =>
  createAuthServiceFromRepository(createAuthRepository(prisma), authConfig);
