import { describe, it, expect, vi, beforeEach } from 'vitest'

let withConfigLock

beforeEach(async () => {
  vi.resetModules()
  const mod = await import('../../server/config-lock.js')
  withConfigLock = mod.withConfigLock
})

describe('withConfigLock', () => {
  it('executes a single operation and returns its result', async () => {
    const result = await withConfigLock(() => 42)
    expect(result).toBe(42)
  })

  it('executes an async operation and returns its result', async () => {
    const result = await withConfigLock(async () => {
      return 'async-result'
    })
    expect(result).toBe('async-result')
  })

  it('serializes concurrent operations', async () => {
    const order = []
    let resolveFirst

    const first = withConfigLock(() => {
      return new Promise(resolve => {
        resolveFirst = () => {
          order.push('first')
          resolve('first')
        }
      })
    })

    const second = withConfigLock(() => {
      order.push('second')
      return 'second'
    })

    // Second should not have run yet
    await new Promise(r => setTimeout(r, 10))
    expect(order).toEqual([])

    // Complete the first
    resolveFirst()
    await first
    await second

    expect(order).toEqual(['first', 'second'])
  })

  it('propagates errors to the caller', async () => {
    await expect(
      withConfigLock(() => { throw new Error('test-error') })
    ).rejects.toThrow('test-error')
  })

  it('continues processing after a failed operation', async () => {
    // First operation fails
    await withConfigLock(() => { throw new Error('fail') }).catch(() => {})

    // Second operation should still work
    const result = await withConfigLock(() => 'recovered')
    expect(result).toBe('recovered')
  })

  it('preserves order across many concurrent operations', async () => {
    const order = []

    const ops = [1, 2, 3, 4, 5].map(n =>
      withConfigLock(() => {
        order.push(n)
        return n
      })
    )

    const results = await Promise.all(ops)
    expect(results).toEqual([1, 2, 3, 4, 5])
    expect(order).toEqual([1, 2, 3, 4, 5])
  })
})
