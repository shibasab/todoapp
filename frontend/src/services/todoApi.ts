import type { CreateTodoRequest, Todo as ApiTodo, UpdateTodoRequest } from '@todoapp/shared'

import type { CreateTodoInput, Todo } from '../models/todo'

type ApiTodoWithParentTitle = Readonly<ApiTodo> &
  Readonly<{
    parentTitle?: string | null
  }>

export const toCreateTodoRequest = (input: CreateTodoInput): CreateTodoRequest => ({
  ...input,
  parentId: input.parentId ?? null,
})

export const toUpdateTodoRequest = (todo: Todo): UpdateTodoRequest => ({
  name: todo.name,
  detail: todo.detail,
  dueDate: todo.dueDate,
  progressStatus: todo.progressStatus,
  recurrenceType: todo.recurrenceType,
})

export const toTodoViewModels = (todos: readonly ApiTodoWithParentTitle[]): readonly Todo[] => {
  const todoNameById = new Map(todos.map((todo) => [todo.id, todo.name] as const))

  return todos.map((todo) => ({
    id: todo.id,
    name: todo.name,
    detail: todo.detail,
    dueDate: todo.dueDate,
    progressStatus: todo.progressStatus,
    recurrenceType: todo.recurrenceType,
    parentId: todo.parentId,
    parentTitle: todo.parentId == null ? null : (todo.parentTitle ?? todoNameById.get(todo.parentId) ?? null),
    completedSubtaskCount: todo.completedSubtaskCount,
    totalSubtaskCount: todo.totalSubtaskCount,
    subtaskProgressPercent: todo.subtaskProgressPercent,
  }))
}
