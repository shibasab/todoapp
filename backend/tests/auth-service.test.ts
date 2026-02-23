import type { User } from "@prisma/client";
import { err, ok } from "@todoapp/shared";
import { describe, expect, it } from "vitest";
import type { AuthRepository } from "../src/auth/repository";
import { createAuthServiceFromRepository } from "../src/auth/service";
import { createAccessToken } from "../src/auth/token";
import type { AuthConfig } from "../src/auth/types";

const authConfig: AuthConfig = {
  jwtSecret: "service-test-secret",
  jwtAccessTokenExpireMinutes: 30,
};

const createUser = (overrides: Partial<User> = {}): User => ({
  id: 1,
  username: "new-user",
  email: "new-user@example.com",
  hashedPassword: "hashed-password",
  isActive: true,
  ...overrides,
});

const createAuthRepositoryStub = (overrides: Partial<AuthRepository> = {}): AuthRepository => ({
  findUserById: async () => null,
  findUserByUsername: async () => null,
  createUser: async () => ok(createUser()),
  ...overrides,
});

describe("auth service", () => {
  it("register はRepositoryのDuplicateKeyをDuplicateUsernameへ変換する", async () => {
    const repository = createAuthRepositoryStub({
      createUser: async () =>
        err({
          type: "DuplicateKey",
          detail: "Unique constraint violation",
        }),
    });
    const authService = createAuthServiceFromRepository(repository, authConfig);

    const result = await authService.register({
      username: "duplicate-user",
      email: "duplicate@example.com",
      password: "password",
    });

    expect(result).toEqual(
      err({
        type: "DuplicateUsername",
        detail: "Username already registered",
      }),
    );
  });

  it("register はRepositoryのUnexpectedをInternalErrorへ変換する", async () => {
    const repository = createAuthRepositoryStub({
      createUser: async () =>
        err({
          type: "Unexpected",
          detail: "Unexpected repository error",
        }),
    });
    const authService = createAuthServiceFromRepository(repository, authConfig);

    const result = await authService.register({
      username: "unexpected-user",
      email: "unexpected@example.com",
      password: "password",
    });

    expect(result).toEqual(
      err({
        type: "InternalError",
        detail: "Internal server error",
      }),
    );
  });

  it("authenticate はBearerヘッダーからトークンを解釈できる", async () => {
    const user = createUser({ id: 10, isActive: true });
    const repository = createAuthRepositoryStub({
      findUserById: async () => user,
    });
    const authService = createAuthServiceFromRepository(repository, authConfig);
    const token = await createAccessToken({ sub: String(user.id) }, authConfig);

    const result = await authService.authenticate(`Bearer ${token}`);

    expect(result).toEqual(
      ok({
        id: user.id,
        username: user.username,
        email: user.email,
      }),
    );
  });

  it("authenticate は不正Authorization形式をUnauthorizedに変換する", async () => {
    const repository = createAuthRepositoryStub();
    const authService = createAuthServiceFromRepository(repository, authConfig);

    const result = await authService.authenticate("Token invalid-format");

    expect(result).toEqual(
      err({
        type: "Unauthorized",
        detail: "Could not validate credentials",
      }),
    );
  });
});
