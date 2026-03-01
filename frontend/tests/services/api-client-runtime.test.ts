import axios from 'axios'
import AxiosMockAdapter from 'axios-mock-adapter'
import { describe, expect, it } from 'vitest'

import { createApiClient } from '../../src/services/api'

const noop = () => {}

describe('ApiClient runtime error handling', () => {
  it('PUT /todo/:id で409をResult.errとして返す', async () => {
    const axiosInstance = axios.create()
    const mock = new AxiosMockAdapter(axiosInstance)
    mock.onPut('/todo/20/').reply(409, {
      status: 409,
      type: 'conflict_error',
      detail: '未完了のサブタスクがあるため完了できません',
    })

    const apiClient = createApiClient(axiosInstance, {
      onRequestStart: noop,
      onRequestEnd: noop,
    })

    const result = await apiClient.put('/todo/20/', {
      dueDate: undefined,
      progressStatus: 'completed',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toEqual({
        status: 409,
        type: 'conflict_error',
        detail: '未完了のサブタスクがあるため完了できません',
      })
    }
    mock.restore()
  })

  it('POST /auth/register で409をResult.errとして返す', async () => {
    const axiosInstance = axios.create()
    const mock = new AxiosMockAdapter(axiosInstance)
    mock.onPost('/auth/register').reply(409, {
      status: 409,
      type: 'conflict_error',
      detail: 'Username already registered',
    })

    const apiClient = createApiClient(axiosInstance, {
      onRequestStart: noop,
      onRequestEnd: noop,
    })

    const result = await apiClient.post('/auth/register', {
      username: 'taken',
      email: 'taken@example.com',
      password: 'password123',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toEqual({
        status: 409,
        type: 'conflict_error',
        detail: 'Username already registered',
      })
    }
    mock.restore()
  })
})
