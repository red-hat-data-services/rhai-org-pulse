import { describe, it, expect, vi } from 'vitest'
const {
  adfToPlainText,
  extractTargetVersions,
  extractFixVersions,
  extractLabels,
  extractComponents,
  mapToCandidate,
  getRfeLink,
  getParentRfeKey,
  getRequestedFields,
  throttledSequential,
  fetchOutcomeFeatures,
  fetchOutcomeRfes,
  fetchOutcomeSummaries
} = require('../../server/jira-client')

describe('adfToPlainText', () => {
  it('returns empty string for null/undefined', () => {
    expect(adfToPlainText(null)).toBe('')
    expect(adfToPlainText(undefined)).toBe('')
  })

  it('returns string as-is', () => {
    expect(adfToPlainText('hello')).toBe('hello')
  })

  it('extracts text from ADF text node', () => {
    expect(adfToPlainText({ type: 'text', text: 'hello world' })).toBe('hello world')
  })

  it('recursively extracts text from ADF paragraph', () => {
    const adf = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Parent RFE: ' },
            { type: 'text', text: 'RHAIRFE-123' }
          ]
        }
      ]
    }
    expect(adfToPlainText(adf)).toBe('Parent RFE: RHAIRFE-123')
  })
})

describe('extractTargetVersions', () => {
  it('returns empty array when field is missing', () => {
    expect(extractTargetVersions({ fields: {} }, 'customfield_10855')).toEqual([])
  })

  it('extracts from array of version objects', () => {
    const issue = {
      fields: {
        customfield_10855: [
          { name: 'RHOAI 3.5' },
          { name: 'RHOAI 3.4' }
        ]
      }
    }
    expect(extractTargetVersions(issue, 'customfield_10855')).toEqual(['RHOAI 3.5', 'RHOAI 3.4'])
  })

  it('extracts from single version object', () => {
    const issue = { fields: { customfield_10855: { name: 'rhoai-3.5' } } }
    expect(extractTargetVersions(issue, 'customfield_10855')).toEqual(['rhoai-3.5'])
  })

  it('extracts from string value', () => {
    const issue = { fields: { customfield_10855: 'rhoai-3.5' } }
    expect(extractTargetVersions(issue, 'customfield_10855')).toEqual(['rhoai-3.5'])
  })
})

describe('extractFixVersions', () => {
  it('returns empty array when no fixVersions', () => {
    expect(extractFixVersions({ fields: {} })).toEqual([])
  })

  it('extracts version names', () => {
    const issue = { fields: { fixVersions: [{ name: 'rhoai-3.5' }, { name: 'rhoai-3.5.1' }] } }
    expect(extractFixVersions(issue)).toEqual(['rhoai-3.5', 'rhoai-3.5.1'])
  })
})

describe('extractLabels', () => {
  it('returns labels array', () => {
    const issue = { fields: { labels: ['3.5-candidate', 'urgent'] } }
    expect(extractLabels(issue)).toEqual(['3.5-candidate', 'urgent'])
  })
})

describe('extractComponents', () => {
  it('returns component names', () => {
    const issue = { fields: { components: [{ name: 'Serving' }, { name: 'Platform' }] } }
    expect(extractComponents(issue)).toEqual(['Serving', 'Platform'])
  })
})

describe('mapToCandidate', () => {
  const fieldMapping = { team: 'customfield_team', architect: 'customfield_arch', rfeLinkType: 'is required by' }
  const customFieldIds = { targetVersion: 'customfield_10855', productManager: 'customfield_10469', releaseType: 'customfield_10851' }

  it('maps a RHAISTRAT issue to candidate', () => {
    const issue = {
      key: 'RHAISTRAT-100',
      fields: {
        summary: 'Test Feature',
        status: { name: 'In Progress' },
        priority: { name: 'Major' },
        components: [{ name: 'Serving' }],
        labels: ['3.5-candidate'],
        fixVersions: [{ name: 'rhoai-3.5' }],
        customfield_10855: [{ name: 'RHOAI 3.5' }],
        customfield_10469: { displayName: 'Jane Doe' },
        customfield_10851: { value: 'EA1' },
        assignee: { displayName: 'John Smith' },
        issuelinks: []
      }
    }

    const candidate = mapToCandidate(issue, 'MaaS', 'outcome', fieldMapping, customFieldIds)
    expect(candidate.issueKey).toBe('RHAISTRAT-100')
    expect(candidate.bigRock).toBe('MaaS')
    expect(candidate.status).toBe('In Progress')
    expect(candidate.priority).toBe('Major')
    expect(candidate.summary).toBe('Test Feature')
    expect(candidate.components).toBe('Serving')
    expect(candidate.targetRelease).toBe('RHOAI 3.5')
    expect(candidate.fixVersion).toBe('rhoai-3.5')
    expect(candidate.pm).toBe('Jane Doe')
    expect(candidate.phase).toBe('EA1')
    expect(candidate.deliveryOwner).toBe('John Smith')
    expect(candidate.source).toBe('jira')
    expect(candidate.sourcePass).toBe('outcome')
  })

  it('maps RHAIRFE issue as rfe source', () => {
    const issue = {
      key: 'RHAIRFE-200',
      fields: {
        summary: 'Test RFE',
        status: { name: 'New' },
        priority: { name: 'Normal' },
        components: [],
        labels: ['3.5-candidate'],
        fixVersions: [],
        issuelinks: []
      }
    }

    const candidate = mapToCandidate(issue, 'MaaS', 'outcome', fieldMapping, customFieldIds)
    expect(candidate.source).toBe('rfe')
    expect(candidate.issueKey).toBe('RHAIRFE-200')
  })
})

describe('getRfeLink', () => {
  const fieldMapping = { rfeLinkType: 'is required by' }

  it('returns empty when no links', () => {
    const issue = { fields: { issuelinks: [] } }
    expect(getRfeLink(issue, fieldMapping)).toEqual({ key: '', status: '' })
  })

  it('finds RFE link via inward issue', () => {
    const issue = {
      fields: {
        issuelinks: [{
          type: { inward: 'is required by', outward: 'requires' },
          inwardIssue: {
            key: 'RHAIRFE-100',
            fields: { status: { name: 'Approved' } }
          }
        }]
      }
    }
    const result = getRfeLink(issue, fieldMapping)
    expect(result.key).toBe('RHAIRFE-100')
    expect(result.status).toBe('Approved')
  })
})

describe('getParentRfeKey', () => {
  it('returns empty when no links or description', () => {
    const issue = { fields: {} }
    expect(getParentRfeKey(issue)).toBe('')
  })

  it('finds Cloners link to RHAIRFE', () => {
    const issue = {
      fields: {
        issuelinks: [{
          type: { name: 'Cloners' },
          outwardIssue: { key: 'RHAIRFE-500' }
        }]
      }
    }
    expect(getParentRfeKey(issue)).toBe('RHAIRFE-500')
  })

  it('finds parent RFE in plain text description', () => {
    const issue = {
      fields: {
        issuelinks: [],
        description: 'Parent RFE: RHAIRFE-999'
      }
    }
    expect(getParentRfeKey(issue)).toBe('RHAIRFE-999')
  })

  it('finds parent RFE in ADF description', () => {
    const issue = {
      fields: {
        issuelinks: [],
        description: {
          type: 'doc',
          content: [{
            type: 'paragraph',
            content: [{ type: 'text', text: 'Parent RFE: RHAIRFE-888' }]
          }]
        }
      }
    }
    expect(getParentRfeKey(issue)).toBe('RHAIRFE-888')
  })
})

describe('getRequestedFields', () => {
  it('includes standard and custom fields', () => {
    const fieldMapping = { team: 'customfield_team', architect: 'customfield_arch' }
    const customFieldIds = { targetVersion: 'customfield_10855', productManager: 'customfield_10469', releaseType: 'customfield_10851' }
    const fields = getRequestedFields(fieldMapping, customFieldIds)
    expect(fields).toContain('summary')
    expect(fields).toContain('status')
    expect(fields).toContain('customfield_10855')
    expect(fields).toContain('customfield_10469')
    expect(fields).toContain('customfield_team')
  })
})

describe('throttledSequential', () => {
  it('processes items in order with delay', async () => {
    const results = []
    const items = ['a', 'b', 'c']
    const fn = async (item) => {
      results.push(item)
      return item.toUpperCase()
    }

    const output = await throttledSequential(items, fn, 0)
    expect(results).toEqual(['a', 'b', 'c'])
    expect(output).toEqual(['A', 'B', 'C'])
  })
})

describe('fetchOutcomeFeatures', () => {
  it('calls fetchAllJqlResults with correct JQL for features', async () => {
    const mockIssues = [{
      key: 'RHAISTRAT-100',
      fields: {
        summary: 'Test',
        status: { name: 'New' },
        priority: { name: 'Major' },
        components: [],
        labels: [],
        fixVersions: [],
        issuelinks: []
      }
    }]
    const mockFetchAll = vi.fn().mockResolvedValue(mockIssues)
    const mockJiraRequest = vi.fn()
    const fieldMapping = { rfeLinkType: 'is required by' }
    const customFieldIds = { targetVersion: 'customfield_10855', productManager: 'customfield_10469', releaseType: 'customfield_10851' }

    const results = await fetchOutcomeFeatures(mockFetchAll, mockJiraRequest, 'RHAISTRAT-1513', 'MaaS', fieldMapping, customFieldIds)

    expect(mockFetchAll).toHaveBeenCalledOnce()
    const jql = mockFetchAll.mock.calls[0][1]
    expect(jql).toContain('parent = "RHAISTRAT-1513"')
    expect(jql).toContain('type = Feature')
    expect(jql).toContain('cf[10855] is not EMPTY')
    expect(jql).toContain('status NOT IN')
    expect(jql).toContain('ORDER BY priority ASC')
    expect(results).toHaveLength(1)
    expect(results[0].issueKey).toBe('RHAISTRAT-100')
    expect(results[0].bigRock).toBe('MaaS')
  })

  it('returns empty array on error', async () => {
    const mockFetchAll = vi.fn().mockRejectedValue(new Error('Network error'))
    const mockJiraRequest = vi.fn()

    const results = await fetchOutcomeFeatures(mockFetchAll, mockJiraRequest, 'KEY-1', 'Rock', {}, {})
    expect(results).toEqual([])
  })
})

describe('fetchOutcomeRfes', () => {
  it('calls fetchAllJqlResults with correct JQL for RFEs', async () => {
    const mockIssues = [{
      key: 'RHAIRFE-200',
      fields: {
        summary: 'Test RFE',
        status: { name: 'New' },
        priority: { name: 'Major' },
        components: [],
        labels: ['3.5-candidate'],
        fixVersions: [],
        issuelinks: []
      }
    }]
    const mockFetchAll = vi.fn().mockResolvedValue(mockIssues)
    const mockJiraRequest = vi.fn()
    const fieldMapping = { rfeLinkType: 'is required by' }
    const customFieldIds = { targetVersion: 'customfield_10855', productManager: 'customfield_10469', releaseType: 'customfield_10851' }

    const results = await fetchOutcomeRfes(mockFetchAll, mockJiraRequest, 'RHAISTRAT-1513', '3.5', 'MaaS', fieldMapping, customFieldIds)

    expect(mockFetchAll).toHaveBeenCalledOnce()
    const jql = mockFetchAll.mock.calls[0][1]
    expect(jql).toContain('parent = "RHAISTRAT-1513"')
    expect(jql).toContain('labels = "3.5-candidate"')
    expect(jql).toContain('status != "Approved"')
    expect(jql).toContain('ORDER BY priority ASC')
    expect(results).toHaveLength(1)
    expect(results[0].issueKey).toBe('RHAIRFE-200')
    expect(results[0].bigRock).toBe('MaaS')
  })

  it('returns empty array on error', async () => {
    const mockFetchAll = vi.fn().mockRejectedValue(new Error('Network error'))
    const mockJiraRequest = vi.fn()

    const results = await fetchOutcomeRfes(mockFetchAll, mockJiraRequest, 'KEY-1', '3.5', 'Rock', {}, {})
    expect(results).toEqual([])
  })
})

describe('fetchOutcomeSummaries', () => {
  it('returns summaries keyed by issue key', async () => {
    const mockIssues = [
      { key: 'RHAISTRAT-1', fields: { summary: 'Outcome A' } },
      { key: 'RHAISTRAT-2', fields: { summary: 'Outcome B' } }
    ]
    const mockFetchAll = vi.fn().mockResolvedValue(mockIssues)
    const mockJiraRequest = vi.fn()

    const result = await fetchOutcomeSummaries(mockFetchAll, mockJiraRequest, ['RHAISTRAT-1', 'RHAISTRAT-2'])
    expect(result).toEqual({
      'RHAISTRAT-1': 'Outcome A',
      'RHAISTRAT-2': 'Outcome B'
    })
  })

  it('returns empty object for empty keys', async () => {
    const mockFetchAll = vi.fn()
    const result = await fetchOutcomeSummaries(mockFetchAll, vi.fn(), [])
    expect(result).toEqual({})
    expect(mockFetchAll).not.toHaveBeenCalled()
  })
})
