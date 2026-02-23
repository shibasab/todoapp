import type { PrismaClient } from "@prisma/client";
import type {
  CreateTodoRecordInput,
  TodoQuery,
  TodoRepoPort,
  UpdateTodoRecordInput,
} from "../../ports/todo-repo-port";

const unsupported = (): never => {
  throw new Error("Todo Prisma repository is not wired yet");
};

export const createPrismaTodoRepoPort = (_prisma: PrismaClient): TodoRepoPort => {
  const listByOwner = async (_query: TodoQuery) => unsupported();
  const findByIdForOwner = async (_id: number, _ownerId: number) => unsupported();
  const create = async (_input: CreateTodoRecordInput) => unsupported();
  const update = async (_input: UpdateTodoRecordInput) => unsupported();
  const deleteById = async (_id: number, _ownerId: number) => unsupported();
  const countByParentId = async (_parentId: number, _ownerId: number) => unsupported();
  const countCompletedByParentId = async (_parentId: number, _ownerId: number) => unsupported();
  const findIncompleteSubtask = async (_parentId: number, _ownerId: number) => unsupported();
  const findDuplicateActiveName = async (_ownerId: number, _name: string, _excludeId?: number) =>
    unsupported();

  const runInTransaction = async <T>(_callback: (repo: TodoRepoPort) => Promise<T>): Promise<T> =>
    unsupported();

  return {
    listByOwner,
    findByIdForOwner,
    create,
    update,
    deleteById,
    countByParentId,
    countCompletedByParentId,
    findIncompleteSubtask,
    findDuplicateActiveName,
    runInTransaction,
  };
};
