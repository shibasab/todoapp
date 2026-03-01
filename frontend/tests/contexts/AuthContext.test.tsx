import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import axios from 'axios'
import AxiosMockAdapter from 'axios-mock-adapter'
import { describe, expect, it } from 'vitest'

import { ApiProvider } from '../../src/contexts/ApiContext'
import { AuthProvider } from '../../src/contexts/AuthContext'
import { useAuth } from '../../src/hooks/useAuth'
import { createApiClient } from '../../src/services/api'
import { summarizeText } from '../helpers/domSnapshot'
import { resetLocalStorageMock } from '../helpers/localStorageMock'

const AuthProbe = () => {
  const { authState, login, register, logout } = useAuth()

  return (
    <div>
      <p data-testid="status">{authState.status}</p>
      <button onClick={() => void login('u', 'p')}>login</button>
      <button onClick={() => void register('u', 'e@example.com', 'p')}>register</button>
      <button onClick={() => void logout()}>logout</button>
    </div>
  )
}

type AuthTestClient = Readonly<{
  client: ReturnType<typeof createApiClient>
  mock: AxiosMockAdapter
}>

const createAuthTestClient = (): AuthTestClient => {
  const axiosInstance = axios.create({
    baseURL: 'http://localhost/api',
    headers: { 'Content-Type': 'application/json' },
  })
  const mock = new AxiosMockAdapter(axiosInstance)

  const client = createApiClient(axiosInstance, {
    onRequestStart: () => {},
    onRequestEnd: () => {},
  })

  return { client, mock }
}

const renderWithClient = (apiClient: AuthTestClient['client']) =>
  render(
    <ApiProvider client={apiClient}>
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    </ApiProvider>,
  )

describe('AuthContext', () => {
  it('トークン無しでは未認証状態になる', async () => {
    resetLocalStorageMock()
    const { client, mock } = createAuthTestClient()

    const { container } = renderWithClient(client)

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated')
    })
    expect(summarizeText(container)).toMatchSnapshot('text')
    mock.restore()
  })

  it('login/register/logoutの振る舞いで認証状態が遷移する', async () => {
    resetLocalStorageMock()
    const { client, mock } = createAuthTestClient()
    mock.onPost('/auth/login').replyOnce(200, {
      user: { id: 1, username: 'u', email: 'e@example.com' },
      token: 't1',
    })
    mock.onPost('/auth/register').replyOnce(200, {
      user: { id: 1, username: 'u', email: 'e@example.com' },
      token: 't2',
    })
    mock.onPost('/auth/logout').replyOnce(200, {
      detail: 'Successfully logged out',
    })

    const { container } = renderWithClient(client)

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated')
    })

    fireEvent.click(screen.getByRole('button', { name: 'login' }))
    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated')
    })

    fireEvent.click(screen.getByRole('button', { name: 'register' }))
    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated')
    })

    fireEvent.click(screen.getByRole('button', { name: 'logout' }))
    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated')
    })

    expect(summarizeText(container)).toMatchSnapshot('text')
    mock.restore()
  })

  it('トークンありでユーザー取得失敗時はトークン削除して未認証に戻る', async () => {
    resetLocalStorageMock()
    localStorage.setItem('token', 'existing')
    const { client, mock } = createAuthTestClient()
    mock.onGet('/auth/user').replyOnce(401, {
      detail: 'Unauthorized',
    })

    const { container } = renderWithClient(client)

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated')
    })
    expect(summarizeText(container)).toMatchSnapshot('text')
    mock.restore()
  })

  it('login/register失敗時は認証状態を変更しない', async () => {
    resetLocalStorageMock()
    const { client, mock } = createAuthTestClient()
    mock.onPost('/auth/login').replyOnce(422, {
      status: 422,
      type: 'validation_error',
      errors: [{ field: 'username', reason: 'required' }],
    })
    mock.onPost('/auth/register').replyOnce(422, {
      status: 422,
      type: 'validation_error',
      errors: [{ field: 'username', reason: 'required' }],
    })

    const { container } = renderWithClient(client)

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated')
    })

    fireEvent.click(screen.getByRole('button', { name: 'login' }))
    fireEvent.click(screen.getByRole('button', { name: 'register' }))

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated')
    })

    expect(summarizeText(container)).toMatchSnapshot('text')
    mock.restore()
  })
})
