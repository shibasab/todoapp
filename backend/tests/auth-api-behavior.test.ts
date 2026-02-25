import { describe, expect, it } from "vitest";
import { createApp, type AppDependencies } from "../src/app";
import {
  createPrismaClient,
  createTemporarySqliteDatabase,
  ensureSqliteSchema,
} from "../src/infra/prisma/testing";

type AuthSuccessBody = Readonly<{
  user: Readonly<{
    id: number;
    username: string;
    email: string;
  }>;
  token: string;
}>;

type UserBody = Readonly<{
  id: number;
  username: string;
  email: string;
}>;

type ErrorBody = Readonly<{
  detail: string;
}>;

const readJson = async <T>(response: Response): Promise<T> => (await response.json()) as T;

const createJsonRequest = (pathname: string, body: unknown): Request =>
  new Request(`http://localhost${pathname}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

const authDependencies = (): Pick<AppDependencies, "authConfig"> => ({
  authConfig: {
    jwtSecret: "behavior-test-secret",
    jwtAccessTokenExpireMinutes: 30,
  },
});

const setupAuthTestApp = async () => {
  const temporaryDatabase = await createTemporarySqliteDatabase();
  const schemaResult = await ensureSqliteSchema(temporaryDatabase.databaseUrl);
  if (!schemaResult.ok) {
    throw new Error(JSON.stringify(schemaResult.error));
  }

  const prisma = createPrismaClient(temporaryDatabase.databaseUrl);
  const app = createApp({
    prisma,
    ...authDependencies(),
  });

  return {
    app,
    cleanup: async () => {
      await prisma.$disconnect();
      await temporaryDatabase.cleanup();
    },
  };
};

describe("auth api behavior", () => {
  it("ユーザーごとのトークンで自分のプロフィールのみ取得できる", async () => {
    const testApp = await setupAuthTestApp();

    try {
      const firstRegisterResponse = await testApp.app.request(
        createJsonRequest("/api/auth/register", {
          username: "alice",
          email: "alice@example.com",
          password: "alice-password",
        }),
      );
      const secondRegisterResponse = await testApp.app.request(
        createJsonRequest("/api/auth/register", {
          username: "bob",
          email: "bob@example.com",
          password: "bob-password",
        }),
      );

      const firstRegisterBody = await readJson<AuthSuccessBody>(firstRegisterResponse);
      const secondRegisterBody = await readJson<AuthSuccessBody>(secondRegisterResponse);

      const firstUserResponse = await testApp.app.request("/api/auth/user", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${firstRegisterBody.token}`,
        },
      });
      const secondUserResponse = await testApp.app.request("/api/auth/user", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${secondRegisterBody.token}`,
        },
      });

      const firstUserBody = await readJson<UserBody>(firstUserResponse);
      const secondUserBody = await readJson<UserBody>(secondUserResponse);

      expect(firstRegisterResponse.status).toBe(200);
      expect(secondRegisterResponse.status).toBe(200);
      expect(firstUserResponse.status).toBe(200);
      expect(secondUserResponse.status).toBe(200);
      expect(firstUserBody).toEqual({
        id: firstRegisterBody.user.id,
        username: "alice",
        email: "alice@example.com",
      });
      expect(secondUserBody).toEqual({
        id: secondRegisterBody.user.id,
        username: "bob",
        email: "bob@example.com",
      });
      expect(firstUserBody.id).not.toBe(secondUserBody.id);
    } finally {
      await testApp.cleanup();
    }
  });

  it("登録・ログイン時に前後空白を吸収して同じ認証情報として扱う", async () => {
    const testApp = await setupAuthTestApp();

    try {
      const registerResponse = await testApp.app.request(
        createJsonRequest("/api/auth/register", {
          username: "  behavior-user  ",
          email: "behavior@example.com",
          password: "  behavior-password  ",
        }),
      );
      const registerBody = await readJson<AuthSuccessBody>(registerResponse);

      const loginResponse = await testApp.app.request(
        createJsonRequest("/api/auth/login", {
          username: "behavior-user",
          password: "behavior-password",
        }),
      );
      const loginBody = await readJson<AuthSuccessBody>(loginResponse);

      expect(registerResponse.status).toBe(200);
      expect(registerBody.user.username).toBe("behavior-user");
      expect(loginResponse.status).toBe(200);
      expect(loginBody.user.username).toBe("behavior-user");
    } finally {
      await testApp.cleanup();
    }
  });

  it("ログイン失敗時はユーザー存在有無に関わらず同じエラーを返す", async () => {
    const testApp = await setupAuthTestApp();

    try {
      await testApp.app.request(
        createJsonRequest("/api/auth/register", {
          username: "known-user",
          email: "known@example.com",
          password: "correct-password",
        }),
      );

      const wrongPasswordResponse = await testApp.app.request(
        createJsonRequest("/api/auth/login", {
          username: "known-user",
          password: "wrong-password",
        }),
      );
      const missingUserResponse = await testApp.app.request(
        createJsonRequest("/api/auth/login", {
          username: "missing-user",
          password: "wrong-password",
        }),
      );

      const wrongPasswordBody = await readJson<ErrorBody>(wrongPasswordResponse);
      const missingUserBody = await readJson<ErrorBody>(missingUserResponse);

      expect(wrongPasswordResponse.status).toBe(401);
      expect(missingUserResponse.status).toBe(401);
      expect(wrongPasswordBody).toEqual({
        detail: "Incorrect Credentials",
      });
      expect(missingUserBody).toEqual({
        detail: "Incorrect Credentials",
      });
    } finally {
      await testApp.cleanup();
    }
  });
});
