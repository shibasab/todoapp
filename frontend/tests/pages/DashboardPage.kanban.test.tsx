import { fireEvent, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { setupHttpFixtureTest } from '../helpers/httpMock'
import { renderApp } from '../helpers/renderPage'

const createDragDataTransfer = (): Pick<DataTransfer, 'setData' | 'effectAllowed'> => ({
  setData: () => {},
  effectAllowed: 'move',
})

describe('DashboardPage Kanban', () => {
  it('カンバンで列移動するとPUTされ、一覧表示へ反映される', async () => {
    const { apiClient, requestLog, clearRequests } = setupHttpFixtureTest({
      scenarioFixture: 'scenarios/dashboard/authenticated.default.json',
      routes: [
        {
          method: 'PUT',
          url: '/todo/1/',
          responseFixture: 'api/todo/update.to-in-progress.json',
        },
      ],
    })

    const { container } = renderApp({ apiClient, initialRoute: '/', isAuthenticated: true })

    await waitFor(() => {
      expect(within(container).getByText('Test Todo 1')).toBeInTheDocument()
    })

    fireEvent.click(within(container).getByRole('button', { name: 'カンバン表示' }))

    await waitFor(() => {
      const notStartedColumn = within(container).getByTestId('kanban-column-not_started')
      expect(within(notStartedColumn).getByText('Test Todo 1')).toBeInTheDocument()
    })

    clearRequests()

    const card = within(container).getByTestId('kanban-card-1')
    const targetColumn = within(container).getByTestId('kanban-column-in_progress')
    const dataTransfer = createDragDataTransfer()

    fireEvent.dragStart(card, { dataTransfer })
    fireEvent.drop(targetColumn)

    await waitFor(() => {
      const putRequest = requestLog.find((entry) => entry.method === 'PUT' && entry.url === '/todo/1/')
      expect(putRequest).toBeDefined()
    })

    expect(requestLog).toMatchSnapshot('kanban-move-api-requests')
  })

  it('カンバン移動でバリデーションエラー時は再取得GETを実行する', async () => {
    const { apiClient, requestLog, clearRequests } = setupHttpFixtureTest({
      scenarioFixture: 'scenarios/dashboard/authenticated.default.json',
      routes: [
        {
          method: 'PUT',
          url: '/todo/1/',
          status: 422,
          response: {
            status: 422,
            type: 'validation_error',
            errors: [{ field: 'name', reason: 'required' }],
          },
        },
      ],
    })

    const { container } = renderApp({ apiClient, initialRoute: '/', isAuthenticated: true })

    await waitFor(() => {
      expect(within(container).getByText('Test Todo 1')).toBeInTheDocument()
    })

    fireEvent.click(within(container).getByRole('button', { name: 'カンバン表示' }))

    await waitFor(() => {
      expect(within(container).getByTestId('kanban-column-not_started')).toBeInTheDocument()
    })

    clearRequests()

    const card = within(container).getByTestId('kanban-card-1')
    const targetColumn = within(container).getByTestId('kanban-column-in_progress')
    const dataTransfer = createDragDataTransfer()

    fireEvent.dragStart(card, { dataTransfer })
    fireEvent.drop(targetColumn)

    await waitFor(() => {
      const putRequest = requestLog.find((entry) => entry.method === 'PUT' && entry.url === '/todo/1/')
      const getRequest = requestLog.find((entry) => entry.method === 'GET' && entry.url === '/todo/')
      expect(putRequest).toBeDefined()
      expect(getRequest).toBeDefined()
    })

    expect(requestLog).toMatchSnapshot('kanban-move-validation-error-requests')
  })
})
