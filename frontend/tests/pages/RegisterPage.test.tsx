import { waitFor, fireEvent, within } from '@testing-library/react'
import { AuthResponseSchema } from '@todoapp/shared'
import { describe, it, expect, beforeEach, vi } from 'vitest'

import { summarizeFormControls, summarizeText } from '../helpers/domSnapshot'
import { loadFixture } from '../helpers/fixtures'
import { setupHttpFixtureTest } from '../helpers/httpMock'
import { localStorageMock, resetLocalStorageMock } from '../helpers/localStorageMock'
import { renderApp } from '../helpers/renderPage'

const mockAuthResponse = AuthResponseSchema.parse(loadFixture('api/auth/register.newuser.json'))

describe('新規登録フロー', () => {
  beforeEach(() => {
    resetLocalStorageMock()
  })

  describe('RegisterPage 初期表示', () => {
    it('登録フォームが正しく表示される', async () => {
      const { apiClient } = setupHttpFixtureTest()

      const { container } = renderApp({ apiClient, initialRoute: '/register' })

      // ローディング完了を待機
      await waitFor(() => {
        expect(within(container).queryByText('Loading...')).not.toBeInTheDocument()
      })

      // フォーム要素の確認
      expect(within(container).getByLabelText('Username')).toBeInTheDocument()
      expect(within(container).getByLabelText('Email')).toBeInTheDocument()
      expect(within(container).getByLabelText('Password')).toBeInTheDocument()
      expect(within(container).getByLabelText('Confirm Password')).toBeInTheDocument()
      expect(within(container).getByRole('button', { name: 'Register' })).toBeInTheDocument()
      expect(within(container).getByText('Already have an account?')).toBeInTheDocument()
      expect(within(container).getAllByRole('link', { name: /login/i }).length).toBeGreaterThan(0)

      // DOMスナップショット
      expect(summarizeFormControls(container)).toMatchSnapshot('register-page-initial-form')
      expect(summarizeText(container)).toMatchSnapshot('register-page-initial-text')
    })
  })

  describe('登録成功', () => {
    it('正しい情報で登録 → API呼び出し → ダッシュボードへリダイレクト', async () => {
      const { apiClient, requestLog } = setupHttpFixtureTest({
        scenarioFixture: 'scenarios/auth/register.success.json',
      })

      const { container } = renderApp({ apiClient, initialRoute: '/register' })

      // ローディング完了を待機
      await waitFor(() => {
        expect(within(container).queryByText('Loading...')).not.toBeInTheDocument()
      })

      // フォーム入力
      fireEvent.change(within(container).getByLabelText('Username'), { target: { value: 'newuser' } })
      fireEvent.change(within(container).getByLabelText('Email'), { target: { value: 'new@example.com' } })
      fireEvent.change(within(container).getByLabelText('Password'), { target: { value: 'password123' } })
      fireEvent.change(within(container).getByLabelText('Confirm Password'), { target: { value: 'password123' } })

      // 登録ボタンをクリック
      fireEvent.click(within(container).getByRole('button', { name: 'Register' }))

      // API呼び出しを検証
      await waitFor(() => {
        const registerRequest = requestLog.find((r) => r.url === '/auth/register')
        expect(registerRequest).toBeDefined()
        expect(registerRequest?.method).toBe('POST')
        expect(registerRequest?.body).toEqual({
          username: 'newuser',
          email: 'new@example.com',
          password: 'password123',
        })
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
      expect(requestLog).toMatchSnapshot('register-api-requests')
    })
  })

  describe('パスワード不一致', () => {
    it('パスワードと確認パスワードが一致しない場合、APIは呼ばれない', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { apiClient, requestLog } = setupHttpFixtureTest()

      const { container } = renderApp({ apiClient, initialRoute: '/register' })

      // ローディング完了を待機
      await waitFor(() => {
        expect(within(container).queryByText('Loading...')).not.toBeInTheDocument()
      })

      // フォーム入力（パスワード不一致）
      fireEvent.change(within(container).getByLabelText('Username'), { target: { value: 'newuser' } })
      fireEvent.change(within(container).getByLabelText('Email'), { target: { value: 'new@example.com' } })
      fireEvent.change(within(container).getByLabelText('Password'), { target: { value: 'password123' } })
      fireEvent.change(within(container).getByLabelText('Confirm Password'), { target: { value: 'different' } })

      // 登録ボタンをクリック
      fireEvent.click(within(container).getByRole('button', { name: 'Register' }))

      // APIが呼ばれていないことを検証（少し待つ）
      await new Promise((resolve) => setTimeout(resolve, 100))
      const registerRequest = requestLog.find((r) => r.url === '/auth/register')
      expect(registerRequest).toBeUndefined()

      // エラーログを検証
      expect(consoleSpy).toHaveBeenCalledWith('Passwords do not match')

      consoleSpy.mockRestore()
    })
  })
})
