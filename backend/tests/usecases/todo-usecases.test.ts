import { err, ok } from "@todoapp/shared";
import { describe, expect, it } from "vitest";
import { createGetTodoUseCase, createListTodosUseCase } from "../../src/usecases/todo/read-todos";
import {
  createCreateTodoUseCase,
  createDeleteTodoUseCase,
  createUpdateTodoUseCase,
} from "../../src/usecases/todo/write-todos";
import type { TodoRepoCreateError, TodoRepoPort } from "../../src/ports/todo-repo-port";
import type { TodoItem } from "../../src/domain/todo/types";

const baseTodo = (overrides: Partial<TodoItem> = {}): TodoItem => ({
  id: 1,
  ownerId: 10,
  name: "todo",
  detail: "detail",
  dueDate: null,
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  progressStatus: "not_started",
  recurrenceType: "none",
  parentId: null,
  parentTitle: null,
  previousTodoId: null,
  ...overrides,
});

const createRepoStub = (overrides: Partial<TodoRepoPort> = {}): TodoRepoPort => {
  const defaultRepo: TodoRepoPort = {
    listByOwner: async () => [baseTodo()],
    findByIdForOwner: async () => baseTodo(),
    create: async () => ok(baseTodo()),
    update: async () => ok(baseTodo()),
    deleteById: async () => {
      return;
    },
    countByParentId: async () => 0,
    countCompletedByParentId: async () => 0,
    findIncompleteSubtask: async () => null,
    findDuplicateActiveName: async () => null,
    runInTransaction: async () => {
      throw new Error("runInTransaction is not initialized");
    },
  };

  let mergedRepo: TodoRepoPort;
  const runInTransaction: TodoRepoPort["runInTransaction"] =
    overrides.runInTransaction ??
    (async (callback) => {
      return callback(mergedRepo);
    });

  mergedRepo = {
    ...defaultRepo,
    ...overrides,
    runInTransaction,
  };

  return mergedRepo;
};

describe("todo usecases", () => {
  it("create: recurrenceありでdueDate未指定はValidationError", async () => {
    const usecase = createCreateTodoUseCase({
      todoRepo: createRepoStub(),
    });

    const result = await usecase({
      userId: 10,
      name: "task",
      detail: "",
      dueDate: null,
      progressStatus: "not_started",
      recurrenceType: "daily",
      parentId: null,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("ValidationError");
    }
  });

  it("create: 重複名とDB unique制約をValidationErrorへ変換", async () => {
    const duplicateUsecase = createCreateTodoUseCase({
      todoRepo: createRepoStub({
        findDuplicateActiveName: async () => baseTodo(),
      }),
    });
    const duplicateResult = await duplicateUsecase({
      userId: 10,
      name: "task",
      detail: "",
      dueDate: null,
      progressStatus: "not_started",
      recurrenceType: "none",
      parentId: null,
    });

    expect(duplicateResult.ok).toBe(false);

    const uniqueUsecase = createCreateTodoUseCase({
      todoRepo: createRepoStub({
        create: async () => err({ type: "DuplicateActiveName" }),
      }),
    });
    const uniqueResult = await uniqueUsecase({
      userId: 10,
      name: "task",
      detail: "",
      dueDate: null,
      progressStatus: "not_started",
      recurrenceType: "none",
      parentId: null,
    });

    expect(uniqueResult.ok).toBe(false);
    if (!uniqueResult.ok) {
      expect(uniqueResult.error.type).toBe("ValidationError");
    }
  });

  it("delete: not found と internal をそれぞれ返す", async () => {
    const notFoundUsecase = createDeleteTodoUseCase({
      todoRepo: createRepoStub({
        findByIdForOwner: async () => null,
      }),
    });
    const notFoundResult = await notFoundUsecase({ userId: 10, todoId: 1 });
    expect(notFoundResult.ok).toBe(false);

    const internalUsecase = createDeleteTodoUseCase({
      todoRepo: createRepoStub({
        deleteById: async () => {
          throw new Error("delete failed");
        },
      }),
    });
    const internalResult = await internalUsecase({ userId: 10, todoId: 1 });
    expect(internalResult.ok).toBe(false);
    if (!internalResult.ok) {
      expect(internalResult.error.type).toBe("InternalError");
    }
  });

  it("get/list: not found, internal, keyword filterを扱う", async () => {
    const getNotFound = createGetTodoUseCase({
      todoRepo: createRepoStub({ findByIdForOwner: async () => null }),
    });
    const getNotFoundResult = await getNotFound({ userId: 10, todoId: 1 });
    expect(getNotFoundResult.ok).toBe(false);

    const getInternal = createGetTodoUseCase({
      todoRepo: createRepoStub({
        findByIdForOwner: async () => {
          throw new Error("failed");
        },
      }),
    });
    const getInternalResult = await getInternal({ userId: 10, todoId: 1 });
    expect(getInternalResult.ok).toBe(false);

    const listUsecase = createListTodosUseCase({
      todoRepo: createRepoStub({
        listByOwner: async () => [
          baseTodo({ name: "match", detail: "detail" }),
          baseTodo({ id: 2, name: "other" }),
        ],
      }),
      clock: { now: () => new Date("2025-01-01T00:00:00.000Z") },
    });
    const listResult = await listUsecase({ userId: 10, keyword: "match" });

    expect(listResult.ok).toBe(true);
    if (listResult.ok) {
      expect(listResult.data).toHaveLength(1);
    }
  });

  it("update: 主要な失敗分岐と成功分岐を扱う", async () => {
    const notFoundUsecase = createUpdateTodoUseCase({
      todoRepo: createRepoStub({ findByIdForOwner: async () => null }),
      clock: { now: () => new Date("2025-01-01T00:00:00.000Z") },
    });
    const notFoundResult = await notFoundUsecase({ userId: 10, todoId: 1 });
    expect(notFoundResult.ok).toBe(false);

    const dueDateRequiredUsecase = createUpdateTodoUseCase({
      todoRepo: createRepoStub({
        findByIdForOwner: async () => baseTodo({ recurrenceType: "none" }),
      }),
      clock: { now: () => new Date("2025-01-01T00:00:00.000Z") },
    });
    const dueDateRequiredResult = await dueDateRequiredUsecase({
      userId: 10,
      todoId: 1,
      recurrenceType: "daily",
      dueDate: null,
    });
    expect(dueDateRequiredResult.ok).toBe(false);

    const conflictUsecase = createUpdateTodoUseCase({
      todoRepo: createRepoStub({
        findByIdForOwner: async () => baseTodo({ parentId: 99 }),
      }),
      clock: { now: () => new Date("2025-01-01T00:00:00.000Z") },
    });
    const conflictResult = await conflictUsecase({
      userId: 10,
      todoId: 1,
      recurrenceType: "daily",
      dueDate: new Date("2025-01-02T00:00:00.000Z"),
    });
    expect(conflictResult.ok).toBe(false);

    const uniqueErrorUsecase = createUpdateTodoUseCase({
      todoRepo: createRepoStub({
        update: async () => err({ type: "DuplicateActiveName" }),
      }),
      clock: { now: () => new Date("2025-01-01T00:00:00.000Z") },
    });
    const uniqueErrorResult = await uniqueErrorUsecase({
      userId: 10,
      todoId: 1,
      name: "duplicated",
    });
    expect(uniqueErrorResult.ok).toBe(false);

    const successorUniqueIgnoredUsecase = createUpdateTodoUseCase({
      todoRepo: createRepoStub({
        findByIdForOwner: async () =>
          baseTodo({
            id: 1,
            progressStatus: "in_progress",
            recurrenceType: "daily",
            dueDate: new Date("2025-01-01T00:00:00.000Z"),
          }),
        update: async () =>
          ok(
            baseTodo({
              id: 1,
              progressStatus: "completed",
              recurrenceType: "daily",
              dueDate: new Date("2025-01-01T00:00:00.000Z"),
            }),
          ),
        create: async () => err({ type: "DuplicatePreviousTodo" }),
      }),
      clock: { now: () => new Date("2025-01-01T00:00:00.000Z") },
    });
    const successorUniqueIgnoredResult = await successorUniqueIgnoredUsecase({
      userId: 10,
      todoId: 1,
      progressStatus: "completed",
    });

    expect(successorUniqueIgnoredResult.ok).toBe(true);
  });

  it("update: update入力の組み立てと後続生成の分岐を扱う", async () => {
    const updateInputs: Array<Record<string, unknown>> = [];
    const usecase = createUpdateTodoUseCase({
      todoRepo: createRepoStub({
        findByIdForOwner: async () =>
          baseTodo({
            id: 5,
            name: "old-name",
            detail: "old-detail",
            dueDate: new Date("2025-01-01T00:00:00.000Z"),
            progressStatus: "in_progress",
            recurrenceType: "daily",
          }),
        update: async (input) => {
          updateInputs.push(input as unknown as Record<string, unknown>);
          return ok(
            baseTodo({
              id: input.id,
              name: (input.name as string | undefined) ?? "old-name",
              detail: (input.detail as string | undefined) ?? "old-detail",
              dueDate: (input.dueDate as Date | undefined) ?? new Date("2025-01-01T00:00:00.000Z"),
              progressStatus:
                (input.progressStatus as TodoItem["progressStatus"] | undefined) ?? "in_progress",
              recurrenceType:
                (input.recurrenceType as TodoItem["recurrenceType"] | undefined) ?? "daily",
            }),
          );
        },
      }),
      clock: { now: () => new Date("2025-01-10T12:00:00.000Z") },
    });

    const definedFieldsResult = await usecase({
      userId: 10,
      todoId: 5,
      name: "new-name",
      detail: "new-detail",
      dueDate: new Date("2025-02-01T00:00:00.000Z"),
      progressStatus: "in_progress",
      recurrenceType: "weekly",
    });
    expect(definedFieldsResult.ok).toBe(true);

    const undefinedFieldsResult = await usecase({
      userId: 10,
      todoId: 5,
      name: "only-name",
    });
    expect(undefinedFieldsResult.ok).toBe(true);

    expect(updateInputs[0]).toMatchObject({
      name: "new-name",
      detail: "new-detail",
      progressStatus: "in_progress",
      recurrenceType: "weekly",
      activeName: "new-name",
    });
    expect(updateInputs[1]).toMatchObject({
      name: "only-name",
      activeName: "only-name",
    });
    expect(updateInputs[1]).not.toHaveProperty("progressStatus");
    expect(updateInputs[1]).not.toHaveProperty("detail");
    expect(updateInputs[1]).not.toHaveProperty("recurrenceType");
    expect(updateInputs[1]).not.toHaveProperty("dueDate");
  });

  it("update: 後続生成時のrepoエラー種別を判定して返却する", async () => {
    const createRecurringTargetRepo = (createError: TodoRepoCreateError): TodoRepoPort =>
      createRepoStub({
        findByIdForOwner: async () =>
          baseTodo({
            id: 7,
            name: "recurring",
            detail: "",
            dueDate: new Date("2025-01-01T00:00:00.000Z"),
            progressStatus: "in_progress",
            recurrenceType: "daily",
          }),
        update: async () =>
          ok(
            baseTodo({
              id: 7,
              name: "recurring",
              detail: "",
              dueDate: new Date("2025-01-01T00:00:00.000Z"),
              progressStatus: "completed",
              recurrenceType: "daily",
            }),
          ),
        create: async () => err(createError),
      });

    const duplicatedNameUsecase = createUpdateTodoUseCase({
      todoRepo: createRecurringTargetRepo({
        type: "DuplicateActiveName",
      }),
      clock: { now: () => new Date("2025-01-10T00:00:00.000Z") },
    });
    const duplicatedNameResult = await duplicatedNameUsecase({
      userId: 10,
      todoId: 7,
      progressStatus: "completed",
    });
    expect(duplicatedNameResult.ok).toBe(false);
    if (!duplicatedNameResult.ok) {
      expect(duplicatedNameResult.error.type).toBe("ValidationError");
    }

    const duplicatedPreviousUsecase = createUpdateTodoUseCase({
      todoRepo: createRecurringTargetRepo({
        type: "DuplicatePreviousTodo",
      }),
      clock: { now: () => new Date("2025-01-10T00:00:00.000Z") },
    });
    const duplicatedPreviousResult = await duplicatedPreviousUsecase({
      userId: 10,
      todoId: 7,
      progressStatus: "completed",
    });
    expect(duplicatedPreviousResult.ok).toBe(true);

    const unexpectedErrorUsecase = createUpdateTodoUseCase({
      todoRepo: createRecurringTargetRepo({
        type: "Unexpected",
      }),
      clock: { now: () => new Date("2025-01-10T00:00:00.000Z") },
    });
    const unexpectedErrorResult = await unexpectedErrorUsecase({
      userId: 10,
      todoId: 7,
      progressStatus: "completed",
    });
    expect(unexpectedErrorResult.ok).toBe(false);
    if (!unexpectedErrorResult.ok) {
      expect(unexpectedErrorResult.error.type).toBe("InternalError");
    }
  });

  it("update: 完了操作日の基準で次回期限日を計算する", async () => {
    let successorInput: Readonly<{
      dueDate: Date;
      previousTodoId: number;
    }> | null = null;

    const usecase = createUpdateTodoUseCase({
      todoRepo: createRepoStub({
        findByIdForOwner: async () =>
          baseTodo({
            id: 20,
            name: "daily",
            detail: "detail",
            dueDate: new Date("2025-01-01T00:00:00.000Z"),
            progressStatus: "in_progress",
            recurrenceType: "daily",
          }),
        update: async () =>
          ok(
            baseTodo({
              id: 20,
              name: "daily",
              detail: "detail",
              dueDate: new Date("2025-01-01T00:00:00.000Z"),
              progressStatus: "completed",
              recurrenceType: "daily",
            }),
          ),
        create: async (input) => {
          successorInput = {
            dueDate: input.dueDate as Date,
            previousTodoId: input.previousTodoId as number,
          };
          return ok(
            baseTodo({
              id: 21,
              name: input.name,
              detail: input.detail,
              dueDate: input.dueDate,
              progressStatus: input.progressStatus,
              recurrenceType: input.recurrenceType,
              previousTodoId: input.previousTodoId ?? null,
            }),
          );
        },
      }),
      clock: { now: () => new Date("2025-03-10T15:45:00.000Z") },
    });

    const result = await usecase({
      userId: 10,
      todoId: 20,
      progressStatus: "completed",
    });

    expect(result.ok).toBe(true);
    expect(successorInput).not.toBeNull();
    expect(successorInput!.dueDate.toISOString()).toBe("2025-03-11T00:00:00.000Z");
    expect(successorInput!.previousTodoId).toBe(20);
  });

  it("update: 繰り返し解除後に完了しても次回タスクを生成しない", async () => {
    let createCalled = 0;

    const usecase = createUpdateTodoUseCase({
      todoRepo: createRepoStub({
        findByIdForOwner: async () =>
          baseTodo({
            id: 30,
            name: "recurring",
            detail: "",
            dueDate: new Date("2025-01-01T00:00:00.000Z"),
            progressStatus: "in_progress",
            recurrenceType: "daily",
          }),
        update: async () =>
          ok(
            baseTodo({
              id: 30,
              name: "recurring",
              detail: "",
              dueDate: new Date("2025-01-01T00:00:00.000Z"),
              progressStatus: "completed",
              recurrenceType: "none",
            }),
          ),
        create: async () => {
          createCalled += 1;
          return err({
            type: "Unexpected",
          });
        },
      }),
      clock: { now: () => new Date("2025-03-10T00:00:00.000Z") },
    });

    const result = await usecase({
      userId: 10,
      todoId: 30,
      progressStatus: "completed",
      recurrenceType: "none",
    });

    expect(result.ok).toBe(true);
    expect(createCalled).toBe(0);
  });
});
