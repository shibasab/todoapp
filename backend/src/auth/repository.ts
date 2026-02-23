import type { PrismaClient, User } from "@prisma/client";
import { fromPromise, type TaskResult } from "@todoapp/shared";

export type CreateUserInput = Readonly<{
  username: string;
  email: string;
  hashedPassword: string;
}>;

type DuplicateKeyError = Readonly<{
  type: "DuplicateKey";
  detail: string;
}>;

type UnexpectedRepositoryError = Readonly<{
  type: "Unexpected";
  detail: string;
}>;

export type RepositoryError = DuplicateKeyError | UnexpectedRepositoryError;

export type AuthRepository = Readonly<{
  findUserById: (userId: number) => Promise<User | null>;
  findUserByUsername: (username: string) => Promise<User | null>;
  createUser: (input: CreateUserInput) => TaskResult<User, RepositoryError>;
}>;

const isUniqueConstraintError = (errorValue: unknown): boolean => {
  if (typeof errorValue !== "object" || errorValue == null || !("code" in errorValue)) {
    return false;
  }

  return typeof errorValue.code === "string" && errorValue.code === "P2002";
};

const mapCreateUserError = (errorValue: unknown): RepositoryError =>
  isUniqueConstraintError(errorValue)
    ? {
        type: "DuplicateKey",
        detail: "Unique constraint violation",
      }
    : {
        type: "Unexpected",
        detail: "Unexpected repository error",
      };

export const createAuthRepository = (prisma: PrismaClient): AuthRepository => ({
  findUserById: async (userId) =>
    prisma.user.findUnique({
      where: {
        id: userId,
      },
    }),
  findUserByUsername: async (username) =>
    prisma.user.findUnique({
      where: {
        username,
      },
    }),
  createUser: async (input) =>
    fromPromise(
      prisma.user.create({
        data: {
          username: input.username,
          email: input.email,
          hashedPassword: input.hashedPassword,
          isActive: true,
        },
      }),
      mapCreateUserError,
    ),
});
