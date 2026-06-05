import { describe, it, expect, vi } from 'vitest'

const { createRefreshRegistry, parseCadence } = require('../refresh-registry')

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

  it('stores cadence on registered handler', () => {
    const registry = createRefreshRegistry()
    registry.register('fast', { handler: vi.fn(), cadence: '12h' })
    expect(registry.get('fast').cadence).toBe('12h')
  })

  it('defaults cadence to 24h when not specified', () => {
    const registry = createRefreshRegistry()
    registry.register('default', { handler: vi.fn() })
    expect(registry.get('default').cadence).toBe('24h')
  })

  it('rejects invalid cadence at registration time', () => {
    const registry = createRefreshRegistry()
    expect(() => registry.register('bad', { handler: vi.fn(), cadence: 'abc' }))
      .toThrow('Invalid cadence format')
  })

  it('rejects zero cadence at registration time', () => {
    const registry = createRefreshRegistry()
    expect(() => registry.register('bad', { handler: vi.fn(), cadence: '0h' }))
      .toThrow('value must be greater than zero')
  })

  // --- Cadence parsing ---

  describe('parseCadence', () => {
    it('parses minutes', () => {
      expect(parseCadence('15m')).toBe(15 * 60 * 1000)
    })

    it('parses hours', () => {
      expect(parseCadence('12h')).toBe(12 * 60 * 60 * 1000)
    })

    it('parses days', () => {
      expect(parseCadence('1d')).toBe(24 * 60 * 60 * 1000)
    })

    it('parses 1m minimum', () => {
      expect(parseCadence('1m')).toBe(60 * 1000)
    })

    it('rejects empty string', () => {
      expect(() => parseCadence('')).toThrow('non-empty string')
    })

    it('rejects non-string', () => {
      expect(() => parseCadence(123)).toThrow('non-empty string')
    })

    it('rejects invalid format', () => {
      expect(() => parseCadence('abc')).toThrow('Invalid cadence format')
    })

    it('rejects zero value', () => {
      expect(() => parseCadence('0h')).toThrow('greater than zero')
    })

    it('rejects invalid unit', () => {
      expect(() => parseCadence('10s')).toThrow('Invalid cadence format')
    })
  })

  // --- Order and parallelism ---

  it('runAll executes handlers in order', async () => {
    const registry = createRefreshRegistry()
    const order = []
    registry.register('second', { handler: async () => { order.push('second') }, order: 50 })
    registry.register('first', { handler: async () => { order.push('first') }, order: 10 })
    registry.register('third', { handler: async () => { order.push('third') }, order: 90 })

    const result = await registry.runAll({ force: true })
    // Two-phase return: await execution if present
    if (result.execution) await result.execution
    expect(order).toEqual(['first', 'second', 'third'])
  })

  it('runAll defaults order to 100', async () => {
    const registry = createRefreshRegistry()
    const order = []
    registry.register('default-order', { handler: async () => { order.push('default') } })
    registry.register('explicit-low', { handler: async () => { order.push('low') }, order: 10 })

    const result = await registry.runAll({ force: true })
    if (result.execution) await result.execution
    expect(order).toEqual(['low', 'default'])
  })

  it('runs handlers at the same order in parallel', async () => {
    const registry = createRefreshRegistry()
    let aStarted = false
    let bStarted = false

    registry.register('a', {
      handler: async () => {
        aStarted = true
        await new Promise((r) => setTimeout(r, 10))
        expect(bStarted).toBe(true)
        return 'a-done'
      },
      order: 50
    })
    registry.register('b', {
      handler: async () => {
        bStarted = true
        await new Promise((r) => setTimeout(r, 10))
        expect(aStarted).toBe(true)
        return 'b-done'
      },
      order: 50
    })

    const result = await registry.runAll({ force: true })
    if (result.execution) await result.execution
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

    const result = await registry.runAll({ force: true })
    if (result.execution) await result.execution

    expect(executed).toContain('group1-ok')
    expect(executed).toContain('group1-fail')
    expect(executed).toContain('group2-ok')
  })

  // --- Errors and timeouts ---

  it('runAll catches handler errors', async () => {
    const registry = createRefreshRegistry()
    registry.register('failing', { handler: async () => { throw new Error('boom') } })

    const result = await registry.runAll({ force: true })
    if (result.execution) await result.execution
  })

  it('runAll uses global timeout as fallback', async () => {
    const registry = createRefreshRegistry()
    registry.register('slow', {
      handler: () => new Promise(() => {}), // never resolves
      order: 10
    })

    const result = await registry.runAll({ timeout: 50, force: true })
    if (result.execution) await result.execution
  })

  it('per-handler timeout overrides global timeout', async () => {
    const registry = createRefreshRegistry()
    registry.register('custom-timeout', {
      handler: () => new Promise(() => {}), // never resolves
      timeout: 30
    })

    const result = await registry.runAll({ timeout: 5000, force: true })
    if (result.execution) await result.execution
  })

  it('handler without per-handler timeout falls back to global', async () => {
    const registry = createRefreshRegistry()
    registry.register('no-custom', {
      handler: () => new Promise(() => {}) // never resolves, no timeout field
    })

    const result = await registry.runAll({ timeout: 40, force: true })
    if (result.execution) await result.execution
  })

  // --- Mutex ---

  it('rejects concurrent runAll calls', async () => {
    const registry = createRefreshRegistry()
    registry.register('slow', {
      handler: () => new Promise((r) => setTimeout(r, 100)),
      order: 10
    })

    const first = registry.runAll({ force: true })
    await expect(registry.runAll({ force: true })).rejects.toThrow('Refresh is already running')
    const result = await first
    if (result.execution) await result.execution
  })

  it('allows sequential runAll calls after first completes', async () => {
    const registry = createRefreshRegistry()
    registry.register('fast', { handler: async () => 'ok' })

    const r1 = await registry.runAll({ force: true })
    if (r1.execution) await r1.execution
    const r2 = await registry.runAll({ force: true })
    if (r2.execution) await r2.execution
    expect(r2.counts.total).toBe(1)
  })

  it('isRunning returns true during execution', async () => {
    const registry = createRefreshRegistry()
    let checkedDuring = false

    registry.register('checker', {
      handler: async () => {
        checkedDuring = registry.isRunning()
      }
    })

    const result = await registry.runAll({ force: true })
    if (result.execution) await result.execution
    expect(checkedDuring).toBe(true)
    expect(registry.isRunning()).toBe(false)
  })

  it('mutex is released even if runAll has an unexpected error', async () => {
    const registry = createRefreshRegistry()
    registry.register('fail', {
      handler: async () => { throw new Error('oops') }
    })

    const r1 = await registry.runAll({ force: true })
    if (r1.execution) await r1.execution
    // Should not throw mutex error
    const r2 = await registry.runAll({ force: true })
    if (r2.execution) await r2.execution
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

    const result = await registry.runAll({ force: true })
    if (result.execution) await result.execution

    expect(capturedStatus.running).toBe(true)
    expect(capturedStatus.handlers['first'].state).toBe('running')
    expect(capturedStatus.handlers['second'].state).toBe('pending')
  })

  it('getStatus returns last run results after completion', async () => {
    const registry = createRefreshRegistry()
    registry.register('a', { handler: async () => 'ok' })
    registry.register('b', { handler: async () => { throw new Error('fail') } })

    const result = await registry.runAll({ force: true })
    if (result.execution) await result.execution
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
    expect(status.handlers['a'].lastRun).toBe('2024-01-01')
    expect(status.handlers['a'].cadence).toBe('24h')
    expect(status.handlers['b']).toMatchObject({ registered: true, order: 100, cadence: '24h' })
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

    const result = await registry.runAll({ force: true })
    if (result.execution) await result.execution

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

    const p = registry.runAll({ force: true })
    await expect(registry.runModule('mod-a')).rejects.toThrow('Refresh is already running')
    const result = await p
    if (result.execution) await result.execution
  })

  it('runModule updates progress and lastRun', async () => {
    const registry = createRefreshRegistry()
    registry.register('mod-a:task', { handler: async () => 'done', order: 10 })
    registry.register('mod-b:task', { handler: async () => 'also', order: 10 })

    await registry.runModule('mod-a')
    const status = await registry.getStatus()
    expect(status.running).toBe(false)
    expect(status.handlers['mod-a:task'].state).toBe('completed')
    expect(status.handlers['mod-b:task'].registered).toBe(true)
  })

  it('runModule ignores cadence — all handlers for module run regardless', async () => {
    const mockStorage = {
      readFromStorage: vi.fn().mockReturnValue({
        completedAt: Date.now(),
        progress: {
          'mod-a:task': {
            state: 'completed',
            order: 10,
            completedAt: Date.now(),
            lastSuccessfulRun: Date.now(), // just ran
            cadence: '24h'
          }
        }
      }),
      writeToStorage: vi.fn()
    }
    const registry = createRefreshRegistry(mockStorage)
    const calls = []
    registry.register('mod-a:task', { handler: async () => { calls.push('ran') }, order: 10, cadence: '24h' })

    await registry.runModule('mod-a')
    expect(calls).toEqual(['ran'])
  })

  // --- Cadence filtering ---

  describe('cadence filtering', () => {
    it('skips handlers that are not due', async () => {
      const mockStorage = {
        readFromStorage: vi.fn().mockReturnValue({
          completedAt: Date.now(),
          progress: {
            'a': {
              state: 'completed',
              order: 10,
              completedAt: Date.now(),
              lastSuccessfulRun: Date.now(), // just ran
              cadence: '24h'
            }
          }
        }),
        writeToStorage: vi.fn()
      }
      const registry = createRefreshRegistry(mockStorage)
      const calls = []
      registry.register('a', { handler: async () => { calls.push('a') }, order: 10, cadence: '24h' })

      const result = await registry.runAll() // no force
      expect(result.counts.skipped).toBe(1)
      expect(result.counts.due).toBe(0)
      expect(calls).toEqual([])
    })

    it('runs handlers that are due', async () => {
      const oldTimestamp = Date.now() - 25 * 60 * 60 * 1000 // 25 hours ago
      const mockStorage = {
        readFromStorage: vi.fn().mockReturnValue({
          completedAt: oldTimestamp,
          progress: {
            'a': {
              state: 'completed',
              order: 10,
              completedAt: oldTimestamp,
              lastSuccessfulRun: oldTimestamp,
              cadence: '24h'
            }
          }
        }),
        writeToStorage: vi.fn()
      }
      const registry = createRefreshRegistry(mockStorage)
      const calls = []
      registry.register('a', { handler: async () => { calls.push('a') }, order: 10, cadence: '24h' })

      const result = await registry.runAll()
      if (result.execution) await result.execution
      expect(result.counts.due).toBe(1)
      expect(result.counts.skipped).toBe(0)
      expect(calls).toEqual(['a'])
    })

    it('force: true bypasses cadence for all handlers', async () => {
      const mockStorage = {
        readFromStorage: vi.fn().mockReturnValue({
          completedAt: Date.now(),
          progress: {
            'a': {
              state: 'completed',
              order: 10,
              completedAt: Date.now(),
              lastSuccessfulRun: Date.now(), // just ran
              cadence: '24h'
            }
          }
        }),
        writeToStorage: vi.fn()
      }
      const registry = createRefreshRegistry(mockStorage)
      const calls = []
      registry.register('a', { handler: async () => { calls.push('a') }, order: 10, cadence: '24h' })

      const result = await registry.runAll({ force: true })
      if (result.execution) await result.execution
      expect(result.counts.due).toBe(1)
      expect(result.counts.skipped).toBe(0)
      expect(calls).toEqual(['a'])
    })

    it('missing lastSuccessfulRun (null) means handler is immediately due', async () => {
      const registry = createRefreshRegistry() // no persisted state
      const calls = []
      registry.register('a', { handler: async () => { calls.push('a') }, order: 10, cadence: '24h' })

      const result = await registry.runAll()
      if (result.execution) await result.execution
      expect(result.counts.due).toBe(1)
      expect(calls).toEqual(['a'])
    })

    it('future lastSuccessfulRun is treated as immediately due', async () => {
      const futureTimestamp = Date.now() + 999999999
      const mockStorage = {
        readFromStorage: vi.fn().mockReturnValue({
          completedAt: futureTimestamp,
          progress: {
            'a': {
              state: 'completed',
              order: 10,
              completedAt: futureTimestamp,
              lastSuccessfulRun: futureTimestamp, // future!
              cadence: '24h'
            }
          }
        }),
        writeToStorage: vi.fn()
      }
      const registry = createRefreshRegistry(mockStorage)
      const calls = []
      registry.register('a', { handler: async () => { calls.push('a') }, order: 10, cadence: '24h' })

      const result = await registry.runAll()
      if (result.execution) await result.execution
      expect(result.counts.due).toBe(1)
      expect(calls).toEqual(['a'])
    })

    it('failed handlers retry on next tick (lastSuccessfulRun not updated on failure)', async () => {
      const oldTimestamp = Date.now() - 25 * 60 * 60 * 1000
      const mockStorage = {
        readFromStorage: vi.fn().mockReturnValue({
          completedAt: Date.now(),
          progress: {
            'a': {
              state: 'completed',
              order: 10,
              completedAt: Date.now(),
              lastSuccessfulRun: oldTimestamp, // old — handler failed recently
              cadence: '24h'
            }
          }
        }),
        writeToStorage: vi.fn()
      }
      const registry = createRefreshRegistry(mockStorage)
      let callCount = 0
      registry.register('a', {
        handler: async () => { callCount++; throw new Error('fail') },
        order: 10,
        cadence: '24h'
      })

      // First run — handler is due because lastSuccessfulRun is old
      const r1 = await registry.runAll()
      if (r1.execution) await r1.execution
      expect(r1.counts.due).toBe(1)
      expect(callCount).toBe(1)

      // The failed handler's lastSuccessfulRun should still be oldTimestamp
      // So on next run it should be due again
      const r2 = await registry.runAll()
      if (r2.execution) await r2.execution
      expect(r2.counts.due).toBe(1)
      expect(callCount).toBe(2)
    })

    it('two-phase return: counts available before execution completes', async () => {
      const registry = createRefreshRegistry()
      registry.register('slow', {
        handler: () => new Promise(r => setTimeout(r, 50)),
        order: 10
      })

      const result = await registry.runAll({ force: true })
      expect(result.counts).toEqual({ total: 1, due: 1, skipped: 0 })
      expect(result.execution).toBeDefined()
      // execution is still running at this point
      await result.execution
    })

    it('all-skipped returns immediately with no execution promise', async () => {
      const mockStorage = {
        readFromStorage: vi.fn().mockReturnValue({
          completedAt: Date.now(),
          progress: {
            'a': {
              state: 'completed',
              order: 10,
              completedAt: Date.now(),
              lastSuccessfulRun: Date.now(),
              cadence: '24h'
            }
          }
        }),
        writeToStorage: vi.fn()
      }
      const registry = createRefreshRegistry(mockStorage)
      registry.register('a', { handler: vi.fn(), order: 10, cadence: '24h' })

      const result = await registry.runAll()
      expect(result.counts).toEqual({ total: 1, due: 0, skipped: 1 })
      expect(result.execution).toBeUndefined()
      expect(result.results).toEqual({})
    })
  })

  // --- Cadence overrides ---

  describe('cadence overrides', () => {
    it('setCadenceOverride stores and persists override', () => {
      const mockStorage = {
        readFromStorage: vi.fn().mockReturnValue(null),
        writeToStorage: vi.fn()
      }
      const registry = createRefreshRegistry(mockStorage)
      registry.register('a', { handler: vi.fn() })

      registry.setCadenceOverride('a', '6h')
      expect(registry.getCadenceOverrides()).toEqual({ a: '6h' })
      expect(mockStorage.writeToStorage).toHaveBeenCalledWith(
        'refresh-cadence-overrides.json',
        { a: '6h' }
      )
    })

    it('setCadenceOverride(null) clears override', () => {
      const mockStorage = {
        readFromStorage: vi.fn().mockReturnValue(null),
        writeToStorage: vi.fn()
      }
      const registry = createRefreshRegistry(mockStorage)
      registry.register('a', { handler: vi.fn() })

      registry.setCadenceOverride('a', '6h')
      registry.setCadenceOverride('a', null)
      expect(registry.getCadenceOverrides()).toEqual({})
    })

    it('rejects override below 15m floor', () => {
      const registry = createRefreshRegistry()
      expect(() => registry.setCadenceOverride('a', '5m')).toThrow('below the minimum of 15m')
    })

    it('loads overrides from storage at startup', () => {
      const mockStorage = {
        readFromStorage: vi.fn((key) => {
          if (key === 'refresh-cadence-overrides.json') return { 'a': '6h' }
          return null
        }),
        writeToStorage: vi.fn()
      }
      const registry = createRefreshRegistry(mockStorage)
      expect(registry.getCadenceOverrides()).toEqual({ 'a': '6h' })
    })

    it('uses override cadence instead of declared cadence', async () => {
      const recentTimestamp = Date.now() - 7 * 60 * 60 * 1000 // 7 hours ago
      const mockStorage = {
        readFromStorage: vi.fn((key) => {
          if (key === 'refresh-cadence-overrides.json') return { 'a': '6h' }
          if (key === 'refresh-registry-state.json') return {
            completedAt: recentTimestamp,
            progress: {
              'a': {
                state: 'completed',
                order: 10,
                completedAt: recentTimestamp,
                lastSuccessfulRun: recentTimestamp,
                cadence: '24h'
              }
            }
          }
          return null
        }),
        writeToStorage: vi.fn()
      }
      const registry = createRefreshRegistry(mockStorage)
      const calls = []
      registry.register('a', { handler: async () => { calls.push('a') }, order: 10, cadence: '24h' })

      // With 24h cadence and 7h since last run, handler would be skipped.
      // But with 6h override, it should be due.
      const result = await registry.runAll()
      if (result.execution) await result.execution
      expect(result.counts.due).toBe(1)
      expect(calls).toEqual(['a'])
    })

    it('handles missing override file gracefully', () => {
      const mockStorage = {
        readFromStorage: vi.fn().mockReturnValue(null),
        writeToStorage: vi.fn()
      }
      const registry = createRefreshRegistry(mockStorage)
      expect(registry.getCadenceOverrides()).toEqual({})
    })
  })

  // --- State persistence ---

  describe('state persistence', () => {
    it('persists lastSuccessfulRun on success', async () => {
      const mockStorage = {
        readFromStorage: vi.fn().mockReturnValue(null),
        writeToStorage: vi.fn()
      }
      const registry = createRefreshRegistry(mockStorage)
      registry.register('a', { handler: async () => 'ok', order: 10 })

      const result = await registry.runAll({ force: true })
      if (result.execution) await result.execution

      const persisted = mockStorage.writeToStorage.mock.calls.find(
        c => c[0] === 'refresh-registry-state.json'
      )
      expect(persisted).toBeTruthy()
      expect(persisted[1].progress['a'].lastSuccessfulRun).toBeTypeOf('number')
      expect(persisted[1].progress['a'].cadence).toBe('24h')
    })

    it('preserves old lastSuccessfulRun on failure', async () => {
      const oldTimestamp = Date.now() - 100000
      const mockStorage = {
        readFromStorage: vi.fn((key) => {
          if (key === 'refresh-registry-state.json') return {
            completedAt: oldTimestamp,
            progress: {
              'a': {
                state: 'completed',
                order: 10,
                completedAt: oldTimestamp,
                lastSuccessfulRun: oldTimestamp,
                cadence: '24h'
              }
            }
          }
          return null
        }),
        writeToStorage: vi.fn()
      }
      const registry = createRefreshRegistry(mockStorage)
      registry.register('a', {
        handler: async () => { throw new Error('boom') },
        order: 10
      })

      const result = await registry.runAll({ force: true })
      if (result.execution) await result.execution

      const persisted = mockStorage.writeToStorage.mock.calls.find(
        c => c[0] === 'refresh-registry-state.json'
      )
      expect(persisted[1].progress['a'].lastSuccessfulRun).toBe(oldTimestamp)
      expect(persisted[1].progress['a'].state).toBe('failed')
    })

    it('persists skippedAt for skipped handlers', async () => {
      const mockStorage = {
        readFromStorage: vi.fn((key) => {
          if (key === 'refresh-registry-state.json') return {
            completedAt: Date.now(),
            progress: {
              'a': {
                state: 'completed',
                order: 10,
                completedAt: Date.now(),
                lastSuccessfulRun: Date.now(),
                cadence: '24h'
              }
            }
          }
          return null
        }),
        writeToStorage: vi.fn()
      }
      const registry = createRefreshRegistry(mockStorage)
      registry.register('a', { handler: vi.fn(), order: 10, cadence: '24h' })

      const result = await registry.runAll() // no force
      expect(result.counts.skipped).toBe(1)

      const persisted = mockStorage.writeToStorage.mock.calls.find(
        c => c[0] === 'refresh-registry-state.json'
      )
      expect(persisted[1].progress['a'].skippedAt).toBeTypeOf('number')
      expect(persisted[1].progress['a'].state).toBe('skipped')
    })
  })

  // --- Dynamic re-registration ---

  it('dynamic re-registration updates cadence for next run', async () => {
    const mockStorage = {
      readFromStorage: vi.fn().mockReturnValue(null),
      writeToStorage: vi.fn()
    }
    const registry = createRefreshRegistry(mockStorage)
    const handler = vi.fn()
    registry.register('a', { handler, order: 10, cadence: '24h' })

    expect(registry.get('a').cadence).toBe('24h')

    // Re-register with different cadence
    registry.register('a', { handler, order: 10, cadence: '12h' })
    expect(registry.get('a').cadence).toBe('12h')
  })

  // --- getStatus with cadence info ---

  it('getStatus includes cadence info after run', async () => {
    const mockStorage = {
      readFromStorage: vi.fn().mockReturnValue(null),
      writeToStorage: vi.fn()
    }
    const registry = createRefreshRegistry(mockStorage)
    registry.register('a', { handler: async () => 'ok', order: 10, cadence: '12h' })

    const result = await registry.runAll({ force: true })
    if (result.execution) await result.execution

    const status = await registry.getStatus()
    expect(status.handlers['a'].cadence).toBe('12h')
    expect(status.handlers['a'].cadenceOverride).toBeNull()
    expect(status.handlers['a'].lastSuccessfulRun).toBeTypeOf('number')
    expect(status.handlers['a'].nextDueAt).toBeTypeOf('number')
  })
})
