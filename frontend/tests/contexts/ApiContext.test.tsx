import { render, screen, waitFor } from '@testing-library/react'
import axios from 'axios'
import { describe, expect, it, vi } from 'vitest'

import { ApiProvider, useApiClient } from '../../src/contexts/ApiContext'
import { createApiClient } from '../../src/services/api'
import { summarizeText } from '../helpers/domSnapshot'

const Probe = () => {
  const { isLoading } = useApiClient()
  return <div data-testid="loading-state">{isLoading ? 'loading' : 'idle'}</div>
}

describe('ApiContext', () => {
  it('Provider配下でisLoadingを参照できる', async () => {
    const noop = vi.fn()
    const client = createApiClient(axios.create(), {
      onRequestStart: noop,
      onRequestEnd: noop,
    })

    const { container } = render(
      <ApiProvider client={client}>
        <Probe />
      </ApiProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading-state')).toHaveTextContent('idle')
    })
    expect(summarizeText(container)).toMatchSnapshot('text')
  })

  it('Provider外でuseApiClientを使うとエラーになる', () => {
    expect(() => render(<Probe />)).toThrowError('useApiClient must be used within an ApiProvider')
    expect(() => render(<Probe />)).toThrowErrorMatchingSnapshot()
  })
})
