import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

let useApiTokens

describe('useApiTokens', () => {
  beforeEach(async () => {
    vi.resetModules()
    global.fetch = vi.fn()
    const mod = await import('../composables/useApiTokens')
    useApiTokens = mod.useApiTokens
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function mockFetch(data, status = 200) {
    global.fetch = vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(data)
    })
  }

  it('loadTokens fetches and stores user tokens', async () => {
    const mockTokens = [{ id: '1', name: 'Test', tokenPrefix: 'tt_abc12345' }]
    mockFetch({ tokens: mockTokens })

    const { tokens, loadTokens } = useApiTokens()
    await loadTokens()

    expect(tokens.value).toEqual(mockTokens)
  })

  it('loadAllTokens fetches admin token list', async () => {
    const mockTokens = [
      { id: '1', name: 'Token 1', ownerEmail: 'user1@test.com' },
      { id: '2', name: 'Token 2', ownerEmail: 'user2@test.com' }
    ]
    mockFetch({ tokens: mockTokens })

    const { allTokens, loadAllTokens } = useApiTokens()
    await loadAllTokens()

    expect(allTokens.value).toEqual(mockTokens)
  })

  it('createToken sends POST and reloads tokens', async () => {
    const created = { token: 'tt_newtoken', id: '1', name: 'New', expiresAt: null }
    // First call: POST, second call: GET (reload)
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 201, json: () => Promise.resolve(created) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ tokens: [{ id: '1', name: 'New' }] }) })

    const { createToken } = useApiTokens()
    const result = await createToken('New Token', '90d')

    expect(result.token).toBe('tt_newtoken')
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('revokeToken sends DELETE and reloads tokens', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ success: true }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ tokens: [] }) })

    const { revokeToken } = useApiTokens()
    await revokeToken('tok-1')

    expect(global.fetch).toHaveBeenCalledTimes(2)
    const firstCall = global.fetch.mock.calls[0]
    expect(firstCall[0]).toContain('/tokens/tok-1')
    expect(firstCall[1].method).toBe('DELETE')
  })

  it('sets error on load failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Server error' })
    })

    const { error, loadTokens } = useApiTokens()
    await loadTokens()

    expect(error.value).toBeTruthy()
  })
})
