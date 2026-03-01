/**
 * TODO型定義
 */
import type {
  CreateTodoRequest as SharedCreateTodoRequest,
  ListTodoQuery,
  Todo as SharedTodo,
  TodoDueDateFilter as SharedTodoDueDateFilter,
  TodoProgressStatus,
  TodoRecurrenceType,
} from '@todoapp/shared'

export type Todo = Pick<SharedTodo, 'id' | 'name' | 'detail' | 'dueDate' | 'progressStatus' | 'recurrenceType'>

export type CreateTodoInput = Omit<SharedCreateTodoRequest, 'parentId'> &
  Readonly<{
    parentId?: SharedCreateTodoRequest['parentId']
  }>

export type TodoStatusFilter = 'all' | TodoProgressStatus
export type TodoDueDateFilter = SharedTodoDueDateFilter

export type TodoSearchParamStatus = Exclude<TodoStatusFilter, 'all'>
export type TodoSearchParamDueDate = Exclude<TodoDueDateFilter, 'all'>

export type TodoSearchQuery = ListTodoQuery
export type { TodoProgressStatus, TodoRecurrenceType }
