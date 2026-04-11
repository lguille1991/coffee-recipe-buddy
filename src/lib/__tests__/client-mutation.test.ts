import { describe, expect, it, vi } from 'vitest'
import { expectOk, runClientMutation } from '../client-mutation'

describe('client mutation helpers', () => {
  it('only runs the success callback when the mutation resolves', async () => {
    const onSuccess = vi.fn()
    const onError = vi.fn()

    await runClientMutation({
      execute: async () => 'ok',
      onSuccess,
      onError,
      errorMessage: 'failed',
    })

    expect(onSuccess).toHaveBeenCalledWith('ok')
    expect(onError).not.toHaveBeenCalled()
  })

  it('does not run the success callback when the mutation rejects', async () => {
    const onSuccess = vi.fn()
    const onError = vi.fn()

    await runClientMutation({
      execute: async () => {
        throw new Error('boom')
      },
      onSuccess,
      onError,
      errorMessage: 'failed to persist',
    })

    expect(onSuccess).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledWith('failed to persist')
  })

  it('treats non-ok responses as failures so callers can avoid optimistic state updates', async () => {
    const onSuccess = vi.fn()
    const onError = vi.fn()

    await runClientMutation({
      execute: async () => expectOk(new Response(null, { status: 500 }), 'server failed'),
      onSuccess,
      onError,
      errorMessage: 'failed to delete',
    })

    expect(onSuccess).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledWith('failed to delete')
  })
})
