import { describe, it, expect, vi } from 'vitest'

const { createRefreshRegistry } = require('../refresh-registry')

describe('refresh-registry', () => {
  it('registers and retrieves a handler', () => {
    const registry = createRefreshRegistry()
    const handler = vi.fn()
    registry.register('roster', { handler, order: 10 })
    const entry = registry.get('roster')
    expect(entry.handler).toBe(handler)
    expect(entry.status).toBeNull()
    expect(entry.order).toBe(10)
    expect(entry.timeout).toBeNull()
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

  it('stores per-handler timeout', () => {
    const registry = createRefreshRegistry()
    registry.register('fast', { handler: vi.fn(), timeout: 1000 })
    expect(registry.get('fast').timeout).toBe(1000)
  })

  // --- Order and parallelism ---

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

  it('runs handlers at the same order in parallel', async () => {
    const registry = createRefreshRegistry()
    let aStarted = false
    let bStarted = false

    registry.register('a', {
      handler: async () => {
        aStarted = true
        // Wait a tick so b can also start if parallel
        await new Promise((r) => setTimeout(r, 10))
        expect(bStarted).toBe(true) // b should have started too
        return 'a-done'
      },
      order: 50
    })
    registry.register('b', {
      handler: async () => {
        bStarted = true
        await new Promise((r) => setTimeout(r, 10))
        expect(aStarted).toBe(true) // a should have started too
        return 'b-done'
      },
      order: 50
    })

    const results = await registry.runAll()
    expect(results['a'].success).toBe(true)
    expect(results['b'].success).toBe(true)
  })

  it('parallel error isolation: one fails in a group, others still run, next group still runs', async () => {
    const registry = createRefreshRegistry()
    const executed = []

    registry.register('group1-ok', {
      handler: async () => { executed.push('group1-ok') },
      order: 10
    })
    registry.register('group1-fail', {
      handler: async () => {
        executed.push('group1-fail')
        throw new Error('group1 boom')
      },
      order: 10
    })
    registry.register('group2-ok', {
      handler: async () => { executed.push('group2-ok') },
      order: 20
    })

    const results = await registry.runAll()

    expect(executed).toContain('group1-ok')
    expect(executed).toContain('group1-fail')
    expect(executed).toContain('group2-ok')
    expect(results['group1-ok'].success).toBe(true)
    expect(results['group1-fail'].success).toBe(false)
    expect(results['group1-fail'].error).toBe('group1 boom')
    expect(results['group2-ok'].success).toBe(true)
  })

  // --- Errors and timeouts ---

  it('runAll catches handler errors', async () => {
    const registry = createRefreshRegistry()
    registry.register('failing', { handler: async () => { throw new Error('boom') } })

    const results = await registry.runAll()
    expect(results['failing'].success).toBe(false)
    expect(results['failing'].error).toBe('boom')
  })

  it('runAll uses global timeout as fallback', async () => {
    const registry = createRefreshRegistry()
    registry.register('slow', {
      handler: () => new Promise(() => {}), // never resolves
      order: 10
    })

    const results = await registry.runAll({ timeout: 50 })
    expect(results['slow'].success).toBe(false)
    expect(results['slow'].error).toContain('timed out')
  })

  it('per-handler timeout overrides global timeout', async () => {
    const registry = createRefreshRegistry()
    registry.register('custom-timeout', {
      handler: () => new Promise(() => {}), // never resolves
      timeout: 30 // handler-level: 30ms
    })

    const results = await registry.runAll({ timeout: 5000 }) // global: 5s
    expect(results['custom-timeout'].success).toBe(false)
    expect(results['custom-timeout'].error).toContain('timed out after 30ms')
  })

  it('handler without per-handler timeout falls back to global', async () => {
    const registry = createRefreshRegistry()
    registry.register('no-custom', {
      handler: () => new Promise(() => {}) // never resolves, no timeout field
    })

    const results = await registry.runAll({ timeout: 40 })
    expect(results['no-custom'].success).toBe(false)
    expect(results['no-custom'].error).toContain('timed out after 40ms')
  })

  // --- Mutex ---

  it('rejects concurrent runAll calls', async () => {
    const registry = createRefreshRegistry()
    registry.register('slow', {
      handler: () => new Promise((r) => setTimeout(r, 100)),
      order: 10
    })

    const first = registry.runAll()
    await expect(registry.runAll()).rejects.toThrow('Refresh is already running')
    await first // let it finish
  })

  it('allows sequential runAll calls after first completes', async () => {
    const registry = createRefreshRegistry()
    registry.register('fast', { handler: async () => 'ok' })

    await registry.runAll()
    const results = await registry.runAll()
    expect(results['fast'].success).toBe(true)
  })

  it('isRunning returns true during execution', async () => {
    const registry = createRefreshRegistry()
    let checkedDuring = false

    registry.register('checker', {
      handler: async () => {
        checkedDuring = registry.isRunning()
      }
    })

    await registry.runAll()
    expect(checkedDuring).toBe(true)
    expect(registry.isRunning()).toBe(false)
  })

  it('mutex is released even if runAll has an unexpected error', async () => {
    const registry = createRefreshRegistry()
    registry.register('fail', {
      handler: async () => { throw new Error('oops') }
    })

    await registry.runAll()
    // Should not throw mutex error
    const results = await registry.runAll()
    expect(results['fail'].success).toBe(false)
  })

  // --- Progress tracking ---

  it('getStatus returns progress during execution', async () => {
    const registry = createRefreshRegistry()
    let capturedStatus = null

    registry.register('first', {
      handler: async () => {
        capturedStatus = await registry.getStatus()
        return 'done'
      },
      order: 10
    })
    registry.register('second', {
      handler: async () => 'also-done',
      order: 20
    })

    await registry.runAll()

    expect(capturedStatus.running).toBe(true)
    expect(capturedStatus.handlers['first'].state).toBe('running')
    expect(capturedStatus.handlers['second'].state).toBe('pending')
  })

  it('getStatus returns last run results after completion', async () => {
    const registry = createRefreshRegistry()
    registry.register('a', { handler: async () => 'ok' })
    registry.register('b', { handler: async () => { throw new Error('fail') } })

    await registry.runAll()
    const status = await registry.getStatus()

    expect(status.running).toBe(false)
    expect(status.completedAt).toBeTypeOf('number')
    expect(status.handlers['a'].state).toBe('completed')
    expect(status.handlers['b'].state).toBe('failed')
    expect(status.handlers['b'].error).toBe('fail')
  })

  it('getStatus returns handler status functions when never run', async () => {
    const registry = createRefreshRegistry()
    registry.register('a', {
      handler: vi.fn(),
      status: async () => ({ lastRun: '2024-01-01' })
    })
    registry.register('b', { handler: vi.fn() })

    const status = await registry.getStatus()
    expect(status.running).toBe(false)
    expect(status.handlers['a']).toEqual({ lastRun: '2024-01-01', order: 100 })
    expect(status.handlers['b']).toEqual({ registered: true, order: 100 })
  })

  it('getStatus returns null-like state when no handlers registered and never run', async () => {
    const registry = createRefreshRegistry()
    const status = await registry.getStatus()
    expect(status.running).toBe(false)
    expect(status.handlers).toEqual({})
  })

  it('progress shows completed handlers from earlier groups', async () => {
    const registry = createRefreshRegistry()
    let statusDuringGroup2 = null

    registry.register('group1', {
      handler: async () => 'g1-result',
      order: 10
    })
    registry.register('group2', {
      handler: async () => {
        statusDuringGroup2 = await registry.getStatus()
        return 'g2-result'
      },
      order: 20
    })

    await registry.runAll()

    expect(statusDuringGroup2.handlers['group1'].state).toBe('completed')
    expect(statusDuringGroup2.handlers['group2'].state).toBe('running')
  })

  // --- runModule ---

  it('runModule runs only handlers for the specified module', async () => {
    const registry = createRefreshRegistry()
    const calls = []
    registry.register('mod-a:first', { handler: async () => { calls.push('a1') }, order: 10 })
    registry.register('mod-a:second', { handler: async () => { calls.push('a2') }, order: 20 })
    registry.register('mod-b:first', { handler: async () => { calls.push('b1') }, order: 10 })

    await registry.runModule('mod-a')
    expect(calls).toEqual(['a1', 'a2'])
  })

  it('runModule throws for unknown module', async () => {
    const registry = createRefreshRegistry()
    registry.register('mod-a:first', { handler: async () => {} })
    await expect(registry.runModule('mod-z')).rejects.toThrow('No handlers registered for module "mod-z"')
  })

  it('runModule respects mutex with runAll', async () => {
    const registry = createRefreshRegistry()
    registry.register('mod-a:slow', {
      handler: () => new Promise(resolve => setTimeout(resolve, 100)),
      order: 10
    })

    const p = registry.runAll()
    await expect(registry.runModule('mod-a')).rejects.toThrow('Refresh is already running')
    await p
  })

  it('runModule updates progress and lastRun', async () => {
    const registry = createRefreshRegistry()
    registry.register('mod-a:task', { handler: async () => 'done', order: 10 })
    registry.register('mod-b:task', { handler: async () => 'also', order: 10 })

    await registry.runModule('mod-a')
    const status = await registry.getStatus()
    expect(status.running).toBe(false)
    expect(status.handlers['mod-a:task'].state).toBe('completed')
    // mod-b handlers remain visible with registered stub (not wiped)
    expect(status.handlers['mod-b:task'].registered).toBe(true)
  })
})
