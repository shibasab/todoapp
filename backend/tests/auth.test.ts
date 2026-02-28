import { afterAll, describe, expect, it } from "vitest";

import { createApp, type AppDependencies } from "../src/app";
import { createAccessToken } from "../src/infra/auth/jwt-token-port";
import { createSqliteApiTestAppFactory } from "./support/sqlite-api-test-harness";

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

type ValidationErrorBody = Readonly<{
  status: 422;
  type: "validation_error";
  detail: string;
  errors: readonly Readonly<{
    field: string;
    reason: string;
  }>[];
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

const createMalformedJsonRequest = (pathname: string, body: string): Request =>
  new Request(`http://localhost${pathname}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body,
  });

const authDependencies = (): Pick<AppDependencies, "authConfig"> => ({
  authConfig: {
    jwtSecret: "test-secret",
    jwtAccessTokenExpireMinutes: 30,
  },
});

const { cleanupTemplateDatabase, setupApiTestApp } = createSqliteApiTestAppFactory();

const setupAuthTestApp = async () => setupApiTestApp(authDependencies());

afterAll(async () => {
  await cleanupTemplateDatabase();
});

describe("auth routes", () => {
  it("POST /api/auth/register でユーザー登録とトークン発行ができる", async () => {
    const testApp = await setupAuthTestApp();

    try {
      const response = await testApp.app.request(
        createJsonRequest("/api/auth/register", {
          username: "newuser",
          email: "newuser@example.com",
          password: "newpassword123",
        }),
      );
      const body = await readJson<AuthSuccessBody>(response);

      expect(response.status).toBe(200);
      expect(body.user.username).toBe("newuser");
      expect(body.user.email).toBe("newuser@example.com");
      expect(typeof body.token).toBe("string");
      expect(body.token.length).toBeGreaterThan(10);
    } finally {
      await testApp.cleanup();
    }
  });

  it("POST /api/auth/register は重複ユーザー名で409を返す", async () => {
    const testApp = await setupAuthTestApp();

    try {
      await testApp.app.request(
        createJsonRequest("/api/auth/register", {
          username: "duplicate-user",
          email: "first@example.com",
          password: "first-password",
        }),
      );

      const response = await testApp.app.request(
        createJsonRequest("/api/auth/register", {
          username: "duplicate-user",
          email: "second@example.com",
          password: "second-password",
        }),
      );
      const body = await readJson<ErrorBody>(response);

      expect(response.status).toBe(409);
      expect(body.detail).toContain("already registered");
    } finally {
      await testApp.cleanup();
    }
  });

  it("POST /api/auth/register は不正なJSONで422を返す", async () => {
    const testApp = await setupAuthTestApp();

    try {
      const response = await testApp.app.request(
        createJsonRequest("/api/auth/register", {
          username: "",
          password: "",
          email: 123,
        }),
      );
      const body = await readJson<ValidationErrorBody>(response);

      expect(response.status).toBe(422);
      expect(body.type).toBe("validation_error");
      expect(body.detail).toBe("Validation error");
      expect(body.errors[0]?.field).toBe("username");
    } finally {
      await testApp.cleanup();
    }
  });

  it("POST /api/auth/register はオブジェクト以外のJSONで422を返す", async () => {
    const testApp = await setupAuthTestApp();

    try {
      const response = await testApp.app.request(
        createJsonRequest("/api/auth/register", "invalid-body"),
      );
      const body = await readJson<ValidationErrorBody>(response);

      expect(response.status).toBe(422);
      expect(body.type).toBe("validation_error");
      expect(body.detail).toBe("Validation error");
      expect(body.errors[0]?.field).toBe("body");
    } finally {
      await testApp.cleanup();
    }
  });

  it("POST /api/auth/register は構文不正JSONで422を返す", async () => {
    const testApp = await setupAuthTestApp();

    try {
      const response = await testApp.app.request(
        createMalformedJsonRequest("/api/auth/register", "{"),
      );
      const body = await readJson<ValidationErrorBody>(response);

      expect(response.status).toBe(422);
      expect(body.type).toBe("validation_error");
      expect(body.detail).toBe("Validation error");
      expect(body.errors[0]?.field).toBe("body");
    } finally {
      await testApp.cleanup();
    }
  });

  it("POST /api/auth/register の同時登録で500が発生しない", async () => {
    const testApp = await setupAuthTestApp();

    try {
      const responses = await Promise.all([
        testApp.app.request(
          createJsonRequest("/api/auth/register", {
            username: "concurrent-user",
            email: "concurrent1@example.com",
            password: "concurrent-password",
          }),
        ),
        testApp.app.request(
          createJsonRequest("/api/auth/register", {
            username: "concurrent-user",
            email: "concurrent2@example.com",
            password: "concurrent-password",
          }),
        ),
      ]);
      const statuses = responses.map((response) => response.status).sort();

      expect(statuses).toEqual([200, 409]);
    } finally {
      await testApp.cleanup();
    }
  });

  it("POST /api/auth/login は正しい認証情報で成功する", async () => {
    const testApp = await setupAuthTestApp();

    try {
      await testApp.app.request(
        createJsonRequest("/api/auth/register", {
          username: "login-user",
          email: "login@example.com",
          password: "login-password",
        }),
      );

      const response = await testApp.app.request(
        createJsonRequest("/api/auth/login", {
          username: "login-user",
          password: "login-password",
        }),
      );
      const body = await readJson<AuthSuccessBody>(response);

      expect(response.status).toBe(200);
      expect(body.user.username).toBe("login-user");
      expect(typeof body.token).toBe("string");
    } finally {
      await testApp.cleanup();
    }
  });

  it("POST /api/auth/login は不正パスワードで401を返す", async () => {
    const testApp = await setupAuthTestApp();

    try {
      await testApp.app.request(
        createJsonRequest("/api/auth/register", {
          username: "wrong-pass-user",
          email: "wrong@example.com",
          password: "correct-password",
        }),
      );

      const response = await testApp.app.request(
        createJsonRequest("/api/auth/login", {
          username: "wrong-pass-user",
          password: "wrong-password",
        }),
      );
      const body = await readJson<ErrorBody>(response);

      expect(response.status).toBe(401);
      expect(body.detail).toBe("Incorrect Credentials");
    } finally {
      await testApp.cleanup();
    }
  });

  it("POST /api/auth/login は存在しないユーザーで401を返す", async () => {
    const testApp = await setupAuthTestApp();

    try {
      const response = await testApp.app.request(
        createJsonRequest("/api/auth/login", {
          username: "missing-user",
          password: "some-password",
        }),
      );
      const body = await readJson<ErrorBody>(response);

      expect(response.status).toBe(401);
      expect(body.detail).toBe("Incorrect Credentials");
    } finally {
      await testApp.cleanup();
    }
  });

  it("POST /api/auth/login は不正なJSONで422を返す", async () => {
    const testApp = await setupAuthTestApp();

    try {
      const response = await testApp.app.request(
        createJsonRequest("/api/auth/login", {
          username: "",
          password: "",
        }),
      );
      const body = await readJson<ValidationErrorBody>(response);

      expect(response.status).toBe(422);
      expect(body.type).toBe("validation_error");
      expect(body.detail).toBe("Validation error");
      expect(body.errors[0]?.field).toBe("username");
    } finally {
      await testApp.cleanup();
    }
  });

  it("POST /api/auth/login はオブジェクト以外のJSONで422を返す", async () => {
    const testApp = await setupAuthTestApp();

    try {
      const response = await testApp.app.request(
        createJsonRequest("/api/auth/login", "invalid-body"),
      );
      const body = await readJson<ValidationErrorBody>(response);

      expect(response.status).toBe(422);
      expect(body.type).toBe("validation_error");
      expect(body.detail).toBe("Validation error");
      expect(body.errors[0]?.field).toBe("body");
    } finally {
      await testApp.cleanup();
    }
  });

  it("POST /api/auth/login は構文不正JSONで422を返す", async () => {
    const testApp = await setupAuthTestApp();

    try {
      const response = await testApp.app.request(
        createMalformedJsonRequest("/api/auth/login", "{"),
      );
      const body = await readJson<ValidationErrorBody>(response);

      expect(response.status).toBe(422);
      expect(body.type).toBe("validation_error");
      expect(body.detail).toBe("Validation error");
      expect(body.errors[0]?.field).toBe("body");
    } finally {
      await testApp.cleanup();
    }
  });

  it("GET /api/auth/user は認証済みユーザー情報を返す", async () => {
    const testApp = await setupAuthTestApp();

    try {
      const registerResponse = await testApp.app.request(
        createJsonRequest("/api/auth/register", {
          username: "whoami-user",
          email: "whoami@example.com",
          password: "whoami-password",
        }),
      );
      const registerBody = await readJson<AuthSuccessBody>(registerResponse);

      const response = await testApp.app.request("/api/auth/user", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${registerBody.token}`,
        },
      });
      const body = await readJson<UserBody>(response);

      expect(response.status).toBe(200);
      expect(body.username).toBe("whoami-user");
      expect(body.email).toBe("whoami@example.com");
    } finally {
      await testApp.cleanup();
    }
  });

  it("GET /api/auth/user は不正JWTで401を返す", async () => {
    const testApp = await setupAuthTestApp();

    try {
      const response = await testApp.app.request("/api/auth/user", {
        method: "GET",
        headers: {
          Authorization: "Bearer invalid.token.value",
        },
      });
      const body = await readJson<ErrorBody>(response);

      expect(response.status).toBe(401);
      expect(body.detail).toBe("Could not validate credentials");
    } finally {
      await testApp.cleanup();
    }
  });

  it("GET /api/auth/user は認証ヘッダーなしで401を返す", async () => {
    const testApp = await setupAuthTestApp();

    try {
      const response = await testApp.app.request("/api/auth/user", {
        method: "GET",
      });
      const body = await readJson<ErrorBody>(response);

      expect(response.status).toBe(401);
      expect(body.detail).toBe("Could not validate credentials");
    } finally {
      await testApp.cleanup();
    }
  });

  it("GET /api/auth/user はsubクレームなしJWTで401を返す", async () => {
    const testApp = await setupAuthTestApp();

    try {
      const token = await createAccessToken({ scope: "read" }, authDependencies().authConfig);

      const response = await testApp.app.request("/api/auth/user", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const body = await readJson<ErrorBody>(response);

      expect(response.status).toBe(401);
      expect(body.detail).toBe("Could not validate credentials");
    } finally {
      await testApp.cleanup();
    }
  });

  it("GET /api/auth/user は数値でないsubクレームで401を返す", async () => {
    const testApp = await setupAuthTestApp();

    try {
      const token = await createAccessToken({ sub: "not-a-number" }, authDependencies().authConfig);

      const response = await testApp.app.request("/api/auth/user", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const body = await readJson<ErrorBody>(response);

      expect(response.status).toBe(401);
      expect(body.detail).toBe("Could not validate credentials");
    } finally {
      await testApp.cleanup();
    }
  });

  it("POST /api/auth/logout は認証済みで成功する", async () => {
    const testApp = await setupAuthTestApp();

    try {
      const registerResponse = await testApp.app.request(
        createJsonRequest("/api/auth/register", {
          username: "logout-user",
          email: "logout@example.com",
          password: "logout-password",
        }),
      );
      const registerBody = await readJson<AuthSuccessBody>(registerResponse);

      const response = await testApp.app.request("/api/auth/logout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${registerBody.token}`,
        },
      });
      const body = await readJson<ErrorBody>(response);

      expect(response.status).toBe(200);
      expect(body).toEqual({ detail: "Successfully logged out" });
    } finally {
      await testApp.cleanup();
    }
  });

  it("POST /api/auth/logout は認証ヘッダーなしで401を返す", async () => {
    const testApp = await setupAuthTestApp();

    try {
      const response = await testApp.app.request("/api/auth/logout", {
        method: "POST",
      });
      const body = await readJson<ErrorBody>(response);

      expect(response.status).toBe(401);
      expect(body.detail).toBe("Could not validate credentials");
    } finally {
      await testApp.cleanup();
    }
  });

  it("POST /api/auth/logout はBearer形式でないヘッダーで401を返す", async () => {
    const testApp = await setupAuthTestApp();

    try {
      const response = await testApp.app.request("/api/auth/logout", {
        method: "POST",
        headers: {
          Authorization: "Basic abc",
        },
      });
      const body = await readJson<ErrorBody>(response);

      expect(response.status).toBe(401);
      expect(body.detail).toBe("Could not validate credentials");
    } finally {
      await testApp.cleanup();
    }
  });

  it("POST /api/auth/logout は不正JWTで401を返す", async () => {
    const testApp = await setupAuthTestApp();

    try {
      const response = await testApp.app.request("/api/auth/logout", {
        method: "POST",
        headers: {
          Authorization: "Bearer invalid.token.value",
        },
      });
      const body = await readJson<ErrorBody>(response);

      expect(response.status).toBe(401);
      expect(body.detail).toBe("Could not validate credentials");
    } finally {
      await testApp.cleanup();
    }
  });

  it("GET /api/auth/user は非アクティブユーザーで401を返す", async () => {
    const testApp = await setupAuthTestApp();

    try {
      const registerResponse = await testApp.app.request(
        createJsonRequest("/api/auth/register", {
          username: "inactive-user",
          email: "inactive@example.com",
          password: "inactive-password",
        }),
      );
      const registerBody = await readJson<AuthSuccessBody>(registerResponse);

      await testApp.prisma.user.update({
        where: {
          id: registerBody.user.id,
        },
        data: {
          isActive: false,
        },
      });

      const response = await testApp.app.request("/api/auth/user", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${registerBody.token}`,
        },
      });
      const body = await readJson<ErrorBody>(response);

      expect(response.status).toBe(401);
      expect(body.detail).toBe("Could not validate credentials");
    } finally {
      await testApp.cleanup();
    }
  });
});
