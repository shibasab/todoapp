import type { PrismaClient } from "@prisma/client";
import { fromPromise } from "@todoapp/shared";
import type { AuthUserRecord } from "../../domain/auth/types";
import type {
  AuthUserRepoCreateError,
  AuthUserRepoPort,
  CreateAuthUserInput,
} from "../../ports/auth-user-repo-port";

const toAuthUserRecord = (
  user: Readonly<{
    id: number;
    username: string;
    email: string;
    hashedPassword: string;
    isActive: boolean;
  }>,
): AuthUserRecord => ({
  id: user.id,
  username: user.username,
  email: user.email,
  hashedPassword: user.hashedPassword,
  isActive: user.isActive,
});

const isUniqueConstraintError = (errorValue: unknown): boolean => {
  if (typeof errorValue !== "object" || errorValue == null || !("code" in errorValue)) {
    return false;
  }

  return errorValue.code === "P2002";
};

const mapCreateUserError = (errorValue: unknown): AuthUserRepoCreateError =>
  isUniqueConstraintError(errorValue)
    ? {
        type: "DuplicateUsername",
        detail: "Username already registered",
      }
    : {
        type: "Unexpected",
        detail: "Unexpected repository error",
      };

export const createPrismaAuthUserRepoPort = (prisma: PrismaClient): AuthUserRepoPort => ({
  findById: async (id) => {
    const user = await prisma.user.findUnique({
      where: {
        id,
      },
    });

    return user == null ? null : toAuthUserRecord(user);
  },
  findByUsername: async (username) => {
    const user = await prisma.user.findUnique({
      where: {
        username,
      },
    });

    return user == null ? null : toAuthUserRecord(user);
  },
  create: async (input: CreateAuthUserInput) =>
    fromPromise(
      prisma.user
        .create({
          data: {
            username: input.username,
            email: input.email,
            hashedPassword: input.hashedPassword,
            isActive: true,
          },
        })
        .then(toAuthUserRecord),
      mapCreateUserError,
    ),
});
