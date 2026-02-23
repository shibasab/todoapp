import { describe, expect, it } from "vitest";

import { createApp, type AppDependencies } from "../src/app";
import {
  createPrismaClient,
  createTemporarySqliteDatabase,
  ensureSqliteSchema,
} from "../src/infra/prisma/testing";

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
  completedSubtaskCount: number;
  totalSubtaskCount: number;
  subtaskProgressPercent: number;
}>;

type ValidationErrorBody = Readonly<{
  status: number;
  type: "validation_error";
  detail: string;
  errors: readonly Readonly<{
    field: string;
    reason: string;
    limit?: number;
  }>[];
}>;

type ErrorBody = Readonly<{
  detail: string;
}>;

const readJson = async <T>(response: Response): Promise<T> => {
  const bodyText = await response.text();
  try {
    return JSON.parse(bodyText) as T;
  } catch {
    throw new Error(`JSON parse error: status=${response.status}, body=${bodyText}`);
  }
};

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

const setupTodoTestApp = async () => {
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
    prisma,
    cleanup: async () => {
      await prisma.$disconnect();
      await temporaryDatabase.cleanup();
    },
  };
};

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

const toUtcDateString = (dateValue: Date): string => dateValue.toISOString().slice(0, 10);

const utcDateFromNow = (offsetDays: number): Date => {
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return new Date(todayUtc.getTime() + offsetDays * 24 * 60 * 60 * 1000);
};

describe("todo routes", () => {
  it("POST /api/todo/ でTodoを作成できる", async () => {
    const testApp = await setupTodoTestApp();

    try {
      const auth = await register(testApp.app, "todo-user", "todo@example.com");
      const response = await testApp.app.request(
        createJsonRequest("/api/todo/", "POST", {
          name: "Test Task",
          detail: "Test Detail",
        }),
        {
          headers: toAuthHeader(auth.token),
        },
      );
      const body = await readJson<TodoBody>(response);

      expect(response.status).toBe(201);
      expect(body.name).toBe("Test Task");
      expect(body.detail).toBe("Test Detail");
      expect(body.progressStatus).toBe("not_started");
      expect(body.recurrenceType).toBe("none");
      expect(body.parentId).toBeNull();
      expect(body.completedSubtaskCount).toBe(0);
      expect(body.totalSubtaskCount).toBe(0);
      expect(body.subtaskProgressPercent).toBe(0);
    } finally {
      await testApp.cleanup();
    }
  });

  it("POST /api/todo/ は認証なしで401を返す", async () => {
    const testApp = await setupTodoTestApp();

    try {
      const response = await testApp.app.request(
        createJsonRequest("/api/todo/", "POST", {
          name: "No Auth",
          detail: "",
        }),
      );
      const body = await readJson<ErrorBody>(response);

      expect(response.status).toBe(401);
      expect(body.detail).toBe("Could not validate credentials");
    } finally {
      await testApp.cleanup();
    }
  });

  it("POST /api/todo/ は重複名で422 unique_violationを返す", async () => {
    const testApp = await setupTodoTestApp();

    try {
      const auth = await register(testApp.app, "duplicate-user", "duplicate@example.com");

      await testApp.app.request(
        createJsonRequest("/api/todo/", "POST", {
          name: "Duplicate Task",
          detail: "first",
        }),
        {
          headers: toAuthHeader(auth.token),
        },
      );

      const response = await testApp.app.request(
        createJsonRequest("/api/todo/", "POST", {
          name: "Duplicate Task",
          detail: "second",
        }),
        {
          headers: toAuthHeader(auth.token),
        },
      );
      const body = await readJson<ValidationErrorBody>(response);

      expect(response.status).toBe(422);
      expect(body.type).toBe("validation_error");
      expect(body.errors).toContainEqual({ field: "name", reason: "unique_violation" });
    } finally {
      await testApp.cleanup();
    }
  });

  it("POST /api/todo/ は繰り返し指定時にdueDate必須", async () => {
    const testApp = await setupTodoTestApp();

    try {
      const auth = await register(testApp.app, "rec-user", "rec@example.com");
      const response = await testApp.app.request(
        createJsonRequest("/api/todo/", "POST", {
          name: "Recurring",
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

  it("POST /api/todo/ は不正dueDate形式で422を返す", async () => {
    const testApp = await setupTodoTestApp();

    try {
      const auth = await register(testApp.app, "date-user", "date@example.com");
      const response = await testApp.app.request(
        createJsonRequest("/api/todo/", "POST", {
          name: "Invalid Date",
          dueDate: "not-a-date",
        }),
        {
          headers: toAuthHeader(auth.token),
        },
      );
      const body = await readJson<ValidationErrorBody>(response);

      expect(response.status).toBe(422);
      expect(body.errors).toContainEqual({ field: "dueDate", reason: "invalid_format" });
    } finally {
      await testApp.cleanup();
    }
  });

  it("POST /api/todo/ はサブタスクに繰り返し設定すると409を返す", async () => {
    const testApp = await setupTodoTestApp();

    try {
      const auth = await register(testApp.app, "subtask-user", "subtask@example.com");
      const parentResponse = await testApp.app.request(
        createJsonRequest("/api/todo/", "POST", {
          name: "Parent Task",
          detail: "",
        }),
        {
          headers: toAuthHeader(auth.token),
        },
      );
      const parentBody = await readJson<TodoBody>(parentResponse);

      const response = await testApp.app.request(
        createJsonRequest("/api/todo/", "POST", {
          name: "Child Task",
          parentId: parentBody.id,
          dueDate: "2026-01-01",
          recurrenceType: "daily",
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

  it("POST /api/todo/ はサブタスクを親指定すると409を返す", async () => {
    const testApp = await setupTodoTestApp();

    try {
      const auth = await register(testApp.app, "nested-parent-user", "nested-parent@example.com");
      const parentResponse = await testApp.app.request(
        createJsonRequest("/api/todo/", "POST", {
          name: "Root Parent",
          detail: "",
        }),
        {
          headers: toAuthHeader(auth.token),
        },
      );
      const parentBody = await readJson<TodoBody>(parentResponse);

      const childResponse = await testApp.app.request(
        createJsonRequest("/api/todo/", "POST", {
          name: "Child",
          detail: "",
          parentId: parentBody.id,
        }),
        {
          headers: toAuthHeader(auth.token),
        },
      );
      const childBody = await readJson<TodoBody>(childResponse);

      const response = await testApp.app.request(
        createJsonRequest("/api/todo/", "POST", {
          name: "Nested",
          detail: "",
          parentId: childBody.id,
        }),
        {
          headers: toAuthHeader(auth.token),
        },
      );
      const body = await readJson<ErrorBody>(response);

      expect(response.status).toBe(409);
      expect(body.detail).toBe("サブタスクを親として指定できません");
    } finally {
      await testApp.cleanup();
    }
  });

  it("GET /api/todo/ で keyword/progress_status/due_date フィルタが機能する", async () => {
    const testApp = await setupTodoTestApp();

    try {
      const auth = await register(testApp.app, "filter-user", "filter@example.com");
      await testApp.prisma.todo.createMany({
        data: [
          {
            name: "Alpha Task",
            detail: "keyword target",
            ownerId: auth.user.id,
            progressStatus: "completed",
            dueDate: utcDateFromNow(1),
          },
          {
            name: "Bravo Task",
            detail: "no keyword",
            ownerId: auth.user.id,
            progressStatus: "not_started",
            dueDate: utcDateFromNow(-1),
          },
          {
            name: "Charlie Task",
            detail: "without due date",
            ownerId: auth.user.id,
            progressStatus: "not_started",
            dueDate: null,
          },
        ],
      });

      const keywordResponse = await testApp.app.request("/api/todo/?keyword=Alpha", {
        headers: toAuthHeader(auth.token),
      });
      const keywordBody = await readJson<readonly TodoBody[]>(keywordResponse);
      expect(keywordBody).toHaveLength(1);
      expect(keywordBody[0]?.name).toBe("Alpha Task");

      const completedResponse = await testApp.app.request("/api/todo/?progress_status=completed", {
        headers: toAuthHeader(auth.token),
      });
      const completedBody = await readJson<readonly TodoBody[]>(completedResponse);
      expect(completedBody).toHaveLength(1);
      expect(completedBody[0]?.name).toBe("Alpha Task");

      const overdueResponse = await testApp.app.request("/api/todo/?due_date=overdue", {
        headers: toAuthHeader(auth.token),
      });
      const overdueBody = await readJson<readonly TodoBody[]>(overdueResponse);
      expect(overdueBody).toHaveLength(1);
      expect(overdueBody[0]?.name).toBe("Bravo Task");

      const noneResponse = await testApp.app.request("/api/todo/?due_date=none", {
        headers: toAuthHeader(auth.token),
      });
      const noneBody = await readJson<readonly TodoBody[]>(noneResponse);
      expect(noneBody).toHaveLength(1);
      expect(noneBody[0]?.name).toBe("Charlie Task");
    } finally {
      await testApp.cleanup();
    }
  });

  it("GET /api/todo/ のキーワード検索は % と _ をリテラル扱いする", async () => {
    const testApp = await setupTodoTestApp();

    try {
      const auth = await register(testApp.app, "escape-user", "escape@example.com");
      await testApp.prisma.todo.createMany({
        data: [
          {
            name: "Save 100% Coverage",
            detail: "",
            ownerId: auth.user.id,
            activeName: "Save 100% Coverage",
          },
          {
            name: "Save 100X Coverage",
            detail: "",
            ownerId: auth.user.id,
            activeName: "Save 100X Coverage",
          },
          {
            name: "test_abc",
            detail: "",
            ownerId: auth.user.id,
            activeName: "test_abc",
          },
          {
            name: "testXabc",
            detail: "",
            ownerId: auth.user.id,
            activeName: "testXabc",
          },
        ],
      });

      const percentResponse = await testApp.app.request("/api/todo/?keyword=100%25", {
        headers: toAuthHeader(auth.token),
      });
      const percentBody = await readJson<readonly TodoBody[]>(percentResponse);
      expect(percentBody.map((todo) => todo.name)).toEqual(["Save 100% Coverage"]);

      const underscoreResponse = await testApp.app.request("/api/todo/?keyword=test_abc", {
        headers: toAuthHeader(auth.token),
      });
      const underscoreBody = await readJson<readonly TodoBody[]>(underscoreResponse);
      expect(underscoreBody.map((todo) => todo.name)).toEqual(["test_abc"]);
    } finally {
      await testApp.cleanup();
    }
  });

  it("GET /api/todo/{id}/ でサブタスク進捗を返す", async () => {
    const testApp = await setupTodoTestApp();

    try {
      const auth = await register(testApp.app, "get-user", "get@example.com");
      const parent = await testApp.prisma.todo.create({
        data: {
          name: "Parent For Get",
          detail: "",
          ownerId: auth.user.id,
          activeName: "Parent For Get",
        },
      });
      await testApp.prisma.todo.createMany({
        data: [
          {
            name: "Child 1",
            detail: "",
            ownerId: auth.user.id,
            parentId: parent.id,
            progressStatus: "completed",
            activeName: null,
          },
          {
            name: "Child 2",
            detail: "",
            ownerId: auth.user.id,
            parentId: parent.id,
            progressStatus: "not_started",
            activeName: "Child 2",
          },
        ],
      });

      const response = await testApp.app.request(`/api/todo/${parent.id}/`, {
        headers: toAuthHeader(auth.token),
      });
      const body = await readJson<TodoBody>(response);

      expect(response.status).toBe(200);
      expect(body.parentId).toBeNull();
      expect(body.totalSubtaskCount).toBe(2);
      expect(body.completedSubtaskCount).toBe(1);
      expect(body.subtaskProgressPercent).toBe(50);
    } finally {
      await testApp.cleanup();
    }
  });

  it("PUT /api/todo/{id}/ で繰り返し完了時に次回タスクを生成する", async () => {
    const testApp = await setupTodoTestApp();

    try {
      const auth = await register(testApp.app, "update-user", "update@example.com");
      const dueDate = toUtcDateString(utcDateFromNow(0));

      const createResponse = await testApp.app.request(
        createJsonRequest("/api/todo/", "POST", {
          name: "Recurring Task",
          dueDate,
          recurrenceType: "daily",
        }),
        {
          headers: toAuthHeader(auth.token),
        },
      );
      const created = await readJson<TodoBody>(createResponse);

      const updateResponse = await testApp.app.request(
        createJsonRequest(`/api/todo/${created.id}/`, "PUT", {
          progressStatus: "completed",
        }),
        {
          headers: toAuthHeader(auth.token),
        },
      );

      expect(updateResponse.status).toBe(200);

      const successor = await testApp.prisma.todo.findFirst({
        where: {
          previousTodoId: created.id,
        },
      });
      expect(successor).not.toBeNull();
      expect(successor?.progressStatus).toBe("not_started");
      expect(successor?.recurrenceType).toBe("daily");
    } finally {
      await testApp.cleanup();
    }
  });

  it("PUT /api/todo/{id}/ は未完了子がある親完了を409で拒否する", async () => {
    const testApp = await setupTodoTestApp();

    try {
      const auth = await register(testApp.app, "parent-user", "parent@example.com");
      const parent = await testApp.prisma.todo.create({
        data: {
          name: "Parent",
          detail: "",
          ownerId: auth.user.id,
        },
      });
      await testApp.prisma.todo.create({
        data: {
          name: "Child",
          detail: "",
          ownerId: auth.user.id,
          parentId: parent.id,
          progressStatus: "not_started",
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

  it("DELETE /api/todo/{id}/ で削除できる", async () => {
    const testApp = await setupTodoTestApp();

    try {
      const auth = await register(testApp.app, "delete-user", "delete@example.com");
      const createResponse = await testApp.app.request(
        createJsonRequest("/api/todo/", "POST", {
          name: "Delete Me",
          detail: "",
        }),
        {
          headers: toAuthHeader(auth.token),
        },
      );
      const created = await readJson<TodoBody>(createResponse);

      const deleteResponse = await testApp.app.request(`/api/todo/${created.id}/`, {
        method: "DELETE",
        headers: toAuthHeader(auth.token),
      });
      expect(deleteResponse.status).toBe(204);

      const getResponse = await testApp.app.request(`/api/todo/${created.id}/`, {
        headers: toAuthHeader(auth.token),
      });
      expect(getResponse.status).toBe(404);
    } finally {
      await testApp.cleanup();
    }
  });

  it("POST /api/todo/ は構文不正JSONで422を返す", async () => {
    const testApp = await setupTodoTestApp();

    try {
      const auth = await register(testApp.app, "malformed-user", "malformed@example.com");
      const response = await testApp.app.request(
        createMalformedJsonRequest("/api/todo/", "POST", "{"),
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
});
