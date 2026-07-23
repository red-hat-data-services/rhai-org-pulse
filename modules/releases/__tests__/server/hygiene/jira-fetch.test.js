import { describe, it, expect } from 'vitest'

const {
  serializeField,
  computeRiceStatus,
  extractClonesLinks,
  parseChangelog,
  transformIssue,
  CUSTOM_FIELDS,
  numericField
} = require('../../../server/hygiene/jira-fetch')

// ─── serializeField ──────────────────────────────────────────────────

describe('serializeField', function () {
  it('returns null for null', function () {
    expect(serializeField(null)).toBeNull()
  })

  it('returns null for undefined', function () {
    expect(serializeField(undefined)).toBeNull()
  })

  it('returns string as-is', function () {
    expect(serializeField('Green')).toBe('Green')
  })

  it('extracts .name from object', function () {
    expect(serializeField({ name: 'Model Serving' })).toBe('Model Serving')
  })

  it('extracts .value from object', function () {
    expect(serializeField({ value: 'GA' })).toBe('GA')
  })

  it('prefers .name over .value', function () {
    expect(serializeField({ name: 'NameVal', value: 'ValueVal' })).toBe('NameVal')
  })

  it('returns null for empty array', function () {
    expect(serializeField([])).toBeNull()
  })

  it('extracts .name from first array element', function () {
    expect(serializeField([{ name: 'First' }, { name: 'Second' }])).toBe('First')
  })

  it('extracts .value from first array element', function () {
    expect(serializeField([{ value: 'Val1' }])).toBe('Val1')
  })

  it('stringifies first array element without name/value', function () {
    expect(serializeField([42])).toBe('42')
  })

  it('stringifies object without name or value', function () {
    expect(serializeField({ id: 123 })).toBe('[object Object]')
  })

  it('stringifies a number', function () {
    expect(serializeField(99)).toBe('99')
  })
})


// ─── numericField ────────────────────────────────────────────────────

describe('numericField', function () {
  it('returns null for null/undefined', function () {
    expect(numericField(null)).toBeNull()
    expect(numericField(undefined)).toBeNull()
  })

  it('returns plain number as-is', function () {
    expect(numericField(42)).toBe(42)
    expect(numericField(3.14)).toBe(3.14)
    expect(numericField(0)).toBe(0)
  })

  it('unwraps Jira object format { value: N }', function () {
    expect(numericField({ value: 100 })).toBe(100)
    expect(numericField({ value: 4.5 })).toBe(4.5)
    expect(numericField({ value: 0 })).toBe(0)
  })

  it('returns null for object with null value', function () {
    expect(numericField({ value: null })).toBeNull()
  })

  it('returns null for non-numeric values', function () {
    expect(numericField('not-a-number')).toBeNull()
    expect(numericField({ value: 'abc' })).toBeNull()
  })

  it('coerces numeric strings', function () {
    expect(numericField('42')).toBe(42)
    expect(numericField({ value: '3.14' })).toBe(3.14)
  })
})
// ─── computeRiceStatus ──────────────────────────────────────────────

describe('computeRiceStatus', function () {
  it('returns complete when all 4 RICE fields present', function () {
    var fields = {}
    fields[CUSTOM_FIELDS.reach] = 100
    fields[CUSTOM_FIELDS.impact] = 2
    fields[CUSTOM_FIELDS.confidence] = 80
    fields[CUSTOM_FIELDS.effort] = 4
    expect(computeRiceStatus(fields)).toBe('complete')
  })

  it('returns partial when some RICE fields present', function () {
    var fields = {}
    fields[CUSTOM_FIELDS.reach] = 100
    fields[CUSTOM_FIELDS.impact] = null
    fields[CUSTOM_FIELDS.confidence] = 80
    fields[CUSTOM_FIELDS.effort] = null
    expect(computeRiceStatus(fields)).toBe('partial')
  })

  it('returns none when no RICE fields present', function () {
    var fields = {}
    fields[CUSTOM_FIELDS.reach] = null
    fields[CUSTOM_FIELDS.impact] = null
    fields[CUSTOM_FIELDS.confidence] = null
    fields[CUSTOM_FIELDS.effort] = null
    expect(computeRiceStatus(fields)).toBe('none')
  })

  it('returns none when RICE fields are undefined', function () {
    expect(computeRiceStatus({})).toBe('none')
  })

  it('counts zero as a non-null value', function () {
    var fields = {}
    fields[CUSTOM_FIELDS.reach] = 0
    fields[CUSTOM_FIELDS.impact] = 0
    fields[CUSTOM_FIELDS.confidence] = 0
    fields[CUSTOM_FIELDS.effort] = 0
    expect(computeRiceStatus(fields)).toBe('complete')
  })

  it('returns partial with 1 field', function () {
    var fields = {}
    fields[CUSTOM_FIELDS.reach] = 50
    expect(computeRiceStatus(fields)).toBe('partial')
  })
})

// ─── extractClonesLinks ─────────────────────────────────────────────

describe('extractClonesLinks', function () {
  it('returns empty array for null', function () {
    expect(extractClonesLinks(null)).toEqual([])
  })

  it('returns empty array for non-array', function () {
    expect(extractClonesLinks('not-an-array')).toEqual([])
  })

  it('returns empty array for empty array', function () {
    expect(extractClonesLinks([])).toEqual([])
  })

  it('extracts outward clones links', function () {
    var links = [
      {
        type: { outward: 'clones', name: 'Cloners' },
        outwardIssue: { key: 'RHAIRFE-100' }
      }
    ]
    expect(extractClonesLinks(links)).toEqual(['RHAIRFE-100'])
  })

  it('extracts by type name Cloners', function () {
    var links = [
      {
        type: { name: 'Cloners' },
        outwardIssue: { key: 'RHAIRFE-200' }
      }
    ]
    expect(extractClonesLinks(links)).toEqual(['RHAIRFE-200'])
  })

  it('ignores links without outwardIssue', function () {
    var links = [
      {
        type: { outward: 'clones' },
        inwardIssue: { key: 'RHAIRFE-300' }
      }
    ]
    expect(extractClonesLinks(links)).toEqual([])
  })

  it('ignores non-clones link types', function () {
    var links = [
      {
        type: { outward: 'blocks', name: 'Blocker' },
        outwardIssue: { key: 'TEST-1' }
      }
    ]
    expect(extractClonesLinks(links)).toEqual([])
  })

  it('extracts multiple clones links', function () {
    var links = [
      {
        type: { outward: 'clones' },
        outwardIssue: { key: 'RHAIRFE-100' }
      },
      {
        type: { outward: 'clones' },
        outwardIssue: { key: 'RHAIRFE-200' }
      }
    ]
    expect(extractClonesLinks(links)).toEqual(['RHAIRFE-100', 'RHAIRFE-200'])
  })
})

// ─── parseChangelog ─────────────────────────────────────────────────

describe('parseChangelog', function () {
  it('returns null for null changelog', function () {
    expect(parseChangelog(null, 'status')).toBeNull()
  })

  it('returns null for changelog without histories', function () {
    expect(parseChangelog({}, 'status')).toBeNull()
  })

  it('returns null when field is not found in histories', function () {
    var changelog = {
      histories: [
        {
          created: '2026-05-01T10:00:00.000Z',
          items: [{ field: 'priority', fieldId: 'priority' }]
        }
      ]
    }
    expect(parseChangelog(changelog, 'status')).toBeNull()
  })

  it('returns timestamp when field matches by name', function () {
    var changelog = {
      histories: [
        {
          created: '2026-05-01T10:00:00.000Z',
          items: [{ field: 'status', fieldId: 'status' }]
        }
      ]
    }
    expect(parseChangelog(changelog, 'status')).toBe('2026-05-01T10:00:00.000Z')
  })

  it('returns timestamp when field matches by fieldId', function () {
    var changelog = {
      histories: [
        {
          created: '2026-05-01T10:00:00.000Z',
          items: [{ field: 'Status Summary', fieldId: 'customfield_10814' }]
        }
      ]
    }
    expect(parseChangelog(changelog, 'customfield_10814')).toBe('2026-05-01T10:00:00.000Z')
  })

  it('returns the most recent timestamp', function () {
    var changelog = {
      histories: [
        {
          created: '2026-04-01T10:00:00.000Z',
          items: [{ field: 'status', fieldId: 'status' }]
        },
        {
          created: '2026-05-15T10:00:00.000Z',
          items: [{ field: 'status', fieldId: 'status' }]
        },
        {
          created: '2026-05-01T10:00:00.000Z',
          items: [{ field: 'status', fieldId: 'status' }]
        }
      ]
    }
    expect(parseChangelog(changelog, 'status')).toBe('2026-05-15T10:00:00.000Z')
  })

  it('handles empty items array in history', function () {
    var changelog = {
      histories: [
        {
          created: '2026-05-01T10:00:00.000Z',
          items: []
        }
      ]
    }
    expect(parseChangelog(changelog, 'status')).toBeNull()
  })
})

// ─── transformIssue ─────────────────────────────────────────────────

describe('transformIssue', function () {
  function makeRawIssue(overrides) {
    var fields = {}
    fields.summary = 'Test feature'
    fields.issuetype = { name: 'Feature' }
    fields.status = { name: 'In Progress', statusCategory: { name: 'In Progress' } }
    fields.assignee = { displayName: 'Jane Doe' }
    fields.fixVersions = [{ name: 'RHOAI-2.14' }]
    fields.components = [{ name: 'serving-runtime' }]
    fields.labels = ['GPU']
    fields.issuelinks = []
    fields[CUSTOM_FIELDS.team] = { name: 'Model Serving' }
    fields[CUSTOM_FIELDS.releaseType] = { value: 'GA' }
    fields[CUSTOM_FIELDS.colorStatus] = { value: 'Green' }
    fields[CUSTOM_FIELDS.docsRequired] = { value: 'Yes' }
    fields[CUSTOM_FIELDS.targetEnd] = '2026-06-15'
    fields[CUSTOM_FIELDS.reach] = 100
    fields[CUSTOM_FIELDS.impact] = 2
    fields[CUSTOM_FIELDS.confidence] = 80
    fields[CUSTOM_FIELDS.effort] = 4
    fields[CUSTOM_FIELDS.riceScore] = 40

    if (overrides) {
      Object.assign(fields, overrides)
    }

    return {
      key: 'TEST1-1045',
      fields: fields,
      renderedFields: {}
    }
  }

  it('transforms a fully populated issue', function () {
    var result = transformIssue(makeRawIssue(), {})
    expect(result.key).toBe('TEST1-1045')
    expect(result.summary).toBe('Test feature')
    expect(result.issueType).toBe('Feature')
    expect(result.status).toBe('In Progress')
    expect(result.statusCategory).toBe('In Progress')
    expect(result.assignee).toBe('Jane Doe')
    expect(result.team).toBe('Model Serving')
    expect(result.fixVersions).toEqual(['RHOAI-2.14'])
    expect(result.components).toEqual(['serving-runtime'])
    expect(result.labels).toEqual(['GPU'])
    expect(result.releaseType).toBe('GA')
    expect(result.colorStatus).toBe('Green')
    expect(result.docsRequired).toBe('Yes')
    expect(result.targetEnd).toBe('2026-06-15')
    expect(result.riceStatus).toBe('complete')
    expect(result.riceScore).toBe(40)
  })

  it('handles minimal fields', function () {
    var raw = { key: 'TEST-1', fields: {}, renderedFields: {} }
    var result = transformIssue(raw, {})
    expect(result.key).toBe('TEST-1')
    expect(result.summary).toBe('')
    expect(result.issueType).toBeNull()
    expect(result.status).toBeNull()
    expect(result.assignee).toBeNull()
    expect(result.fixVersions).toEqual([])
    expect(result.components).toEqual([])
    expect(result.labels).toEqual([])
    expect(result.riceStatus).toBe('none')
  })

  it('handles missing fields object', function () {
    var raw = { key: 'TEST-2' }
    var result = transformIssue(raw, {})
    expect(result.key).toBe('TEST-2')
    expect(result.summary).toBe('')
  })

  it('extracts linked RFE from clones links with rfeMap', function () {
    var fields = {}
    fields.issuelinks = [
      {
        type: { outward: 'clones' },
        outwardIssue: { key: 'RHAIRFE-500' }
      }
    ]
    var raw = { key: 'TEST-3', fields: fields, renderedFields: {} }
    var rfeMap = {
      'RHAIRFE-500': { status: 'Approved', isApproved: true }
    }
    var result = transformIssue(raw, rfeMap)
    expect(result.linkedRfeKey).toBe('RHAIRFE-500')
    expect(result.linkedRfeApproved).toBe(true)
  })

  it('sets linkedRfeApproved false when RFE not in map', function () {
    var fields = {}
    fields.issuelinks = [
      {
        type: { outward: 'clones' },
        outwardIssue: { key: 'RHAIRFE-600' }
      }
    ]
    var raw = { key: 'TEST-4', fields: fields, renderedFields: {} }
    var result = transformIssue(raw, {})
    expect(result.linkedRfeKey).toBe('RHAIRFE-600')
    expect(result.linkedRfeApproved).toBe(false)
  })

  it('ignores non-RHAIRFE clones links', function () {
    var fields = {}
    fields.issuelinks = [
      {
        type: { outward: 'clones' },
        outwardIssue: { key: 'OTHER-100' }
      }
    ]
    var raw = { key: 'TEST-5', fields: fields, renderedFields: {} }
    var result = transformIssue(raw, {})
    expect(result.linkedRfeKey).toBeNull()
    expect(result.linkedRfeApproved).toBe(false)
  })

  it('prefers rendered statusSummary over serialized', function () {
    var fields = {}
    fields[CUSTOM_FIELDS.statusSummary] = 'plain text'
    var raw = {
      key: 'TEST-6',
      fields: fields,
      renderedFields: {}
    }
    raw.renderedFields[CUSTOM_FIELDS.statusSummary] = '<p>rendered html</p>'
    var result = transformIssue(raw, {})
    expect(result.statusSummary).toBe('<p>rendered html</p>')
  })

  it('initializes statusEnteredAt and statusSummaryUpdated as null', function () {
    var result = transformIssue(makeRawIssue(), {})
    expect(result.statusEnteredAt).toBeNull()
    expect(result.statusSummaryUpdated).toBeNull()
  })

  it('initializes violations as empty array', function () {
    var result = transformIssue(makeRawIssue(), {})
    expect(result.violations).toEqual([])
  })

  // ─── isBlocked via statusCategory ─────────────────────────────────

  it('marks as blocked when blocker statusCategory is not Done', function () {
    var fields = {}
    fields.issuelinks = [{
      type: { name: 'Blocks', inward: 'is blocked by' },
      inwardIssue: {
        key: 'BLOCK-1',
        fields: { status: { name: 'In Progress', statusCategory: { name: 'In Progress' } } }
      }
    }]
    var result = transformIssue({ key: 'TEST-B1', fields: fields, renderedFields: {} }, {})
    expect(result.isBlocked).toBe(true)
  })

  it('not blocked when blocker statusCategory is Done', function () {
    var fields = {}
    fields.issuelinks = [{
      type: { name: 'Blocks', inward: 'is blocked by' },
      inwardIssue: {
        key: 'BLOCK-2',
        fields: { status: { name: 'Closed', statusCategory: { name: 'Done' } } }
      }
    }]
    var result = transformIssue({ key: 'TEST-B2', fields: fields, renderedFields: {} }, {})
    expect(result.isBlocked).toBe(false)
  })

  it('not blocked when blocker has custom terminal status with Done category', function () {
    var fields = {}
    fields.issuelinks = [{
      type: { name: 'Blocks', inward: 'is blocked by' },
      inwardIssue: {
        key: 'BLOCK-3',
        fields: { status: { name: 'Release Pending', statusCategory: { name: 'Done' } } }
      }
    }]
    var result = transformIssue({ key: 'TEST-B3', fields: fields, renderedFields: {} }, {})
    expect(result.isBlocked).toBe(false)
  })

  it('not blocked when blocker status is Cancelled with Done category', function () {
    var fields = {}
    fields.issuelinks = [{
      type: { name: 'Blocks', inward: 'is blocked by' },
      inwardIssue: {
        key: 'BLOCK-4',
        fields: { status: { name: 'Cancelled', statusCategory: { name: 'Done' } } }
      }
    }]
    var result = transformIssue({ key: 'TEST-B4', fields: fields, renderedFields: {} }, {})
    expect(result.isBlocked).toBe(false)
  })

  it('blocked when blocker statusCategory is To Do', function () {
    var fields = {}
    fields.issuelinks = [{
      type: { name: 'Blocks', inward: 'is blocked by' },
      inwardIssue: {
        key: 'BLOCK-5',
        fields: { status: { name: 'New', statusCategory: { name: 'To Do' } } }
      }
    }]
    var result = transformIssue({ key: 'TEST-B5', fields: fields, renderedFields: {} }, {})
    expect(result.isBlocked).toBe(true)
  })

  it('blocked when blocker has no statusCategory', function () {
    var fields = {}
    fields.issuelinks = [{
      type: { name: 'Blocks', inward: 'is blocked by' },
      inwardIssue: {
        key: 'BLOCK-6',
        fields: { status: { name: 'In Progress' } }
      }
    }]
    var result = transformIssue({ key: 'TEST-B6', fields: fields, renderedFields: {} }, {})
    expect(result.isBlocked).toBe(true)
  })

  it('blocked when blocker has no status at all', function () {
    var fields = {}
    fields.issuelinks = [{
      type: { name: 'Blocks', inward: 'is blocked by' },
      inwardIssue: { key: 'BLOCK-7', fields: {} }
    }]
    var result = transformIssue({ key: 'TEST-B7', fields: fields, renderedFields: {} }, {})
    expect(result.isBlocked).toBe(true)
  })

  it('ignores outward Blocks links (issue blocks another)', function () {
    var fields = {}
    fields.issuelinks = [{
      type: { name: 'Blocks', outward: 'blocks' },
      outwardIssue: {
        key: 'OTHER-1',
        fields: { status: { name: 'Open', statusCategory: { name: 'To Do' } } }
      }
    }]
    var result = transformIssue({ key: 'TEST-B8', fields: fields, renderedFields: {} }, {})
    expect(result.isBlocked).toBe(false)
  })

  it('ignores non-Blocks link types', function () {
    var fields = {}
    fields.issuelinks = [{
      type: { name: 'Cloners', inward: 'is cloned by' },
      inwardIssue: {
        key: 'CLONE-1',
        fields: { status: { name: 'Open', statusCategory: { name: 'To Do' } } }
      }
    }]
    var result = transformIssue({ key: 'TEST-B9', fields: fields, renderedFields: {} }, {})
    expect(result.isBlocked).toBe(false)
  })

  it('blocked if any one of multiple blockers is unresolved', function () {
    var fields = {}
    fields.issuelinks = [
      {
        type: { name: 'Blocks', inward: 'is blocked by' },
        inwardIssue: {
          key: 'BLOCK-DONE',
          fields: { status: { name: 'Closed', statusCategory: { name: 'Done' } } }
        }
      },
      {
        type: { name: 'Blocks', inward: 'is blocked by' },
        inwardIssue: {
          key: 'BLOCK-OPEN',
          fields: { status: { name: 'In Progress', statusCategory: { name: 'In Progress' } } }
        }
      }
    ]
    var result = transformIssue({ key: 'TEST-B10', fields: fields, renderedFields: {} }, {})
    expect(result.isBlocked).toBe(true)
  })

  it('not blocked when all blockers are resolved', function () {
    var fields = {}
    fields.issuelinks = [
      {
        type: { name: 'Blocks', inward: 'is blocked by' },
        inwardIssue: {
          key: 'BLOCK-D1',
          fields: { status: { name: 'Done', statusCategory: { name: 'Done' } } }
        }
      },
      {
        type: { name: 'Blocks', inward: 'is blocked by' },
        inwardIssue: {
          key: 'BLOCK-D2',
          fields: { status: { name: 'Resolved', statusCategory: { name: 'Done' } } }
        }
      }
    ]
    var result = transformIssue({ key: 'TEST-B11', fields: fields, renderedFields: {} }, {})
    expect(result.isBlocked).toBe(false)
  })
})

// ─── fetchHygieneFeatures — jqlVersions parameter ──────────────────

const { fetchHygieneFeatures } = require('../../../server/hygiene/jira-fetch')

describe('fetchHygieneFeatures jqlVersions option', function() {
  // Capture JQL queries without hitting Jira
  function createMockJira() {
    var capturedJqls = []
    function mockJiraRequest() { return Promise.resolve({}) }
    function mockFetchAll(_jiraReq, jql) {
      capturedJqls.push(jql)
      return Promise.resolve([])
    }
    return { mockJiraRequest, mockFetchAll, capturedJqls }
  }

  it('uses version string in JQL when jqlVersions not provided', async function () {
    var mock = createMockJira()
    await fetchHygieneFeatures(mock.mockJiraRequest, mock.mockFetchAll, 'rhoai-3.5.z', {})
    expect(mock.capturedJqls[0]).toContain('"Target Version" = "rhoai-3.5.z"')
  })

  it('uses single jqlVersion with = syntax', async function () {
    var mock = createMockJira()
    await fetchHygieneFeatures(mock.mockJiraRequest, mock.mockFetchAll, 'rhoai-3.5.z', {}, null, {
      jqlVersions: ['rhoai-3.5']
    })
    expect(mock.capturedJqls[0]).toContain('"Target Version" = "rhoai-3.5"')
    expect(mock.capturedJqls[0]).not.toContain('rhoai-3.5.z')
  })

  it('uses multiple jqlVersions with IN syntax', async function () {
    var mock = createMockJira()
    await fetchHygieneFeatures(mock.mockJiraRequest, mock.mockFetchAll, 'rhoai-3.5.z', {}, null, {
      jqlVersions: ['rhoai-3.5', 'RHOAI-3.5']
    })
    expect(mock.capturedJqls[0]).toContain('"Target Version" IN ("rhoai-3.5", "RHOAI-3.5")')
  })

  it('uses jqlVersions for fixVersion filter too', async function () {
    var mock = createMockJira()
    await fetchHygieneFeatures(mock.mockJiraRequest, mock.mockFetchAll, 'rhoai-3.5.z', {}, null, {
      jqlVersions: ['rhoai-3.5']
    })
    // The supplementary queries (pass 1 missing TV and bugs) also use the version
    var fixVersionJqls = mock.capturedJqls.filter(function (q) { return q.includes('fixVersion') })
    for (var i = 0; i < fixVersionJqls.length; i++) {
      expect(fixVersionJqls[i]).toContain('fixVersion = "rhoai-3.5"')
      expect(fixVersionJqls[i]).not.toContain('rhoai-3.5.z')
    }
  })

  it('sanitizes double quotes in version strings', async function () {
    var mock = createMockJira()
    await fetchHygieneFeatures(mock.mockJiraRequest, mock.mockFetchAll, 'test', {}, null, {
      jqlVersions: ['ver"sion']
    })
    expect(mock.capturedJqls[0]).toContain('ver\\"sion')
    expect(mock.capturedJqls[0]).not.toContain('ver"sion')
  })

  it('sanitizes backslashes before quotes to prevent escape bypass', async function () {
    var mock = createMockJira()
    await fetchHygieneFeatures(mock.mockJiraRequest, mock.mockFetchAll, 'test', {}, null, {
      jqlVersions: ['ver\\"sion']
    })
    // Input: ver\"sion → after backslash escape: ver\\"sion → after quote escape: ver\\\\"sion
    // The backslash must be escaped first so \" doesn't become \\" (breaking out of the string)
    expect(mock.capturedJqls[0]).not.toContain('ver\\"sion')
  })

  it('falls back to version when jqlVersions is empty array', async function () {
    var mock = createMockJira()
    await fetchHygieneFeatures(mock.mockJiraRequest, mock.mockFetchAll, 'rhoai-3.5.z', {}, null, {
      jqlVersions: []
    })
    expect(mock.capturedJqls[0]).toContain('"Target Version" = "rhoai-3.5.z"')
  })

  it('falls back to version when jqlVersions is null', async function () {
    var mock = createMockJira()
    await fetchHygieneFeatures(mock.mockJiraRequest, mock.mockFetchAll, 'rhoai-3.5.z', {}, null, {
      jqlVersions: null
    })
    expect(mock.capturedJqls[0]).toContain('"Target Version" = "rhoai-3.5.z"')
  })

  it('preserves version in result for storage key', async function () {
    var mock = createMockJira()
    var result = await fetchHygieneFeatures(mock.mockJiraRequest, mock.mockFetchAll, 'rhoai-3.5.z', {}, null, {
      jqlVersions: ['rhoai-3.5']
    })
    expect(result.version).toBe('rhoai-3.5.z')
  })
})
