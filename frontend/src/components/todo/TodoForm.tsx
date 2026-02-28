import { useCallback, useState, type FormEvent, type ChangeEvent } from 'react'

import type { ValidationError } from '../../models/error'
import type { CreateTodoInput, TodoRecurrenceType } from '../../models/todo'

import { TODO_NAME_MAX_LENGTH, TODO_DETAIL_MAX_LENGTH, useTodoFieldValidation } from '../../hooks/useTodo'
import { mergeValidationErrors } from '../../services/validation'
import { FieldError } from '../FieldError'
import { ValidatedInput } from '../ValidatedInput'

type TodoFormProps = Readonly<{
  onSubmit: (todo: CreateTodoInput) => Promise<readonly ValidationError[] | undefined>
}>

type FormState = Readonly<{
  name: string
  detail: string
  dueDate: string
  recurrenceType: TodoRecurrenceType
}>

export const TodoForm = ({ onSubmit }: TodoFormProps) => {
  const [formState, setFormState] = useState<FormState>({
    name: '',
    detail: '',
    dueDate: '',
    recurrenceType: 'none',
  })
  const [errors, setErrors] = useState<readonly ValidationError[]>([])

  const mergeErrors = useCallback((incoming: readonly ValidationError[]) => {
    setErrors((prev) => mergeValidationErrors(prev, incoming))
  }, [])

  const { validateName, validateDetail } = useTodoFieldValidation((update) => setErrors(update))

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormState((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const dueDate = formState.dueDate === '' ? null : formState.dueDate
    const validationErrors = await onSubmit({
      name: formState.name.trim(),
      detail: formState.detail,
      dueDate,
      progressStatus: 'not_started',
      recurrenceType: formState.recurrenceType,
      parentId: null,
    })
    if (validationErrors != null && validationErrors.length > 0) {
      mergeErrors(validationErrors)
      return
    }
    setFormState({ name: '', detail: '', dueDate: '', recurrenceType: 'none' })
    setErrors([])
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 my-6">
      <h2 className="text-xl font-bold mb-4">Add Todo</h2>
      <form onSubmit={handleSubmit}>
        <ValidatedInput
          id="todo-name"
          name="name"
          label="Task"
          errorLabel="タスク名"
          type="text"
          maxLength={TODO_NAME_MAX_LENGTH}
          value={formState.name}
          onChange={handleChange}
          validate={validateName}
          errors={errors}
        />
        <ValidatedInput
          id="todo-detail"
          name="detail"
          label="Detail"
          errorLabel="詳細"
          type="text"
          maxLength={TODO_DETAIL_MAX_LENGTH}
          value={formState.detail}
          onChange={handleChange}
          validate={validateDetail}
          errors={errors}
        />
        <div className="mb-4">
          <label htmlFor="todo-recurrenceType" className="block text-sm font-medium text-gray-700 mb-2">
            Recurrence
          </label>
          <select
            id="todo-recurrenceType"
            name="recurrenceType"
            onChange={handleChange}
            value={formState.recurrenceType}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300"
          >
            <option value="none">なし</option>
            <option value="daily">毎日</option>
            <option value="weekly">毎週</option>
            <option value="monthly">毎月</option>
          </select>
        </div>
        <div className="mb-4">
          <label htmlFor="todo-dueDate" className="block text-sm font-medium text-gray-700 mb-2">
            Due Date
          </label>
          <input
            id="todo-dueDate"
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.some((e) => e.field === 'dueDate') ? 'border-red-500' : 'border-gray-300'
            }`}
            type="date"
            name="dueDate"
            onChange={handleChange}
            value={formState.dueDate}
          />
          <FieldError errors={errors} fieldName="dueDate" fieldLabel="期限" />
        </div>

        <div className="mb-4">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Submit
          </button>
        </div>
      </form>
    </div>
  )
}
