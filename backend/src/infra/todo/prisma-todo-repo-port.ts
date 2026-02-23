import type { Prisma, PrismaClient, Todo } from "@prisma/client";
import { toTodoProgressStatus, toTodoRecurrenceType } from "../../domain/todo/normalization";
import type { TodoItem } from "../../domain/todo/types";
import type { TodoQuery, TodoRepoPort } from "../../ports/todo-repo-port";

type PrismaTodoClient = Readonly<{
  todo: PrismaClient["todo"];
  $transaction?: PrismaClient["$transaction"];
}>;

const toTodoItem = (todo: Todo): TodoItem => ({
  id: todo.id,
  ownerId: todo.ownerId,
  name: todo.name,
  detail: todo.detail,
  dueDate: todo.dueDate,
  createdAt: todo.createdAt,
  progressStatus: toTodoProgressStatus(todo.progressStatus),
  recurrenceType: toTodoRecurrenceType(todo.recurrenceType),
  parentId: todo.parentId,
  previousTodoId: todo.previousTodoId,
});

const toDueDateFilterWhere = (
  dueDateFilter: TodoQuery["dueDateFilter"],
  now: Date,
): Prisma.TodoWhereInput => {
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const weekEnd = new Date(todayStart.getTime() + 6 * 24 * 60 * 60 * 1000);

  switch (dueDateFilter) {
    case undefined:
    case "all":
      return {};
    case "today":
      return {
        dueDate: {
          gte: todayStart,
          lt: tomorrowStart,
        },
      };
    case "this_week":
      return {
        dueDate: {
          gte: todayStart,
          lte: weekEnd,
        },
      };
    case "overdue":
      return {
        dueDate: {
          lt: todayStart,
        },
      };
    case "none":
      return {
        dueDate: null,
      };
    default: {
      const exhaustiveCheck: never = dueDateFilter;
      throw new Error(`Not exhaustive: dueDateFilter (${String(exhaustiveCheck)})`);
    }
  }
};

const createRepo = (client: PrismaTodoClient): TodoRepoPort => ({
  listByOwner: async (query) => {
    const todos = await client.todo.findMany({
      where: {
        ownerId: query.ownerId,
        ...(query.progressStatus == null ? {} : { progressStatus: query.progressStatus }),
        ...toDueDateFilterWhere(query.dueDateFilter, query.now),
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return todos.map(toTodoItem);
  },
  findByIdForOwner: async (id, ownerId) => {
    const todo = await client.todo.findFirst({
      where: {
        id,
        ownerId,
      },
    });

    return todo == null ? null : toTodoItem(todo);
  },
  create: async (input) =>
    toTodoItem(
      await client.todo.create({
        data: {
          ownerId: input.ownerId,
          name: input.name,
          detail: input.detail,
          dueDate: input.dueDate,
          progressStatus: input.progressStatus,
          recurrenceType: input.recurrenceType,
          parentId: input.parentId,
          activeName: input.activeName,
          ...(input.previousTodoId == null ? {} : { previousTodoId: input.previousTodoId }),
        },
      }),
    ),
  update: async (input) =>
    toTodoItem(
      await client.todo.update({
        where: {
          id: input.id,
        },
        data: {
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.detail === undefined ? {} : { detail: input.detail }),
          ...(input.dueDate === undefined ? {} : { dueDate: input.dueDate }),
          ...(input.progressStatus === undefined ? {} : { progressStatus: input.progressStatus }),
          ...(input.recurrenceType === undefined ? {} : { recurrenceType: input.recurrenceType }),
          ...(input.activeName === undefined ? {} : { activeName: input.activeName }),
        },
      }),
    ),
  deleteById: async (id, ownerId) => {
    const target = await client.todo.findFirst({
      where: {
        id,
        ownerId,
      },
    });

    if (target == null) {
      return;
    }

    await client.todo.delete({
      where: {
        id,
      },
    });
  },
  countByParentId: async (parentId, ownerId) =>
    client.todo.count({
      where: {
        parentId,
        ownerId,
      },
    }),
  countCompletedByParentId: async (parentId, ownerId) =>
    client.todo.count({
      where: {
        parentId,
        ownerId,
        progressStatus: "completed",
      },
    }),
  findIncompleteSubtask: async (parentId, ownerId) => {
    const todo = await client.todo.findFirst({
      where: {
        parentId,
        ownerId,
        progressStatus: {
          not: "completed",
        },
      },
    });

    return todo == null ? null : toTodoItem(todo);
  },
  findDuplicateActiveName: async (ownerId, name, excludeId) => {
    const duplicated = await client.todo.findFirst({
      where: {
        ownerId,
        name,
        progressStatus: {
          not: "completed",
        },
        ...(excludeId == null
          ? {}
          : {
              id: {
                not: excludeId,
              },
            }),
      },
    });

    return duplicated == null ? null : toTodoItem(duplicated);
  },
  runInTransaction: async (callback) => {
    if (client.$transaction == null) {
      return callback(createRepo(client));
    }

    return client.$transaction(async (transactionClient) => {
      return callback(
        createRepo({
          todo: transactionClient.todo,
        }),
      );
    });
  },
});

export const createPrismaTodoRepoPort = (prisma: PrismaClient): TodoRepoPort =>
  createRepo({
    todo: prisma.todo,
    $transaction: prisma.$transaction.bind(prisma),
  });
