import { waitFor, fireEvent, within } from '@testing-library/react'
import { AuthResponseSchema } from '@todoapp/shared'
import { describe, it, expect, beforeEach } from 'vitest'

import { summarizeFormControls, summarizeText } from '../helpers/domSnapshot'
import { loadFixture } from '../helpers/fixtures'
import { setupHttpFixtureTest } from '../helpers/httpMock'
import { localStorageMock, resetLocalStorageMock } from '../helpers/localStorageMock'
import { renderApp } from '../helpers/renderPage'

const mockAuthResponse = AuthResponseSchema.parse(loadFixture('api/auth/login.testuser.json'))

describe('ログインフロー', () => {
  beforeEach(() => {
    resetLocalStorageMock()
  })

  describe('LoginPage 初期表示', () => {
    it('ログインフォームが正しく表示される', async () => {
      const { apiClient } = setupHttpFixtureTest()

      const { container } = renderApp({ apiClient, initialRoute: '/login' })

      // ローディング完了を待機
      await waitFor(() => {
        expect(within(container).queryByText('Loading...')).not.toBeInTheDocument()
      })

      // フォーム要素の確認
      expect(within(container).getByLabelText('Username')).toBeInTheDocument()
      expect(within(container).getByLabelText('Password')).toBeInTheDocument()
      expect(within(container).getByRole('button', { name: 'Login' })).toBeInTheDocument()
      expect(within(container).getByText("Don't have an account?")).toBeInTheDocument()
      expect(within(container).getAllByRole('link', { name: /register/i }).length).toBeGreaterThan(0)

      // DOMスナップショット
      expect(summarizeFormControls(container)).toMatchSnapshot('login-page-initial-form')
      expect(summarizeText(container)).toMatchSnapshot('login-page-initial-text')
    })
  })

  describe('ログイン成功', () => {
    it('正しい認証情報でログイン → API呼び出し → ダッシュボードへリダイレクト', async () => {
      const { apiClient, requestLog } = setupHttpFixtureTest({
        scenarioFixture: 'scenarios/auth/login.success.json',
      })

      const { container } = renderApp({ apiClient, initialRoute: '/login' })

      // ローディング完了を待機
      await waitFor(() => {
        expect(within(container).queryByText('Loading...')).not.toBeInTheDocument()
      })

      // フォーム入力
      fireEvent.change(within(container).getByLabelText('Username'), { target: { value: 'testuser' } })
      fireEvent.change(within(container).getByLabelText('Password'), { target: { value: 'password123' } })

      // ログインボタンをクリック
      fireEvent.click(within(container).getByRole('button', { name: 'Login' }))

      // API呼び出しを検証
      await waitFor(() => {
        const loginRequest = requestLog.find((r) => r.url === '/auth/login')
        expect(loginRequest).toBeDefined()
        expect(loginRequest?.method).toBe('POST')
        expect(loginRequest?.body).toEqual({ username: 'testuser', password: 'password123' })
      })

      // トークン保存を検証
      await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalledWith('token', mockAuthResponse.token)
      })

      // ダッシュボードへリダイレクト（Header表示確認）
      await waitFor(() => {
        expect(within(container).getByText(`Welcome ${mockAuthResponse.user.username}`)).toBeInTheDocument()
      })

      await waitFor(() => {
        const todoRequest = requestLog.find((r) => r.url === '/todo/')
        expect(todoRequest).toBeDefined()
        expect(todoRequest?.method).toBe('GET')
      })

      // APIリクエストのスナップショット
      expect(requestLog).toMatchSnapshot('login-api-requests')
    })
  })

  describe('認証状態によるリダイレクト', () => {
    it('認証済みユーザーが /login にアクセス → / へリダイレクト', async () => {
      // トークンを事前にセット
      localStorageMock.setItem('token', 'existing-token')

      const { apiClient } = setupHttpFixtureTest({
        scenarioFixture: 'scenarios/auth/authenticated.empty-todos.json',
      })

      const { container } = renderApp({ apiClient, initialRoute: '/login' })

      // ダッシュボードへリダイレクトされることを確認
      await waitFor(() => {
        expect(within(container).getByText('Welcome testuser')).toBeInTheDocument()
      })

      // ログインフォームが表示されていないことを確認
      expect(within(container).queryByLabelText('Username')).not.toBeInTheDocument()
    })
  })
})
