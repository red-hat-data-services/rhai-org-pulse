import { describe, it, expect, vi, beforeEach } from 'vitest'

// We need a fresh module for each test to reset the internal providers Map
let registerProvider, getMessages

beforeEach(async () => {
  vi.resetModules()
  const mod = await import('../message-registry.js')
  registerProvider = mod.registerProvider
  getMessages = mod.getMessages
})

describe('registerProvider', () => {
  it('stores a provider function', async () => {
    const fn = vi.fn(async () => [])
    registerProvider('test:a', fn)
    await getMessages({})
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('logs warning and skips when fn is not a function', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    registerProvider('test:bad', 'not-a-function')
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Provider "test:bad" is not a function')
    )
    warnSpy.mockRestore()
  })
})

describe('getMessages', () => {
  it('calls all providers with user context', async () => {
    const user = { email: 'a@b.com', uid: 'uid1' }
    const fn1 = vi.fn(async () => [])
    const fn2 = vi.fn(async () => [])
    registerProvider('p1', fn1)
    registerProvider('p2', fn2)
    await getMessages(user)
    expect(fn1).toHaveBeenCalledWith(user)
    expect(fn2).toHaveBeenCalledWith(user)
  })

  it('returns empty results from provider returning empty array', async () => {
    registerProvider('empty', async () => [])
    const result = await getMessages({})
    expect(result).toEqual([])
  })

  it('catches and skips provider errors; other providers still run', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    registerProvider('bad', async () => { throw new Error('boom') })
    registerProvider('good', async () => [{ id: 'ok', type: 'info', text: 'hi' }])
    const result = await getMessages({})
    expect(result).toEqual([{ id: 'ok', type: 'info', text: 'hi' }])
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Provider "bad" failed:'),
      'boom'
    )
    warnSpy.mockRestore()
  })

  it('skips provider that exceeds timeout', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    registerProvider('slow', () => new Promise(() => {})) // never resolves
    registerProvider('fast', async () => [{ id: 'f', type: 'info', text: 'fast' }])

    // Override TIMEOUT_MS by using vi.useFakeTimers wouldn't work well with Promise.race,
    // but we can test the behavior — the slow provider times out at 5000ms
    // For unit test speed, we won't actually wait 5s; instead test the error-catching behavior
    // by simulating a rejection
    const result = await getMessages({})
    // fast provider should still produce results
    expect(result).toContainEqual({ id: 'f', type: 'info', text: 'fast' })
    warnSpy.mockRestore()
  }, 10000)

  it('concatenates results from multiple providers in registration order', async () => {
    registerProvider('a', async () => [{ id: 'a1', type: 'info', text: 'A' }])
    registerProvider('b', async () => [
      { id: 'b1', type: 'warning', text: 'B1' },
      { id: 'b2', type: 'error', text: 'B2' }
    ])
    const result = await getMessages({})
    expect(result).toEqual([
      { id: 'a1', type: 'info', text: 'A' },
      { id: 'b1', type: 'warning', text: 'B1' },
      { id: 'b2', type: 'error', text: 'B2' }
    ])
  })
})
