import { afterAll, describe, expect, it } from "vitest";
import { createApp, type AppDependencies } from "../src/app";
import { createSqliteApiTestAppFactory } from "./support/sqlite-api-test-harness";

type AuthBody = Readonly<{
  user: Readonly<{
    id: number;
    username: string;
    email: string;
  }>;
  token: string;
}>;

type TodoBody = Readonly<{
  id: number;
  name: string;
  detail: string;
  dueDate: string | null;
  progressStatus: "not_started" | "in_progress" | "completed";
  recurrenceType: "none" | "daily" | "weekly" | "monthly";
  parentId: number | null;
  parentTitle: string | null;
}>;

type ValidationErrorBody = Readonly<{
  status: number;
  type: "validation_error";
  detail: string;
  errors: readonly Readonly<{
    field: string;
    reason: string;
  }>[];
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
    jwtSecret: "test-secret",
    jwtAccessTokenExpireMinutes: 30,
  },
});

const { cleanupTemplateDatabase, setupApiTestApp } = createSqliteApiTestAppFactory();

const setupTodoTestApp = async () => setupApiTestApp(authDependencies());

afterAll(async () => {
  await cleanupTemplateDatabase();
});

const register = async (
  app: ReturnType<typeof createApp>,
  username: string,
  email: string,
): Promise<AuthBody> => {
  const response = await app.request(
    createJsonRequest("/api/auth/register", {
      username,
      email,
      password: "password123",
    }),
  );

  return readJson<AuthBody>(response);
};

const toAuthHeader = (token: string): Readonly<Record<string, string>> => ({
  Authorization: `Bearer ${token}`,
});

describe("todo write basic api", () => {
  it("POST /api/todo/ でTodoを作成できる", async () => {
    const testApp = await setupTodoTestApp();

    try {
      const auth = await register(testApp.app, "todo-create-user", "todo-create@example.com");

      const response = await testApp.app.request(
        createJsonRequest("/api/todo/", {
          name: "new task",
          detail: "new detail",
        }),
        {
          headers: toAuthHeader(auth.token),
        },
      );
      const body = await readJson<TodoBody>(response);

      expect(response.status).toBe(201);
      expect(body.name).toBe("new task");
      expect(body.detail).toBe("new detail");
      expect(body.progressStatus).toBe("not_started");
      expect(body.recurrenceType).toBe("none");
    } finally {
      await testApp.cleanup();
    }
  });

  it("POST /api/todo/ は重複名で422 unique_violationを返す", async () => {
    const testApp = await setupTodoTestApp();

    try {
      const auth = await register(testApp.app, "todo-dup-user", "todo-dup@example.com");

      await testApp.app.request(
        createJsonRequest("/api/todo/", {
          name: "duplicate task",
        }),
        {
          headers: toAuthHeader(auth.token),
        },
      );

      const response = await testApp.app.request(
        createJsonRequest("/api/todo/", {
          name: "duplicate task",
        }),
        {
          headers: toAuthHeader(auth.token),
        },
      );
      const body = await readJson<ValidationErrorBody>(response);

      expect(response.status).toBe(422);
      expect(body.errors).toContainEqual({
        field: "name",
        reason: "unique_violation",
      });
    } finally {
      await testApp.cleanup();
    }
  });

  it("POST /api/todo/ は不正JWTで401を返す", async () => {
    const testApp = await setupTodoTestApp();

    try {
      const response = await testApp.app.request(
        createJsonRequest("/api/todo/", {
          name: "invalid-token-task",
        }),
        {
          headers: {
            Authorization: "Bearer invalid.token.value",
          },
        },
      );
      const body = await readJson<ErrorBody>(response);

      expect(response.status).toBe(401);
      expect(body.detail).toBe("Could not validate credentials");
    } finally {
      await testApp.cleanup();
    }
  });

  it("POST /api/todo/ は繰り返し指定時にdueDate必須", async () => {
    const testApp = await setupTodoTestApp();

    try {
      const auth = await register(testApp.app, "todo-rec-user", "todo-rec@example.com");

      const response = await testApp.app.request(
        createJsonRequest("/api/todo/", {
          name: "daily task",
          recurrenceType: "daily",
        }),
        {
          headers: toAuthHeader(auth.token),
        },
      );
      const body = await readJson<ValidationErrorBody>(response);

      expect(response.status).toBe(422);
      expect(body.errors).toContainEqual({ field: "dueDate", reason: "required" });
    } finally {
      await testApp.cleanup();
    }
  });

  it("POST /api/todo/ はサブタスクへの繰り返し設定を409で拒否する", async () => {
    const testApp = await setupTodoTestApp();

    try {
      const auth = await register(testApp.app, "todo-sub-user", "todo-sub@example.com");
      const parent = await testApp.prisma.todo.create({
        data: {
          ownerId: auth.user.id,
          name: "parent",
          detail: "",
          progressStatus: "in_progress",
          recurrenceType: "none",
          activeName: "parent",
        },
      });

      const response = await testApp.app.request(
        createJsonRequest("/api/todo/", {
          name: "sub",
          parentId: parent.id,
          recurrenceType: "daily",
          dueDate: "2025-01-01",
        }),
        {
          headers: toAuthHeader(auth.token),
        },
      );
      const body = await readJson<ErrorBody>(response);

      expect(response.status).toBe(409);
      expect(body.detail).toBe("サブタスクには繰り返し設定できません");
    } finally {
      await testApp.cleanup();
    }
  });

  it("POST /api/todo/ は不正ボディ形式で422を返す", async () => {
    const testApp = await setupTodoTestApp();

    try {
      const auth = await register(testApp.app, "todo-invalid-user", "todo-invalid@example.com");
      const response = await testApp.app.request(
        createJsonRequest("/api/todo/", {
          name: 123,
        }),
        {
          headers: toAuthHeader(auth.token),
        },
      );
      const body = await readJson<ValidationErrorBody>(response);

      expect(response.status).toBe(422);
      expect(body.type).toBe("validation_error");
    } finally {
      await testApp.cleanup();
    }
  });

  it("POST /api/todo/ は配列ボディを422で拒否し、field=bodyを返す", async () => {
    const testApp = await setupTodoTestApp();

    try {
      const auth = await register(testApp.app, "todo-array-user", "todo-array@example.com");
      const response = await testApp.app.request(
        createJsonRequest("/api/todo/", [
          {
            name: "invalid",
          },
        ]),
        {
          headers: toAuthHeader(auth.token),
        },
      );
      const body = await readJson<ValidationErrorBody>(response);

      expect(response.status).toBe(422);
      expect(body.errors).toContainEqual({
        field: "body",
        reason: "invalid_format",
      });
    } finally {
      await testApp.cleanup();
    }
  });

  it("DELETE /api/todo/{id} で削除できる", async () => {
    const testApp = await setupTodoTestApp();

    try {
      const auth = await register(testApp.app, "todo-delete-user", "todo-delete@example.com");
      const todo = await testApp.prisma.todo.create({
        data: {
          ownerId: auth.user.id,
          name: "delete me",
          detail: "",
          progressStatus: "not_started",
          recurrenceType: "none",
          activeName: "delete me",
        },
      });

      const response = await testApp.app.request(`/api/todo/${todo.id}/`, {
        method: "DELETE",
        headers: toAuthHeader(auth.token),
      });

      expect(response.status).toBe(204);

      const found = await testApp.prisma.todo.findUnique({
        where: {
          id: todo.id,
        },
      });
      expect(found).toBeNull();
    } finally {
      await testApp.cleanup();
    }
  });

  it("DELETE /api/todo/{id} は不正JWTで401を返す", async () => {
    const testApp = await setupTodoTestApp();

    try {
      const response = await testApp.app.request("/api/todo/1/", {
        method: "DELETE",
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

  it("DELETE /api/todo/{id} は認証なしで401を返す", async () => {
    const testApp = await setupTodoTestApp();

    try {
      const response = await testApp.app.request("/api/todo/1/", {
        method: "DELETE",
      });
      const body = await readJson<ErrorBody>(response);

      expect(response.status).toBe(401);
      expect(body.detail).toBe("Could not validate credentials");
    } finally {
      await testApp.cleanup();
    }
  });

  it("DELETE /api/todo/{id} は不正IDと未存在IDで404を返す", async () => {
    const testApp = await setupTodoTestApp();

    try {
      const auth = await register(
        testApp.app,
        "todo-delete-notfound-user",
        "todo-delete-notfound@example.com",
      );

      const invalidIdResponse = await testApp.app.request("/api/todo/invalid/", {
        method: "DELETE",
        headers: toAuthHeader(auth.token),
      });
      const invalidIdBody = await readJson<ErrorBody>(invalidIdResponse);

      const notFoundResponse = await testApp.app.request("/api/todo/999999/", {
        method: "DELETE",
        headers: toAuthHeader(auth.token),
      });
      const notFoundBody = await readJson<ErrorBody>(notFoundResponse);

      expect(invalidIdResponse.status).toBe(404);
      expect(invalidIdBody.detail).toBe("Todo not found");
      expect(notFoundResponse.status).toBe(404);
      expect(notFoundBody.detail).toBe("Todo not found");
    } finally {
      await testApp.cleanup();
    }
  });
});
