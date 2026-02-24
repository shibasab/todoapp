import { err, ok } from "@todoapp/shared";
import { describe, expect, it } from "vitest";
import type { AuthConfig, AuthUserRecord } from "../src/domain/auth/types";
import { createAccessToken } from "../src/infra/auth/jwt-token-port";
import type { AuthUserRepoPort } from "../src/ports/auth-user-repo-port";
import type { PasswordPort } from "../src/ports/password-port";
import type { TokenPort } from "../src/ports/token-port";
import { createAuthenticateUseCase } from "../src/usecases/auth/authenticate";
import { createLoginUseCase, createRegisterUseCase } from "../src/usecases/auth/register-login";

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

const createAuthUserRepoStub = (overrides: Partial<AuthUserRepoPort> = {}): AuthUserRepoPort => ({
  findById: async () => null,
  findByUsername: async () => null,
  create: async () => ok(createUser()),
  ...overrides,
});

const createPasswordPortStub = (overrides: Partial<PasswordPort> = {}): PasswordPort => ({
  hash: async () => "hashed-password",
  verify: async () => true,
  ...overrides,
});

const createTokenPortStub = (overrides: Partial<TokenPort> = {}): TokenPort => ({
  createAccessToken: async () => "signed-token",
  verifyAccessToken: async () => ok("1"),
  ...overrides,
});

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
      passwordPort: createPasswordPortStub(),
      tokenPort: createTokenPortStub(),
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
      passwordPort: createPasswordPortStub(),
      tokenPort: createTokenPortStub(),
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

  it("register はhash失敗時にInternalErrorを返す", async () => {
    const register = createRegisterUseCase({
      authUserRepo: createAuthUserRepoStub(),
      passwordPort: createPasswordPortStub({
        hash: async () => {
          throw new Error("hash failed");
        },
      }),
      tokenPort: createTokenPortStub(),
      authConfig,
    });

    const result = await register({
      username: "new-user",
      email: "new-user@example.com",
      password: "password",
    });

    expect(result).toEqual(
      err({
        type: "InternalError",
        detail: "Internal server error",
      }),
    );
  });

  it("register は成功時に公開ユーザー情報とトークンを返す", async () => {
    const createdUser = createUser({ id: 42 });
    const register = createRegisterUseCase({
      authUserRepo: createAuthUserRepoStub({
        create: async (input) => {
          expect(input.hashedPassword).toBe("hashed-password");
          return ok(createdUser);
        },
      }),
      passwordPort: createPasswordPortStub(),
      tokenPort: createTokenPortStub({
        createAccessToken: async () => "created-token",
      }),
      authConfig,
    });

    const result = await register({
      username: "new-user",
      email: "new-user@example.com",
      password: "password",
    });

    expect(result).toEqual(
      ok({
        user: {
          id: 42,
          username: createdUser.username,
          email: createdUser.email,
        },
        token: "created-token",
      }),
    );
  });

  it("register はトークン発行失敗時にInternalErrorを返す", async () => {
    const register = createRegisterUseCase({
      authUserRepo: createAuthUserRepoStub(),
      passwordPort: createPasswordPortStub(),
      tokenPort: createTokenPortStub({
        createAccessToken: async () => {
          throw new Error("sign failed");
        },
      }),
      authConfig,
    });

    const result = await register({
      username: "new-user",
      email: "new-user@example.com",
      password: "password",
    });

    expect(result).toEqual(
      err({
        type: "InternalError",
        detail: "Internal server error",
      }),
    );
  });

  it("login はfindByUsernameが例外の場合InternalErrorを返す", async () => {
    const login = createLoginUseCase({
      authUserRepo: createAuthUserRepoStub({
        findByUsername: async () => {
          throw new Error("lookup failed");
        },
      }),
      passwordPort: createPasswordPortStub(),
      tokenPort: createTokenPortStub(),
      authConfig,
    });

    const result = await login({
      username: "new-user",
      password: "password",
    });

    expect(result).toEqual(
      err({
        type: "InternalError",
        detail: "Internal server error",
      }),
    );
  });

  it("login はユーザー未存在時にUnauthorizedを返す", async () => {
    const login = createLoginUseCase({
      authUserRepo: createAuthUserRepoStub({
        findByUsername: async () => null,
      }),
      passwordPort: createPasswordPortStub(),
      tokenPort: createTokenPortStub(),
      authConfig,
    });

    const result = await login({
      username: "new-user",
      password: "password",
    });

    expect(result).toEqual(
      err({
        type: "Unauthorized",
        detail: "Incorrect Credentials",
      }),
    );
  });

  it("login はパスワード不一致時にUnauthorizedを返す", async () => {
    const login = createLoginUseCase({
      authUserRepo: createAuthUserRepoStub({
        findByUsername: async () => createUser(),
      }),
      passwordPort: createPasswordPortStub({
        verify: async () => false,
      }),
      tokenPort: createTokenPortStub(),
      authConfig,
    });

    const result = await login({
      username: "new-user",
      password: "wrong-password",
    });

    expect(result).toEqual(
      err({
        type: "Unauthorized",
        detail: "Incorrect Credentials",
      }),
    );
  });

  it("login はパスワード検証例外時にInternalErrorを返す", async () => {
    const login = createLoginUseCase({
      authUserRepo: createAuthUserRepoStub({
        findByUsername: async () => createUser(),
      }),
      passwordPort: createPasswordPortStub({
        verify: async () => {
          throw new Error("verify failed");
        },
      }),
      tokenPort: createTokenPortStub(),
      authConfig,
    });

    const result = await login({
      username: "new-user",
      password: "password",
    });

    expect(result).toEqual(
      err({
        type: "InternalError",
        detail: "Internal server error",
      }),
    );
  });

  it("login はトークン発行例外時にInternalErrorを返す", async () => {
    const login = createLoginUseCase({
      authUserRepo: createAuthUserRepoStub({
        findByUsername: async () => createUser(),
      }),
      passwordPort: createPasswordPortStub(),
      tokenPort: createTokenPortStub({
        createAccessToken: async () => {
          throw new Error("sign failed");
        },
      }),
      authConfig,
    });

    const result = await login({
      username: "new-user",
      password: "password",
    });

    expect(result).toEqual(
      err({
        type: "InternalError",
        detail: "Internal server error",
      }),
    );
  });

  it("login は成功時に公開ユーザー情報とトークンを返す", async () => {
    const loginUser = createUser({ id: 99 });
    const login = createLoginUseCase({
      authUserRepo: createAuthUserRepoStub({
        findByUsername: async () => loginUser,
      }),
      passwordPort: createPasswordPortStub(),
      tokenPort: createTokenPortStub({
        createAccessToken: async () => "login-token",
      }),
      authConfig,
    });

    const result = await login({
      username: "new-user",
      password: "password",
    });

    expect(result).toEqual(
      ok({
        user: {
          id: 99,
          username: loginUser.username,
          email: loginUser.email,
        },
        token: "login-token",
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
      tokenPort: createTokenPortStub(),
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

  it("authenticate はBearer以外でも空白を含まない文字列をトークンとして受け取る", async () => {
    const user = createUser({ id: 1, isActive: true });
    const authenticate = createAuthenticateUseCase({
      authUserRepo: createAuthUserRepoStub({
        findById: async () => user,
      }),
      tokenPort: createTokenPortStub({
        verifyAccessToken: async () => ok("1"),
      }),
      authConfig,
    });

    const result = await authenticate("raw-token");

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
      tokenPort: createTokenPortStub(),
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

  it("authenticate は空ヘッダーをUnauthorizedに変換する", async () => {
    const authenticate = createAuthenticateUseCase({
      authUserRepo: createAuthUserRepoStub(),
      tokenPort: createTokenPortStub(),
      authConfig,
    });

    const missingHeader = await authenticate(undefined);
    const emptyBearer = await authenticate("Bearer   ");

    expect(missingHeader).toEqual(
      err({
        type: "Unauthorized",
        detail: "Could not validate credentials",
      }),
    );
    expect(emptyBearer).toEqual(
      err({
        type: "Unauthorized",
        detail: "Could not validate credentials",
      }),
    );
  });

  it("authenticate はトークン検証失敗をUnauthorizedへ変換する", async () => {
    const authenticate = createAuthenticateUseCase({
      authUserRepo: createAuthUserRepoStub(),
      tokenPort: createTokenPortStub({
        verifyAccessToken: async () =>
          err({
            type: "TokenVerifyFailed",
            detail: "invalid token",
          }),
      }),
      authConfig,
    });

    const result = await authenticate("raw-token");

    expect(result).toEqual(
      err({
        type: "Unauthorized",
        detail: "Could not validate credentials",
      }),
    );
  });

  it("authenticate は不正subクレームをUnauthorizedへ変換する", async () => {
    const authenticate = createAuthenticateUseCase({
      authUserRepo: createAuthUserRepoStub(),
      tokenPort: createTokenPortStub({
        verifyAccessToken: async () => ok("not-a-number"),
      }),
      authConfig,
    });

    const result = await authenticate("raw-token");

    expect(result).toEqual(
      err({
        type: "Unauthorized",
        detail: "Could not validate credentials",
      }),
    );
  });

  it("authenticate はユーザー取得の例外をUnauthorizedへ変換する", async () => {
    const authenticate = createAuthenticateUseCase({
      authUserRepo: createAuthUserRepoStub({
        findById: async () => {
          throw new Error("find failed");
        },
      }),
      tokenPort: createTokenPortStub({
        verifyAccessToken: async () => ok("1"),
      }),
      authConfig,
    });

    const result = await authenticate("raw-token");

    expect(result).toEqual(
      err({
        type: "Unauthorized",
        detail: "Could not validate credentials",
      }),
    );
  });

  it("authenticate は非アクティブ/未存在ユーザーをUnauthorizedへ変換する", async () => {
    const noUserAuthenticate = createAuthenticateUseCase({
      authUserRepo: createAuthUserRepoStub({
        findById: async () => null,
      }),
      tokenPort: createTokenPortStub({
        verifyAccessToken: async () => ok("1"),
      }),
      authConfig,
    });
    const inactiveAuthenticate = createAuthenticateUseCase({
      authUserRepo: createAuthUserRepoStub({
        findById: async () => createUser({ isActive: false }),
      }),
      tokenPort: createTokenPortStub({
        verifyAccessToken: async () => ok("1"),
      }),
      authConfig,
    });

    const noUserResult = await noUserAuthenticate("raw-token");
    const inactiveResult = await inactiveAuthenticate("raw-token");

    expect(noUserResult).toEqual(
      err({
        type: "Unauthorized",
        detail: "Could not validate credentials",
      }),
    );
    expect(inactiveResult).toEqual(
      err({
        type: "Unauthorized",
        detail: "Could not validate credentials",
      }),
    );
  });
});
