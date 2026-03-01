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

const createJsonRequest = (pathname: string, method: "POST" | "PUT", body: unknown): Request =>
  new Request(`http://localhost${pathname}`, {
    method,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

const createMalformedJsonRequest = (
  pathname: string,
  method: "POST" | "PUT",
  body: string,
): Request =>
  new Request(`http://localhost${pathname}`, {
    method,
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
    createJsonRequest("/api/auth/register", "POST", {
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

const todayUtc = (): Date => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

describe("todo update api", () => {
  it("PUT /api/todo/{id} で繰り返し完了時に次回タスクを生成する", async () => {
    const testApp = await setupTodoTestApp();

    try {
      const auth = await register(testApp.app, "todo-update-user", "todo-update@example.com");
      const baseDueDate = todayUtc();
      const target = await testApp.prisma.todo.create({
        data: {
          ownerId: auth.user.id,
          name: "daily task",
          detail: "",
          progressStatus: "in_progress",
          recurrenceType: "daily",
          dueDate: baseDueDate,
          activeName: "daily task",
        },
      });

      const response = await testApp.app.request(
        createJsonRequest(`/api/todo/${target.id}/`, "PUT", {
          progressStatus: "completed",
        }),
        {
          headers: toAuthHeader(auth.token),
        },
      );
      const body = await readJson<TodoBody>(response);

      expect(response.status).toBe(200);
      expect(body.progressStatus).toBe("completed");

      const todos = await testApp.prisma.todo.findMany({
        where: {
          ownerId: auth.user.id,
        },
        orderBy: {
          id: "asc",
        },
      });

      expect(todos).toHaveLength(2);
      const successor = todos.find((todo) => todo.previousTodoId === target.id);
      expect(successor).toBeDefined();
      expect(successor?.progressStatus).toBe("not_started");
      expect(successor?.name).toBe("daily task");
    } finally {
      await testApp.cleanup();
    }
  });

  it("PUT /api/todo/{id} は未完了サブタスクがある親完了を409で拒否する", async () => {
    const testApp = await setupTodoTestApp();

    try {
      const auth = await register(testApp.app, "todo-parent-user", "todo-parent@example.com");
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

      await testApp.prisma.todo.create({
        data: {
          ownerId: auth.user.id,
          name: "child",
          detail: "",
          progressStatus: "not_started",
          recurrenceType: "none",
          parentId: parent.id,
          activeName: "child",
        },
      });

      const response = await testApp.app.request(
        createJsonRequest(`/api/todo/${parent.id}/`, "PUT", {
          progressStatus: "completed",
        }),
        {
          headers: toAuthHeader(auth.token),
        },
      );
      const body = await readJson<ErrorBody>(response);

      expect(response.status).toBe(409);
      expect(body.detail).toBe("未完了のサブタスクがあるため完了できません");
    } finally {
      await testApp.cleanup();
    }
  });

  it("PUT /api/todo/{id} は重複名で422 unique_violationを返す", async () => {
    const testApp = await setupTodoTestApp();

    try {
      const auth = await register(testApp.app, "todo-rename-user", "todo-rename@example.com");
      const existing = await testApp.prisma.todo.create({
        data: {
          ownerId: auth.user.id,
          name: "existing",
          detail: "",
          progressStatus: "in_progress",
          recurrenceType: "none",
          activeName: "existing",
        },
      });
      const target = await testApp.prisma.todo.create({
        data: {
          ownerId: auth.user.id,
          name: "target",
          detail: "",
          progressStatus: "in_progress",
          recurrenceType: "none",
          activeName: "target",
        },
      });

      const response = await testApp.app.request(
        createJsonRequest(`/api/todo/${target.id}/`, "PUT", {
          name: existing.name,
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

  it("PUT /api/todo/{id} はサブタスクに繰り返しを設定すると409を返す", async () => {
    const testApp = await setupTodoTestApp();

    try {
      const auth = await register(testApp.app, "todo-sub-put-user", "todo-sub-put@example.com");
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
      const subtask = await testApp.prisma.todo.create({
        data: {
          ownerId: auth.user.id,
          name: "sub",
          detail: "",
          progressStatus: "in_progress",
          recurrenceType: "none",
          parentId: parent.id,
          activeName: "sub",
        },
      });

      const response = await testApp.app.request(
        createJsonRequest(`/api/todo/${subtask.id}/`, "PUT", {
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

  it("PUT /api/todo/{id} は他ユーザーのタスク更新を404で拒否する", async () => {
    const testApp = await setupTodoTestApp();

    try {
      const owner = await register(testApp.app, "todo-owner-user", "todo-owner@example.com");
      const another = await register(testApp.app, "todo-another-user", "todo-another@example.com");
      const target = await testApp.prisma.todo.create({
        data: {
          ownerId: owner.user.id,
          name: "owner task",
          detail: "",
          progressStatus: "in_progress",
          recurrenceType: "daily",
          dueDate: todayUtc(),
          activeName: "owner task",
        },
      });

      const response = await testApp.app.request(
        createJsonRequest(`/api/todo/${target.id}/`, "PUT", {
          progressStatus: "completed",
        }),
        {
          headers: toAuthHeader(another.token),
        },
      );
      const body = await readJson<ErrorBody>(response);

      expect(response.status).toBe(404);
      expect(body.detail).toBe("Todo not found");
    } finally {
      await testApp.cleanup();
    }
  });

  it("PUT /api/todo/{id} は認証/入力バリデーション境界を満たす", async () => {
    const testApp = await setupTodoTestApp();

    try {
      const auth = await register(testApp.app, "todo-put-edge-user", "todo-put-edge@example.com");
      const target = await testApp.prisma.todo.create({
        data: {
          ownerId: auth.user.id,
          name: "edge-target",
          detail: "before",
          progressStatus: "in_progress",
          recurrenceType: "none",
          activeName: "edge-target",
        },
      });

      const noAuthResponse = await testApp.app.request(
        createJsonRequest(`/api/todo/${target.id}/`, "PUT", {
          detail: "after",
        }),
      );
      const noAuthBody = await readJson<ErrorBody>(noAuthResponse);

      const invalidJwtResponse = await testApp.app.request(
        createJsonRequest(`/api/todo/${target.id}/`, "PUT", {
          detail: "after",
        }),
        {
          headers: {
            Authorization: "Bearer invalid.token.value",
          },
        },
      );
      const invalidJwtBody = await readJson<ErrorBody>(invalidJwtResponse);

      const invalidIdResponse = await testApp.app.request(
        createJsonRequest("/api/todo/invalid/", "PUT", {
          detail: "after",
        }),
        {
          headers: toAuthHeader(auth.token),
        },
      );
      const invalidIdBody = await readJson<ErrorBody>(invalidIdResponse);

      const malformedJsonResponse = await testApp.app.request(
        createMalformedJsonRequest(`/api/todo/${target.id}/`, "PUT", '{"detail":"x"'),
        {
          headers: toAuthHeader(auth.token),
        },
      );
      const malformedJsonBody = await readJson<ValidationErrorBody>(malformedJsonResponse);

      const invalidBodyResponse = await testApp.app.request(
        createJsonRequest(`/api/todo/${target.id}/`, "PUT", {
          name: 100,
        }),
        {
          headers: toAuthHeader(auth.token),
        },
      );
      const invalidBody = await readJson<ValidationErrorBody>(invalidBodyResponse);

      const nullDetailResponse = await testApp.app.request(
        createJsonRequest(`/api/todo/${target.id}/`, "PUT", {
          detail: null,
        }),
        {
          headers: toAuthHeader(auth.token),
        },
      );
      const nullDetailBody = await readJson<TodoBody>(nullDetailResponse);

      const textDetailResponse = await testApp.app.request(
        createJsonRequest(`/api/todo/${target.id}/`, "PUT", {
          detail: "changed",
        }),
        {
          headers: toAuthHeader(auth.token),
        },
      );
      const textDetailBody = await readJson<TodoBody>(textDetailResponse);

      expect(noAuthResponse.status).toBe(401);
      expect(noAuthBody.detail).toBe("Could not validate credentials");
      expect(invalidJwtResponse.status).toBe(401);
      expect(invalidJwtBody.detail).toBe("Could not validate credentials");
      expect(invalidIdResponse.status).toBe(404);
      expect(invalidIdBody.detail).toBe("Todo not found");
      expect(malformedJsonResponse.status).toBe(422);
      expect(malformedJsonBody.errors).toContainEqual({
        field: "body",
        reason: "invalid_format",
      });
      expect(invalidBodyResponse.status).toBe(422);
      expect(invalidBody.errors).toContainEqual({
        field: "name",
        reason: "invalid_format",
      });
      expect(nullDetailResponse.status).toBe(200);
      expect(nullDetailBody.detail).toBe("");
      expect(textDetailResponse.status).toBe(200);
      expect(textDetailBody.detail).toBe("changed");
    } finally {
      await testApp.cleanup();
    }
  });
});
