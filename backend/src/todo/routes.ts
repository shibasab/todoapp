import type { PrismaClient, Todo } from "@prisma/client";
import { err, ok, type Result } from "@todoapp/shared";
import { Hono } from "hono";
import { createAuthService } from "../auth/service";
import type { AuthConfig } from "../auth/types";

const TODO_NAME_MAX_LENGTH = 100;
const TODO_DETAIL_MAX_LENGTH = 500;

type TodoProgressStatus = "not_started" | "in_progress" | "completed";
type TodoRecurrenceType = "none" | "daily" | "weekly" | "monthly";
type TodoDueDateFilter = "all" | "today" | "this_week" | "overdue" | "none";

type ValidationErrorReason = "required" | "unique_violation" | "max_length" | "invalid_format";

type ValidationError = Readonly<{
  field: string;
  reason: ValidationErrorReason;
  limit?: number;
}>;

type CreateTodoInput = Readonly<{
  name: string;
  detail: string;
  dueDate: Date | null;
  progressStatus: TodoProgressStatus;
  recurrenceType: TodoRecurrenceType;
  parentId: number | null;
}>;

type UpdateTodoInput = {
  name?: string;
  detail?: string;
  dueDate?: Date | null;
  progressStatus?: TodoProgressStatus;
  recurrenceType?: TodoRecurrenceType;
};

export type TodoRouteDependencies = Readonly<{
  prisma: PrismaClient;
  authConfig: AuthConfig;
}>;

const parseRecord = (value: unknown): Result<Readonly<Record<string, unknown>>, "invalid_body"> => {
  if (typeof value !== "object" || value == null || Array.isArray(value)) {
    return err("invalid_body");
  }

  const parsed: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    parsed[key] = entry;
  }
  return ok(parsed);
};

const parseProgressStatus = (value: unknown): Result<TodoProgressStatus, "invalid_format"> => {
  if (value === "not_started" || value === "in_progress" || value === "completed") {
    return ok(value);
  }
  return err("invalid_format");
};

const parseRecurrenceType = (value: unknown): Result<TodoRecurrenceType, "invalid_format"> => {
  if (value === "none" || value === "daily" || value === "weekly" || value === "monthly") {
    return ok(value);
  }
  return err("invalid_format");
};

const toProgressStatus = (value: string): TodoProgressStatus =>
  value === "not_started" || value === "in_progress" || value === "completed"
    ? value
    : "not_started";

const toRecurrenceType = (value: string): TodoRecurrenceType =>
  value === "none" || value === "daily" || value === "weekly" || value === "monthly"
    ? value
    : "none";

const parseDateString = (value: unknown): Result<Date | null, "invalid_format"> => {
  if (value == null) {
    return ok(null);
  }
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return err("invalid_format");
  }

  const dateValue = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(dateValue.getTime()) || dateValue.toISOString().slice(0, 10) !== value) {
    return err("invalid_format");
  }

  return ok(dateValue);
};

const toDateOnlyString = (dateValue: Date | null): string | null =>
  dateValue == null ? null : dateValue.toISOString().slice(0, 10);

const toValidationErrorResponse = (errors: readonly ValidationError[]) => ({
  status: 422,
  type: "validation_error",
  detail: "Validation error",
  errors,
});

const readBearerToken = (
  authorizationHeader: string | undefined,
): Result<string, "unauthorized"> => {
  if (authorizationHeader == null || authorizationHeader === "") {
    return err("unauthorized");
  }

  if (!authorizationHeader.startsWith("Bearer ")) {
    return err("unauthorized");
  }

  const token = authorizationHeader.slice("Bearer ".length).trim();
  return token === "" ? err("unauthorized") : ok(token);
};

const readJsonBody = async (
  context: Readonly<{
    req: Readonly<{
      json: () => Promise<unknown>;
    }>;
  }>,
): Promise<Result<unknown, "invalid_body">> => {
  try {
    return ok(await context.req.json());
  } catch {
    return err("invalid_body");
  }
};

const parseTodoId = (value: string): Result<number, "not_found"> => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return err("not_found");
  }
  return ok(parsed);
};

const hasErrorCode = (
  errorValue: unknown,
): errorValue is Readonly<{ code: string; meta?: unknown }> => {
  if (typeof errorValue !== "object" || errorValue == null || !("code" in errorValue)) {
    return false;
  }

  return typeof errorValue.code === "string";
};

const isUniqueConstraintError = (errorValue: unknown): boolean =>
  hasErrorCode(errorValue) && errorValue.code === "P2002";

const isPreviousTodoUniqueConstraintError = (errorValue: unknown): boolean => {
  if (!hasErrorCode(errorValue) || errorValue.code !== "P2002") {
    return false;
  }

  if (
    typeof errorValue.meta !== "object" ||
    errorValue.meta == null ||
    !("target" in errorValue.meta)
  ) {
    return false;
  }

  const target = errorValue.meta.target;
  if (!Array.isArray(target)) {
    return false;
  }

  return target.includes("previousTodoId") || target.includes("previous_todo_id");
};

const parseCreateTodoInput = (
  body: unknown,
): Result<CreateTodoInput, readonly ValidationError[]> => {
  const record = parseRecord(body);
  if (!record.ok) {
    return err([{ field: "body", reason: "invalid_format" }]);
  }

  const errors: ValidationError[] = [];
  const nameValue = record.data.name;
  if (typeof nameValue !== "string" || nameValue.trim() === "") {
    errors.push({ field: "name", reason: "required" });
  } else if (nameValue.length > TODO_NAME_MAX_LENGTH) {
    errors.push({ field: "name", reason: "max_length", limit: TODO_NAME_MAX_LENGTH });
  }

  const detailValue = record.data.detail;
  if (detailValue != null && typeof detailValue !== "string") {
    errors.push({ field: "detail", reason: "invalid_format" });
  } else if (typeof detailValue === "string" && detailValue.length > TODO_DETAIL_MAX_LENGTH) {
    errors.push({ field: "detail", reason: "max_length", limit: TODO_DETAIL_MAX_LENGTH });
  }

  const dueDateResult = parseDateString(record.data.dueDate);
  if (!dueDateResult.ok) {
    errors.push({ field: "dueDate", reason: "invalid_format" });
  }

  const progressStatusResult =
    record.data.progressStatus == null
      ? ok<TodoProgressStatus>("not_started")
      : parseProgressStatus(record.data.progressStatus);
  if (!progressStatusResult.ok) {
    errors.push({ field: "progressStatus", reason: "invalid_format" });
  }

  const recurrenceTypeResult =
    record.data.recurrenceType == null
      ? ok<TodoRecurrenceType>("none")
      : parseRecurrenceType(record.data.recurrenceType);
  if (!recurrenceTypeResult.ok) {
    errors.push({ field: "recurrenceType", reason: "invalid_format" });
  }

  const parentIdValue = record.data.parentId;
  const parentId =
    parentIdValue == null
      ? null
      : typeof parentIdValue === "number" && Number.isInteger(parentIdValue) && parentIdValue > 0
        ? parentIdValue
        : null;
  if (parentIdValue != null && parentId == null) {
    errors.push({ field: "parentId", reason: "invalid_format" });
  }

  if (
    errors.length > 0 ||
    !dueDateResult.ok ||
    !progressStatusResult.ok ||
    !recurrenceTypeResult.ok
  ) {
    return err(errors);
  }

  if (recurrenceTypeResult.data !== "none" && dueDateResult.data == null) {
    return err([{ field: "dueDate", reason: "required" }]);
  }

  const normalizedName = typeof nameValue === "string" ? nameValue.trim() : "";

  return ok({
    name: normalizedName,
    detail: typeof detailValue === "string" ? detailValue : "",
    dueDate: dueDateResult.data,
    progressStatus: progressStatusResult.data,
    recurrenceType: recurrenceTypeResult.data,
    parentId,
  });
};

const parseUpdateTodoInput = (
  body: unknown,
): Result<UpdateTodoInput, readonly ValidationError[]> => {
  const record = parseRecord(body);
  if (!record.ok) {
    return err([{ field: "body", reason: "invalid_format" }]);
  }

  const errors: ValidationError[] = [];
  const update: UpdateTodoInput = {};

  if ("name" in record.data) {
    const nameValue = record.data.name;
    if (typeof nameValue !== "string" || nameValue.trim() === "") {
      errors.push({ field: "name", reason: "required" });
    } else if (nameValue.length > TODO_NAME_MAX_LENGTH) {
      errors.push({ field: "name", reason: "max_length", limit: TODO_NAME_MAX_LENGTH });
    } else {
      update.name = nameValue.trim();
    }
  }

  if ("detail" in record.data) {
    const detailValue = record.data.detail;
    if (detailValue != null && typeof detailValue !== "string") {
      errors.push({ field: "detail", reason: "invalid_format" });
    } else if (typeof detailValue === "string" && detailValue.length > TODO_DETAIL_MAX_LENGTH) {
      errors.push({ field: "detail", reason: "max_length", limit: TODO_DETAIL_MAX_LENGTH });
    } else {
      update.detail = detailValue == null ? "" : detailValue;
    }
  }

  if ("dueDate" in record.data) {
    const dueDateResult = parseDateString(record.data.dueDate);
    if (!dueDateResult.ok) {
      errors.push({ field: "dueDate", reason: "invalid_format" });
    } else {
      update.dueDate = dueDateResult.data;
    }
  }

  if ("progressStatus" in record.data) {
    const progressStatusResult = parseProgressStatus(record.data.progressStatus);
    if (!progressStatusResult.ok) {
      errors.push({ field: "progressStatus", reason: "invalid_format" });
    } else {
      update.progressStatus = progressStatusResult.data;
    }
  }

  if ("recurrenceType" in record.data) {
    const recurrenceTypeResult = parseRecurrenceType(record.data.recurrenceType);
    if (!recurrenceTypeResult.ok) {
      errors.push({ field: "recurrenceType", reason: "invalid_format" });
    } else {
      update.recurrenceType = recurrenceTypeResult.data;
    }
  }

  if (errors.length > 0) {
    return err(errors);
  }

  return ok(update);
};

const addOneMonth = (baseDate: Date): Date => {
  const year =
    baseDate.getUTCMonth() === 11 ? baseDate.getUTCFullYear() + 1 : baseDate.getUTCFullYear();
  const month = baseDate.getUTCMonth() === 11 ? 0 : baseDate.getUTCMonth() + 1;
  const day = baseDate.getUTCDate();
  const endOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, endOfMonth)));
};

const calculateNextDueDate = (recurrenceType: TodoRecurrenceType, baseDate: Date): Date => {
  if (recurrenceType === "daily") {
    return new Date(baseDate.getTime() + 24 * 60 * 60 * 1000);
  }
  if (recurrenceType === "weekly") {
    return new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
  if (recurrenceType === "monthly") {
    return addOneMonth(baseDate);
  }
  return baseDate;
};

const toTodoResponse = async (
  prisma: PrismaClient,
  todo: Todo,
): Promise<
  Readonly<{
    id: number;
    name: string;
    detail: string;
    dueDate: string | null;
    created_at: string;
    progressStatus: TodoProgressStatus;
    recurrenceType: TodoRecurrenceType;
    parentId: number | null;
    completedSubtaskCount: number;
    totalSubtaskCount: number;
    subtaskProgressPercent: number;
  }>
> => {
  const totalSubtaskCount = await prisma.todo.count({
    where: {
      parentId: todo.id,
      ownerId: todo.ownerId,
    },
  });
  const completedSubtaskCount = await prisma.todo.count({
    where: {
      parentId: todo.id,
      ownerId: todo.ownerId,
      progressStatus: "completed",
    },
  });
  const subtaskProgressPercent =
    totalSubtaskCount === 0 ? 0 : Math.floor((completedSubtaskCount * 100) / totalSubtaskCount);

  return {
    id: todo.id,
    name: todo.name,
    detail: todo.detail,
    dueDate: toDateOnlyString(todo.dueDate),
    created_at: todo.createdAt.toISOString(),
    progressStatus: toProgressStatus(todo.progressStatus),
    recurrenceType: toRecurrenceType(todo.recurrenceType),
    parentId: todo.parentId,
    completedSubtaskCount,
    totalSubtaskCount,
    subtaskProgressPercent,
  };
};

const buildDueDateFilter = (value: string | undefined): TodoDueDateFilter | null => {
  if (value == null || value === "" || value === "all") {
    return "all";
  }
  if (value === "today" || value === "this_week" || value === "overdue" || value === "none") {
    return value;
  }
  return null;
};

export const createTodoRoutes = (dependencies: TodoRouteDependencies): Hono => {
  const router = new Hono({ strict: false });
  const authService = createAuthService(dependencies.prisma, dependencies.authConfig);

  router.get("/", async (context) => {
    const token = readBearerToken(context.req.header("Authorization"));
    if (!token.ok) {
      return context.json({ detail: "Could not validate credentials" }, 401);
    }

    const user = await authService.authenticate(token.data);
    if (!user.ok) {
      return context.json({ detail: "Could not validate credentials" }, 401);
    }

    const keyword = context.req.query("keyword");
    const progressStatusRaw = context.req.query("progress_status");
    const parsedProgressStatus =
      progressStatusRaw == null ? null : parseProgressStatus(progressStatusRaw);
    const dueDateFilter = buildDueDateFilter(context.req.query("due_date"));

    if (progressStatusRaw != null && (parsedProgressStatus == null || !parsedProgressStatus.ok)) {
      return context.json(
        toValidationErrorResponse([{ field: "progress_status", reason: "invalid_format" }]),
        422,
      );
    }
    if (dueDateFilter == null) {
      return context.json(
        toValidationErrorResponse([{ field: "due_date", reason: "invalid_format" }]),
        422,
      );
    }

    const progressStatusFilter =
      parsedProgressStatus == null || !parsedProgressStatus.ok
        ? undefined
        : parsedProgressStatus.data;

    const now = new Date();
    const todayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const weekEnd = new Date(todayStart.getTime() + 6 * 24 * 60 * 60 * 1000);
    const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const todos = await dependencies.prisma.todo.findMany({
      where: {
        ownerId: user.data.id,
        ...(progressStatusFilter == null ? {} : { progressStatus: progressStatusFilter }),
        ...(dueDateFilter === "today"
          ? {
              dueDate: {
                gte: todayStart,
                lt: tomorrowStart,
              },
            }
          : dueDateFilter === "this_week"
            ? {
                dueDate: {
                  gte: todayStart,
                  lte: weekEnd,
                },
              }
            : dueDateFilter === "overdue"
              ? {
                  dueDate: {
                    lt: todayStart,
                  },
                }
              : dueDateFilter === "none"
                ? {
                    dueDate: null,
                  }
                : {}),
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const normalizedKeyword = keyword == null ? "" : keyword.trim();
    const keywordFilteredTodos =
      normalizedKeyword === ""
        ? todos
        : todos.filter(
            (todo) =>
              todo.name.includes(normalizedKeyword) || todo.detail.includes(normalizedKeyword),
          );
    const responseTodos = await Promise.all(
      keywordFilteredTodos.map((todo) => toTodoResponse(dependencies.prisma, todo)),
    );

    return context.json(responseTodos);
  });

  router.post("/", async (context) => {
    const token = readBearerToken(context.req.header("Authorization"));
    if (!token.ok) {
      return context.json({ detail: "Could not validate credentials" }, 401);
    }

    const user = await authService.authenticate(token.data);
    if (!user.ok) {
      return context.json({ detail: "Could not validate credentials" }, 401);
    }

    const rawBody = await readJsonBody(context);
    if (!rawBody.ok) {
      return context.json(
        toValidationErrorResponse([{ field: "body", reason: "invalid_format" }]),
        422,
      );
    }

    const parsed = parseCreateTodoInput(rawBody.data);
    if (!parsed.ok) {
      return context.json(toValidationErrorResponse(parsed.error), 422);
    }

    if (parsed.data.parentId != null) {
      const parent = await dependencies.prisma.todo.findFirst({
        where: {
          id: parsed.data.parentId,
          ownerId: user.data.id,
        },
      });
      if (parent == null) {
        return context.json({ detail: "親タスクが存在しません" }, 409);
      }
      if (parent.parentId != null) {
        return context.json({ detail: "サブタスクを親として指定できません" }, 409);
      }
      if (parsed.data.recurrenceType !== "none") {
        return context.json({ detail: "サブタスクには繰り返し設定できません" }, 409);
      }
    }

    const duplicated = await dependencies.prisma.todo.findFirst({
      where: {
        ownerId: user.data.id,
        name: parsed.data.name,
        progressStatus: {
          not: "completed",
        },
      },
    });
    if (duplicated != null) {
      return context.json(
        toValidationErrorResponse([
          {
            field: "name",
            reason: "unique_violation",
          },
        ]),
        422,
      );
    }

    try {
      const created = await dependencies.prisma.todo.create({
        data: {
          name: parsed.data.name,
          detail: parsed.data.detail,
          dueDate: parsed.data.dueDate,
          progressStatus: parsed.data.progressStatus,
          recurrenceType: parsed.data.recurrenceType,
          ownerId: user.data.id,
          parentId: parsed.data.parentId,
          activeName: parsed.data.progressStatus === "completed" ? null : parsed.data.name,
        },
      });

      return context.json(await toTodoResponse(dependencies.prisma, created), 201);
    } catch (errorValue) {
      if (isUniqueConstraintError(errorValue)) {
        return context.json(
          toValidationErrorResponse([
            {
              field: "name",
              reason: "unique_violation",
            },
          ]),
          422,
        );
      }

      throw errorValue;
    }
  });

  router.get("/:todoId", async (context) => {
    const token = readBearerToken(context.req.header("Authorization"));
    if (!token.ok) {
      return context.json({ detail: "Could not validate credentials" }, 401);
    }

    const user = await authService.authenticate(token.data);
    if (!user.ok) {
      return context.json({ detail: "Could not validate credentials" }, 401);
    }

    const todoId = parseTodoId(context.req.param("todoId"));
    if (!todoId.ok) {
      return context.json({ detail: "Todo not found" }, 404);
    }

    const todo = await dependencies.prisma.todo.findFirst({
      where: {
        id: todoId.data,
        ownerId: user.data.id,
      },
    });
    if (todo == null) {
      return context.json({ detail: "Todo not found" }, 404);
    }

    return context.json(await toTodoResponse(dependencies.prisma, todo));
  });

  router.put("/:todoId", async (context) => {
    const token = readBearerToken(context.req.header("Authorization"));
    if (!token.ok) {
      return context.json({ detail: "Could not validate credentials" }, 401);
    }

    const user = await authService.authenticate(token.data);
    if (!user.ok) {
      return context.json({ detail: "Could not validate credentials" }, 401);
    }

    const todoId = parseTodoId(context.req.param("todoId"));
    if (!todoId.ok) {
      return context.json({ detail: "Todo not found" }, 404);
    }

    const target = await dependencies.prisma.todo.findFirst({
      where: {
        id: todoId.data,
        ownerId: user.data.id,
      },
    });
    if (target == null) {
      return context.json({ detail: "Todo not found" }, 404);
    }

    const rawBody = await readJsonBody(context);
    if (!rawBody.ok) {
      return context.json(
        toValidationErrorResponse([{ field: "body", reason: "invalid_format" }]),
        422,
      );
    }

    const parsed = parseUpdateTodoInput(rawBody.data);
    if (!parsed.ok) {
      return context.json(toValidationErrorResponse(parsed.error), 422);
    }

    const nextDueDate = parsed.data.dueDate === undefined ? target.dueDate : parsed.data.dueDate;
    const nextRecurrenceType =
      parsed.data.recurrenceType === undefined
        ? toRecurrenceType(target.recurrenceType)
        : parsed.data.recurrenceType;
    if (nextRecurrenceType !== "none" && nextDueDate == null) {
      return context.json(
        toValidationErrorResponse([{ field: "dueDate", reason: "required" }]),
        422,
      );
    }
    if (target.parentId != null && nextRecurrenceType !== "none") {
      return context.json({ detail: "サブタスクには繰り返し設定できません" }, 409);
    }

    if (parsed.data.name != null) {
      const duplicated = await dependencies.prisma.todo.findFirst({
        where: {
          ownerId: user.data.id,
          name: parsed.data.name,
          progressStatus: {
            not: "completed",
          },
          id: {
            not: target.id,
          },
        },
      });
      if (duplicated != null) {
        return context.json(
          toValidationErrorResponse([
            {
              field: "name",
              reason: "unique_violation",
            },
          ]),
          422,
        );
      }
    }

    if (
      target.parentId == null &&
      parsed.data.progressStatus === "completed" &&
      target.progressStatus !== "completed"
    ) {
      const incompleteSubtask = await dependencies.prisma.todo.findFirst({
        where: {
          parentId: target.id,
          ownerId: user.data.id,
          progressStatus: {
            not: "completed",
          },
        },
      });
      if (incompleteSubtask != null) {
        return context.json({ detail: "未完了のサブタスクがあるため完了できません" }, 409);
      }
    }

    const nextName = parsed.data.name === undefined ? target.name : parsed.data.name;
    const nextProgressStatus =
      parsed.data.progressStatus === undefined
        ? toProgressStatus(target.progressStatus)
        : parsed.data.progressStatus;
    const shouldGenerateSuccessor =
      target.progressStatus !== "completed" &&
      nextProgressStatus === "completed" &&
      nextRecurrenceType !== "none" &&
      nextDueDate != null;
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const nextDueDateForSuccessor = calculateNextDueDate(nextRecurrenceType, today);

    let updated: Todo;
    try {
      updated = await dependencies.prisma.$transaction(async (transaction) => {
        const updatedTodo = await transaction.todo.update({
          where: {
            id: target.id,
          },
          data: {
            ...(parsed.data.name === undefined ? {} : { name: parsed.data.name }),
            ...(parsed.data.detail === undefined ? {} : { detail: parsed.data.detail }),
            ...(parsed.data.dueDate === undefined ? {} : { dueDate: parsed.data.dueDate }),
            ...(parsed.data.progressStatus === undefined
              ? {}
              : { progressStatus: parsed.data.progressStatus }),
            ...(parsed.data.recurrenceType === undefined
              ? {}
              : { recurrenceType: parsed.data.recurrenceType }),
            activeName: nextProgressStatus === "completed" ? null : nextName,
          },
        });

        if (shouldGenerateSuccessor) {
          try {
            await transaction.todo.create({
              data: {
                name: updatedTodo.name,
                detail: updatedTodo.detail,
                ownerId: updatedTodo.ownerId,
                dueDate: nextDueDateForSuccessor,
                progressStatus: "not_started",
                recurrenceType: updatedTodo.recurrenceType,
                previousTodoId: updatedTodo.id,
                activeName: updatedTodo.name,
              },
            });
          } catch (errorValue) {
            if (!isPreviousTodoUniqueConstraintError(errorValue)) {
              throw errorValue;
            }
          }
        }

        return updatedTodo;
      });
    } catch (errorValue) {
      if (isUniqueConstraintError(errorValue)) {
        return context.json(
          toValidationErrorResponse([
            {
              field: "name",
              reason: "unique_violation",
            },
          ]),
          422,
        );
      }

      throw errorValue;
    }

    return context.json(await toTodoResponse(dependencies.prisma, updated));
  });

  router.delete("/:todoId", async (context) => {
    const token = readBearerToken(context.req.header("Authorization"));
    if (!token.ok) {
      return context.json({ detail: "Could not validate credentials" }, 401);
    }

    const user = await authService.authenticate(token.data);
    if (!user.ok) {
      return context.json({ detail: "Could not validate credentials" }, 401);
    }

    const todoId = parseTodoId(context.req.param("todoId"));
    if (!todoId.ok) {
      return context.json({ detail: "Todo not found" }, 404);
    }

    const target = await dependencies.prisma.todo.findFirst({
      where: {
        id: todoId.data,
        ownerId: user.data.id,
      },
    });
    if (target == null) {
      return context.json({ detail: "Todo not found" }, 404);
    }

    await dependencies.prisma.todo.delete({
      where: {
        id: target.id,
      },
    });

    return new Response(null, {
      status: 204,
    });
  });

  return router;
};
