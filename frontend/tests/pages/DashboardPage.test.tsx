import { waitFor, fireEvent, within, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { setupHttpFixtureTest } from '../helpers/httpMock'
import { renderApp } from '../helpers/renderPage'

const setupAuthenticatedDashboard = (todoListFixture = 'api/todo/list.default.json') => {
  return setupHttpFixtureTest({
    scenarioFixture: 'scenarios/dashboard/authenticated.default.json',
    routes:
      todoListFixture === 'api/todo/list.default.json'
        ? []
        : [
            {
              method: 'GET',
              url: '/todo/',
              responseFixture: todoListFixture,
            },
          ],
  })
}

describe('DashboardPage', () => {
  describe('初期表示', () => {
    it('ページレンダリング時にGET APIが呼ばれ、TODOリストが表示される', async () => {
      const { apiClient, requestLog } = setupAuthenticatedDashboard()

      const { container } = renderApp({ apiClient, initialRoute: '/', isAuthenticated: true })

      // APIリクエストを検証
      await waitFor(() => {
        expect(requestLog).toMatchSnapshot('api-requests')
      })

      // 画面表示を検証
      await waitFor(() => {
        expect(within(container).getByText('Test Todo 1')).toBeInTheDocument()
        expect(within(container).getByText('Test Todo 2')).toBeInTheDocument()
        expect(within(container).getByLabelText('検索')).toBeInTheDocument()
        expect(within(container).getByLabelText('状態')).toBeInTheDocument()
        expect(within(container).getByLabelText('期限')).toBeInTheDocument()
        expect(within(container).getByLabelText('クイック入力')).toBeInTheDocument()
        expect(within(container).getByRole('button', { name: '追加' })).toBeInTheDocument()
        expect(within(container).getByRole('button', { name: '詳細入力を開く' })).toBeInTheDocument()
        expect(within(container).getByRole('button', { name: 'クリア' })).toBeInTheDocument()
        expect(within(container).getByText('繰り返し: 毎週')).toBeInTheDocument()
        expect(within(container).queryByLabelText('Task')).not.toBeInTheDocument()
      })
    })
  })

  describe('TODO追加', () => {
    it('自然文入力で期限を抽出してPOST APIが呼ばれる', async () => {
      const { apiClient, requestLog, clearRequests } = setupHttpFixtureTest({
        scenarioFixture: 'scenarios/dashboard/authenticated.default.json',
        routes: [
          {
            method: 'POST',
            url: '/todo/',
            responseFixture: 'api/todo/create.new-todo.json',
          },
        ],
      })

      const { container } = renderApp({ apiClient, initialRoute: '/', isAuthenticated: true })

      // 初期表示完了を待機（TODOリストが表示されるまで）
      await waitFor(() => {
        expect(within(container).getByText('Test Todo 1')).toBeInTheDocument()
      })
      clearRequests()

      // クイック追加入力
      const quickAddInput = within(container).getByLabelText('クイック入力')
      const submitButton = within(container).getByRole('button', { name: '追加' })

      fireEvent.change(quickAddInput, { target: { value: '2026-02-20 New Todo' } })
      fireEvent.click(submitButton)

      // APIリクエストを検証
      await waitFor(() => {
        const postRequest = requestLog.find((entry) => entry.method === 'POST' && entry.url === '/todo/')
        expect(postRequest).toBeDefined()
        expect(postRequest).toMatchObject({
          method: 'POST',
          url: '/todo/',
          body: {
            name: 'New Todo',
            detail: '',
            dueDate: '2026-02-20',
            progressStatus: 'not_started',
            recurrenceType: 'none',
          },
        })
      })
    })

    it('期限が解釈できない入力でも登録を継続し、dueDateはnullで送信する', async () => {
      const { apiClient, requestLog, clearRequests } = setupHttpFixtureTest({
        scenarioFixture: 'scenarios/dashboard/authenticated.default.json',
        routes: [
          {
            method: 'POST',
            url: '/todo/',
            responseFixture: 'api/todo/create.new-todo.json',
          },
        ],
      })

      const { container } = renderApp({ apiClient, initialRoute: '/', isAuthenticated: true })

      await waitFor(() => {
        expect(within(container).getByText('Test Todo 1')).toBeInTheDocument()
      })
      clearRequests()

      const quickAddInput = within(container).getByLabelText('クイック入力')
      const submitButton = within(container).getByRole('button', { name: '追加' })

      fireEvent.change(quickAddInput, { target: { value: '通常のメモだけ' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        const postRequest = requestLog.find((entry) => entry.method === 'POST' && entry.url === '/todo/')
        expect(postRequest).toBeDefined()
        expect(postRequest).toMatchObject({
          method: 'POST',
          url: '/todo/',
          body: {
            name: '通常のメモだけ',
            detail: '',
            dueDate: null,
            progressStatus: 'not_started',
            recurrenceType: 'none',
          },
        })
      })
    })
  })

  describe('詳細フォーム', () => {
    it('デフォルトで閉じており、トグルで表示/非表示を切り替えられる', async () => {
      const { apiClient } = setupAuthenticatedDashboard()

      const { container } = renderApp({ apiClient, initialRoute: '/', isAuthenticated: true })

      await waitFor(() => {
        expect(within(container).getByText('Test Todo 1')).toBeInTheDocument()
      })

      expect(within(container).queryByLabelText('Task')).not.toBeInTheDocument()

      const openButton = within(container).getByRole('button', { name: '詳細入力を開く' })
      fireEvent.click(openButton)

      await waitFor(() => {
        expect(within(container).getByLabelText('Task')).toBeInTheDocument()
        expect(within(container).getByLabelText('Detail')).toBeInTheDocument()
        expect(within(container).getByLabelText('Recurrence')).toBeInTheDocument()
        expect(within(container).getByLabelText('Due Date')).toBeInTheDocument()
      })

      const closeButton = within(container).getByRole('button', { name: '詳細入力を閉じる' })
      fireEvent.click(closeButton)

      await waitFor(() => {
        expect(within(container).queryByLabelText('Task')).not.toBeInTheDocument()
      })
    })

    it('繰り返し指定時に期限未入力だとバリデーションエラーになる', async () => {
      const { apiClient, requestLog, clearRequests } = setupAuthenticatedDashboard()

      const { container } = renderApp({ apiClient, initialRoute: '/', isAuthenticated: true })

      await waitFor(() => {
        expect(within(container).getByText('Test Todo 1')).toBeInTheDocument()
      })

      const openButton = within(container).getByRole('button', { name: '詳細入力を開く' })
      fireEvent.click(openButton)

      await waitFor(() => {
        expect(within(container).getByLabelText('Task')).toBeInTheDocument()
      })
      clearRequests()

      fireEvent.change(within(container).getByLabelText('Task'), { target: { value: 'Recurring Todo' } })
      fireEvent.change(within(container).getByLabelText('Recurrence'), { target: { value: 'weekly' } })
      fireEvent.click(within(container).getByRole('button', { name: 'Submit' }))

      await waitFor(() => {
        expect(within(container).getByText('期限を入力してください')).toBeInTheDocument()
      })
      expect(requestLog).toHaveLength(0)
    })
  })

  describe('空状態メッセージ', () => {
    it('検索条件の有無で空状態メッセージが切り替わる', async () => {
      const { apiClient } = setupHttpFixtureTest({
        scenarioFixture: 'scenarios/auth/authenticated.empty-todos.json',
      })

      const { container } = renderApp({ apiClient, initialRoute: '/', isAuthenticated: true })

      await waitFor(() => {
        expect(within(container).getByText('タスクはありません')).toBeInTheDocument()
      })

      const keywordInput = within(container).getByLabelText('検索')
      fireEvent.change(keywordInput, { target: { value: 'Test' } })

      await waitFor(() => {
        expect(within(container).getByText('条件に一致するタスクがありません')).toBeInTheDocument()
      })
    })
  })

  describe('検索・フィルタ', () => {
    it('検索条件の変更後にデバウンスしてGET APIが呼ばれる', async () => {
      const { apiClient, requestLog, clearRequests } = setupAuthenticatedDashboard()

      const { container } = renderApp({ apiClient, initialRoute: '/', isAuthenticated: true })

      await waitFor(() => {
        expect(within(container).getByText('Test Todo 1')).toBeInTheDocument()
      })
      clearRequests()

      const keywordInput = within(container).getByLabelText('検索')
      const statusSelect = within(container).getByLabelText('状態')
      const dueDateSelect = within(container).getByLabelText('期限')

      fireEvent.change(keywordInput, { target: { value: 'Test' } })
      fireEvent.change(statusSelect, { target: { value: 'completed' } })
      fireEvent.change(dueDateSelect, { target: { value: 'today' } })

      expect(requestLog.length).toBe(0)

      await act(async () => {
        await new Promise((resolve) => {
          setTimeout(resolve, 350)
        })
      })

      await waitFor(() => {
        expect(requestLog).toMatchSnapshot('api-requests-search')
      })
      expect(requestLog).toHaveLength(1)

      expect(requestLog[0]).toMatchObject({
        method: 'GET',
        url: '/todo/',
        query: {
          keyword: 'Test',
          progressStatus: 'completed',
          dueDate: 'today',
        },
      })
    })
  })

  describe('TODO削除', () => {
    it('削除ボタンクリックでDELETE APIが呼ばれる', async () => {
      const { apiClient, requestLog, clearRequests } = setupHttpFixtureTest({
        scenarioFixture: 'scenarios/dashboard/authenticated.default.json',
        routes: [
          {
            method: 'DELETE',
            url: '/todo/1/',
            response: null,
          },
        ],
      })

      const { container } = renderApp({ apiClient, initialRoute: '/', isAuthenticated: true })

      // 初期表示完了を待機
      await waitFor(() => {
        expect(within(container).getByText('Test Todo 1')).toBeInTheDocument()
      })
      clearRequests()

      // 削除ボタンをクリック
      const deleteButtons = within(container).getAllByRole('button', { name: /delete/i })
      fireEvent.click(deleteButtons[0])

      // APIリクエストを検証
      await waitFor(() => {
        expect(requestLog).toMatchSnapshot('api-requests-delete')
      })
    })
  })

  describe('TODO更新', () => {
    it('編集ボタンクリックで編集フォームが表示される', async () => {
      const { apiClient } = setupAuthenticatedDashboard()

      const { container } = renderApp({ apiClient, initialRoute: '/', isAuthenticated: true })

      // 初期表示完了を待機
      await waitFor(() => {
        expect(within(container).getByText('Test Todo 1')).toBeInTheDocument()
      })

      // 編集ボタンをクリック
      const editButtons = within(container).getAllByRole('button', { name: /edit/i })
      fireEvent.click(editButtons[0])

      // 編集フォームが表示される
      await waitFor(() => {
        expect(within(container).getByLabelText('タスク名')).toBeInTheDocument()
        expect(within(container).getByLabelText('詳細')).toBeInTheDocument()
        expect(within(container).getByLabelText('繰り返し')).toBeInTheDocument()
        expect(within(container).getByRole('button', { name: /save/i })).toBeInTheDocument()
        expect(within(container).getByRole('button', { name: /cancel/i })).toBeInTheDocument()
      })
    })

    it('値変更→保存ボタンでPUT APIが呼ばれる', async () => {
      const { apiClient, requestLog, clearRequests } = setupHttpFixtureTest({
        scenarioFixture: 'scenarios/dashboard/authenticated.default.json',
        routes: [
          {
            method: 'PUT',
            url: '/todo/1/',
            responseFixture: 'api/todo/update.updated-todo.json',
          },
        ],
      })

      const { container } = renderApp({ apiClient, initialRoute: '/', isAuthenticated: true })

      // 初期表示完了を待機
      await waitFor(() => {
        expect(within(container).getByText('Test Todo 1')).toBeInTheDocument()
      })

      // 編集ボタンをクリック
      const editButtons = within(container).getAllByRole('button', { name: /edit/i })
      fireEvent.click(editButtons[0])

      // 編集フォームが表示されるまで待機
      await waitFor(() => {
        expect(within(container).getByLabelText('タスク名')).toBeInTheDocument()
      })
      clearRequests()

      // 値を変更
      const nameInput = within(container).getByLabelText('タスク名')
      const detailInput = within(container).getByLabelText('詳細')
      const recurrenceInput = within(container).getByLabelText('繰り返し')
      fireEvent.change(nameInput, { target: { value: 'Updated Todo' } })
      fireEvent.change(detailInput, { target: { value: 'Updated Detail' } })
      fireEvent.change(recurrenceInput, { target: { value: 'none' } })

      // 保存ボタンをクリック
      const saveButton = within(container).getByRole('button', { name: /save/i })
      fireEvent.click(saveButton)

      // APIリクエストを検証
      await waitFor(() => {
        expect(requestLog).toMatchSnapshot('api-requests-update')
      })
    })

    it('キャンセルボタンで編集モード終了', async () => {
      const { apiClient } = setupAuthenticatedDashboard()

      const { container } = renderApp({ apiClient, initialRoute: '/', isAuthenticated: true })

      // 初期表示完了を待機
      await waitFor(() => {
        expect(within(container).getByText('Test Todo 1')).toBeInTheDocument()
      })

      // 編集ボタンをクリック
      const editButtons = within(container).getAllByRole('button', { name: /edit/i })
      fireEvent.click(editButtons[0])

      // 編集フォームが表示されるまで待機
      await waitFor(() => {
        expect(within(container).getByLabelText('タスク名')).toBeInTheDocument()
      })

      // キャンセルボタンをクリック
      const cancelButton = within(container).getByRole('button', { name: /cancel/i })
      fireEvent.click(cancelButton)

      // 編集フォームが非表示になる
      await waitFor(() => {
        expect(within(container).queryByLabelText('タスク名')).not.toBeInTheDocument()
        expect(within(container).getByText('Test Todo 1')).toBeInTheDocument()
      })
    })

    it('タスク名が空の場合はバリデーションエラー', async () => {
      const { apiClient, requestLog, clearRequests } = setupAuthenticatedDashboard()

      const { container } = renderApp({ apiClient, initialRoute: '/', isAuthenticated: true })

      // 初期表示完了を待機
      await waitFor(() => {
        expect(within(container).getByText('Test Todo 1')).toBeInTheDocument()
      })

      // 編集ボタンをクリック
      const editButtons = within(container).getAllByRole('button', { name: /edit/i })
      fireEvent.click(editButtons[0])

      // 編集フォームが表示されるまで待機
      await waitFor(() => {
        expect(within(container).getByLabelText('タスク名')).toBeInTheDocument()
      })
      clearRequests()

      // タスク名を空にする
      const nameInput = within(container).getByLabelText('タスク名')
      fireEvent.change(nameInput, { target: { value: '' } })

      // 保存ボタンをクリック
      const saveButton = within(container).getByRole('button', { name: /save/i })
      fireEvent.click(saveButton)

      // エラーメッセージが表示される
      await waitFor(() => {
        expect(within(container).getByText('タスク名を入力してください')).toBeInTheDocument()
      })

      // API呼び出しがないことを確認
      expect(requestLog.length).toBe(0)
    })

    it('チェックボックスクリックで完了状態が更新される', async () => {
      const { apiClient, requestLog, clearRequests } = setupHttpFixtureTest({
        scenarioFixture: 'scenarios/dashboard/authenticated.default.json',
        routes: [
          {
            method: 'PUT',
            url: '/todo/1/',
            responseFixture: 'api/todo/update.toggle-completed.json',
          },
        ],
      })

      const { container } = renderApp({ apiClient, initialRoute: '/', isAuthenticated: true })

      await waitFor(() => {
        expect(within(container).getByText('Test Todo 1')).toBeInTheDocument()
      })
      clearRequests()

      // 1つ目のTODOのチェックボックスをクリック（未完了 -> 完了）
      const checkboxes = within(container).getAllByRole('checkbox')
      fireEvent.click(checkboxes[0])

      await waitFor(() => {
        expect(requestLog).toMatchSnapshot('api-requests-toggle')
      })
    })
  })
})
