import { describe, it, expect, beforeEach, afterEach } from 'vitest'

const { pickRecommendedBranch } = require('../../../server/rhoai-component-architectures/routes')

function makeRegistry(releases) {
  return { releases }
}

function makeRelease(id, gaDate) {
  return { id, milestones: { ga: gaDate } }
}

describe('pickRecommendedBranch', () => {
  let realDateNow

  beforeEach(() => {
    realDateNow = Date.now
  })

  afterEach(() => {
    Date.now = realDateNow
  })

  it('picks the branch whose GA release date is closest to today', () => {
    Date.now = () => new Date('2026-08-20').getTime()

    const registry = makeRegistry([
      makeRelease('rhai-3.5-ga', '2026-08-19'),
      makeRelease('rhai-3.6-ga', '2026-11-19')
    ])
    const branches = ['rhoai-3.6', 'rhoai-3.5']

    expect(pickRecommendedBranch(registry, branches)).toBe('rhoai-3.5')
  })

  it('picks closer future GA when past GA is farther away', () => {
    Date.now = () => new Date('2026-10-15').getTime()

    const registry = makeRegistry([
      makeRelease('rhai-3.5-ga', '2026-08-19'),
      makeRelease('rhai-3.6-ga', '2026-11-19')
    ])
    const branches = ['rhoai-3.6', 'rhoai-3.5']

    expect(pickRecommendedBranch(registry, branches)).toBe('rhoai-3.6')
  })

  it('picks GA release date over EA release date for the same branch', () => {
    Date.now = () => new Date('2026-08-15').getTime()

    const registry = makeRegistry([
      makeRelease('rhai-3.5-ea1', '2026-06-17'),
      makeRelease('rhai-3.5-ea2', '2026-07-15'),
      makeRelease('rhai-3.5-ga', '2026-08-19'),
      makeRelease('rhai-3.6-ea1', '2026-09-17')
    ])
    const branches = ['rhoai-3.6', 'rhoai-3.5']

    expect(pickRecommendedBranch(registry, branches)).toBe('rhoai-3.5')
  })

  it('returns null when registry is null', () => {
    expect(pickRecommendedBranch(null, ['rhoai-3.5'])).toBe(null)
  })

  it('returns null when no releases have GA dates', () => {
    const registry = makeRegistry([
      { id: 'rhai-3.5-ga', milestones: {} }
    ])
    expect(pickRecommendedBranch(registry, ['rhoai-3.5'])).toBe(null)
  })

  it('skips releases whose branch is not in availableBranches', () => {
    Date.now = () => new Date('2026-08-20').getTime()

    const registry = makeRegistry([
      makeRelease('rhai-3.5-ga', '2026-08-19'),
      makeRelease('rhai-3.6-ga', '2026-11-19')
    ])

    expect(pickRecommendedBranch(registry, ['rhoai-3.6'])).toBe('rhoai-3.6')
  })
})
