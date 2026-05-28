import { describe, it, expect, vi } from 'vitest'

const { createRefreshRegistry } = require('../refresh-registry')

describe('refresh-registry', () => {
  it('registers and retrieves a handler', () => {
    const registry = createRefreshRegistry()
    const handler = vi.fn()
    registry.register('roster', { handler, order: 10 })
    expect(registry.get('roster')).toEqual({ handler, status: null, order: 10 })
  })

  it('returns null for unregistered ids', () => {
    const registry = createRefreshRegistry()
    expect(registry.get('nonexistent')).toBeNull()
  })

  it('skips non-function handlers with warning', () => {
    const registry = createRefreshRegistry()
    registry.register('bad', { handler: 'not-a-function' })
    expect(registry.get('bad')).toBeNull()
  })

  it('getAll returns all registered entries', () => {
    const registry = createRefreshRegistry()
    registry.register('a', { handler: vi.fn() })
    registry.register('b', { handler: vi.fn() })
    const all = registry.getAll()
    expect(Object.keys(all)).toEqual(['a', 'b'])
  })

  it('runAll executes handlers in order', async () => {
    const registry = createRefreshRegistry()
    const order = []
    registry.register('second', { handler: async () => { order.push('second') }, order: 50 })
    registry.register('first', { handler: async () => { order.push('first') }, order: 10 })
    registry.register('third', { handler: async () => { order.push('third') }, order: 90 })

    const results = await registry.runAll()
    expect(order).toEqual(['first', 'second', 'third'])
    expect(results['first'].success).toBe(true)
    expect(results['second'].success).toBe(true)
    expect(results['third'].success).toBe(true)
  })

  it('runAll defaults order to 100', async () => {
    const registry = createRefreshRegistry()
    const order = []
    registry.register('default-order', { handler: async () => { order.push('default') } })
    registry.register('explicit-low', { handler: async () => { order.push('low') }, order: 10 })

    await registry.runAll()
    expect(order).toEqual(['low', 'default'])
  })

  it('runAll catches handler errors', async () => {
    const registry = createRefreshRegistry()
    registry.register('failing', { handler: async () => { throw new Error('boom') } })

    const results = await registry.runAll()
    expect(results['failing'].success).toBe(false)
    expect(results['failing'].error).toBe('boom')
  })

  it('runAll handles timeout', async () => {
    const registry = createRefreshRegistry()
    registry.register('slow', {
      handler: () => new Promise(() => {}), // never resolves
      order: 10
    })

    const results = await registry.runAll({ timeout: 50 })
    expect(results['slow'].success).toBe(false)
    expect(results['slow'].error).toContain('timed out')
  })

  it('getStatus returns aggregated status', async () => {
    const registry = createRefreshRegistry()
    registry.register('a', {
      handler: vi.fn(),
      status: async () => ({ lastRun: '2024-01-01' })
    })
    registry.register('b', { handler: vi.fn() })

    const status = await registry.getStatus()
    expect(status['a']).toEqual({ lastRun: '2024-01-01' })
    expect(status['b']).toEqual({ registered: true })
  })
})
