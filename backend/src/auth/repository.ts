import type { PrismaClient, User } from "@prisma/client";

export type CreateUserInput = Readonly<{
  username: string;
  email: string;
  hashedPassword: string;
}>;

export type AuthRepository = Readonly<{
  findUserById: (userId: number) => Promise<User | null>;
  findUserByUsername: (username: string) => Promise<User | null>;
  createUser: (input: CreateUserInput) => Promise<User>;
}>;

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
    prisma.user.create({
      data: {
        username: input.username,
        email: input.email,
        hashedPassword: input.hashedPassword,
        isActive: true,
      },
    }),
});
