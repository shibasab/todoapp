import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { ValidationError } from '../../src/models/error'

import { TodoForm } from '../../src/components/todo/TodoForm'
import { summarizeFormControls, summarizeText } from '../helpers/domSnapshot'

describe('TodoForm', () => {
  it('入力して送信するとonSubmitへ正規化された値を渡し、成功時にフォームを初期化する', async () => {
    const onSubmit = vi.fn(async () => undefined)
    const { container } = render(<TodoForm onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText('Task'), { target: { value: '  タスクA  ' } })
    fireEvent.change(screen.getByLabelText('Detail'), { target: { value: '詳細A' } })
    fireEvent.change(screen.getByLabelText('Recurrence'), { target: { value: 'weekly' } })
    fireEvent.change(screen.getByLabelText('Due Date'), { target: { value: '2026-01-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'タスクA',
        detail: '詳細A',
        dueDate: '2026-01-01',
        progressStatus: 'not_started',
        recurrenceType: 'weekly',
        parentId: null,
      })
    })

    await waitFor(() => {
      expect(screen.getByLabelText('Task')).toHaveValue('')
      expect(screen.getByLabelText('Detail')).toHaveValue('')
      expect(screen.getByLabelText('Recurrence')).toHaveValue('none')
      expect(screen.getByLabelText('Due Date')).toHaveValue('')
    })

    expect(summarizeFormControls(container)).toMatchSnapshot('form')
    expect(summarizeText(container)).toMatchSnapshot('text')
  })

  it('サーバーのバリデーションエラーを表示する', async () => {
    const onSubmit = vi.fn(
      async (): Promise<readonly ValidationError[]> => [{ field: 'dueDate', reason: 'invalid_format' }],
    )

    const { container } = render(<TodoForm onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText('Task'), { target: { value: 'タスクB' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(screen.getByText('期限の形式が正しくありません')).toBeInTheDocument()
    })

    expect(summarizeFormControls(container)).toMatchSnapshot('form')
    expect(summarizeText(container)).toMatchSnapshot('text')
  })
})
