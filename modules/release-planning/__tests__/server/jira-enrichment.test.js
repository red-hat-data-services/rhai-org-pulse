import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const {
  parseIssueLinks,
  hasDescriptionContent,
  parseChangelog,
  identifyChangelogTargets,
  runPass1,
  runPass2,
  enrichFeatures
} = require('../../server/health/jira-enrichment')

describe('parseIssueLinks', function() {
  it('returns empty array for null', function() {
    expect(parseIssueLinks(null)).toEqual([])
  })

  it('returns empty array for undefined', function() {
    expect(parseIssueLinks(undefined)).toEqual([])
  })

  it('parses inward issue links', function() {
    var links = parseIssueLinks([{
      type: { name: 'Blocks' },
      inwardIssue: {
        key: 'TEST-1',
        fields: { status: { name: 'In Progress' } }
      }
    }])
    expect(links).toEqual([{
      type: 'Blocks',
      direction: 'inward',
      linkedKey: 'TEST-1',
      linkedStatus: 'In Progress'
    }])
  })

  it('parses outward issue links', function() {
    var links = parseIssueLinks([{
      type: { name: 'is required by' },
      outwardIssue: {
        key: 'RFE-5',
        fields: { status: { name: 'Closed' } }
      }
    }])
    expect(links).toEqual([{
      type: 'is required by',
      direction: 'outward',
      linkedKey: 'RFE-5',
      linkedStatus: 'Closed'
    }])
  })

  it('handles missing type and status fields', function() {
    var links = parseIssueLinks([{
      type: null,
      inwardIssue: { key: 'X-1', fields: {} }
    }])
    expect(links[0].type).toBe('')
    expect(links[0].linkedStatus).toBe('')
  })

  it('parses both inward and outward from a single link', function() {
    var links = parseIssueLinks([{
      type: { name: 'Relates' },
      inwardIssue: { key: 'A-1', fields: { status: { name: 'New' } } },
      outwardIssue: { key: 'A-2', fields: { status: { name: 'Done' } } }
    }])
    expect(links).toHaveLength(2)
  })
})

describe('hasDescriptionContent', function() {
  it('returns false for null', function() {
    expect(hasDescriptionContent(null)).toBe(false)
  })

  it('returns false for undefined', function() {
    expect(hasDescriptionContent(undefined)).toBe(false)
  })

  it('returns false for empty string', function() {
    expect(hasDescriptionContent('')).toBe(false)
  })

  it('returns false for whitespace-only string', function() {
    expect(hasDescriptionContent('   ')).toBe(false)
  })

  it('returns true for non-empty string', function() {
    expect(hasDescriptionContent('Feature description')).toBe(true)
  })

  it('returns true for ADF doc with content', function() {
    expect(hasDescriptionContent({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe(true)
  })

  it('returns false for ADF doc with empty content', function() {
    expect(hasDescriptionContent({ type: 'doc', content: [] })).toBe(false)
  })

  it('returns true for non-string non-ADF truthy value', function() {
    expect(hasDescriptionContent({ someField: true })).toBe(true)
  })
})

describe('parseChangelog', function() {
  it('returns empty array when no changelog', function() {
    expect(parseChangelog({})).toEqual([])
  })

  it('returns empty array when histories is not an array', function() {
    expect(parseChangelog({ changelog: { histories: null } })).toEqual([])
  })

  it('extracts Target Version changes', function() {
    var issue = {
      changelog: {
        histories: [{
          created: '2026-03-15T10:00:00Z',
          items: [{
            field: 'Target Version',
            fromString: 'rhoai-3.4',
            toString: 'rhoai-3.5'
          }]
        }]
      }
    }
    var result = parseChangelog(issue)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      field: 'Target Version',
      from: 'rhoai-3.4',
      to: 'rhoai-3.5',
      date: '2026-03-15T10:00:00Z'
    })
  })

  it('also matches by fieldId customfield_10855', function() {
    var issue = {
      changelog: {
        histories: [{
          created: '2026-04-01T10:00:00Z',
          items: [{
            fieldId: 'customfield_10855',
            field: 'some display name',
            fromString: null,
            toString: 'rhoai-3.5'
          }]
        }]
      }
    }
    var result = parseChangelog(issue)
    expect(result).toHaveLength(1)
    expect(result[0].to).toBe('rhoai-3.5')
  })

  it('ignores non-Target-Version changelog items', function() {
    var issue = {
      changelog: {
        histories: [{
          created: '2026-03-15T10:00:00Z',
          items: [
            { field: 'Status', fromString: 'New', toString: 'In Progress' },
            { field: 'Target Version', fromString: null, toString: 'rhoai-3.5' }
          ]
        }]
      }
    }
    var result = parseChangelog(issue)
    expect(result).toHaveLength(1)
    expect(result[0].field).toBe('Target Version')
  })
})

describe('identifyChangelogTargets', function() {
  it('flags features with empty targetVersions', function() {
    var features = [{ key: 'A-1', status: 'In Progress', targetVersions: [] }]
    var enrichmentMap = new Map([['A-1', { storyPoints: 5 }]])
    var result = identifyChangelogTargets(['A-1'], enrichmentMap, features)
    expect(result).toContain('A-1')
  })

  it('flags features in EARLY_STATUSES', function() {
    var features = [{ key: 'A-1', status: 'New', targetVersions: ['3.5'] }]
    var enrichmentMap = new Map([['A-1', { storyPoints: 5 }]])
    var result = identifyChangelogTargets(['A-1'], enrichmentMap, features)
    expect(result).toContain('A-1')
  })

  it('flags features with no storyPoints in enrichment', function() {
    var features = [{ key: 'A-1', status: 'In Progress', targetVersions: ['3.5'] }]
    var enrichmentMap = new Map([['A-1', { storyPoints: null }]])
    var result = identifyChangelogTargets(['A-1'], enrichmentMap, features)
    expect(result).toContain('A-1')
  })

  it('does not flag healthy features', function() {
    var features = [{ key: 'A-1', status: 'In Progress', targetVersions: ['3.5'] }]
    var enrichmentMap = new Map([['A-1', { storyPoints: 8 }]])
    var result = identifyChangelogTargets(['A-1'], enrichmentMap, features)
    expect(result).not.toContain('A-1')
  })
})

describe('runPass1', function() {
  it('populates enrichmentMap from fetchAllJqlResults', async function() {
    var mockFetch = vi.fn().mockResolvedValue([{
      key: 'TEST-1',
      fields: {
        description: 'A desc',
        customfield_10028: 5,
        issuelinks: []
      }
    }])
    var result = await runPass1(vi.fn(), mockFetch, ['TEST-1'], { batchSize: 40, throttleMs: 0 })
    expect(result.get('TEST-1')).toBeDefined()
    expect(result.get('TEST-1').hasDescription).toBe(true)
    expect(result.get('TEST-1').storyPoints).toBe(5)
  })

  it('populates tshirtSize from description in Pass 1', async function() {
    var mockFetch = vi.fn().mockResolvedValue([{
      key: 'TEST-2',
      fields: {
        description: 'Feature overview.\nT-Shirt Size: L\nMore details.',
        customfield_10028: 3,
        issuelinks: []
      }
    }])
    var result = await runPass1(vi.fn(), mockFetch, ['TEST-2'], { batchSize: 40, throttleMs: 0 })
    expect(result.get('TEST-2').tshirtSize).toBe('L')
  })

  it('sets tshirtSize to null when description has no size', async function() {
    var mockFetch = vi.fn().mockResolvedValue([{
      key: 'TEST-3',
      fields: {
        description: 'A description with no size info',
        customfield_10028: 5,
        issuelinks: []
      }
    }])
    var result = await runPass1(vi.fn(), mockFetch, ['TEST-3'], { batchSize: 40, throttleMs: 0 })
    expect(result.get('TEST-3').tshirtSize).toBeNull()
  })

  it('batches keys correctly', async function() {
    var keys = []
    for (var i = 1; i <= 5; i++) keys.push('T-' + i)
    var mockFetch = vi.fn().mockResolvedValue([])
    await runPass1(vi.fn(), mockFetch, keys, { batchSize: 2, throttleMs: 0 })
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('marks failed keys with _error on batch failure', async function() {
    var mockFetch = vi.fn().mockRejectedValue(new Error('Jira down'))
    var result = await runPass1(vi.fn(), mockFetch, ['T-1', 'T-2'], { batchSize: 40, throttleMs: 0 })
    expect(result.get('T-1')._error).toBe(true)
    expect(result.get('T-2')._error).toBe(true)
  })

  it('returns empty map for empty keys', async function() {
    var result = await runPass1(vi.fn(), vi.fn(), [], { throttleMs: 0 })
    expect(result.size).toBe(0)
  })
})

describe('runPass2', function() {
  it('updates enrichmentMap with refinementHistory', async function() {
    var enrichmentMap = new Map([['T-1', { hasDescription: true, storyPoints: 5 }]])
    var mockFetch = vi.fn().mockResolvedValue([{
      key: 'T-1',
      changelog: {
        histories: [{
          created: '2026-04-01T10:00:00Z',
          items: [{ field: 'Target Version', fromString: null, toString: '3.5' }]
        }]
      }
    }])
    await runPass2(vi.fn(), mockFetch, ['T-1'], enrichmentMap, { batchSize: 40, throttleMs: 0 })
    expect(enrichmentMap.get('T-1').refinementHistory).toHaveLength(1)
  })

  it('handles empty targetKeys', async function() {
    var enrichmentMap = new Map()
    var mockFetch = vi.fn()
    await runPass2(vi.fn(), mockFetch, [], enrichmentMap, { throttleMs: 0 })
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe('enrichFeatures', function() {
  var origToken, origEmail

  beforeEach(function() {
    origToken = process.env.JIRA_TOKEN
    origEmail = process.env.JIRA_EMAIL
  })

  afterEach(function() {
    if (origToken !== undefined) process.env.JIRA_TOKEN = origToken
    else delete process.env.JIRA_TOKEN
    if (origEmail !== undefined) process.env.JIRA_EMAIL = origEmail
    else delete process.env.JIRA_EMAIL
  })

  it('returns warning when Jira credentials not configured', async function() {
    delete process.env.JIRA_TOKEN
    delete process.env.JIRA_EMAIL
    var result = await enrichFeatures(vi.fn(), vi.fn(), [], {})
    expect(result.warnings).toContain('Jira credentials not configured -- enrichment skipped')
    expect(result.enrichments.size).toBe(0)
  })

  it('returns warning when enrichment disabled in config', async function() {
    process.env.JIRA_TOKEN = 'test'
    process.env.JIRA_EMAIL = 'test@test.com'
    var result = await enrichFeatures(vi.fn(), vi.fn(), [], {
      healthConfig: { enableJiraEnrichment: false }
    })
    expect(result.warnings).toContain('Jira enrichment disabled in config')
  })

  it('runs pass1 and pass2 when configured', async function() {
    process.env.JIRA_TOKEN = 'test'
    process.env.JIRA_EMAIL = 'test@test.com'
    var features = [{ key: 'T-1', status: 'New', targetVersions: [] }]
    var mockFetch = vi.fn().mockResolvedValue([{
      key: 'T-1',
      fields: { description: 'desc', customfield_10028: 3, issuelinks: [] }
    }])
    var result = await enrichFeatures(vi.fn(), mockFetch, features, {
      healthConfig: { enrichmentThrottleMs: 0 }
    })
    expect(result.enrichments.has('T-1')).toBe(true)
    expect(result.stats.pass1).toBe(1)
  })

  it('fetches RICE from parents when enabled and configured', async function() {
    process.env.JIRA_TOKEN = 'test'
    process.env.JIRA_EMAIL = 'test@test.com'
    var features = [{ key: 'T-1', status: 'In Progress', targetVersions: ['3.5'], parentKey: 'STRAT-1' }]
    var mockFetch = vi.fn().mockImplementation(function(jiraReq, jql) {
      if (jql.indexOf('STRAT-1') !== -1) {
        return Promise.resolve([{
          key: 'STRAT-1',
          fields: { cf_reach: 1000, cf_impact: 2, cf_conf: 80, cf_effort: 4 }
        }])
      }
      return Promise.resolve([{
        key: 'T-1',
        fields: { description: 'desc', customfield_10028: 3, issuelinks: [] }
      }])
    })
    var result = await enrichFeatures(vi.fn(), mockFetch, features, {
      healthConfig: { enableRice: true, enrichmentThrottleMs: 0 },
      customFieldIds: {
        riceReach: 'cf_reach',
        riceImpact: 'cf_impact',
        riceConfidence: 'cf_conf',
        riceEffort: 'cf_effort'
      }
    })
    var enrichment = result.enrichments.get('T-1')
    expect(enrichment.rice).toBeDefined()
    expect(enrichment.rice.reach).toBe(1000)
  })
})
