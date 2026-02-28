import { useCallback, useState, type ChangeEvent, type FormEvent } from 'react'

import type { ValidationError } from '../../models/error'
import type { CreateTodoInput } from '../../models/todo'

import { TODO_NAME_MAX_LENGTH } from '../../hooks/useTodo'
import { parseTodoQuickAddInput } from '../../services/todoQuickAddParser'
import { mergeValidationErrors } from '../../services/validation'
import { FieldError } from '../FieldError'

type TodoQuickAddProps = Readonly<{
  onSubmit: (todo: CreateTodoInput) => Promise<readonly ValidationError[] | undefined>
}>

export const TodoQuickAdd = ({ onSubmit }: TodoQuickAddProps) => {
  const [input, setInput] = useState('')
  const [errors, setErrors] = useState<readonly ValidationError[]>([])

  const mergeErrors = useCallback((incoming: readonly ValidationError[]) => {
    setErrors((prev) => mergeValidationErrors(prev, incoming))
  }, [])

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setInput(event.target.value)
    setErrors((prev) => prev.filter((error) => error.field !== 'name' && error.field !== 'dueDate'))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()

    const trimmedInput = input.trim()
    if (trimmedInput === '') {
      setErrors([{ field: 'name', reason: 'required' }])
      return
    }

    const parsed = parseTodoQuickAddInput(trimmedInput)
    const validationErrors = await onSubmit({
      name: parsed.name,
      detail: '',
      dueDate: parsed.dueDate,
      progressStatus: 'not_started',
      recurrenceType: 'none',
      parentId: null,
    })
    if (validationErrors != null && validationErrors.length > 0) {
      mergeErrors(validationErrors)
      return
    }

    setInput('')
    setErrors([])
  }

  return (
    <section className="mb-6 rounded-lg border border-cyan-100 bg-white p-4 shadow-md">
      <h4 className="mb-3 text-lg font-bold">クイック追加</h4>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 md:flex-row md:items-start">
        <div className="flex-1">
          <label htmlFor="todo-quick-add-input" className="mb-1 block text-sm font-medium text-gray-700">
            クイック入力
          </label>
          <input
            id="todo-quick-add-input"
            type="text"
            name="quickAdd"
            maxLength={TODO_NAME_MAX_LENGTH}
            value={input}
            onChange={handleChange}
            placeholder="例: 来週金曜 リリース準備"
            className={`w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.some((error) => error.field === 'name' || error.field === 'dueDate')
                ? 'border-red-500'
                : 'border-gray-300'
            }`}
          />
          <FieldError errors={errors} fieldName="name" fieldLabel="タスク名" />
          <FieldError errors={errors} fieldName="dueDate" fieldLabel="期限" />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-cyan-700 md:mt-7 md:w-auto"
        >
          追加
        </button>
      </form>
    </section>
  )
}
