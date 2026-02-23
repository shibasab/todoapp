import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { createPrismaTodoRepoPortForTesting } from "../../src/infra/todo/prisma-todo-repo-port";

const todoRecord = () => ({
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
});

describe("prisma todo repo port", () => {
  it("deleteByIdは対象がなければdeleteを呼ばない", async () => {
    let deleteCalled = 0;

    const todoDelegate = {
      findMany: async () => [],
      findFirst: async () => null,
      create: async () => {
        throw new Error("unused");
      },
      update: async () => {
        throw new Error("unused");
      },
      delete: async () => {
        deleteCalled += 1;
      },
      count: async () => 0,
    } as unknown as PrismaClient["todo"];

    const repo = createPrismaTodoRepoPortForTesting({
      todo: todoDelegate,
    });

    await repo.deleteById(1, 10);

    expect(deleteCalled).toBe(0);
  });

  it("runInTransactionはtransaction未対応クライアントでそのままcallbackを実行する", async () => {
    const todoDelegate = {
      findMany: async () => [],
      findFirst: async () => null,
      create: async () => {
        throw new Error("unused");
      },
      update: async () => {
        throw new Error("unused");
      },
      delete: async () => {
        throw new Error("unused");
      },
      count: async () => 0,
    } as unknown as PrismaClient["todo"];

    const repo = createPrismaTodoRepoPortForTesting({
      todo: todoDelegate,
    });

    const result = await repo.runInTransaction(async () => "ok");

    expect(result).toBe("ok");
  });

  it("updateはundefined項目を除外し、指定項目のみを更新データに含める", async () => {
    const updateCalls: Array<Record<string, unknown>> = [];

    const todoDelegate = {
      findMany: async () => [],
      findFirst: async () => null,
      create: async () => {
        throw new Error("unused");
      },
      update: async (input: unknown) => {
        updateCalls.push(input as Record<string, unknown>);
        return todoRecord();
      },
      delete: async () => {
        throw new Error("unused");
      },
      count: async () => 0,
    } as unknown as PrismaClient["todo"];

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

    const firstData = updateCalls[0]?.data as Record<string, unknown>;
    const secondData = updateCalls[1]?.data as Record<string, unknown>;

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
});
