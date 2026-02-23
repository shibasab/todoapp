import type { PrismaClient } from "@prisma/client";
import { err, ok, type TaskResult } from "@todoapp/shared";
import { createAuthRepository } from "./repository";
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

export type AuthServiceError = RegisterError | InvalidCredentialsError | UnauthorizedError;

export type AuthService = Readonly<{
  register: (input: RegisterInput) => TaskResult<AuthTokenResponse, AuthServiceError>;
  login: (input: LoginInput) => TaskResult<AuthTokenResponse, AuthServiceError>;
  authenticate: (token: string) => TaskResult<PublicUser, AuthServiceError>;
}>;

const toPublicUser = (
  user: Readonly<{ id: number; username: string; email: string }>,
): PublicUser => ({
  id: user.id,
  username: user.username,
  email: user.email,
});

const isUniqueConstraintError = (errorValue: unknown): boolean => {
  if (typeof errorValue !== "object" || errorValue == null || !("code" in errorValue)) {
    return false;
  }

  return typeof errorValue.code === "string" && errorValue.code === "P2002";
};

export const createAuthService = (prisma: PrismaClient, authConfig: AuthConfig): AuthService => {
  const repository = createAuthRepository(prisma);

  return {
    register: async (input) => {
      const existingUser = await repository.findUserByUsername(input.username);
      if (existingUser != null) {
        return err({
          type: "DuplicateUsername",
          detail: "Username already registered",
        });
      }

      const hashedPassword = await hashPassword(input.password);
      let createdUser;
      try {
        createdUser = await repository.createUser({
          username: input.username,
          email: input.email,
          hashedPassword,
        });
      } catch (errorValue) {
        if (isUniqueConstraintError(errorValue)) {
          return err({
            type: "DuplicateUsername",
            detail: "Username already registered",
          });
        }

        throw errorValue;
      }
      const token = await createAccessToken({ sub: String(createdUser.id) }, authConfig);

      return ok({
        user: toPublicUser(createdUser),
        token,
      });
    },
    login: async (input) => {
      const user = await repository.findUserByUsername(input.username);
      if (user == null) {
        return err({
          type: "InvalidCredentials",
          detail: "Incorrect Credentials",
        });
      }

      const passwordMatches = await verifyPassword(input.password, user.hashedPassword);
      if (!passwordMatches) {
        return err({
          type: "InvalidCredentials",
          detail: "Incorrect Credentials",
        });
      }

      const token = await createAccessToken({ sub: String(user.id) }, authConfig);
      return ok({
        user: toPublicUser(user),
        token,
      });
    },
    authenticate: async (token) => {
      const verifiedToken = await verifyAccessToken(token, authConfig);
      if (!verifiedToken.ok) {
        return err({
          type: "Unauthorized",
          detail: "Could not validate credentials",
        });
      }

      const userId = Number(verifiedToken.data);
      if (!Number.isInteger(userId) || userId <= 0) {
        return err({
          type: "Unauthorized",
          detail: "Could not validate credentials",
        });
      }

      const user = await repository.findUserById(userId);
      if (user == null || !user.isActive) {
        return err({
          type: "Unauthorized",
          detail: "Could not validate credentials",
        });
      }

      return ok(toPublicUser(user));
    },
  };
};
