import { describe, it, expect } from 'vitest'
import { computeCumulativeBugData } from '../../../server/delivery/quality/calculations.js'

describe('computeCumulativeBugData', () => {
  it('returns empty datasets when no bugs', () => {
    const bugs = []
    const versions = ['rhoai-3.3', 'rhoai-3.4']
    const versionReleaseMap = new Map([
      ['rhoai-3.3', '2026-01-15'],
      ['rhoai-3.4', '2026-03-20']
    ])

    const result = computeCumulativeBugData(bugs, versions, versionReleaseMap)

    expect(result.labels).toEqual([])
    expect(result.datasets).toHaveLength(2)
    expect(result.datasets[0].label).toBe('rhoai-3.3')
    expect(result.datasets[0].data).toEqual([])
    expect(result.datasets[1].label).toBe('rhoai-3.4')
    expect(result.datasets[1].data).toEqual([])
  })

  it('computes cumulative counts for single version', () => {
    const bugs = [
      {
        key: 'BUG-1',
        affectedVersions: ['rhoai-3.3'],
        created: '2026-01-17T10:00:00.000Z'
      },
      {
        key: 'BUG-2',
        affectedVersions: ['rhoai-3.3'],
        created: '2026-01-17T14:00:00.000Z'
      },
      {
        key: 'BUG-3',
        affectedVersions: ['rhoai-3.3'],
        created: '2026-01-20T10:00:00.000Z'
      }
    ]
    const versions = ['rhoai-3.3']
    const versionReleaseMap = new Map([['rhoai-3.3', '2026-01-15']])

    const result = computeCumulativeBugData(bugs, versions, versionReleaseMap)

    expect(result.labels).toEqual([0, 1, 2, 3, 4, 5])
    expect(result.datasets).toHaveLength(1)
    expect(result.datasets[0].label).toBe('rhoai-3.3')
    // Day 0-1: 0 bugs
    // Day 2: 2 bugs (both on Jan 17)
    // Day 3-4: 2 bugs
    // Day 5: 3 bugs (one on Jan 20)
    expect(result.datasets[0].data).toEqual([0, 0, 2, 2, 2, 3])
  })

  it('computes cumulative counts for multiple versions', () => {
    const bugs = [
      {
        key: 'BUG-1',
        affectedVersions: ['rhoai-3.3'],
        created: '2026-01-17T10:00:00.000Z'
      },
      {
        key: 'BUG-2',
        affectedVersions: ['rhoai-3.4'],
        created: '2026-03-22T10:00:00.000Z'
      },
      {
        key: 'BUG-3',
        affectedVersions: ['rhoai-3.4'],
        created: '2026-03-25T10:00:00.000Z'
      }
    ]
    const versions = ['rhoai-3.3', 'rhoai-3.4']
    const versionReleaseMap = new Map([
      ['rhoai-3.3', '2026-01-15'],
      ['rhoai-3.4', '2026-03-20']
    ])

    const result = computeCumulativeBugData(bugs, versions, versionReleaseMap)

    expect(result.datasets).toHaveLength(2)

    const v33 = result.datasets.find(d => d.label === 'rhoai-3.3')
    const v34 = result.datasets.find(d => d.label === 'rhoai-3.4')

    expect(v33.data[2]).toBe(1) // Day 2: 1 bug
    expect(v34.data[2]).toBe(1) // Day 2: 1 bug
    expect(v34.data[5]).toBe(2) // Day 5: 2 bugs
  })

  it('filters out bugs with negative daysSinceRelease', () => {
    const bugs = [
      {
        key: 'BUG-PRE',
        affectedVersions: ['rhoai-3.3'],
        created: '2026-01-10T10:00:00.000Z' // 5 days before release
      },
      {
        key: 'BUG-POST',
        affectedVersions: ['rhoai-3.3'],
        created: '2026-01-17T10:00:00.000Z' // 2 days after release
      }
    ]
    const versions = ['rhoai-3.3']
    const versionReleaseMap = new Map([['rhoai-3.3', '2026-01-15']])

    const result = computeCumulativeBugData(bugs, versions, versionReleaseMap)

    expect(result.datasets[0].data[2]).toBe(1) // Only post-release bug counted
  })

  it('handles bugs affecting multiple versions', () => {
    const bugs = [
      {
        key: 'BUG-MULTI',
        affectedVersions: ['rhoai-3.3', 'rhoai-3.4'],
        created: '2026-01-17T10:00:00.000Z'
      }
    ]
    const versions = ['rhoai-3.3', 'rhoai-3.4']
    const versionReleaseMap = new Map([
      ['rhoai-3.3', '2026-01-15'],
      ['rhoai-3.4', '2026-03-20']
    ])

    const result = computeCumulativeBugData(bugs, versions, versionReleaseMap)

    const v33 = result.datasets.find(d => d.label === 'rhoai-3.3')
    const v34 = result.datasets.find(d => d.label === 'rhoai-3.4')

    // Bug counted in both versions
    expect(v33.data[2]).toBe(1)
    expect(v34.data).toEqual([0, 0, 0]) // Bug filed before 3.4 release
  })

  it('creates empty dataset for versions with no release date in map', () => {
    const bugs = [
      {
        key: 'BUG-1',
        affectedVersions: ['rhoai-3.3'],
        created: '2026-01-17T10:00:00.000Z'
      }
    ]
    const versions = ['rhoai-3.3', 'rhoai-unknown']
    const versionReleaseMap = new Map([['rhoai-3.3', '2026-01-15']])

    const result = computeCumulativeBugData(bugs, versions, versionReleaseMap)

    expect(result.datasets).toHaveLength(2)
    const unknown = result.datasets.find(d => d.label === 'rhoai-unknown')
    // Version without release date gets empty bug list, so all zeros matching maxDays
    expect(unknown.data.every(count => count === 0)).toBe(true)
  })

  it('handles same-day multiple bugs correctly', () => {
    const bugs = [
      {
        key: 'BUG-1',
        affectedVersions: ['rhoai-3.3'],
        created: '2026-01-17T08:00:00.000Z'
      },
      {
        key: 'BUG-2',
        affectedVersions: ['rhoai-3.3'],
        created: '2026-01-17T12:00:00.000Z'
      },
      {
        key: 'BUG-3',
        affectedVersions: ['rhoai-3.3'],
        created: '2026-01-17T18:00:00.000Z'
      }
    ]
    const versions = ['rhoai-3.3']
    const versionReleaseMap = new Map([['rhoai-3.3', '2026-01-15']])

    const result = computeCumulativeBugData(bugs, versions, versionReleaseMap)

    expect(result.datasets[0].data[2]).toBe(3) // All 3 bugs on day 2
  })

  it('correctly handles gaps in bug filing dates', () => {
    const bugs = [
      {
        key: 'BUG-1',
        affectedVersions: ['rhoai-3.3'],
        created: '2026-01-16T10:00:00.000Z' // Day 1
      },
      {
        key: 'BUG-2',
        affectedVersions: ['rhoai-3.3'],
        created: '2026-01-20T10:00:00.000Z' // Day 5
      }
    ]
    const versions = ['rhoai-3.3']
    const versionReleaseMap = new Map([['rhoai-3.3', '2026-01-15']])

    const result = computeCumulativeBugData(bugs, versions, versionReleaseMap)

    // Cumulative count stays at 1 for days 1-4, then increments to 2 on day 5
    expect(result.datasets[0].data).toEqual([0, 1, 1, 1, 1, 2])
  })

  it('truncates data at actual elapsed days per version', () => {
    const bugs = [
      {
        key: 'BUG-1',
        affectedVersions: ['v-old', 'v-new'],
        created: '2026-01-19T10:00:00.000Z'
      },
      {
        key: 'BUG-2',
        affectedVersions: ['v-old'],
        created: '2026-01-20T10:00:00.000Z'
      }
    ]
    const versions = ['v-old', 'v-new']
    const versionReleaseMap = new Map([
      ['v-old', '2026-01-15'],
      ['v-new', '2026-01-18']
    ])

    // Jan 21 = 6 days after v-old release, 3 days after v-new release
    const now = new Date('2026-01-21T00:00:00.000Z').getTime()
    const result = computeCumulativeBugData(bugs, versions, versionReleaseMap, { now })

    const vOld = result.datasets.find(d => d.label === 'v-old')
    const vNew = result.datasets.find(d => d.label === 'v-new')

    // v-old: released Jan 15, elapsed=6, maxDays=5 → cap=5, all points filled
    // BUG-1 at day 4 (Jan 19 - Jan 15), BUG-2 at day 5 (Jan 20 - Jan 15)
    expect(vOld.data).toEqual([0, 0, 0, 0, 1, 2])

    // v-new: released Jan 18, elapsed=3, maxDays=5 → cap=3
    // BUG-1 at day 1 (Jan 19 - Jan 18), days 4-5 should be null
    expect(vNew.data).toEqual([0, 1, 1, 1, null, null])
  })
})
