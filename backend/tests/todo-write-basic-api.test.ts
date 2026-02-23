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
});
