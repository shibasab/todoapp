import type { PrismaClient } from "@prisma/client";
import { Hono } from "hono";
import { createAuthService } from "../../auth/service";
import type { AuthConfig } from "../../auth/types";
import { createPrismaTodoRepoPort } from "../../infra/todo/prisma-todo-repo-port";
import { systemClock } from "../../ports/clock-port";
import { createGetTodoUseCase, createListTodosUseCase } from "../../usecases/todo/read-todos";
import { createCreateTodoUseCase, createDeleteTodoUseCase } from "../../usecases/todo/write-todos";
import { toTodoValidationError, type TodoUseCaseError } from "../../usecases/todo/errors";
import { createUpdateTodoUseCase } from "../../usecases/todo/update-todo";
import {
  createTodoBodySchema,
  listTodoQuerySchema,
  todoIdParamSchema,
  updateTodoBodySchema,
} from "./schemas";
import { toTodoHttpError } from "./to-http-error";

export type TodoHttpRouteDependencies = Readonly<{
  prisma: PrismaClient;
  authConfig: AuthConfig;
}>;

type JsonResponder = Readonly<{
  json: (body: Record<string, unknown>, init?: number | ResponseInit) => Response;
}>;

const toDateOrNull = (dateValue: string | null | undefined): Date | null => {
  if (dateValue == null) {
    return null;
  }

  return new Date(`${dateValue}T00:00:00.000Z`);
};

const readValidationField = (errorValue: {
  issues: readonly { path: readonly unknown[] }[];
}): string => {
  const field = errorValue.issues[0]?.path[0];
  return typeof field === "string" ? field : "body";
};
export const createTodoHttpRoutes = (dependencies: TodoHttpRouteDependencies): Hono => {
  const router = new Hono({ strict: false });
  const authService = createAuthService(dependencies.prisma, dependencies.authConfig);
  const todoRepo = createPrismaTodoRepoPort(dependencies.prisma);
  const listTodos = createListTodosUseCase({
    todoRepo,
    clock: systemClock,
  });
  const getTodo = createGetTodoUseCase({
    todoRepo,
  });
  const createTodo = createCreateTodoUseCase({
    todoRepo,
  });
  const deleteTodo = createDeleteTodoUseCase({
    todoRepo,
  });
  const updateTodo = createUpdateTodoUseCase({
    todoRepo,
    clock: systemClock,
  });

  const respondError = (context: JsonResponder, errorValue: TodoUseCaseError): Response => {
    const httpError = toTodoHttpError(errorValue);
    return context.json(httpError.body, {
      status: httpError.status,
    });
  };

  router.get("/", async (context) => {
    const authenticated = await authService.authenticate(context.req.header("Authorization"));
    if (!authenticated.ok) {
      return context.json({ detail: authenticated.error.detail }, 401);
    }

    const parsedQuery = listTodoQuerySchema.safeParse(context.req.query());
    if (!parsedQuery.success) {
      const firstIssue = parsedQuery.error.issues[0];
      const field = typeof firstIssue?.path[0] === "string" ? firstIssue.path[0] : "query";
      return respondError(
        context,
        toTodoValidationError([
          {
            field,
            reason: "invalid_format",
          },
        ]),
      );
    }

    const result = await listTodos({
      userId: authenticated.data.id,
      ...(parsedQuery.data.keyword === undefined ? {} : { keyword: parsedQuery.data.keyword }),
      ...(parsedQuery.data.progressStatus === undefined
        ? {}
        : { progressStatus: parsedQuery.data.progressStatus }),
      ...(parsedQuery.data.dueDate === undefined
        ? {}
        : { dueDateFilter: parsedQuery.data.dueDate }),
    });
    if (!result.ok) {
      return respondError(context, result.error);
    }

    return context.json(result.data);
  });

  router.post("/", async (context) => {
    const authenticated = await authService.authenticate(context.req.header("Authorization"));
    if (!authenticated.ok) {
      return context.json({ detail: authenticated.error.detail }, 401);
    }

    const rawBody = await context.req.json().catch(() => null);
    if (rawBody == null) {
      return respondError(
        context,
        toTodoValidationError([
          {
            field: "body",
            reason: "invalid_format",
          },
        ]),
      );
    }

    const parsedBody = createTodoBodySchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return respondError(
        context,
        toTodoValidationError([
          {
            field: readValidationField(parsedBody.error),
            reason: "invalid_format",
          },
        ]),
      );
    }

    const result = await createTodo({
      userId: authenticated.data.id,
      name: parsedBody.data.name,
      detail: parsedBody.data.detail,
      dueDate: toDateOrNull(parsedBody.data.dueDate),
      progressStatus: parsedBody.data.progressStatus,
      recurrenceType: parsedBody.data.recurrenceType,
      parentId: parsedBody.data.parentId,
    });
    if (!result.ok) {
      return respondError(context, result.error);
    }

    return context.json(result.data, 201);
  });

  router.get("/:todoId", async (context) => {
    const authenticated = await authService.authenticate(context.req.header("Authorization"));
    if (!authenticated.ok) {
      return context.json({ detail: authenticated.error.detail }, 401);
    }

    const parsedParams = todoIdParamSchema.safeParse(context.req.param());
    if (!parsedParams.success) {
      return context.json({ detail: "Todo not found" }, 404);
    }

    const result = await getTodo({
      userId: authenticated.data.id,
      todoId: parsedParams.data.todoId,
    });
    if (!result.ok) {
      return respondError(context, result.error);
    }

    return context.json(result.data);
  });

  router.put("/:todoId", async (context) => {
    const authenticated = await authService.authenticate(context.req.header("Authorization"));
    if (!authenticated.ok) {
      return context.json({ detail: authenticated.error.detail }, 401);
    }

    const parsedParams = todoIdParamSchema.safeParse(context.req.param());
    if (!parsedParams.success) {
      return context.json({ detail: "Todo not found" }, 404);
    }

    const rawBody = await context.req.json().catch(() => null);
    if (rawBody == null) {
      return respondError(
        context,
        toTodoValidationError([
          {
            field: "body",
            reason: "invalid_format",
          },
        ]),
      );
    }

    const parsedBody = updateTodoBodySchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return respondError(
        context,
        toTodoValidationError([
          {
            field: readValidationField(parsedBody.error),
            reason: "invalid_format",
          },
        ]),
      );
    }

    const result = await updateTodo({
      userId: authenticated.data.id,
      todoId: parsedParams.data.todoId,
      ...(parsedBody.data.name === undefined ? {} : { name: parsedBody.data.name }),
      ...(parsedBody.data.detail === undefined
        ? {}
        : {
            detail: parsedBody.data.detail == null ? "" : parsedBody.data.detail,
          }),
      ...(parsedBody.data.dueDate === undefined
        ? {}
        : { dueDate: toDateOrNull(parsedBody.data.dueDate) }),
      ...(parsedBody.data.progressStatus === undefined
        ? {}
        : { progressStatus: parsedBody.data.progressStatus }),
      ...(parsedBody.data.recurrenceType === undefined
        ? {}
        : { recurrenceType: parsedBody.data.recurrenceType }),
    });
    if (!result.ok) {
      return respondError(context, result.error);
    }

    return context.json(result.data);
  });

  router.delete("/:todoId", async (context) => {
    const authenticated = await authService.authenticate(context.req.header("Authorization"));
    if (!authenticated.ok) {
      return context.json({ detail: authenticated.error.detail }, 401);
    }

    const parsedParams = todoIdParamSchema.safeParse(context.req.param());
    if (!parsedParams.success) {
      return context.json({ detail: "Todo not found" }, 404);
    }

    const result = await deleteTodo({
      userId: authenticated.data.id,
      todoId: parsedParams.data.todoId,
    });
    if (!result.ok) {
      return respondError(context, result.error);
    }

    return new Response(null, {
      status: result.data.status,
    });
  });

  return router;
};
