import { Fragment, useState, useCallback, type ChangeEvent } from 'react'

import type { ValidationError } from '../../models/error'
import type { CreateTodoInput, Todo } from '../../models/todo'

import { TODO_NAME_MAX_LENGTH, TODO_DETAIL_MAX_LENGTH, useTodoFieldValidation } from '../../hooks/useTodo'
import { mergeValidationErrors } from '../../services/validation'
import { FieldError } from '../FieldError'
import { SelectBox, type SelectOption } from '../SelectBox'
import { ValidatedInput } from '../ValidatedInput'

type TodoListProps = Readonly<{
  todos: readonly Todo[]
  hasSearchCriteria: boolean
  onDelete: (id: number) => void
  onEdit: (todo: Todo) => Promise<readonly ValidationError[] | undefined>
  onToggleCompletion: (todo: Todo) => Promise<readonly ValidationError[] | undefined>
  onCreateTodo?: (todo: CreateTodoInput) => Promise<readonly ValidationError[] | undefined>
}>

type EditState =
  | (Todo &
      Readonly<{
        dueDate: string
        errors: readonly ValidationError[]
      }>)
  | null

export const TodoList = ({
  todos,
  hasSearchCriteria,
  onDelete,
  onEdit,
  onToggleCompletion,
  onCreateTodo,
}: TodoListProps) => {
  const [editState, setEditState] = useState<EditState>(null)
  const [childTodoNames, setChildTodoNames] = useState<Readonly<Record<number, string>>>({})
  const [createTodoErrorsByParentId, setCreateTodoErrorsByParentId] = useState<
    Readonly<Record<number, readonly ValidationError[]>>
  >({})
  const [toggleErrors, setToggleErrors] = useState<Readonly<Record<number, readonly ValidationError[]>>>({})
  const emptyMessage = hasSearchCriteria ? '条件に一致するタスクがありません' : 'タスクはありません'
  const recurrenceTypeLabel: Record<Todo['recurrenceType'], string> = {
    none: 'なし',
    daily: '毎日',
    weekly: '毎週',
    monthly: '毎月',
  }
  const progressStatusLabel: Record<Todo['progressStatus'], string> = {
    not_started: '着手前',
    in_progress: '進行中',
    completed: '完了',
  }
  const recurrenceTypeOptions: readonly SelectOption<Todo['recurrenceType']>[] = [
    { value: 'none', label: 'なし' },
    { value: 'daily', label: '毎日' },
    { value: 'weekly', label: '毎週' },
    { value: 'monthly', label: '毎月' },
  ]
  const progressStatusOptions: readonly SelectOption<Todo['progressStatus']>[] = [
    { value: 'not_started', label: '着手前' },
    { value: 'in_progress', label: '進行中' },
    { value: 'completed', label: '完了' },
  ]

  const handleEditClick = (todo: Todo) => {
    setEditState({
      id: todo.id,
      name: todo.name,
      detail: todo.detail,
      dueDate: todo.dueDate ?? '',
      progressStatus: todo.progressStatus,
      recurrenceType: todo.recurrenceType,
      errors: [],
    })
  }

  const handleCancelClick = () => {
    setEditState(null)
  }

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (editState == null) return
    const { name, value } = e.target
    setEditState({ ...editState, [name]: value })
  }

  const setEditErrors = useCallback((update: (prev: readonly ValidationError[]) => readonly ValidationError[]) => {
    setEditState((prev) => {
      if (prev == null) return prev
      return { ...prev, errors: update(prev.errors) }
    })
  }, [])

  const { validateName, validateDetail } = useTodoFieldValidation(setEditErrors)

  const handleSaveClick = async () => {
    if (editState == null) return
    const { errors: _, ...todo } = editState
    const dueDate = editState.dueDate === '' ? null : editState.dueDate
    const validationErrors = await onEdit({
      ...todo,
      name: todo.name.trim(),
      dueDate,
    })
    if (validationErrors) {
      setEditState((prev) => {
        if (prev == null) return prev
        return { ...prev, errors: mergeValidationErrors(prev.errors, validationErrors) }
      })
      return
    }
    setEditState(null)
  }

  const handleChildTodoNameChange = useCallback((parentId: number, value: string) => {
    setChildTodoNames((prev) => ({ ...prev, [parentId]: value }))
  }, [])

  const handleCreateChildTodo = useCallback(
    async (parentId: number) => {
      if (onCreateTodo == null) {
        return
      }

      const validationErrors = await onCreateTodo({
        name: (childTodoNames[parentId] ?? '').trim(),
        detail: '',
        dueDate: null,
        progressStatus: 'not_started',
        recurrenceType: 'none',
        parentId,
      })

      if (validationErrors != null && validationErrors.length > 0) {
        setCreateTodoErrorsByParentId((prev) => ({ ...prev, [parentId]: validationErrors }))
        return
      }

      setChildTodoNames((prev) => ({ ...prev, [parentId]: '' }))
      setCreateTodoErrorsByParentId((prev) => ({ ...prev, [parentId]: [] }))
    },
    [childTodoNames, onCreateTodo],
  )

  const handleToggleCompletion = useCallback(
    async (todo: Todo) => {
      const errors = await onToggleCompletion(todo)
      if (errors == null || errors.length === 0) {
        setToggleErrors((prev) => ({ ...prev, [todo.id]: [] }))
        return
      }
      setToggleErrors((prev) => ({ ...prev, [todo.id]: errors }))
    },
    [onToggleCompletion],
  )

  return (
    <Fragment>
      <br />
      <h4 className="text-xl font-bold mb-4">Todo List</h4>
      <div className="space-y-4">
        {todos.length === 0 ? (
          <div className="text-center py-8 text-gray-500">{emptyMessage}</div>
        ) : (
          todos.map((todo) => {
            const isEditing = editState?.id === todo.id
            const isCompleted = todo.progressStatus === 'completed'
            const isSubtask = todo.parentId != null
            const subtasks = isSubtask ? [] : todos.filter((item) => item.parentId === todo.id)
            const completedCount = todo.completedSubtaskCount ?? 0
            const totalCount = todo.totalSubtaskCount ?? 0
            const progressPercent = todo.subtaskProgressPercent ?? 0
            const createTodoErrors = createTodoErrorsByParentId[todo.id] ?? []
            const hasNonNameCreateError = createTodoErrors.some((error) => error.field !== 'name')

            if (isEditing) {
              return (
                <div key={todo.id} className="bg-white rounded-lg shadow-md p-4 border-2 border-blue-400">
                  <ValidatedInput
                    id={`edit-name-${todo.id}`}
                    name="name"
                    type="text"
                    label="タスク名"
                    errorLabel="タスク名"
                    value={editState.name}
                    maxLength={TODO_NAME_MAX_LENGTH}
                    errors={editState.errors}
                    validate={validateName}
                    onChange={handleInputChange}
                  />
                  <ValidatedInput
                    id={`edit-detail-${todo.id}`}
                    name="detail"
                    type="text"
                    label="詳細"
                    errorLabel="詳細"
                    value={editState.detail}
                    maxLength={TODO_DETAIL_MAX_LENGTH}
                    errors={editState.errors}
                    validate={validateDetail}
                    onChange={handleInputChange}
                  />
                  <SelectBox
                    id={`edit-recurrenceType-${todo.id}`}
                    label="繰り返し"
                    value={editState.recurrenceType}
                    options={recurrenceTypeOptions}
                    onChange={(value) =>
                      setEditState((prev) => (prev == null ? prev : { ...prev, recurrenceType: value }))
                    }
                    wrapperClassName="mb-3"
                  />
                  <SelectBox
                    id={`edit-progressStatus-${todo.id}`}
                    label="進捗"
                    value={editState.progressStatus}
                    options={progressStatusOptions}
                    onChange={(value) =>
                      setEditState((prev) => (prev == null ? prev : { ...prev, progressStatus: value }))
                    }
                    wrapperClassName="mb-3"
                  />
                  <div className="mb-3">
                    <label htmlFor={`edit-dueDate-${todo.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                      期限
                    </label>
                    <input
                      id={`edit-dueDate-${todo.id}`}
                      type="date"
                      name="dueDate"
                      value={editState.dueDate}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        editState.errors.some((e) => e.field === 'dueDate') ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    <FieldError errors={editState.errors} fieldName="dueDate" fieldLabel="期限" />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveClick}
                      className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancelClick}
                      className="px-3 py-1 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )
            }

            return (
              <div
                key={todo.id}
                className={`rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow duration-200 border border-gray-100 overflow-hidden ${
                  isCompleted ? 'bg-gray-50' : 'bg-white'
                }`}
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={isCompleted}
                      onChange={() => {
                        void handleToggleCompletion(todo)
                      }}
                      className="mt-1.5 w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300 cursor-pointer"
                    />
                    <div className="min-w-0">
                      <h5
                        className={`text-lg font-semibold break-all overflow-hidden ${
                          isCompleted ? 'text-gray-400 line-through' : 'text-gray-800'
                        }`}
                      >
                        {todo.name}
                      </h5>
                      <p className={`text-sm mt-1 ${isCompleted ? 'text-gray-400' : 'text-gray-500'}`}>
                        期限: {todo.dueDate ?? '-'}
                      </p>
                      <p className={`text-sm mt-1 ${isCompleted ? 'text-gray-400' : 'text-indigo-700'}`}>
                        進捗: {progressStatusLabel[todo.progressStatus]}
                      </p>
                      {!isSubtask ? (
                        <p className={`text-sm mt-1 ${isCompleted ? 'text-gray-400' : 'text-emerald-700'}`}>
                          サブタスク進捗: {completedCount}/{totalCount} ({progressPercent}%)
                        </p>
                      ) : (
                        <p className={`text-sm mt-1 ${isCompleted ? 'text-gray-400' : 'text-emerald-700'}`}>
                          親タスク: {todo.parentTitle ?? '不明'}
                        </p>
                      )}
                      {todo.recurrenceType !== 'none' ? (
                        <p className={`text-sm mt-1 ${isCompleted ? 'text-gray-400' : 'text-cyan-700'}`}>
                          繰り返し: {recurrenceTypeLabel[todo.recurrenceType]}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleEditClick(todo)}
                      className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(todo.id)}
                      className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {todo.detail && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p
                      className={`break-all whitespace-pre-wrap overflow-hidden ${
                        isCompleted ? 'text-gray-400' : 'text-gray-600'
                      }`}
                    >
                      {todo.detail}
                    </p>
                  </div>
                )}
                {!isSubtask ? (
                  <div className="mt-3 border-t border-gray-100 pt-3">
                    <h6 className="text-sm font-semibold text-gray-700">サブタスク</h6>
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        value={childTodoNames[todo.id] ?? ''}
                        onChange={(event) => handleChildTodoNameChange(todo.id, event.target.value)}
                        aria-label={`サブタスク名-${todo.id}`}
                        placeholder="サブタスク名を入力"
                        className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          void handleCreateChildTodo(todo.id)
                        }}
                        aria-label={`サブタスク追加-${todo.id}`}
                        className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
                      >
                        追加
                      </button>
                    </div>
                    <FieldError errors={createTodoErrors} fieldName="name" fieldLabel="タスク名" />
                    {hasNonNameCreateError ? (
                      <p className="mt-1 text-sm text-red-600">タスクを追加できませんでした</p>
                    ) : null}
                    {subtasks.length === 0 ? (
                      <p className="mt-2 text-sm text-gray-500">サブタスクはありません</p>
                    ) : (
                      <ul className="mt-2 list-disc pl-5 text-sm text-gray-700">
                        {subtasks.map((subtask) => (
                          <li key={subtask.id}>{subtask.name}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
                {(toggleErrors[todo.id] ?? []).map((error) => (
                  <p key={`${todo.id}-${error.field}-${error.reason}`} className="mt-2 text-sm text-red-600">
                    {error.field === 'global' ? error.reason : '入力内容に誤りがあります'}
                  </p>
                ))}
              </div>
            )
          })
        )}
      </div>
    </Fragment>
  )
}
