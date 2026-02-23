import type { TodoItem, TodoProgressStatus } from "../domain/todo/types";

export type TodoQuery = Readonly<{
  ownerId: number;
  progressStatus?: TodoProgressStatus;
  keyword?: string;
  dueDateFilter?: "all" | "today" | "this_week" | "overdue" | "none";
}>;

export type CreateTodoRecordInput = Readonly<{
  ownerId: number;
  name: string;
  detail: string;
  dueDate: Date | null;
  progressStatus: TodoProgressStatus;
  recurrenceType: "none" | "daily" | "weekly" | "monthly";
  parentId: number | null;
  activeName: string | null;
  previousTodoId?: number;
}>;

export type UpdateTodoRecordInput = Readonly<{
  id: number;
  ownerId: number;
  name?: string;
  detail?: string;
  dueDate?: Date | null;
  progressStatus?: TodoProgressStatus;
  recurrenceType?: "none" | "daily" | "weekly" | "monthly";
  activeName?: string | null;
}>;

export type TodoRepoPort = Readonly<{
  listByOwner: (query: TodoQuery) => Promise<readonly TodoItem[]>;
  findByIdForOwner: (id: number, ownerId: number) => Promise<TodoItem | null>;
  create: (input: CreateTodoRecordInput) => Promise<TodoItem>;
  update: (input: UpdateTodoRecordInput) => Promise<TodoItem>;
  deleteById: (id: number, ownerId: number) => Promise<void>;
  countByParentId: (parentId: number, ownerId: number) => Promise<number>;
  countCompletedByParentId: (parentId: number, ownerId: number) => Promise<number>;
  findIncompleteSubtask: (parentId: number, ownerId: number) => Promise<TodoItem | null>;
  findDuplicateActiveName: (
    ownerId: number,
    name: string,
    excludeId?: number,
  ) => Promise<TodoItem | null>;
  runInTransaction: <T>(callback: (repo: TodoRepoPort) => Promise<T>) => Promise<T>;
}>;
