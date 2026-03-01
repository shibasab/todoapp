import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { ValidationError } from '../../src/models/error'
import type { Todo } from '../../src/models/todo'

import { TodoList } from '../../src/components/todo/TodoList'
import { summarizeFormControls, summarizeText } from '../helpers/domSnapshot'

const TODO_ITEM: Todo = {
  id: 1,
  name: '実装する',
  detail: '詳細あり',
  dueDate: '2026-02-01',
  progressStatus: 'not_started',
  recurrenceType: 'daily',
}

describe('TodoList', () => {
  it('空配列時は空メッセージを表示する', () => {
    const { container } = render(
      <TodoList
        todos={[]}
        hasSearchCriteria={false}
        onDelete={vi.fn()}
        onEdit={vi.fn(async () => undefined)}
        onToggleCompletion={vi.fn(async () => undefined as string | undefined)}
      />,
    )

    expect(screen.getByText('タスクはありません')).toBeInTheDocument()
    expect(summarizeText(container)).toMatchSnapshot('text')
  })

  it('表示モードでトグル・削除が動作し、編集保存成功で表示モードへ戻る', async () => {
    const onDelete = vi.fn()
    const onToggleCompletion = vi.fn(async () => undefined as string | undefined)
    const onEdit = vi.fn(async () => undefined)

    const { container } = render(
      <TodoList
        todos={[TODO_ITEM]}
        hasSearchCriteria={false}
        onDelete={onDelete}
        onEdit={onEdit}
        onToggleCompletion={onToggleCompletion}
      />,
    )

    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(onToggleCompletion).toHaveBeenCalledWith(TODO_ITEM)
    expect(onDelete).toHaveBeenCalledWith(1)

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('タスク名'), { target: { value: '  更新後  ' } })
    fireEvent.change(screen.getByLabelText('詳細'), { target: { value: '更新詳細' } })
    fireEvent.change(screen.getByLabelText('進捗'), { target: { value: 'completed' } })
    fireEvent.change(screen.getByLabelText('繰り返し'), { target: { value: 'weekly' } })
    fireEvent.change(screen.getByLabelText('期限'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(onEdit).toHaveBeenCalledWith({
        id: 1,
        name: '更新後',
        detail: '更新詳細',
        dueDate: null,
        progressStatus: 'completed',
        recurrenceType: 'weekly',
      })
    })

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    })

    expect(summarizeText(container)).toMatchSnapshot('text')
    expect(summarizeFormControls(container)).toMatchSnapshot('form')
  })

  it('編集保存でバリデーションエラーが返ると編集状態を維持してエラーを表示する', async () => {
    const onEdit = vi.fn(
      async (): Promise<readonly ValidationError[]> => [{ field: 'dueDate', reason: 'invalid_format' }],
    )

    const { container } = render(
      <TodoList
        todos={[TODO_ITEM]}
        hasSearchCriteria={true}
        onDelete={vi.fn()}
        onEdit={onEdit}
        onToggleCompletion={vi.fn(async () => undefined as string | undefined)}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.getByText('期限の形式が正しくありません')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(summarizeText(container)).toMatchSnapshot('text')
    expect(summarizeFormControls(container)).toMatchSnapshot('form')
  })
})
