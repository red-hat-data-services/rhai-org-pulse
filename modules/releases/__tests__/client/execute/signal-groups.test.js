import { describe, it, expect } from 'vitest'
import {
  isFeatureCompleteForSignals,
  partitionSignalFeatures
} from '../../../client/execute/utils/signal-groups.js'

function feature(overrides = {}) {
  return {
    key: 'RHAISTRAT-1',
    summary: 'Test feature',
    status: 'In Progress',
    statusCategory: 'In Progress',
    health: 'YELLOW',
    completionPct: 0,
    blockerCount: 0,
    ...overrides
  }
}

describe('isFeatureCompleteForSignals', () => {
  it('returns true when completionPct is 100', () => {
    expect(isFeatureCompleteForSignals(feature({
      status: 'In Progress',
      statusCategory: 'In Progress',
      completionPct: 100
    }))).toBe(true)
  })

  it('returns true when statusCategory is Done', () => {
    expect(isFeatureCompleteForSignals(feature({
      status: 'Closed',
      statusCategory: 'Done',
      completionPct: 0,
      health: 'YELLOW'
    }))).toBe(true)
  })

  it('returns true for Release Pending by status name when category missing', () => {
    expect(isFeatureCompleteForSignals(feature({
      status: 'Release Pending',
      statusCategory: null,
      completionPct: 0
    }))).toBe(true)
  })

  it('returns true for Closed by status name (case-insensitive) when category missing', () => {
    expect(isFeatureCompleteForSignals(feature({
      status: 'closed',
      statusCategory: null,
      completionPct: 0
    }))).toBe(true)
  })

  it('returns false for In Progress with 0%', () => {
    expect(isFeatureCompleteForSignals(feature({
      status: 'In Progress',
      statusCategory: 'In Progress',
      completionPct: 0,
      health: 'YELLOW'
    }))).toBe(false)
  })

  it('returns false for null/undefined feature', () => {
    expect(isFeatureCompleteForSignals(null)).toBe(false)
    expect(isFeatureCompleteForSignals(undefined)).toBe(false)
  })
})

describe('partitionSignalFeatures', () => {
  it('buckets Closed + 0% + YELLOW into Complete (not Not Started)', () => {
    const closed = feature({
      key: 'RHAISTRAT-CLOSED',
      status: 'Closed',
      statusCategory: 'Done',
      completionPct: 0,
      health: 'YELLOW'
    })
    const groups = partitionSignalFeatures([closed])
    expect(groups.complete).toEqual([closed])
    expect(groups.notStarted).toEqual([])
  })

  it('buckets Release Pending + 0% into Complete', () => {
    const pending = feature({
      key: 'RHAISTRAT-RP',
      status: 'Release Pending',
      statusCategory: 'Done',
      completionPct: 0,
      health: 'YELLOW'
    })
    const groups = partitionSignalFeatures([pending])
    expect(groups.complete).toEqual([pending])
    expect(groups.notStarted).toEqual([])
  })

  it('buckets statusCategory Done into Complete', () => {
    const done = feature({
      key: 'RHAISTRAT-DONE',
      status: 'Resolved',
      statusCategory: 'Done',
      completionPct: 25,
      health: 'RED',
      blockerCount: 2
    })
    const groups = partitionSignalFeatures([done])
    expect(groups.complete).toEqual([done])
    expect(groups.blocked).toEqual([])
  })

  it('keeps In Progress + 0% + YELLOW in Not Started', () => {
    const active = feature({
      key: 'RHAISTRAT-NS',
      status: 'In Progress',
      statusCategory: 'In Progress',
      completionPct: 0,
      health: 'YELLOW'
    })
    const groups = partitionSignalFeatures([active])
    expect(groups.notStarted).toEqual([active])
    expect(groups.complete).toEqual([])
  })

  it('keeps RED + blockers + incomplete in Blocked', () => {
    const blocked = feature({
      key: 'RHAISTRAT-BLK',
      status: 'In Progress',
      statusCategory: 'In Progress',
      completionPct: 40,
      health: 'RED',
      blockerCount: 1
    })
    const groups = partitionSignalFeatures([blocked])
    expect(groups.blocked).toEqual([blocked])
    expect(groups.complete).toEqual([])
  })

  it('keeps completionPct 100 in Complete regardless of health', () => {
    const finished = feature({
      key: 'RHAISTRAT-100',
      status: 'In Progress',
      statusCategory: 'In Progress',
      completionPct: 100,
      health: 'RED',
      blockerCount: 3
    })
    const groups = partitionSignalFeatures([finished])
    expect(groups.complete).toEqual([finished])
    expect(groups.blocked).toEqual([])
  })

  it('partitions a mixed set into the expected buckets', () => {
    const features = [
      feature({ key: 'A', status: 'Closed', statusCategory: 'Done', completionPct: 0, health: 'YELLOW' }),
      feature({ key: 'B', status: 'In Progress', statusCategory: 'In Progress', completionPct: 0, health: 'YELLOW' }),
      feature({ key: 'C', status: 'In Progress', statusCategory: 'In Progress', completionPct: 50, health: 'YELLOW' }),
      feature({ key: 'D', status: 'In Progress', statusCategory: 'In Progress', completionPct: 30, health: 'RED', blockerCount: 2 }),
      feature({ key: 'E', status: 'In Progress', statusCategory: 'In Progress', completionPct: 60, health: 'RED', blockerCount: 0 }),
      feature({ key: 'F', status: 'In Progress', statusCategory: 'In Progress', completionPct: 80, health: 'GREEN' }),
      feature({ key: 'G', status: 'In Progress', statusCategory: 'In Progress', completionPct: 100, health: 'YELLOW' })
    ]
    const groups = partitionSignalFeatures(features)
    expect(groups.complete.map(f => f.key).sort()).toEqual(['A', 'G'])
    expect(groups.notStarted.map(f => f.key)).toEqual(['B'])
    expect(groups.atRisk.map(f => f.key)).toEqual(['C'])
    expect(groups.blocked.map(f => f.key)).toEqual(['D'])
    expect(groups.redOther.map(f => f.key)).toEqual(['E'])
    expect(groups.onTrack.map(f => f.key)).toEqual(['F'])
  })
})
