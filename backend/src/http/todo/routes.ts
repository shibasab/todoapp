import type { PrismaClient } from "@prisma/client";
import {
  CreateTodoRequestSchema,
  ListTodoQuerySchema,
  UpdateTodoRequestSchema,
} from "@todoapp/shared";
import { Hono } from "hono";
import type { AuthConfig } from "../../domain/auth/types";
import { createPrismaAuthUserRepoPort } from "../../infra/auth/prisma-auth-user-repo-port";
import { jwtTokenPort } from "../../infra/auth/jwt-token-port";
import { createPrismaTodoRepoPort } from "../../infra/todo/prisma-todo-repo-port";
import { systemClock } from "../../ports/clock-port";
import { createAuthenticateUseCase } from "../../usecases/auth/authenticate";
import { createGetTodoUseCase, createListTodosUseCase } from "../../usecases/todo/read-todos";
import {
  createCreateTodoUseCase,
  createDeleteTodoUseCase,
  createUpdateTodoUseCase,
} from "../../usecases/todo/write-todos";
import { toTodoValidationError, type TodoUseCaseError } from "../../usecases/todo/errors";
import { todoIdParamSchema } from "./schemas";
import { readJsonBody, readValidationField, type JsonResponder } from "../shared/request-utils";
import { toTodoHttpError } from "./to-http-error";

export type TodoHttpRouteDependencies = Readonly<{
  prisma: PrismaClient;
  authConfig: AuthConfig;
}>;

const toDateOrNull = (dateValue: string | null | undefined): Date | null => {
  if (dateValue == null) {
    return null;
  }

  return new Date(`${dateValue}T00:00:00.000Z`);
};

export const createTodoHttpRoutes = (dependencies: TodoHttpRouteDependencies): Hono => {
  const router = new Hono({ strict: false });
  const authUserRepo = createPrismaAuthUserRepoPort(dependencies.prisma);
  const authenticate = createAuthenticateUseCase({
    authUserRepo,
    tokenPort: jwtTokenPort,
    authConfig: dependencies.authConfig,
  });
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
    const authenticated = await authenticate(context.req.header("Authorization"));
    if (!authenticated.ok) {
      return context.json({ detail: authenticated.error.detail }, 401);
    }

    const parsedQuery = ListTodoQuerySchema.safeParse(context.req.query());
    if (!parsedQuery.success) {
      return respondError(
        context,
        toTodoValidationError([
          {
            field: readValidationField(parsedQuery.error, "query"),
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
    const authenticated = await authenticate(context.req.header("Authorization"));
    if (!authenticated.ok) {
      return context.json({ detail: authenticated.error.detail }, 401);
    }

    const rawBody = await readJsonBody(context);
    if (!rawBody.ok) {
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

    const parsedBody = CreateTodoRequestSchema.safeParse(rawBody.data);
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
    const authenticated = await authenticate(context.req.header("Authorization"));
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
    const authenticated = await authenticate(context.req.header("Authorization"));
    if (!authenticated.ok) {
      return context.json({ detail: authenticated.error.detail }, 401);
    }

    const parsedParams = todoIdParamSchema.safeParse(context.req.param());
    if (!parsedParams.success) {
      return context.json({ detail: "Todo not found" }, 404);
    }

    const rawBody = await readJsonBody(context);
    if (!rawBody.ok) {
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

    const parsedBody = UpdateTodoRequestSchema.safeParse(rawBody.data);
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
    const authenticated = await authenticate(context.req.header("Authorization"));
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
