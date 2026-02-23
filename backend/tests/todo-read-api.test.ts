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
  createdAt: string;
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

const toUtcDate = (offsetDays: number): Date => {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return new Date(today.getTime() + offsetDays * 24 * 60 * 60 * 1000);
};

describe("todo read api", () => {
  it("GET /api/todo/ は認証なしで401を返す", async () => {
    const testApp = await setupTodoTestApp();

    try {
      const response = await testApp.app.request("/api/todo/", {
        method: "GET",
      });
      const body = await readJson<ErrorBody>(response);

      expect(response.status).toBe(401);
      expect(body.detail).toBe("Could not validate credentials");
    } finally {
      await testApp.cleanup();
    }
  });

  it("GET /api/todo/ は query フィルタで絞り込める", async () => {
    const testApp = await setupTodoTestApp();

    try {
      const auth = await register(testApp.app, "todo-read-user", "todo-read@example.com");

      await testApp.prisma.todo.createMany({
        data: [
          {
            ownerId: auth.user.id,
            name: "weekly report",
            detail: "contains % and _ literally",
            progressStatus: "in_progress",
            recurrenceType: "none",
            dueDate: toUtcDate(0),
            activeName: "weekly report",
          },
          {
            ownerId: auth.user.id,
            name: "completed task",
            detail: "done",
            progressStatus: "completed",
            recurrenceType: "none",
            dueDate: toUtcDate(0),
            activeName: null,
          },
          {
            ownerId: auth.user.id,
            name: "future task",
            detail: "later",
            progressStatus: "in_progress",
            recurrenceType: "none",
            dueDate: toUtcDate(3),
            activeName: "future task",
          },
        ],
      });

      const response = await testApp.app.request(
        "/api/todo/?keyword=%&progress_status=in_progress&due_date=today",
        {
          method: "GET",
          headers: toAuthHeader(auth.token),
        },
      );
      const body = await readJson<readonly TodoBody[]>(response);

      expect(response.status).toBe(200);
      expect(body).toHaveLength(1);
      expect(body[0]?.name).toBe("weekly report");
      expect(body[0]?.progressStatus).toBe("in_progress");
    } finally {
      await testApp.cleanup();
    }
  });

  it("GET /api/todo/ は不正due_dateで422を返す", async () => {
    const testApp = await setupTodoTestApp();

    try {
      const auth = await register(testApp.app, "query-user", "query-user@example.com");
      const response = await testApp.app.request("/api/todo/?due_date=invalid", {
        method: "GET",
        headers: toAuthHeader(auth.token),
      });
      const body = await readJson<ValidationErrorBody>(response);

      expect(response.status).toBe(422);
      expect(body.type).toBe("validation_error");
      expect(body.errors).toContainEqual({ field: "due_date", reason: "invalid_format" });
    } finally {
      await testApp.cleanup();
    }
  });

  it("GET /api/todo/{id} はサブタスク進捗を返す", async () => {
    const testApp = await setupTodoTestApp();

    try {
      const auth = await register(testApp.app, "detail-user", "detail-user@example.com");
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

      await testApp.prisma.todo.createMany({
        data: [
          {
            ownerId: auth.user.id,
            name: "sub-1",
            detail: "",
            progressStatus: "completed",
            recurrenceType: "none",
            parentId: parent.id,
            activeName: null,
          },
          {
            ownerId: auth.user.id,
            name: "sub-2",
            detail: "",
            progressStatus: "not_started",
            recurrenceType: "none",
            parentId: parent.id,
            activeName: "sub-2",
          },
        ],
      });

      const response = await testApp.app.request(`/api/todo/${parent.id}/`, {
        method: "GET",
        headers: toAuthHeader(auth.token),
      });
      const body = await readJson<TodoBody>(response);

      expect(response.status).toBe(200);
      expect(body.totalSubtaskCount).toBe(2);
      expect(body.completedSubtaskCount).toBe(1);
      expect(body.subtaskProgressPercent).toBe(50);
    } finally {
      await testApp.cleanup();
    }
  });

  it("GET /api/todo/{id} は不正ID・未存在で404を返す", async () => {
    const testApp = await setupTodoTestApp();

    try {
      const auth = await register(testApp.app, "missing-user", "missing-user@example.com");

      const invalidIdResponse = await testApp.app.request("/api/todo/invalid/", {
        method: "GET",
        headers: toAuthHeader(auth.token),
      });
      const invalidIdBody = await readJson<ErrorBody>(invalidIdResponse);

      const notFoundResponse = await testApp.app.request("/api/todo/99999/", {
        method: "GET",
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
