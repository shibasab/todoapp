import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { Todo } from '../../src/models/todo'

import { TodoKanbanBoard } from '../../src/components/todo/TodoKanbanBoard'
import { summarizeText } from '../helpers/domSnapshot'

const createDragDataTransfer = (): Pick<DataTransfer, 'setData' | 'effectAllowed'> => ({
  setData: vi.fn(),
  effectAllowed: 'move',
})

const todos: readonly Todo[] = [
  {
    id: 1,
    name: 'Backlog Task',
    detail: '',
    dueDate: null,
    progressStatus: 'not_started',
    recurrenceType: 'none',
  },
  {
    id: 2,
    name: 'Doing Task',
    detail: '',
    dueDate: null,
    progressStatus: 'in_progress',
    recurrenceType: 'none',
  },
  {
    id: 3,
    name: 'Done Task',
    detail: '',
    dueDate: null,
    progressStatus: 'completed',
    recurrenceType: 'none',
  },
]

describe('TodoKanbanBoard', () => {
  it('progressStatusごとに3列へ表示する', () => {
    const { container } = render(<TodoKanbanBoard todos={todos} hasSearchCriteria={false} onMoveTodo={vi.fn()} />)

    const notStartedColumn = screen.getByTestId('kanban-column-not_started')
    const inProgressColumn = screen.getByTestId('kanban-column-in_progress')
    const completedColumn = screen.getByTestId('kanban-column-completed')

    expect(within(notStartedColumn).getByText('Backlog Task')).toBeInTheDocument()
    expect(within(inProgressColumn).getByText('Doing Task')).toBeInTheDocument()
    expect(within(completedColumn).getByText('Done Task')).toBeInTheDocument()

    expect(summarizeText(container)).toMatchSnapshot('text')
  })

  it('カードを別列へドロップするとonMoveTodoを呼ぶ', async () => {
    const onMoveTodo = vi.fn(async () => {})
    render(<TodoKanbanBoard todos={todos} hasSearchCriteria={false} onMoveTodo={onMoveTodo} />)

    const card = screen.getByTestId('kanban-card-1')
    const targetColumn = screen.getByTestId('kanban-column-in_progress')
    const dataTransfer = createDragDataTransfer()

    fireEvent.dragStart(card, { dataTransfer })
    fireEvent.drop(targetColumn)

    await waitFor(() => {
      expect(onMoveTodo).toHaveBeenCalledWith(todos[0], 'in_progress')
    })
  })

  it('同じ列へのドロップは移動せず、dragOverでドロップ可能状態になる', async () => {
    const onMoveTodo = vi.fn(async () => {})
    render(<TodoKanbanBoard todos={todos} hasSearchCriteria={false} onMoveTodo={onMoveTodo} />)

    const card = screen.getByTestId('kanban-card-1')
    const sameColumn = screen.getByTestId('kanban-column-not_started')
    const dataTransfer = createDragDataTransfer()

    fireEvent.dragStart(card, { dataTransfer })
    fireEvent.dragOver(sameColumn)
    fireEvent.drop(sameColumn)

    await waitFor(() => {
      expect(onMoveTodo).not.toHaveBeenCalled()
    })
    expect(summarizeText(screen.getByTestId('kanban-column-not_started'))).toMatchSnapshot('text')
  })
})
