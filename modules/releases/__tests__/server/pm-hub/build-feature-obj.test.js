import { describe, it, expect } from 'vitest'

const {
  buildFeatureObj,
  extractTargetVersions,
  computePmDoAligned,
  versionsStrictMatch
} = require('../../../server/pm-hub/routes')

describe('buildFeatureObj', function () {
  var fullInput = {
    key: 'RHAIENG-123',
    summary: 'Add model serving support',
    status: 'In Progress',
    statusCategory: 'In Progress',
    colorStatus: 'Green',
    statusSummary: '<p>On track</p>',
    releaseType: 'Feature',
    priority: 'Major',
    isBlocked: false,
    components: ['Inference', 'Serving'],
    fixVersions: ['rhoai-3.5', 'rhoai-3.6'],
    assignee: 'Alice',
    pmOwner: 'Bob',
    labels: ['strat-creator-auto-created'],
    riceScore: 12,
    docsRequired: 'Yes',
    linkedRfeKey: 'RHAIRFE-1'
  }

  it('maps core fields and attaches FPDoR + alignment', function () {
    var result = buildFeatureObj(fullInput, ['rhoai-3.5'])
    expect(result.key).toBe('RHAIENG-123')
    expect(result.summary).toBe('Add model serving support')
    expect(result.title).toBe('Add model serving support')
    expect(result.targetVersions).toEqual(['rhoai-3.5'])
    expect(result.fixVersions).toEqual(['rhoai-3.5', 'rhoai-3.6'])
    expect(result.pmDoAligned).toBe(true)
    expect(result.fpdor).toBeTruthy()
    expect(Array.isArray(result.fpdor.items)).toBe(true)
    expect(result.fpdor.totalCount).toBe(17)
    expect(result.isAiFirst).toBe(true)
    expect(result.confidence).toBeTruthy()
    expect(result.labels).toEqual(['strat-creator-auto-created'])
  })

  it('defaults missing fields to null or empty', function () {
    var result = buildFeatureObj({ key: 'X-1' })
    expect(result.key).toBe('X-1')
    expect(result.summary).toBe('')
    expect(result.pmDoAligned).toBe(false)
    expect(result.isAiFirst).toBe(false)
    expect(result.fpdor).toBeTruthy()
    expect(result.confidence).toBe('not-ready')
  })

  it('marks pmDoAligned false when TV/FV mismatch', function () {
    var result = buildFeatureObj(fullInput, ['rhoai-3.7'])
    expect(result.pmDoAligned).toBe(false)
  })

  it('does not include unrelated hygiene fields', function () {
    var input = Object.assign({}, fullInput, {
      team: 'Some Team',
      violations: ['missing-summary']
    })
    var result = buildFeatureObj(input, [])
    expect(result).not.toHaveProperty('team')
    expect(result).not.toHaveProperty('violations')
    expect(result.linkedRfeKey).toBe('RHAIRFE-1')
  })

  it('passes Child epics when execution index has epicCount', function () {
    var input = Object.assign({}, fullInput, { openChildCount: 0 })
    var result = buildFeatureObj(input, ['rhoai-3.5'], null, { 'RHAIENG-123': 1 })
    var childEpics = result.fpdor.items.find(function (item) {
      return item.name === 'Child epics'
    })
    expect(childEpics).toBeTruthy()
    expect(childEpics.pass).toBe(true)
    expect(childEpics.detail).toMatch(/linked child epics/i)
  })

  it('ignores hygiene openChildCount for Child epics FPDoR', function () {
    var input = Object.assign({}, fullInput, { openChildCount: 5 })
    var result = buildFeatureObj(input, ['rhoai-3.5'], null, {})
    var childEpics = result.fpdor.items.find(function (item) {
      return item.name === 'Child epics'
    })
    expect(childEpics).toBeTruthy()
    expect(childEpics.pass).toBe(false)
  })

  it('uses f.epicCount when no execution map entry', function () {
    var input = Object.assign({}, fullInput, { epicCount: 2, openChildCount: 0 })
    var result = buildFeatureObj(input, ['rhoai-3.5'])
    var childEpics = result.fpdor.items.find(function (item) {
      return item.name === 'Child epics'
    })
    expect(childEpics.pass).toBe(true)
  })
})

describe('resolveEpicCount', function () {
  const { resolveEpicCount, loadEpicCountByKey } = require('../../../server/pm-hub/routes')

  it('prefers execution map over feature.epicCount', function () {
    expect(resolveEpicCount({ key: 'A-1', epicCount: 9 }, { 'A-1': 1 })).toBe(1)
  })

  it('returns 0 when map has explicit zero', function () {
    expect(resolveEpicCount({ key: 'A-1', epicCount: 9 }, { 'A-1': 0 })).toBe(0)
  })

  it('falls back to feature.epicCount when key missing from map', function () {
    expect(resolveEpicCount({ key: 'A-1', epicCount: 3 }, {})).toBe(3)
  })

  it('does not use openChildCount', function () {
    expect(resolveEpicCount({ key: 'A-1', openChildCount: 7 }, {})).toBe(0)
  })

  it('loadEpicCountByKey maps execution index epicCount by key', async function () {
    var readFromStorage = async function (path) {
      if (path === 'releases/execution/index.json') {
        return {
          features: [
            { key: 'RHAISTRAT-2318', epicCount: 1 },
            { key: 'RHAISTRAT-1', epicCount: 0 }
          ]
        }
      }
      return null
    }
    var map = await loadEpicCountByKey(readFromStorage)
    expect(map['RHAISTRAT-2318']).toBe(1)
    expect(map['RHAISTRAT-1']).toBe(0)
  })
})

describe('computePmDoAligned / versionsStrictMatch', function () {
  it('returns true for exact string match', function () {
    expect(versionsStrictMatch('rhoai-3.5', 'rhoai-3.5')).toBe(true)
    expect(computePmDoAligned(['rhoai-3.5'], ['rhoai-3.5'])).toBe(true)
  })

  it('returns false when either side is missing', function () {
    expect(computePmDoAligned([], ['rhoai-3.5'])).toBe(false)
    expect(computePmDoAligned(['rhoai-3.5'], [])).toBe(false)
  })

  it('returns false for early delivery (FV before TV in same cycle)', function () {
    // EA1 FV vs GA TV should not be strict match
    expect(computePmDoAligned(['3.5 EA1 RHOAI RELEASE'], ['3.5 GA RHOAI RELEASE'])).toBe(false)
  })

  it('returns true when any FV matches any TV', function () {
    expect(computePmDoAligned(['rhoai-3.4', 'rhoai-3.5'], ['rhoai-3.5', 'rhoai-3.6'])).toBe(true)
  })
})

describe('extractTargetVersions', function () {
  var TV_FIELD = 'customfield_10855'

  it('extracts target version names from array field', function () {
    var raw = { fields: { [TV_FIELD]: [{ name: 'rhoai-3.5' }, { name: 'rhelai-3.5' }] } }
    expect(extractTargetVersions(raw)).toEqual(['rhoai-3.5', 'rhelai-3.5'])
  })

  it('extracts from single object (non-array) field', function () {
    var raw = { fields: { [TV_FIELD]: { name: 'rhoai-3.6' } } }
    expect(extractTargetVersions(raw)).toEqual(['rhoai-3.6'])
  })

  it('uses value property when name is missing', function () {
    var raw = { fields: { [TV_FIELD]: [{ value: 'rhoai-3.5' }] } }
    expect(extractTargetVersions(raw)).toEqual(['rhoai-3.5'])
  })

  it('prefers name over value', function () {
    var raw = { fields: { [TV_FIELD]: [{ name: 'rhoai-3.5', value: 'rhoai-3.5-alt' }] } }
    expect(extractTargetVersions(raw)).toEqual(['rhoai-3.5'])
  })

  it('returns empty array when field is missing', function () {
    var raw = { fields: {} }
    expect(extractTargetVersions(raw)).toEqual([])
  })

  it('returns empty array when fields is missing', function () {
    var raw = {}
    expect(extractTargetVersions(raw)).toEqual([])
  })

  it('returns empty array when field is null', function () {
    var raw = { fields: { [TV_FIELD]: null } }
    expect(extractTargetVersions(raw)).toEqual([])
  })

  it('returns empty array when field is empty array', function () {
    var raw = { fields: { [TV_FIELD]: [] } }
    expect(extractTargetVersions(raw)).toEqual([])
  })

  it('skips entries with null name and value', function () {
    var raw = { fields: { [TV_FIELD]: [{ name: 'rhoai-3.5' }, null, { name: null }] } }
    expect(extractTargetVersions(raw)).toEqual(['rhoai-3.5'])
  })
})

describe('attachAlignment', function () {
  var attachAlignment = require('../../../server/pm-hub/routes').attachAlignment

  it('marks early delivery as aligned_on_time for the TV release', function () {
    var base = buildFeatureObj({
      key: 'X-1',
      fixVersions: ['rhoai-3.5'],
      summary: 'Early'
    }, ['rhoai-3.6'])
    var row = attachAlignment(Object.assign({}, base), 'rhoai-3.6', {})
    expect(row.alignmentCategory).toBe('aligned_on_time')
    expect(row.pmDoAligned).toBe(true)
  })

  it('marks TV-only as not aligned', function () {
    var base = buildFeatureObj({ key: 'X-2', fixVersions: [], summary: 'TV' }, ['rhoai-3.6'])
    var row = attachAlignment(Object.assign({}, base), 'rhoai-3.6', {})
    expect(row.alignmentCategory).toBe('tv_only')
    expect(row.pmDoAligned).toBe(false)
  })
})
