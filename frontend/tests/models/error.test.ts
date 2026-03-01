import { describe, expect, it } from 'vitest'

import { toValidationError, toValidationErrors } from '../../src/models/error'

describe('error model converters', () => {
  it('ValidationIssueをUI向けValidationErrorへ変換できる', () => {
    const issue = {
      field: 'name',
      reason: 'required',
    } as const

    expect(toValidationError(issue)).toEqual({
      field: 'name',
      reason: 'required',
    })
  })

  it('未知のreasonも破棄せず変換できる', () => {
    const issue = {
      field: 'name',
      reason: 'something_new',
    } as const

    expect(toValidationError(issue)).toEqual({
      field: 'name',
      reason: 'something_new',
    })
  })

  it('ValidationIssue配列をUI向けValidationError配列へ変換できる', () => {
    const issues = [
      { field: 'name', reason: 'required' },
      { field: 'dueDate', reason: 'invalid_format' },
    ] as const

    expect(toValidationErrors(issues)).toEqual([
      { field: 'name', reason: 'required' },
      { field: 'dueDate', reason: 'invalid_format' },
    ])
  })
})
