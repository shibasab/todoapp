import { err, ok } from "@todoapp/shared";
import { describe, expect, it } from "vitest";
import type { AuthConfig, AuthUserRecord } from "../src/domain/auth/types";
import { createAccessToken } from "../src/infra/auth/jwt-token-port";
import type { AuthUserRepoPort } from "../src/ports/auth-user-repo-port";
import type { PasswordPort } from "../src/ports/password-port";
import type { TokenPort } from "../src/ports/token-port";
import { createAuthenticateUseCase } from "../src/usecases/auth/authenticate";
import { createRegisterUseCase } from "../src/usecases/auth/register-login";

const authConfig: AuthConfig = {
  jwtSecret: "service-test-secret",
  jwtAccessTokenExpireMinutes: 30,
};

const createUser = (overrides: Partial<AuthUserRecord> = {}): AuthUserRecord => ({
  id: 1,
  username: "new-user",
  email: "new-user@example.com",
  hashedPassword: "hashed-password",
  isActive: true,
  ...overrides,
});

const createAuthUserRepoStub = (
  overrides: Partial<AuthUserRepoPort> = {},
): AuthUserRepoPort => ({
  findById: async () => null,
  findByUsername: async () => null,
  create: async () => ok(createUser()),
  ...overrides,
});

const passwordPortStub: PasswordPort = {
  hash: async () => "hashed-password",
  verify: async () => true,
};

const tokenPortStub: TokenPort = {
  createAccessToken: async () => "signed-token",
  verifyAccessToken: async () => ok("1"),
};

describe("auth service", () => {
  it("register はRepositoryのDuplicateUsernameをConflictへ変換する", async () => {
    const authUserRepo = createAuthUserRepoStub({
      create: async () =>
        err({
          type: "DuplicateUsername",
          detail: "Username already registered",
        }),
    });
    const register = createRegisterUseCase({
      authUserRepo,
      passwordPort: passwordPortStub,
      tokenPort: tokenPortStub,
      authConfig,
    });

    const result = await register({
      username: "duplicate-user",
      email: "duplicate@example.com",
      password: "password",
    });

    expect(result).toEqual(
      err({
        type: "Conflict",
        detail: "Username already registered",
      }),
    );
  });

  it("register はRepositoryのUnexpectedをInternalErrorへ変換する", async () => {
    const authUserRepo = createAuthUserRepoStub({
      create: async () =>
        err({
          type: "Unexpected",
          detail: "Unexpected repository error",
        }),
    });
    const register = createRegisterUseCase({
      authUserRepo,
      passwordPort: passwordPortStub,
      tokenPort: tokenPortStub,
      authConfig,
    });

    const result = await register({
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
    const authUserRepo = createAuthUserRepoStub({
      findById: async () => user,
    });
    const authenticate = createAuthenticateUseCase({
      authUserRepo,
      tokenPort: tokenPortStub,
      authConfig,
    });
    const token = await createAccessToken({ sub: String(user.id) }, authConfig);

    const result = await authenticate(`Bearer ${token}`);

    expect(result).toEqual(
      ok({
        id: user.id,
        username: user.username,
        email: user.email,
      }),
    );
  });

  it("authenticate は不正Authorization形式をUnauthorizedに変換する", async () => {
    const authUserRepo = createAuthUserRepoStub();
    const authenticate = createAuthenticateUseCase({
      authUserRepo,
      tokenPort: tokenPortStub,
      authConfig,
    });

    const result = await authenticate("Token invalid-format");

    expect(result).toEqual(
      err({
        type: "Unauthorized",
        detail: "Could not validate credentials",
      }),
    );
  });
});
