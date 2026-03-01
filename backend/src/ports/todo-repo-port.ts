import type { TaskResult } from "@todoapp/shared";
import type {
  TodoDueDateFilter,
  TodoItem,
  TodoProgressStatus,
  TodoRecurrenceType,
} from "../domain/todo/types";

export type TodoQuery = Readonly<{
  ownerId: number;
  now: Date;
  progressStatus?: TodoProgressStatus;
  keyword?: string;
  dueDateFilter?: TodoDueDateFilter;
  parentId?: number;
}>;

export type CreateTodoRecordInput = Readonly<{
  ownerId: number;
  name: string;
  detail: string;
  dueDate: Date | null;
  progressStatus: TodoProgressStatus;
  recurrenceType: TodoRecurrenceType;
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
  recurrenceType?: TodoRecurrenceType;
  activeName?: string | null;
}>;

export type TodoRepoCreateError =
  | Readonly<{
      type: "DuplicateActiveName";
    }>
  | Readonly<{
      type: "DuplicatePreviousTodo";
    }>
  | Readonly<{
      type: "Unexpected";
    }>;

export type TodoRepoUpdateError =
  | Readonly<{
      type: "DuplicateActiveName";
    }>
  | Readonly<{
      type: "Unexpected";
    }>;

export type TodoRepoPort = Readonly<{
  listByOwner: (query: TodoQuery) => Promise<readonly TodoItem[]>;
  findByIdForOwner: (id: number, ownerId: number) => Promise<TodoItem | null>;
  create: (input: CreateTodoRecordInput) => TaskResult<TodoItem, TodoRepoCreateError>;
  update: (input: UpdateTodoRecordInput) => TaskResult<TodoItem, TodoRepoUpdateError>;
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
