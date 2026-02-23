import type { PrismaClient } from "@prisma/client";
import { Hono } from "hono";
import { createAuthService } from "../../auth/service";
import type { AuthConfig } from "../../auth/types";
import { createPrismaTodoRepoPort } from "../../infra/todo/prisma-todo-repo-port";
import { systemClock } from "../../ports/clock-port";
import { createGetTodoUseCase, createListTodosUseCase } from "../../usecases/todo/read-todos";
import { toTodoValidationError, type TodoUseCaseError } from "../../usecases/todo/errors";
import { listTodoQuerySchema, todoIdParamSchema } from "./schemas";
import { toTodoHttpError } from "./to-http-error";

export type TodoHttpRouteDependencies = Readonly<{
  prisma: PrismaClient;
  authConfig: AuthConfig;
}>;

type JsonResponder = Readonly<{
  json: (body: Record<string, unknown>, init?: number | ResponseInit) => Response;
}>;

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

  return router;
};
