import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { ValidationError } from '../../src/models/error'

import { TodoQuickAdd } from '../../src/components/todo/TodoQuickAdd'
import { summarizeFormControls, summarizeText } from '../helpers/domSnapshot'

describe('TodoQuickAdd', () => {
  it('空文字で送信すると必須エラーを表示する', async () => {
    const onSubmit = vi.fn(async () => undefined)
    const { container } = render(<TodoQuickAdd onSubmit={onSubmit} />)

    fireEvent.click(screen.getByRole('button', { name: '追加' }))

    await waitFor(() => {
      expect(screen.getByText('タスク名を入力してください')).toBeInTheDocument()
    })
    expect(onSubmit).not.toHaveBeenCalled()
    expect(summarizeFormControls(container)).toMatchSnapshot('form')
    expect(summarizeText(container)).toMatchSnapshot('text')
  })

  it('入力して送信成功すると入力欄をクリアする', async () => {
    const onSubmit = vi.fn(async () => undefined)
    const { container } = render(<TodoQuickAdd onSubmit={onSubmit} />)
    const input = screen.getByRole('textbox', { name: 'クイック入力' })

    fireEvent.change(input, { target: { value: '明日 資料作成' } })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect(input).toHaveValue('')
    })
    expect(summarizeFormControls(container)).toMatchSnapshot('form')
    expect(summarizeText(container)).toMatchSnapshot('text')
  })

  it('サーバーのバリデーションエラー表示後に入力変更するとエラーをクリアする', async () => {
    const onSubmit = vi.fn(
      async (): Promise<readonly ValidationError[]> => [
        { field: 'name', reason: 'required' },
        { field: 'dueDate', reason: 'invalid_format' },
      ],
    )

    const { container } = render(<TodoQuickAdd onSubmit={onSubmit} />)
    const input = screen.getByLabelText('クイック入力')

    fireEvent.change(input, { target: { value: 'invalid date text' } })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))

    await waitFor(() => {
      expect(screen.getByText('タスク名を入力してください')).toBeInTheDocument()
      expect(screen.getByText('期限の形式が正しくありません')).toBeInTheDocument()
    })

    fireEvent.change(input, { target: { value: '来週木曜 定例MTG資料' } })

    await waitFor(() => {
      expect(screen.queryByText('タスク名を入力してください')).not.toBeInTheDocument()
      expect(screen.queryByText('期限の形式が正しくありません')).not.toBeInTheDocument()
    })
    expect(summarizeFormControls(container)).toMatchSnapshot('form')
    expect(summarizeText(container)).toMatchSnapshot('text')
  })
})
