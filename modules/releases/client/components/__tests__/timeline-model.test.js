import { describe, expect, it, vi } from 'vitest'
import { buildTimelineNodes, cycleFromGroupLabel, groupKey } from '../timeline-model.js'

function release(id, opts = {}) {
  return {
    id,
    displayName: opts.displayName === undefined ? id : opts.displayName,
    productPagesShortname: opts.shortname === undefined ? 'rhoai' : opts.shortname,
    milestones: opts.milestones || {}
  }
}

describe('timeline-model', function () {
  it('uses parsed product-family names before ids', function () {
    expect(groupKey(release('fallback-3.6', { displayName: '3.6 EA1 RHELAI RELEASE' })))
      .toBe('rhelai-3.6-EA1')
  })

  it('falls back to the id cycle and milestone', function () {
    expect(groupKey(release('rhaii-3.6.EA2', { displayName: 'unparseable', shortname: 'rhaii' })))
      .toBe('rhaii-3.6-EA2')
    expect(groupKey(release('rhoai-3.6', { displayName: 'unparseable', shortname: 'rhoai' })))
      .toBe('rhoai-3.6-GA')
    expect(groupKey(release('release-3.6', { displayName: 'unparseable', shortname: 'custom' })))
      .toBe('custom-3.6-GA')
  })

  it('falls back to the display name, id, or other', function () {
    expect(groupKey(release('custom', { displayName: 'Infrastructure Refresh', shortname: null })))
      .toBe('Infrastructure Refresh')
    expect(groupKey(release('custom', { displayName: '', shortname: null }))).toBe('custom')
    expect(groupKey({})).toBe('other')
  })

  it('handles invalid dates while consolidating source metadata', function () {
    var nodes = buildTimelineNodes([
      { id: 'invalid-a', displayName: 'Invalid A', milestones: { ga: 'not-a-date' } },
      { id: 'invalid-b', displayName: 'Invalid B', milestones: { ga: 'also-invalid' } },
      { id: 'rhoai-3.6', displayName: 'rhoai-3.6', milestones: { ga: '2026-10-01' } },
      {}
    ])
    expect(nodes).toHaveLength(3)
    expect(nodes.every(function (node) { return node.date })).toBe(true)
  })

  it('extracts a cycle prefix only when the label starts with one', function () {
    expect(cycleFromGroupLabel('3.6 GA')).toBe('3.6')
    expect(cycleFromGroupLabel('Infrastructure Refresh')).toBe('Infrastructure Refresh')
  })

  it('builds sorted milestone nodes and preserves source releases', function () {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-21T00:00:00'))
    try {
      var nodes = buildTimelineNodes([
        release('rhoai-3.6', {
          milestones: { planningFreeze: '2026-09-23', ga: '2026-10-01' }
        }),
        release('rhelai-3.6', {
          shortname: 'rhelai',
          milestones: { planningFreeze: '2026-09-23', ga: '2026-10-01' }
        })
      ])
      expect(nodes.map(function (n) { return n.date })).toEqual(['2026-09-23', '2026-09-23', '2026-10-01', '2026-10-01'])
      expect(nodes[0].isPast).toBe(false)
      expect(nodes[0].releases).toHaveLength(1)
      expect(nodes[0].productList).toEqual(['rhoai'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('merges same-product milestones sharing a date and handles missing milestones', function () {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-21T00:00:00'))
    try {
      var nodes = buildTimelineNodes([
        release('rhoai-3.6', {
          milestones: { planningFreeze: '2026-09-23', featureFreeze: '2026-09-23' }
        }),
        release('rhoai-3.6', {
          milestones: { planningFreeze: '2026-09-23', ga: '2026-09-23' }
        })
      ])
      expect(nodes).toHaveLength(1)
      expect(nodes.some(function (n) { return n.isGa })).toBe(true)
      expect(nodes[0].releases).toHaveLength(6)
    } finally {
      vi.useRealTimers()
    }
  })
})
