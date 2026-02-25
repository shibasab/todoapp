import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  createPrismaTodoRepoPort,
  createPrismaTodoRepoPortForTesting,
} from "../../src/infra/todo/prisma-todo-repo-port";

const todoRecord = (
  overrides: Partial<{
    id: number;
    ownerId: number;
    name: string;
    detail: string;
    dueDate: Date | null;
    createdAt: Date;
    progressStatus: "not_started" | "in_progress" | "completed";
    recurrenceType: "none" | "daily" | "weekly" | "monthly";
    parentId: number | null;
    previousTodoId: number | null;
    activeName: string | null;
  }> = {},
) => ({
  id: 1,
  ownerId: 10,
  name: "task",
  detail: "",
  dueDate: null,
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  progressStatus: "not_started",
  recurrenceType: "none",
  parentId: null,
  previousTodoId: null,
  activeName: "task",
  ...overrides,
});

type TodoDelegateStub = Readonly<{
  findMany?: (args?: unknown) => Promise<readonly unknown[]>;
  findFirst?: (args?: unknown) => Promise<unknown>;
  create?: (args: unknown) => Promise<unknown>;
  update?: (args: unknown) => Promise<unknown>;
  delete?: (args: unknown) => Promise<unknown>;
  count?: (args?: unknown) => Promise<number>;
}>;

const createTodoDelegate = (overrides: TodoDelegateStub = {}): PrismaClient["todo"] =>
  ({
    findMany: async () => [],
    findFirst: async () => null,
    create: async () => todoRecord(),
    update: async () => todoRecord(),
    delete: async () => todoRecord(),
    count: async () => 0,
    ...overrides,
  }) as unknown as PrismaClient["todo"];

const baseCreateInput = Object.freeze({
  ownerId: 10,
  name: "task",
  detail: "",
  dueDate: null,
  progressStatus: "not_started" as const,
  recurrenceType: "none" as const,
  parentId: null,
  activeName: "task",
});

const baseUpdateInput = Object.freeze({
  id: 1,
  ownerId: 10,
});

describe("prisma todo repo port", () => {
  it("listByOwnerはdueDateFilterとprogressStatusをwhere句へ反映する", async () => {
    const findManyCalls: Array<Record<string, unknown>> = [];
    const todoDelegate = createTodoDelegate({
      findMany: async (args: unknown) => {
        findManyCalls.push(args as Record<string, unknown>);
        return [];
      },
    });
    const repo = createPrismaTodoRepoPortForTesting({ todo: todoDelegate });
    const now = new Date("2025-03-05T12:34:56.000Z");

    await repo.listByOwner({
      ownerId: 10,
      now,
    });
    await repo.listByOwner({
      ownerId: 10,
      now,
      dueDateFilter: "all",
    });
    await repo.listByOwner({
      ownerId: 10,
      now,
      dueDateFilter: "today",
    });
    await repo.listByOwner({
      ownerId: 10,
      now,
      dueDateFilter: "this_week",
    });
    await repo.listByOwner({
      ownerId: 10,
      now,
      dueDateFilter: "overdue",
    });
    await repo.listByOwner({
      ownerId: 10,
      now,
      dueDateFilter: "none",
      progressStatus: "completed",
    });

    const todayStart = new Date("2025-03-05T00:00:00.000Z");
    const tomorrowStart = new Date("2025-03-06T00:00:00.000Z");
    const weekEnd = new Date("2025-03-11T00:00:00.000Z");

    expect((findManyCalls[0]?.where as Record<string, unknown>) ?? {}).toEqual({
      ownerId: 10,
    });
    expect((findManyCalls[1]?.where as Record<string, unknown>) ?? {}).toEqual({
      ownerId: 10,
    });
    expect((findManyCalls[2]?.where as Record<string, unknown>) ?? {}).toMatchObject({
      ownerId: 10,
      dueDate: {
        gte: todayStart,
        lt: tomorrowStart,
      },
    });
    expect((findManyCalls[3]?.where as Record<string, unknown>) ?? {}).toMatchObject({
      ownerId: 10,
      dueDate: {
        gte: todayStart,
        lte: weekEnd,
      },
    });
    expect((findManyCalls[4]?.where as Record<string, unknown>) ?? {}).toMatchObject({
      ownerId: 10,
      dueDate: {
        lt: todayStart,
      },
    });
    expect((findManyCalls[5]?.where as Record<string, unknown>) ?? {}).toMatchObject({
      ownerId: 10,
      progressStatus: "completed",
      dueDate: null,
    });
  });

  it("createはpreviousTodoIdを必要時のみ保存データへ含める", async () => {
    const createCalls: Array<Record<string, unknown>> = [];
    const todoDelegate = createTodoDelegate({
      create: async (args: unknown) => {
        createCalls.push(args as Record<string, unknown>);
        return todoRecord();
      },
    });
    const repo = createPrismaTodoRepoPortForTesting({
      todo: todoDelegate,
    });

    await repo.create(baseCreateInput);
    await repo.create({
      ...baseCreateInput,
      previousTodoId: 5,
    });

    const firstData = (createCalls[0]?.data as Record<string, unknown>) ?? {};
    const secondData = (createCalls[1]?.data as Record<string, unknown>) ?? {};

    expect(firstData).not.toHaveProperty("previousTodoId");
    expect(secondData).toMatchObject({
      previousTodoId: 5,
    });
  });

  it("createはユニーク制約違反と想定外エラーをResultへ変換する", async () => {
    const duplicatePreviousStringRepo = createPrismaTodoRepoPortForTesting({
      todo: createTodoDelegate({
        create: async () => {
          throw {
            code: "P2002",
            meta: {
              target: "previousTodoId",
            },
          };
        },
      }),
    });
    const duplicatePreviousArrayRepo = createPrismaTodoRepoPortForTesting({
      todo: createTodoDelegate({
        create: async () => {
          throw {
            code: "P2002",
            meta: {
              target: ["ownerId", "previous_todo_id"],
            },
          };
        },
      }),
    });
    const duplicateActiveRepo = createPrismaTodoRepoPortForTesting({
      todo: createTodoDelegate({
        create: async () => {
          throw {
            code: "P2002",
            meta: {
              target: ["ownerId", "activeName"],
            },
          };
        },
      }),
    });
    const unexpectedRepo = createPrismaTodoRepoPortForTesting({
      todo: createTodoDelegate({
        create: async () => {
          throw new Error("failed");
        },
      }),
    });

    const duplicatePreviousString = await duplicatePreviousStringRepo.create(baseCreateInput);
    const duplicatePreviousArray = await duplicatePreviousArrayRepo.create(baseCreateInput);
    const duplicateActive = await duplicateActiveRepo.create(baseCreateInput);
    const unexpected = await unexpectedRepo.create(baseCreateInput);

    expect(duplicatePreviousString).toMatchObject({
      ok: false,
      error: { type: "DuplicatePreviousTodo" },
    });
    expect(duplicatePreviousArray).toMatchObject({
      ok: false,
      error: { type: "DuplicatePreviousTodo" },
    });
    expect(duplicateActive).toMatchObject({
      ok: false,
      error: { type: "DuplicateActiveName" },
    });
    expect(unexpected).toMatchObject({
      ok: false,
      error: { type: "Unexpected" },
    });
  });

  it("updateはundefined項目を除外し、指定項目のみを更新データに含める", async () => {
    const updateCalls: Array<Record<string, unknown>> = [];

    const todoDelegate = createTodoDelegate({
      update: async (input: unknown) => {
        updateCalls.push(input as Record<string, unknown>);
        return todoRecord();
      },
    });

    const repo = createPrismaTodoRepoPortForTesting({
      todo: todoDelegate,
    });

    await repo.update({
      id: 1,
      ownerId: 10,
    });
    await repo.update({
      id: 1,
      ownerId: 10,
      name: "new-name",
      detail: "new-detail",
      dueDate: new Date("2025-02-01T00:00:00.000Z"),
      progressStatus: "completed",
      recurrenceType: "weekly",
      activeName: null,
    });

    const firstData = (updateCalls[0]?.data as Record<string, unknown>) ?? {};
    const secondData = (updateCalls[1]?.data as Record<string, unknown>) ?? {};

    expect(firstData).toEqual({});
    expect(secondData).toMatchObject({
      name: "new-name",
      detail: "new-detail",
      dueDate: new Date("2025-02-01T00:00:00.000Z"),
      progressStatus: "completed",
      recurrenceType: "weekly",
      activeName: null,
    });
  });

  it("updateはユニーク制約違反と想定外エラーをResultへ変換する", async () => {
    const duplicateRepo = createPrismaTodoRepoPortForTesting({
      todo: createTodoDelegate({
        update: async () => {
          throw {
            code: "P2002",
          };
        },
      }),
    });
    const unexpectedRepo = createPrismaTodoRepoPortForTesting({
      todo: createTodoDelegate({
        update: async () => {
          throw new Error("failed");
        },
      }),
    });

    const duplicate = await duplicateRepo.update(baseUpdateInput);
    const unexpected = await unexpectedRepo.update(baseUpdateInput);

    expect(duplicate).toMatchObject({
      ok: false,
      error: { type: "DuplicateActiveName" },
    });
    expect(unexpected).toMatchObject({
      ok: false,
      error: { type: "Unexpected" },
    });
  });

  it("deleteByIdは対象がなければdeleteを呼ばず、存在すればdeleteする", async () => {
    let deleteCalled = 0;
    let findFirstCalled = 0;
    const todoDelegate = createTodoDelegate({
      findFirst: async () => {
        findFirstCalled += 1;
        return findFirstCalled === 1 ? null : todoRecord();
      },
      delete: async () => {
        deleteCalled += 1;
        return todoRecord();
      },
    });
    const repo = createPrismaTodoRepoPortForTesting({
      todo: todoDelegate,
    });

    await repo.deleteById(1, 10);
    await repo.deleteById(1, 10);

    expect(deleteCalled).toBe(1);
  });

  it("findDuplicateActiveNameはexcludeIdの有無でwhere句を切り替える", async () => {
    const findFirstCalls: Array<Record<string, unknown>> = [];
    const todoDelegate = createTodoDelegate({
      findFirst: async (args: unknown) => {
        findFirstCalls.push(args as Record<string, unknown>);
        return todoRecord();
      },
    });
    const repo = createPrismaTodoRepoPortForTesting({
      todo: todoDelegate,
    });

    await repo.findDuplicateActiveName(10, "task");
    await repo.findDuplicateActiveName(10, "task", 99);

    const whereWithoutExclude = (findFirstCalls[0]?.where as Record<string, unknown>) ?? {};
    const whereWithExclude = (findFirstCalls[1]?.where as Record<string, unknown>) ?? {};

    expect(whereWithoutExclude).toMatchObject({
      ownerId: 10,
      name: "task",
      progressStatus: {
        not: "completed",
      },
    });
    expect(whereWithoutExclude).not.toHaveProperty("id");
    expect(whereWithExclude).toMatchObject({
      ownerId: 10,
      name: "task",
      progressStatus: {
        not: "completed",
      },
      id: {
        not: 99,
      },
    });
  });

  it("findByIdForOwnerとfindIncompleteSubtaskはnull/存在を正しく変換する", async () => {
    let findFirstCall = 0;
    const todoDelegate = createTodoDelegate({
      findFirst: async () => {
        findFirstCall += 1;
        switch (findFirstCall) {
          case 1:
            return null;
          case 2:
            return todoRecord({ id: 2, name: "found" });
          case 3:
            return null;
          case 4:
            return todoRecord({ id: 3, parentId: 1, name: "child" });
          default:
            return null;
        }
      },
    });
    const repo = createPrismaTodoRepoPortForTesting({
      todo: todoDelegate,
    });

    const notFound = await repo.findByIdForOwner(1, 10);
    const found = await repo.findByIdForOwner(2, 10);
    const noIncomplete = await repo.findIncompleteSubtask(1, 10);
    const incomplete = await repo.findIncompleteSubtask(1, 10);

    expect(notFound).toBeNull();
    expect(found?.name).toBe("found");
    expect(noIncomplete).toBeNull();
    expect(incomplete?.name).toBe("child");
  });

  it("runInTransactionはtransaction未対応クライアントでそのままcallbackを実行する", async () => {
    const repo = createPrismaTodoRepoPortForTesting({
      todo: createTodoDelegate(),
    });

    const result = await repo.runInTransaction(async () => "ok");

    expect(result).toBe("ok");
  });

  it("runInTransactionはtransaction対応クライアントではtransaction用repoを渡す", async () => {
    let rootFindManyCalled = 0;
    let txFindManyCalled = 0;
    const rootTodoDelegate = createTodoDelegate({
      findMany: async () => {
        rootFindManyCalled += 1;
        return [];
      },
    });
    const txTodoDelegate = createTodoDelegate({
      findMany: async () => {
        txFindManyCalled += 1;
        return [];
      },
    });
    const prismaLike = {
      todo: rootTodoDelegate,
      $transaction: async <T>(callback: (client: { todo: PrismaClient["todo"] }) => Promise<T>) =>
        callback({ todo: txTodoDelegate }),
    } as unknown as PrismaClient;
    const repo = createPrismaTodoRepoPort(prismaLike);

    const result = await repo.runInTransaction(async (txRepo) => {
      await txRepo.listByOwner({
        ownerId: 10,
        now: new Date("2025-01-01T00:00:00.000Z"),
      });
      return "ok";
    });

    expect(result).toBe("ok");
    expect(rootFindManyCalled).toBe(0);
    expect(txFindManyCalled).toBe(1);
  });
});
