import { describe, it, expect } from 'vitest'

const { transformIssue, CUSTOM_FIELDS } = require('../../../server/hygiene/jira-fetch')
const { findFixVersionAddedDate, findFixVersionRemovedDate, classifyFeature, normalizeVersionName, fetchDroppedFeatures } = require('../../../server/execution/feature-tracking-routes')

function makeRawIssue(overrides) {
  var fields = {}
  fields.summary = 'Test feature'
  fields.issuetype = { name: 'Feature' }
  fields.status = { name: 'In Progress', statusCategory: { name: 'In Progress' } }
  fields.assignee = { displayName: 'Jane Doe' }
  fields.fixVersions = [{ name: 'rhoai-3.5.EA1' }]
  fields.components = [{ name: 'Model Serving' }]
  fields.labels = []
  fields.issuelinks = []
  fields[CUSTOM_FIELDS.team] = { name: 'Model Serving' }
  fields[CUSTOM_FIELDS.colorStatus] = { value: 'Green' }

  if (overrides) {
    Object.assign(fields, overrides)
  }

  return {
    key: 'RHAISTRAT-100',
    fields: fields,
    renderedFields: {}
  }
}

// ─── isBlocked derivation ──────────────────────────────────────────

describe('transformIssue — isBlocked', function () {
  it('sets isBlocked=false when no issue links exist', function () {
    var result = transformIssue(makeRawIssue(), {})
    expect(result.isBlocked).toBe(false)
  })

  it('sets isBlocked=true when an unresolved inward Blocks link exists', function () {
    var result = transformIssue(makeRawIssue({
      issuelinks: [{
        type: { name: 'Blocks', inward: 'is blocked by' },
        inwardIssue: {
          key: 'RHOAIENG-500',
          fields: { status: { name: 'In Progress' } }
        }
      }]
    }), {})
    expect(result.isBlocked).toBe(true)
  })

  it('sets isBlocked=false when blocking issue is Closed', function () {
    var result = transformIssue(makeRawIssue({
      issuelinks: [{
        type: { name: 'Blocks', inward: 'is blocked by' },
        inwardIssue: {
          key: 'RHOAIENG-500',
          fields: { status: { name: 'Closed' } }
        }
      }]
    }), {})
    expect(result.isBlocked).toBe(false)
  })

  it('sets isBlocked=false when blocking issue is Resolved', function () {
    var result = transformIssue(makeRawIssue({
      issuelinks: [{
        type: { name: 'Blocks', inward: 'is blocked by' },
        inwardIssue: {
          key: 'RHOAIENG-500',
          fields: { status: { name: 'Resolved' } }
        }
      }]
    }), {})
    expect(result.isBlocked).toBe(false)
  })

  it('sets isBlocked=false when blocking issue is Done', function () {
    var result = transformIssue(makeRawIssue({
      issuelinks: [{
        type: { name: 'Blocks', inward: 'is blocked by' },
        inwardIssue: {
          key: 'RHOAIENG-500',
          fields: { status: { name: 'Done' } }
        }
      }]
    }), {})
    expect(result.isBlocked).toBe(false)
  })

  it('ignores outward Blocks links (this issue blocks something else)', function () {
    var result = transformIssue(makeRawIssue({
      issuelinks: [{
        type: { name: 'Blocks', outward: 'blocks' },
        outwardIssue: {
          key: 'RHOAIENG-600',
          fields: { status: { name: 'In Progress' } }
        }
      }]
    }), {})
    expect(result.isBlocked).toBe(false)
  })

  it('ignores non-Blocks link types', function () {
    var result = transformIssue(makeRawIssue({
      issuelinks: [{
        type: { name: 'Relates', inward: 'relates to' },
        inwardIssue: {
          key: 'RHOAIENG-700',
          fields: { status: { name: 'In Progress' } }
        }
      }]
    }), {})
    expect(result.isBlocked).toBe(false)
  })

  it('detects blocked via "is blocked by" inward label', function () {
    var result = transformIssue(makeRawIssue({
      issuelinks: [{
        type: { name: 'SomeType', inward: 'is blocked by' },
        inwardIssue: {
          key: 'RHOAIENG-800',
          fields: { status: { name: 'To Do' } }
        }
      }]
    }), {})
    expect(result.isBlocked).toBe(true)
  })
})

// ─── pmOwner derivation ────────────────────────────────────────────

describe('transformIssue — pmOwner', function () {
  it('extracts pmOwner from productManager custom field', function () {
    var overrides = {}
    overrides[CUSTOM_FIELDS.productManager] = { displayName: 'Bob Smith' }
    var result = transformIssue(makeRawIssue(overrides), {})
    expect(result.pmOwner).toBe('Bob Smith')
  })

  it('returns null when productManager field is not set', function () {
    var result = transformIssue(makeRawIssue(), {})
    expect(result.pmOwner).toBeNull()
  })

  it('returns null when productManager field is null', function () {
    var overrides = {}
    overrides[CUSTOM_FIELDS.productManager] = null
    var result = transformIssue(makeRawIssue(overrides), {})
    expect(result.pmOwner).toBeNull()
  })
})

// ─── productManager custom field ID ────────────────────────────────

describe('CUSTOM_FIELDS', function () {
  it('includes productManager field ID', function () {
    expect(CUSTOM_FIELDS.productManager).toBe('customfield_10469')
  })
})

// ─── findFixVersionAddedDate ──────────────────────────────────────

describe('findFixVersionAddedDate', function () {
  it('returns the timestamp when fixVersion was added', function () {
    var changelog = {
      histories: [{
        created: '2026-05-15T10:30:00.000+0000',
        items: [{
          field: 'Fix Version',
          fieldId: 'fixVersions',
          toString: 'rhoai-3.5.EA1'
        }]
      }]
    }
    expect(findFixVersionAddedDate(changelog, 'rhoai-3.5.EA1')).toBe('2026-05-15T10:30:00.000+0000')
  })

  it('returns null when fixVersion not found in changelog', function () {
    var changelog = {
      histories: [{
        created: '2026-05-15T10:30:00.000+0000',
        items: [{
          field: 'Fix Version',
          fieldId: 'fixVersions',
          toString: 'rhoai-3.5.EA2'
        }]
      }]
    }
    expect(findFixVersionAddedDate(changelog, 'rhoai-3.5.EA1')).toBeNull()
  })

  it('returns null when changelog is empty', function () {
    expect(findFixVersionAddedDate({ histories: [] }, 'rhoai-3.5.EA1')).toBeNull()
  })

  it('returns null when changelog is null', function () {
    expect(findFixVersionAddedDate(null, 'rhoai-3.5.EA1')).toBeNull()
  })

  it('matches case-insensitively', function () {
    var changelog = {
      histories: [{
        created: '2026-05-15T10:30:00.000+0000',
        items: [{
          field: 'Fix Version',
          fieldId: 'fixVersions',
          toString: 'RHOAI-3.5.EA1'
        }]
      }]
    }
    expect(findFixVersionAddedDate(changelog, 'rhoai-3.5.EA1')).toBe('2026-05-15T10:30:00.000+0000')
  })

  it('matches any version in an array of fixVersion names', function () {
    var changelog = {
      histories: [{
        created: '2026-05-15T10:30:00.000+0000',
        items: [{
          field: 'Fix Version',
          fieldId: 'fixVersions',
          toString: 'rhelai-3.5 EA2 release'
        }]
      }]
    }
    expect(findFixVersionAddedDate(changelog, ['rhelai-3.5EA2', 'rhelai-3.5 EA2 release'])).toBe('2026-05-15T10:30:00.000+0000')
  })
})

// ─── findFixVersionRemovedDate ────────────────────────────────────

describe('findFixVersionRemovedDate', function () {
  it('returns the timestamp when fixVersion was removed', function () {
    var changelog = {
      histories: [{
        created: '2026-05-20T14:00:00.000+0000',
        items: [{
          field: 'Fix Version',
          fieldId: 'fixVersions',
          fromString: 'rhoai-3.5.EA1',
          toString: ''
        }]
      }]
    }
    expect(findFixVersionRemovedDate(changelog, 'rhoai-3.5.EA1')).toBe('2026-05-20T14:00:00.000+0000')
  })

  it('returns the most recent removal when fixVersion was removed multiple times', function () {
    var changelog = {
      histories: [
        {
          created: '2026-05-10T10:00:00.000+0000',
          items: [{
            field: 'Fix Version',
            fieldId: 'fixVersions',
            fromString: 'rhoai-3.5.EA1',
            toString: ''
          }]
        },
        {
          created: '2026-05-20T14:00:00.000+0000',
          items: [{
            field: 'Fix Version',
            fieldId: 'fixVersions',
            fromString: 'rhoai-3.5.EA1',
            toString: 'rhoai-3.6'
          }]
        }
      ]
    }
    expect(findFixVersionRemovedDate(changelog, 'rhoai-3.5.EA1')).toBe('2026-05-20T14:00:00.000+0000')
  })

  it('returns null when fixVersion was never removed', function () {
    var changelog = {
      histories: [{
        created: '2026-05-15T10:00:00.000+0000',
        items: [{
          field: 'Fix Version',
          fieldId: 'fixVersions',
          fromString: '',
          toString: 'rhoai-3.5.EA1'
        }]
      }]
    }
    expect(findFixVersionRemovedDate(changelog, 'rhoai-3.5.EA1')).toBeNull()
  })

  it('matches any version in an array of fixVersion names', function () {
    var changelog = {
      histories: [{
        created: '2026-05-20T14:00:00.000+0000',
        items: [{
          field: 'Fix Version',
          fieldId: 'fixVersions',
          fromString: 'rhelai-3.5 EA2 release',
          toString: ''
        }]
      }]
    }
    expect(findFixVersionRemovedDate(changelog, ['rhelai-3.5EA2', 'rhelai-3.5 EA2 release'])).toBe('2026-05-20T14:00:00.000+0000')
  })

  it('matches case-insensitively', function () {
    var changelog = {
      histories: [{
        created: '2026-05-20T14:00:00.000+0000',
        items: [{
          field: 'Fix Version',
          fieldId: 'fixVersions',
          fromString: 'RHOAI-3.5.EA1',
          toString: ''
        }]
      }]
    }
    expect(findFixVersionRemovedDate(changelog, 'rhoai-3.5.EA1')).toBe('2026-05-20T14:00:00.000+0000')
  })

  it('returns null when changelog is null', function () {
    expect(findFixVersionRemovedDate(null, 'rhoai-3.5.EA1')).toBeNull()
  })

  it('returns null when changelog is empty', function () {
    expect(findFixVersionRemovedDate({ histories: [] }, 'rhoai-3.5.EA1')).toBeNull()
  })
})

// ─── classifyFeature ──────────────────────────────────────────────

describe('classifyFeature', function () {
  it('returns "added" when fixVersion was applied after freeze date', function () {
    var feature = { fixVersionAddedAt: '2026-06-01T10:00:00.000+0000' }
    expect(classifyFeature(feature, '2026-05-20')).toBe('added')
  })

  it('returns null when fixVersion was applied before freeze date', function () {
    var feature = { fixVersionAddedAt: '2026-05-10T10:00:00.000+0000' }
    expect(classifyFeature(feature, '2026-05-20')).toBeNull()
  })

  it('returns null when no freeze date is available', function () {
    var feature = { fixVersionAddedAt: '2026-06-01T10:00:00.000+0000' }
    expect(classifyFeature(feature, null)).toBeNull()
  })

  it('returns null when fixVersionAddedAt is not available', function () {
    var feature = { fixVersionAddedAt: null }
    expect(classifyFeature(feature, '2026-05-20')).toBeNull()
  })
})

// ─── normalizeVersionName ─────────────────────────────────────────

describe('normalizeVersionName', function () {
  it('normalizes dot-separated EA tag (rhoai style)', function () {
    expect(normalizeVersionName('rhoai-3.5.EA2')).toBe('rhoai-3.5ea2')
  })

  it('normalizes space-separated EA tag (RHAII style)', function () {
    expect(normalizeVersionName('RHAII-3.5 EA2')).toBe('rhaii-3.5ea2')
  })

  it('normalizes concatenated EA tag (rhelai style)', function () {
    expect(normalizeVersionName('rhelai-3.5EA2')).toBe('rhelai-3.5ea2')
  })

  it('strips trailing "release" suffix', function () {
    expect(normalizeVersionName('rhelai-3.5 EA2 release')).toBe('rhelai-3.5ea2')
  })

  it('normalizes hyphenated EA tag (RHELAI-3.4 EA-1)', function () {
    expect(normalizeVersionName('RHELAI-3.4 EA-1')).toBe('rhelai-3.4ea1')
  })

  it('normalizes GA versions consistently', function () {
    expect(normalizeVersionName('rhoai-3.5')).toBe('rhoai-3.5')
    expect(normalizeVersionName('RHAII-3.5')).toBe('rhaii-3.5')
  })

  it('normalizes space-separated GA tag', function () {
    expect(normalizeVersionName('RHAII-3.5 GA')).toBe('rhaii-3.5ga')
    expect(normalizeVersionName('RHAII-3.5 ga')).toBe('rhaii-3.5ga')
  })

  it('strips .z notation from z-stream releases', function () {
    expect(normalizeVersionName('rhoai-3.5.z')).toBe('rhoai-3.5')
    expect(normalizeVersionName('rhoai-3.5.z.EA1')).toBe('rhoai-3.5ea1')
    expect(normalizeVersionName('RHAI-3.6.z.EA2')).toBe('rhai-3.6ea2')
    expect(normalizeVersionName('rhelai-3.5.z EA2 release')).toBe('rhelai-3.5ea2')
  })

  it('handles null/empty gracefully', function () {
    expect(normalizeVersionName(null)).toBe('')
    expect(normalizeVersionName('')).toBe('')
  })
})

// ─── fetchDroppedFeatures — freeze date filtering ─────────────────

describe('fetchDroppedFeatures — freeze date filtering', function () {
  function makeDroppedRawIssue(key, removedAt) {
    return {
      key: key,
      fields: {
        summary: 'Dropped feature ' + key,
        issuetype: { name: 'Feature' },
        status: { name: 'In Progress', statusCategory: { name: 'In Progress' } },
        assignee: { displayName: 'Jane Doe' },
        fixVersions: [],
        components: [{ name: 'Model Serving' }],
        labels: [],
        issuelinks: []
      },
      renderedFields: {},
      changelog: {
        histories: [{
          created: removedAt,
          items: [{
            field: 'Fix Version',
            fieldId: 'fixVersions',
            fromString: 'rhoai-3.5.EA2',
            toString: ''
          }]
        }]
      }
    }
  }

  var mockJiraRequest = function () {}

  function makeFetchAll(rawIssues) {
    return async function () { return rawIssues }
  }

  it('includes features removed after the freeze date', async function () {
    var issues = [makeDroppedRawIssue('RHAISTRAT-200', '2026-05-25T10:00:00.000+0000')]
    var result = await fetchDroppedFeatures('rhoai-3.5.EA2', mockJiraRequest, makeFetchAll(issues), {}, '2026-05-20')
    expect(result).toHaveLength(1)
    expect(result[0].key).toBe('RHAISTRAT-200')
    expect(result[0].scopeChange).toBe('dropped')
  })

  it('excludes features removed before the freeze date', async function () {
    var issues = [makeDroppedRawIssue('RHAISTRAT-201', '2026-05-15T10:00:00.000+0000')]
    var result = await fetchDroppedFeatures('rhoai-3.5.EA2', mockJiraRequest, makeFetchAll(issues), {}, '2026-05-20')
    expect(result).toHaveLength(0)
  })

  it('includes features removed on the same day as the freeze date', async function () {
    var issues = [makeDroppedRawIssue('RHAISTRAT-202', '2026-05-20T08:00:00.000+0000')]
    var result = await fetchDroppedFeatures('rhoai-3.5.EA2', mockJiraRequest, makeFetchAll(issues), {}, '2026-05-20')
    expect(result).toHaveLength(1)
    expect(result[0].scopeChange).toBe('dropped')
  })

  it('shows all dropped features when no freeze date is provided', async function () {
    var issues = [
      makeDroppedRawIssue('RHAISTRAT-203', '2026-04-01T10:00:00.000+0000'),
      makeDroppedRawIssue('RHAISTRAT-204', '2026-06-01T10:00:00.000+0000')
    ]
    var result = await fetchDroppedFeatures('rhoai-3.5.EA2', mockJiraRequest, makeFetchAll(issues), {}, null)
    expect(result).toHaveLength(2)
    expect(result.every(function (f) { return f.scopeChange === 'dropped' })).toBe(true)
  })

  it('excludes features with no changelog when freeze date is set', async function () {
    var issue = {
      key: 'RHAISTRAT-205',
      fields: {
        summary: 'No changelog feature',
        issuetype: { name: 'Feature' },
        status: { name: 'In Progress', statusCategory: { name: 'In Progress' } },
        assignee: null,
        fixVersions: [],
        components: [],
        labels: [],
        issuelinks: []
      },
      renderedFields: {},
      changelog: { histories: [] }
    }
    var result = await fetchDroppedFeatures('rhoai-3.5.EA2', mockJiraRequest, makeFetchAll([issue]), {}, '2026-05-20')
    expect(result).toHaveLength(0)
  })

  it('skips issues already in currentKeys', async function () {
    var issues = [makeDroppedRawIssue('RHAISTRAT-206', '2026-05-25T10:00:00.000+0000')]
    var result = await fetchDroppedFeatures('rhoai-3.5.EA2', mockJiraRequest, makeFetchAll(issues), { 'RHAISTRAT-206': true }, '2026-05-20')
    expect(result).toHaveLength(0)
  })
})
