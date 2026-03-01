import type { Todo as ApiTodo } from '@todoapp/shared'

import { describe, expect, it } from 'vitest'

import type { CreateTodoInput, Todo } from '../../src/models/todo'

import { toCreateTodoRequest, toTodoViewModels, toUpdateTodoRequest } from '../../src/services/todoApi'

describe('todoApi', () => {
  describe('toCreateTodoRequest', () => {
    it('parentId未指定時はnullを送信する', () => {
      const input: CreateTodoInput = {
        name: '子タスク',
        detail: 'detail',
        dueDate: null,
        progressStatus: 'not_started',
        recurrenceType: 'none',
      }

      expect(toCreateTodoRequest(input)).toEqual({
        ...input,
        parentId: null,
      })
    })
  })

  describe('toTodoViewModels', () => {
    it('subtaskのparentIdからparentTitleを解決する', () => {
      const todos: readonly ApiTodo[] = [
        {
          id: 1,
          name: '親タスク',
          detail: '',
          dueDate: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          progressStatus: 'in_progress',
          recurrenceType: 'none',
          parentId: null,
          completedSubtaskCount: 1,
          totalSubtaskCount: 2,
          subtaskProgressPercent: 50,
        },
        {
          id: 2,
          name: '子タスク',
          detail: '',
          dueDate: null,
          createdAt: '2026-01-02T00:00:00.000Z',
          progressStatus: 'not_started',
          recurrenceType: 'none',
          parentId: 1,
          completedSubtaskCount: 0,
          totalSubtaskCount: 0,
          subtaskProgressPercent: 0,
        },
      ]

      expect(toTodoViewModels(todos)).toEqual([
        {
          id: 1,
          name: '親タスク',
          detail: '',
          dueDate: null,
          progressStatus: 'in_progress',
          recurrenceType: 'none',
          parentId: null,
          parentTitle: null,
          completedSubtaskCount: 1,
          totalSubtaskCount: 2,
          subtaskProgressPercent: 50,
        },
        {
          id: 2,
          name: '子タスク',
          detail: '',
          dueDate: null,
          progressStatus: 'not_started',
          recurrenceType: 'none',
          parentId: 1,
          parentTitle: '親タスク',
          completedSubtaskCount: 0,
          totalSubtaskCount: 0,
          subtaskProgressPercent: 0,
        },
      ])
    })

    it('進捗項目をそのまま保持する', () => {
      const todos: readonly ApiTodo[] = [
        {
          id: 10,
          name: '親タスク',
          detail: '',
          dueDate: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          progressStatus: 'in_progress',
          recurrenceType: 'none',
          parentId: null,
          completedSubtaskCount: 3,
          totalSubtaskCount: 5,
          subtaskProgressPercent: 60,
        },
      ]

      expect(toTodoViewModels(todos)[0]).toMatchObject({
        completedSubtaskCount: 3,
        totalSubtaskCount: 5,
        subtaskProgressPercent: 60,
      })
    })

    it('レスポンスにparentTitleが含まれる場合はそれを優先する', () => {
      const todos: readonly ApiTodo[] = [
        {
          id: 10,
          name: '子タスク',
          detail: '',
          dueDate: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          progressStatus: 'not_started',
          recurrenceType: 'none',
          parentId: 999,
          completedSubtaskCount: 0,
          totalSubtaskCount: 0,
          subtaskProgressPercent: 0,
        },
      ]

      const withParentTitle = [{ ...todos[0], parentTitle: '親タイトル(サーバー返却)' }] as unknown as readonly ApiTodo[]

      expect(toTodoViewModels(withParentTitle)[0]).toMatchObject({
        parentTitle: '親タイトル(サーバー返却)',
      })
    })
  })

  describe('toUpdateTodoRequest', () => {
    it('更新APIに必要な項目だけを送信する', () => {
      const todo: Todo = {
        id: 1,
        name: '更新タスク',
        detail: '更新詳細',
        dueDate: null,
        progressStatus: 'in_progress',
        recurrenceType: 'none',
        parentId: 10,
        parentTitle: '親タスク',
        completedSubtaskCount: 1,
        totalSubtaskCount: 2,
        subtaskProgressPercent: 50,
      }

      expect(toUpdateTodoRequest(todo)).toEqual({
        name: '更新タスク',
        detail: '更新詳細',
        dueDate: null,
        progressStatus: 'in_progress',
        recurrenceType: 'none',
      })
    })
  })
})
