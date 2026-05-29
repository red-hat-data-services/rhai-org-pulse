import { describe, it, expect } from 'vitest'

const { computeHealth } = await import('../../server/health.js')

const PIPELINE = {
  slug: 'test-pipeline',
  schedule: { expectedIntervalMinutes: 720 }
}

function makeRun(overrides = {}) {
  return {
    id: '1',
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    durationSeconds: 3600,
    status: 'success',
    ...overrides
  }
}

describe('computeHealth', () => {
  it('returns grey when no runs', () => {
    const result = computeHealth(PIPELINE, [])
    expect(result.healthStatus).toBe('grey')
    expect(result.successRate).toBeNull()
    expect(result.failureStreak).toBe(0)
  })

  it('returns grey when runs is null', () => {
    const result = computeHealth(PIPELINE, null)
    expect(result.healthStatus).toBe('grey')
  })

  it('returns green when recent run succeeded within interval', () => {
    const runs = Array.from({ length: 10 }, (_, i) =>
      makeRun({
        id: String(i),
        startedAt: new Date(Date.now() - i * 720 * 60 * 1000).toISOString(),
        status: 'success'
      })
    )
    const result = computeHealth(PIPELINE, runs)
    expect(result.healthStatus).toBe('green')
    expect(result.successRate).toBe(100)
    expect(result.failureStreak).toBe(0)
  })

  it('returns red when failure streak >= 3', () => {
    const runs = [
      makeRun({ id: '1', startedAt: new Date(Date.now() - 1000).toISOString(), status: 'failed' }),
      makeRun({ id: '2', startedAt: new Date(Date.now() - 100000).toISOString(), status: 'failed' }),
      makeRun({ id: '3', startedAt: new Date(Date.now() - 200000).toISOString(), status: 'failed' }),
      makeRun({ id: '4', startedAt: new Date(Date.now() - 300000).toISOString(), status: 'success' }),
    ]
    const result = computeHealth(PIPELINE, runs)
    expect(result.healthStatus).toBe('red')
    expect(result.failureStreak).toBe(3)
  })

  it('returns yellow when last run failed but previous succeeded', () => {
    const runs = [
      makeRun({ id: '1', startedAt: new Date(Date.now() - 1000).toISOString(), status: 'failed' }),
      ...Array.from({ length: 9 }, (_, i) =>
        makeRun({
          id: String(i + 2),
          startedAt: new Date(Date.now() - (i + 1) * 720 * 60 * 1000).toISOString(),
          status: 'success'
        })
      )
    ]
    const result = computeHealth(PIPELINE, runs)
    expect(result.healthStatus).toBe('yellow')
  })

  it('computes average duration', () => {
    const runs = [
      makeRun({ durationSeconds: 100 }),
      makeRun({ durationSeconds: 200, startedAt: new Date(Date.now() - 10000).toISOString() }),
    ]
    const result = computeHealth(PIPELINE, runs)
    expect(result.avgDurationSeconds).toBe(150)
  })
})
