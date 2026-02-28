import { createContext, useState, useEffect, type ReactNode } from 'react'

import type { User } from '../models/user'

import { authToken } from '../services/authToken'
import { useApiClient } from './ApiContext'

/**
 * 認証状態
 */
type AuthStateBase = Readonly<{
  status: unknown
}>
type Loading = AuthStateBase &
  Readonly<{
    status: 'loading'
  }>
type Authenticated = AuthStateBase &
  Readonly<{
    status: 'authenticated'
    user: User
  }>
type Unauthenticated = AuthStateBase &
  Readonly<{
    status: 'unauthenticated'
  }>

export type AuthState = Loading | Authenticated | Unauthenticated

/**
 * 認証Context の公開API
 */
export type AuthContextValue = Readonly<{
  authState: AuthState
  login: (username: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}>

export const AuthContext = createContext<AuthContextValue | null>(null)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { apiClient } = useApiClient()
  const [authState, setAuthState] = useState<AuthState>({ status: 'loading' })

  // 初回マウント時にユーザー情報を読み込む
  useEffect(() => {
    const loadUser = async () => {
      const token = authToken.get()
      if (token == null || token === '') {
        setAuthState({ status: 'unauthenticated' })
        return
      }

      try {
        const user = await apiClient.get('/auth/user')
        setAuthState({ status: 'authenticated', user })
      } catch {
        authToken.remove()
        setAuthState({ status: 'unauthenticated' })
      }
    }

    void loadUser()
  }, [apiClient])

  const login = async (username: string, password: string): Promise<void> => {
    const result = await apiClient.post('/auth/login', { username, password })
    if (!result.ok) {
      // TODO: エラーハンドリング
      return
    }
    authToken.set(result.data.token)
    setAuthState({ status: 'authenticated', user: result.data.user })
  }

  const register = async (username: string, email: string, password: string): Promise<void> => {
    const result = await apiClient.post('/auth/register', { username, email, password })
    if (!result.ok) {
      // TODO: エラーハンドリング
      return
    }
    authToken.set(result.data.token)
    setAuthState({ status: 'authenticated', user: result.data.user })
  }

  const logout = async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout')
    } finally {
      authToken.remove()
      setAuthState({ status: 'unauthenticated' })
    }
  }

  const value: AuthContextValue = {
    authState,
    login,
    register,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
