import { fireEvent, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { setupHttpFixtureTest } from '../helpers/httpMock'
import { renderApp } from '../helpers/renderPage'

describe('DashboardPage subtask', () => {
  it('子タスクがない親タスクで 0/0 (0%) を表示する', async () => {
    const { apiClient } = setupHttpFixtureTest({
      routes: [
        {
          method: 'GET',
          url: '/auth/user',
          responseFixture: 'api/auth/user.testuser.json',
        },
        {
          method: 'GET',
          url: '/todo/',
          response: [
            {
              id: 10,
              name: '親タスクA',
              detail: '',
              dueDate: null,
              createdAt: '2026-03-01T00:00:00.000Z',
              progressStatus: 'in_progress',
              recurrenceType: 'none',
              parentId: null,
              parentTitle: null,
              completedSubtaskCount: 0,
              totalSubtaskCount: 0,
              subtaskProgressPercent: 0,
            },
          ],
        },
      ],
    })

    const { container } = renderApp({ apiClient, initialRoute: '/', isAuthenticated: true })

    await waitFor(() => {
      expect(within(container).getByText('親タスクA')).toBeInTheDocument()
      expect(within(container).getByText('サブタスク進捗: 0/0 (0%)')).toBeInTheDocument()
      expect(within(container).getByText('サブタスクはありません')).toBeInTheDocument()
    })
  })

  it('親タスクのサブタスク追加フォームから parentId 付きで作成できる', async () => {
    const { apiClient, requestLog, clearRequests } = setupHttpFixtureTest({
      routes: [
        {
          method: 'GET',
          url: '/auth/user',
          responseFixture: 'api/auth/user.testuser.json',
        },
        {
          method: 'GET',
          url: '/todo/',
          once: true,
          response: [
            {
              id: 10,
              name: '親タスクA',
              detail: '',
              dueDate: null,
              createdAt: '2026-03-01T00:00:00.000Z',
              progressStatus: 'in_progress',
              recurrenceType: 'none',
              parentId: null,
              parentTitle: null,
              completedSubtaskCount: 0,
              totalSubtaskCount: 0,
              subtaskProgressPercent: 0,
            },
          ],
        },
        {
          method: 'POST',
          url: '/todo/',
          response: {
            id: 11,
            name: '子タスクA',
            detail: '',
            dueDate: null,
            createdAt: '2026-03-01T00:00:10.000Z',
            progressStatus: 'not_started',
            recurrenceType: 'none',
            parentId: 10,
            parentTitle: '親タスクA',
            completedSubtaskCount: 0,
            totalSubtaskCount: 0,
            subtaskProgressPercent: 0,
          },
        },
        {
          method: 'GET',
          url: '/todo/',
          once: true,
          response: [
            {
              id: 10,
              name: '親タスクA',
              detail: '',
              dueDate: null,
              createdAt: '2026-03-01T00:00:00.000Z',
              progressStatus: 'in_progress',
              recurrenceType: 'none',
              parentId: null,
              parentTitle: null,
              completedSubtaskCount: 0,
              totalSubtaskCount: 1,
              subtaskProgressPercent: 0,
            },
            {
              id: 11,
              name: '子タスクA',
              detail: '',
              dueDate: null,
              createdAt: '2026-03-01T00:00:10.000Z',
              progressStatus: 'not_started',
              recurrenceType: 'none',
              parentId: 10,
              parentTitle: '親タスクA',
              completedSubtaskCount: 0,
              totalSubtaskCount: 0,
              subtaskProgressPercent: 0,
            },
          ],
        },
      ],
    })

    const { container } = renderApp({ apiClient, initialRoute: '/', isAuthenticated: true })

    await waitFor(() => {
      expect(within(container).getByText('親タスクA')).toBeInTheDocument()
    })
    clearRequests()

    fireEvent.change(within(container).getByLabelText('サブタスク名-10'), {
      target: { value: '子タスクA' },
    })
    fireEvent.click(within(container).getByLabelText('サブタスク追加-10'))

    await waitFor(() => {
      const postRequest = requestLog.find((entry) => entry.method === 'POST' && entry.url === '/todo/')
      expect(postRequest).toBeDefined()
      expect(postRequest).toMatchObject({
        body: {
          name: '子タスクA',
          detail: '',
          dueDate: null,
          progressStatus: 'not_started',
          recurrenceType: 'none',
          parentId: 10,
        },
      })
    })

    await waitFor(() => {
      expect(within(container).getAllByText('子タスクA').length).toBeGreaterThan(0)
      expect(within(container).getByText('サブタスク進捗: 0/1 (0%)')).toBeInTheDocument()
    })
  })

  it('サブタスク表示で親タスク情報を確認できる', async () => {
    const { apiClient } = setupHttpFixtureTest({
      routes: [
        {
          method: 'GET',
          url: '/auth/user',
          responseFixture: 'api/auth/user.testuser.json',
        },
        {
          method: 'GET',
          url: '/todo/',
          response: [
            {
              id: 10,
              name: '親タスクA',
              detail: '',
              dueDate: null,
              createdAt: '2026-03-01T00:00:00.000Z',
              progressStatus: 'in_progress',
              recurrenceType: 'none',
              parentId: null,
              parentTitle: null,
              completedSubtaskCount: 0,
              totalSubtaskCount: 1,
              subtaskProgressPercent: 0,
            },
            {
              id: 11,
              name: '子タスクA',
              detail: '',
              dueDate: null,
              createdAt: '2026-03-01T00:00:10.000Z',
              progressStatus: 'not_started',
              recurrenceType: 'none',
              parentId: 10,
              parentTitle: '親タスクA',
              completedSubtaskCount: 0,
              totalSubtaskCount: 0,
              subtaskProgressPercent: 0,
            },
          ],
        },
      ],
    })

    const { container } = renderApp({ apiClient, initialRoute: '/', isAuthenticated: true })

    await waitFor(() => {
      expect(within(container).getAllByText('子タスクA').length).toBeGreaterThan(0)
      expect(within(container).getByText('親タスク: 親タスクA')).toBeInTheDocument()
    })
  })

  it('未完了サブタスクがある親の完了操作で拒否理由を表示する', async () => {
    const { apiClient } = setupHttpFixtureTest({
      routes: [
        {
          method: 'GET',
          url: '/auth/user',
          responseFixture: 'api/auth/user.testuser.json',
        },
        {
          method: 'GET',
          url: '/todo/',
          response: [
            {
              id: 20,
              name: '親タスクB',
              detail: '',
              dueDate: null,
              createdAt: '2026-03-01T00:00:00.000Z',
              progressStatus: 'in_progress',
              recurrenceType: 'none',
              parentId: null,
              parentTitle: null,
              completedSubtaskCount: 0,
              totalSubtaskCount: 1,
              subtaskProgressPercent: 0,
            },
            {
              id: 21,
              name: '子タスクB',
              detail: '',
              dueDate: null,
              createdAt: '2026-03-01T00:00:10.000Z',
              progressStatus: 'not_started',
              recurrenceType: 'none',
              parentId: 20,
              parentTitle: '親タスクB',
              completedSubtaskCount: 0,
              totalSubtaskCount: 0,
              subtaskProgressPercent: 0,
            },
          ],
        },
        {
          method: 'PUT',
          url: '/todo/20/',
          status: 409,
          response: {
            status: 409,
            type: 'conflict_error',
            detail: '未完了のサブタスクがあるため完了できません',
          },
        },
      ],
    })

    const { container } = renderApp({ apiClient, initialRoute: '/', isAuthenticated: true })

    await waitFor(() => {
      expect(within(container).getByText('親タスクB')).toBeInTheDocument()
    })

    fireEvent.click(within(container).getAllByRole('checkbox')[0])

    await waitFor(() => {
      expect(within(container).getByText('未完了のサブタスクがあるため完了できません')).toBeInTheDocument()
    })
  })
})
