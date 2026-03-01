import { todoPath } from '@todoapp/shared'
import { isAxiosError } from 'axios'
import { useCallback, useRef, useState } from 'react'

import type { CreateTodoInput, Todo, TodoRecurrenceType } from '../models/todo'
import type { TodoSearchParams, TodoSearchState } from './todoSearch'

import { useApiClient } from '../contexts/ApiContext'
import { toValidationErrors, type ValidationError } from '../models/error'
import { toCreateTodoRequest, toTodoViewModels, toUpdateTodoRequest } from '../services/todoApi'
import { validateRequired, validateMaxLength } from '../services/validation'

// バリデーション制約値（バックエンドと同期）
export const TODO_NAME_MAX_LENGTH = 100
export const TODO_DETAIL_MAX_LENGTH = 500

const removeNulls = <T>(values: readonly (T | null)[]): readonly T[] => {
  return values.filter((value) => value != null)
}

const getTodoNameErrors = (value: string): readonly ValidationError[] => {
  return removeNulls([validateRequired('name', value), validateMaxLength('name', value, TODO_NAME_MAX_LENGTH)])
}

const getTodoDetailErrors = (value: string): readonly ValidationError[] => {
  return removeNulls([validateMaxLength('detail', value, TODO_DETAIL_MAX_LENGTH)])
}

const getTodoDueDateErrors = (
  dueDate: string | null | undefined,
  recurrenceType: TodoRecurrenceType,
): readonly ValidationError[] => {
  if (recurrenceType === 'none' || dueDate != null) {
    return []
  }
  return [{ field: 'dueDate', reason: 'required' }]
}

/**
 * Todoフォームのバリデーション
 * @returns バリデーションエラーの配列（エラーがなければ空配列）
 */
const validateTodoForm = (
  name: string,
  detail: string,
  dueDate: string | null | undefined,
  recurrenceType: TodoRecurrenceType,
): readonly ValidationError[] => {
  return [...getTodoNameErrors(name), ...getTodoDetailErrors(detail), ...getTodoDueDateErrors(dueDate, recurrenceType)]
}

type ErrorsUpdater = (update: (prev: readonly ValidationError[]) => readonly ValidationError[]) => void

export const useTodoFieldValidation = (setErrors: ErrorsUpdater) => {
  const updateFieldErrors = useCallback(
    (fieldName: string, newErrors: readonly ValidationError[]) => {
      setErrors((prev) => {
        const remaining = prev.filter((error) => error.field !== fieldName)
        return newErrors.length > 0 ? [...remaining, ...newErrors] : remaining
      })
    },
    [setErrors],
  )

  const validateName = useCallback(
    (value: string) => {
      updateFieldErrors('name', getTodoNameErrors(value))
    },
    [updateFieldErrors],
  )

  const validateDetail = useCallback(
    (value: string) => {
      updateFieldErrors('detail', getTodoDetailErrors(value))
    },
    [updateFieldErrors],
  )

  return { validateName, validateDetail, updateFieldErrors } as const
}

type TodoService = Readonly<{
  todos: readonly Todo[]
  isLoading: boolean
  fetchTodos: (criteria?: TodoSearchState) => Promise<void>
  addTodo: (todo: CreateTodoInput) => Promise<readonly ValidationError[] | undefined>
  updateTodo: (todo: Todo) => Promise<readonly ValidationError[] | undefined>
  toggleTodoCompletion: (todo: Todo) => Promise<string | undefined>
  removeTodo: (id: number) => Promise<void>
  validateTodo: (
    name: string,
    detail: string,
    dueDate: string | null | undefined,
    recurrenceType: TodoRecurrenceType,
  ) => readonly ValidationError[]
}>

const buildTodoSearchParams = (criteria?: TodoSearchState): TodoSearchParams | undefined => {
  if (!criteria) {
    return undefined
  }

  const keyword = criteria.keyword.trim()
  const progressStatus = criteria.status === 'all' ? undefined : criteria.status
  const dueDate = criteria.dueDate === 'all' ? undefined : criteria.dueDate

  const params: TodoSearchParams = {
    ...(keyword === '' ? {} : { keyword }),
    ...(progressStatus ? { progressStatus } : {}),
    ...(dueDate ? { dueDate } : {}),
  }

  return Object.keys(params).length > 0 ? params : undefined
}

export const useTodo = (): TodoService => {
  const { apiClient, isLoading } = useApiClient()
  const [todos, setTodos] = useState<readonly Todo[]>([])
  // 検索条件を保持し、追加/更新/削除後も同じ条件で再取得するために使用する
  const lastSearchRef = useRef<TodoSearchState | undefined>(undefined)

  const fetchTodos = useCallback(
    async (criteria?: TodoSearchState) => {
      lastSearchRef.current = criteria
      const params = buildTodoSearchParams(criteria)
      const data = await apiClient.get('/todo/', {
        ...(params ? { params } : {}),
        options: {
          key: 'todo-search',
          mode: 'latestOnly',
        },
      })
      setTodos(toTodoViewModels(data))
    },
    [apiClient],
  )

  const addTodo = useCallback(
    async (data: CreateTodoInput): Promise<readonly ValidationError[] | undefined> => {
      // クライアントバリデーション
      const clientErrors = validateTodoForm(data.name, data.detail, data.dueDate, data.recurrenceType)
      if (clientErrors.length > 0) {
        return clientErrors
      }

      // API 呼び出し（unique_violation 等はサーバーでのみ検出）
      const result = await apiClient.post('/todo/', toCreateTodoRequest(data))
      if (!result.ok) {
        return toValidationErrors(result.error.errors)
      }
      await fetchTodos(lastSearchRef.current)
    },
    [apiClient, fetchTodos],
  )

  const updateTodo = useCallback(
    async (todo: Todo): Promise<readonly ValidationError[] | undefined> => {
      // クライアントバリデーション
      const clientErrors = validateTodoForm(todo.name, todo.detail, todo.dueDate, todo.recurrenceType)
      if (clientErrors.length > 0) {
        return clientErrors
      }

      const { id } = todo
      // API 呼び出し（unique_violation 等はサーバーでのみ検出）
      const result = await apiClient.put(todoPath(id), toUpdateTodoRequest(todo))
      if (!result.ok) {
        return toValidationErrors(result.error.errors)
      }
      await fetchTodos(lastSearchRef.current)
    },
    [apiClient, fetchTodos],
  )

  const toggleTodoCompletion = useCallback(
    async (todo: Todo): Promise<string | undefined> => {
      try {
        // 現在の状態を反転させて更新
        const validationErrors = await updateTodo({
          ...todo,
          progressStatus: todo.progressStatus === 'completed' ? 'not_started' : 'completed',
        })
        if (validationErrors) {
          return '入力内容に誤りがあります'
        }
        return
      } catch (error) {
        if (isAxiosError<{ detail?: string }>(error) && error.response?.status === 409) {
          return error.response.data?.detail ?? '未完了のサブタスクがあるため完了できません'
        }
        throw error
      }
    },
    [updateTodo],
  )

  const removeTodo = useCallback(
    async (id: number) => {
      await apiClient.delete(todoPath(id))
      await fetchTodos(lastSearchRef.current)
    },
    [apiClient, fetchTodos],
  )

  return {
    todos,
    isLoading,
    fetchTodos,
    addTodo,
    updateTodo,
    toggleTodoCompletion,
    removeTodo,
    validateTodo: validateTodoForm,
  } as const
}
