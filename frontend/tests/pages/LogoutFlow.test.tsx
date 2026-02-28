import { waitFor, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'

import { setupHttpFixtureTest } from '../helpers/httpMock'
import { localStorageMock, resetLocalStorageMock } from '../helpers/localStorageMock'
import { renderApp } from '../helpers/renderPage'

describe('ログアウトフロー', () => {
  beforeEach(() => {
    resetLocalStorageMock()
  })

  describe('Header ログアウトボタン', () => {
    it('認証済み状態でログアウトボタンが表示される', async () => {
      // トークンを事前にセット
      localStorageMock.setItem('token', 'test-token')

      const { apiClient } = setupHttpFixtureTest({
        scenarioFixture: 'scenarios/auth/authenticated.empty-todos.json',
      })

      const { container } = renderApp({ apiClient, initialRoute: '/' })

      // 認証済み状態の表示確認
      await waitFor(() => {
        expect(within(container).getByText('Welcome testuser')).toBeInTheDocument()
      })

      expect(within(container).getByRole('button', { name: /logout/i })).toBeInTheDocument()
    })

    it('ログアウトボタンクリック → API呼び出し → ログインページへ遷移', async () => {
      // トークンを事前にセット
      localStorageMock.setItem('token', 'test-token')

      const { apiClient, requestLog, clearRequests } = setupHttpFixtureTest({
        scenarioFixture: 'scenarios/auth/logout.success.json',
      })

      const { container } = renderApp({ apiClient, initialRoute: '/' })

      // 認証済み状態になるまで待機
      await waitFor(() => {
        expect(within(container).getByText('Welcome testuser')).toBeInTheDocument()
      })

      // Dashboardの初期ロードで発生するリクエスト完了まで待機
      await waitFor(() => {
        const todoRequest = requestLog.find((r) => r.url === '/todo/' && r.method === 'GET')
        expect(todoRequest).toBeDefined()
      })

      // 初期リクエストをクリア
      clearRequests()

      // ログアウトボタンをクリック
      fireEvent.click(within(container).getByRole('button', { name: /logout/i }))

      // API呼び出しを検証
      await waitFor(() => {
        const logoutRequest = requestLog.find((r) => r.url === '/auth/logout')
        expect(logoutRequest).toBeDefined()
        expect(logoutRequest?.method).toBe('POST')
      })

      // トークン削除を検証
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('token')

      // ログインページへリダイレクト（ログインフォーム表示確認）
      await waitFor(() => {
        expect(within(container).getByLabelText('Username')).toBeInTheDocument()
        expect(within(container).getByLabelText('Password')).toBeInTheDocument()
      })

      // Welcome表示が消えることを確認
      expect(within(container).queryByText('Welcome testuser')).not.toBeInTheDocument()

      // APIリクエストのスナップショット
      expect(requestLog).toMatchSnapshot('logout-api-requests')
    })
  })

  describe('Header 未認証状態', () => {
    it('未認証状態ではログイン・登録リンクが表示される', async () => {
      const { apiClient } = setupHttpFixtureTest()

      const { container } = renderApp({ apiClient, initialRoute: '/login' })

      // ローディング完了を待機
      await waitFor(() => {
        expect(within(container).queryByText('Loading...')).not.toBeInTheDocument()
      })

      // ゲストリンクの確認
      expect(within(container).getAllByRole('link', { name: /register/i }).length).toBeGreaterThan(0)
      // Header内のLoginリンク（ページ内のLoginボタンとは別）
      const loginLinks = within(container).getAllByRole('link', { name: /login/i })
      expect(loginLinks.length).toBeGreaterThan(0)

      // ログアウトボタンが表示されていないことを確認
      expect(within(container).queryByRole('button', { name: /logout/i })).not.toBeInTheDocument()
    })
  })
})
