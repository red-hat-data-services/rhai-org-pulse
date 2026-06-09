import { describe, it, expect } from 'vitest'

const { computeFieldDiff } = require('../../../server/planning/audit-log')

describe('computeFieldDiff', function() {
  it('returns null when before is null', function() {
    expect(computeFieldDiff(null, { name: 'a' })).toBeNull()
  })

  it('returns null when after is null', function() {
    expect(computeFieldDiff({ name: 'a' }, null)).toBeNull()
  })

  it('returns null when both are null', function() {
    expect(computeFieldDiff(null, null)).toBeNull()
  })

  it('returns null when no fields changed', function() {
    var obj = { name: 'Rock', pillar: 'Platform' }
    expect(computeFieldDiff(obj, obj)).toBeNull()
  })

  it('detects changed fields', function() {
    var before = { name: 'Old Name', pillar: 'Platform' }
    var after = { name: 'New Name', pillar: 'Platform' }
    var diff = computeFieldDiff(before, after)
    expect(diff).toEqual({ name: { from: 'Old Name', to: 'New Name' } })
  })

  it('detects added fields', function() {
    var before = { name: 'Rock' }
    var after = { name: 'Rock', pillar: 'Platform' }
    var diff = computeFieldDiff(before, after)
    expect(diff).toEqual({ pillar: { from: undefined, to: 'Platform' } })
  })

  it('detects removed fields', function() {
    var before = { name: 'Rock', pillar: 'Platform' }
    var after = { name: 'Rock' }
    var diff = computeFieldDiff(before, after)
    expect(diff).toEqual({ pillar: { from: 'Platform', to: undefined } })
  })

  it('handles array field changes', function() {
    var before = { jiraKeys: ['RHOAIENG-100'] }
    var after = { jiraKeys: ['RHOAIENG-100', 'RHOAIENG-200'] }
    var diff = computeFieldDiff(before, after)
    expect(diff).toEqual({
      jiraKeys: {
        from: ['RHOAIENG-100'],
        to: ['RHOAIENG-100', 'RHOAIENG-200']
      }
    })
  })

  it('handles nested object changes', function() {
    var before = { config: { key: 'a' } }
    var after = { config: { key: 'b' } }
    var diff = computeFieldDiff(before, after)
    expect(diff).toEqual({
      config: { from: { key: 'a' }, to: { key: 'b' } }
    })
  })

  it('handles multiple changed fields', function() {
    var before = { name: 'Old', pillar: 'P1', owner: 'Alice' }
    var after = { name: 'New', pillar: 'P2', owner: 'Alice' }
    var diff = computeFieldDiff(before, after)
    expect(diff).toEqual({
      name: { from: 'Old', to: 'New' },
      pillar: { from: 'P1', to: 'P2' }
    })
  })

  it('treats identical arrays as unchanged', function() {
    var before = { keys: ['A', 'B'] }
    var after = { keys: ['A', 'B'] }
    expect(computeFieldDiff(before, after)).toBeNull()
  })

  it('treats empty objects as unchanged', function() {
    expect(computeFieldDiff({}, {})).toBeNull()
  })
})
