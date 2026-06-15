import { describe, it, expect } from 'vitest'

const { buildFeatureObj, extractTargetVersions } = require('../../../server/pm-hub/routes')

// ---------------------------------------------------------------------------
// buildFeatureObj
// ---------------------------------------------------------------------------

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
    pmOwner: 'Bob'
  }

  it('maps all fields from a fully-populated transformed issue', function () {
    var result = buildFeatureObj(fullInput, ['rhoai-3.5'])
    expect(result.key).toBe('RHAIENG-123')
    expect(result.summary).toBe('Add model serving support')
    expect(result.status).toBe('In Progress')
    expect(result.statusCategory).toBe('In Progress')
    expect(result.colorStatus).toBe('Green')
    expect(result.statusSummary).toBe('<p>On track</p>')
    expect(result.releaseType).toBe('Feature')
    expect(result.priority).toBe('Major')
    expect(result.isBlocked).toBe(false)
    expect(result.components).toEqual(['Inference', 'Serving'])
    expect(result.fixVersions).toEqual(['rhoai-3.5', 'rhoai-3.6'])
    expect(result.targetVersions).toEqual(['rhoai-3.5'])
    expect(result.assignee).toBe('Alice')
    expect(result.pmOwner).toBe('Bob')
  })

  it('defaults missing fields to null or empty', function () {
    var result = buildFeatureObj({ key: 'X-1' })
    expect(result.key).toBe('X-1')
    expect(result.summary).toBe('')
    expect(result.status).toBeNull()
    expect(result.statusCategory).toBeNull()
    expect(result.colorStatus).toBeNull()
    expect(result.statusSummary).toBeNull()
    expect(result.releaseType).toBeNull()
    expect(result.priority).toBeNull()
    expect(result.isBlocked).toBe(false)
    expect(result.components).toEqual([])
    expect(result.fixVersions).toEqual([])
    expect(result.targetVersions).toEqual([])
    expect(result.assignee).toBeNull()
    expect(result.pmOwner).toBeNull()
  })

  it('defaults targetVersions to empty array when not provided', function () {
    var result = buildFeatureObj(fullInput)
    expect(result.targetVersions).toEqual([])
  })

  it('passes through targetVersions array', function () {
    var tvs = ['rhoai-3.5', 'rhelai-3.5']
    var result = buildFeatureObj(fullInput, tvs)
    expect(result.targetVersions).toEqual(['rhoai-3.5', 'rhelai-3.5'])
  })

  it('includes fixVersions from the transformed issue', function () {
    var input = Object.assign({}, fullInput, { fixVersions: ['rhoai-3.6'] })
    var result = buildFeatureObj(input, [])
    expect(result.fixVersions).toEqual(['rhoai-3.6'])
  })

  it('defaults fixVersions to empty array when missing', function () {
    var input = { key: 'X-2', fixVersions: undefined }
    var result = buildFeatureObj(input, [])
    expect(result.fixVersions).toEqual([])
  })

  it('preserves isBlocked true', function () {
    var input = Object.assign({}, fullInput, { isBlocked: true })
    var result = buildFeatureObj(input, [])
    expect(result.isBlocked).toBe(true)
  })

  it('passes through priority from input', function () {
    var input = Object.assign({}, fullInput, { priority: 'Critical' })
    var result = buildFeatureObj(input, [])
    expect(result.priority).toBe('Critical')
  })

  it('defaults priority to null when missing', function () {
    var input = { key: 'X-3' }
    var result = buildFeatureObj(input, [])
    expect(result.priority).toBeNull()
  })

  it('does not include extra fields from the input', function () {
    var input = Object.assign({}, fullInput, {
      team: 'Some Team',
      linkedRfeKey: 'RHAIRFE-99',
      violations: ['missing-summary']
    })
    var result = buildFeatureObj(input, [])
    expect(result).not.toHaveProperty('team')
    expect(result).not.toHaveProperty('linkedRfeKey')
    expect(result).not.toHaveProperty('violations')
  })
})

// ---------------------------------------------------------------------------
// extractTargetVersions
// ---------------------------------------------------------------------------

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

  it('trims whitespace from version names', function () {
    var raw = { fields: { [TV_FIELD]: [{ name: '  rhoai-3.5  ' }] } }
    expect(extractTargetVersions(raw)).toEqual(['rhoai-3.5'])
  })

  it('handles mixed name and value entries', function () {
    var raw = { fields: { [TV_FIELD]: [
      { name: 'rhoai-3.5' },
      { value: 'rhelai-3.5' },
      { name: 'RHAII-3.5', value: 'ignored' }
    ] } }
    expect(extractTargetVersions(raw)).toEqual(['rhoai-3.5', 'rhelai-3.5', 'RHAII-3.5'])
  })
})
