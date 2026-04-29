import { describe, it, expect } from 'vitest'
const {
  mapToCandidate,
  findRfeFromLinks,
  findTier1Features,
  findTier1Rfes,
  findOutcomeSummaries,
  findTier2Features,
  findTier2Rfes,
  findTier3Features,
  validateKeysFromCache
} = require('../../server/cache-reader')

function makeFeatureIndex(key, overrides) {
  return Object.assign({
    key: key,
    summary: 'Summary for ' + key,
    status: 'In Progress',
    statusCategory: 'In Progress',
    priority: 'Major',
    assignee: 'Test User',
    fixVersions: [],
    targetVersions: null,
    pm: null,
    architect: null,
    parentKey: null,
    labels: [],
    completionPct: 0,
    epicCount: 0,
    issueCount: 0,
    blockerCount: 0,
    health: 'YELLOW',
    lastUpdated: '2026-01-01T00:00:00.000+0000'
  }, overrides || {})
}

function makeFeatureDetail(key, overrides) {
  return Object.assign({
    key: key,
    summary: 'Summary for ' + key,
    status: 'In Progress',
    statusCategory: 'In Progress',
    priority: 'Major',
    assignee: { displayName: 'Test User', accountId: 'test123' },
    fixVersions: [],
    targetVersions: null,
    pm: null,
    architect: null,
    parentKey: null,
    labels: [],
    components: [],
    created: '2025-01-01T00:00:00.000+0000',
    updated: '2026-01-01T00:00:00.000+0000',
    statusNotes: null,
    issueLinks: [],
    epics: [],
    metrics: {},
    topology: { repos: [] }
  }, overrides || {})
}

function makeRfeIndex(key, overrides) {
  return Object.assign({
    key: key,
    summary: 'RFE Summary for ' + key,
    status: 'New',
    statusCategory: 'To Do',
    priority: 'Major',
    assignee: 'Test User',
    fixVersions: [],
    labels: [],
    lastUpdated: '2026-01-01T00:00:00.000+0000'
  }, overrides || {})
}

function makeRfeDetail(key, overrides) {
  return Object.assign({
    key: key,
    summary: 'RFE Summary for ' + key,
    status: 'New',
    statusCategory: 'To Do',
    priority: 'Major',
    assignee: null,
    fixVersions: [],
    labels: [],
    components: [],
    created: '2025-01-01T00:00:00.000+0000',
    updated: '2026-01-01T00:00:00.000+0000',
    description: null,
    issueLinks: []
  }, overrides || {})
}

function createMockStorage(featureDetails, rfeDetails) {
  const store = {}
  if (featureDetails) {
    for (let i = 0; i < featureDetails.length; i++) {
      store['feature-traffic/features/' + featureDetails[i].key + '.json'] = featureDetails[i]
    }
  }
  if (rfeDetails) {
    for (let j = 0; j < rfeDetails.length; j++) {
      store['feature-traffic/rfes/' + rfeDetails[j].key + '.json'] = rfeDetails[j]
    }
  }
  return function(path) {
    return store[path] || null
  }
}

describe('mapToCandidate', () => {
  it('maps an index-level feature (string fields)', () => {
    const feature = makeFeatureIndex('RHAISTRAT-100', {
      targetVersions: ['rhoai-3.5'],
      pm: 'Jane PM',
      architect: 'Bob Arch',
      assignee: 'John Smith'
    })
    const candidate = mapToCandidate(feature, 'MaaS', 'outcome')
    expect(candidate.issueKey).toBe('RHAISTRAT-100')
    expect(candidate.bigRock).toBe('MaaS')
    expect(candidate.targetRelease).toBe('rhoai-3.5')
    expect(candidate.pm).toBe('Jane PM')
    expect(candidate.architect).toBe('Bob Arch')
    expect(candidate.deliveryOwner).toBe('John Smith')
    expect(candidate.source).toBe('jira')
    expect(candidate.sourcePass).toBe('outcome')
  })

  it('maps a detail-level feature (object fields)', () => {
    const feature = makeFeatureDetail('RHAISTRAT-200', {
      targetVersions: ['rhoai-3.5'],
      pm: { displayName: 'Jane PM', accountId: 'pm123' },
      architect: { displayName: 'Bob Arch', accountId: 'arch456' },
      components: ['Serving', 'Platform']
    })
    const candidate = mapToCandidate(feature, 'Training', 'tier2')
    expect(candidate.pm).toBe('Jane PM')
    expect(candidate.architect).toBe('Bob Arch')
    expect(candidate.components).toBe('Serving, Platform')
    expect(candidate.team).toBe('Serving, Platform')
  })

  it('identifies RHAIRFE keys as rfe source', () => {
    const rfe = makeRfeDetail('RHAIRFE-100')
    const candidate = mapToCandidate(rfe, '', 'tier2')
    expect(candidate.source).toBe('rfe')
  })

  it('handles null/missing fields gracefully', () => {
    const feature = makeFeatureIndex('RHAISTRAT-300', {
      targetVersions: null,
      pm: null,
      architect: null,
      assignee: null
    })
    const candidate = mapToCandidate(feature, '', 'tier3')
    expect(candidate.targetRelease).toBe('')
    expect(candidate.pm).toBe('')
    expect(candidate.architect).toBe('')
    expect(candidate.deliveryOwner).toBe('')
  })
})

describe('findRfeFromLinks', () => {
  it('returns empty when no links', () => {
    expect(findRfeFromLinks([])).toEqual({ key: '', status: '' })
  })

  it('finds RHAIRFE link', () => {
    const links = [
      { type: 'Dependency', direction: 'inward', linkedKey: 'RHAIRFE-100', linkedSummary: 'Test', linkedStatus: 'Approved' }
    ]
    expect(findRfeFromLinks(links)).toEqual({ key: 'RHAIRFE-100', status: 'Approved' })
  })

  it('ignores non-RHAIRFE links', () => {
    const links = [
      { type: 'Dependency', direction: 'inward', linkedKey: 'RHAISTRAT-100', linkedSummary: 'Test', linkedStatus: 'New' }
    ]
    expect(findRfeFromLinks(links)).toEqual({ key: '', status: '' })
  })
})

describe('findTier1Features', () => {
  it('finds features whose parentKey matches outcome keys', () => {
    const index = {
      features: [
        makeFeatureIndex('RHAISTRAT-100', { parentKey: 'KEY-1', targetVersions: ['rhoai-3.5'], status: 'In Progress' }),
        makeFeatureIndex('RHAISTRAT-101', { parentKey: 'KEY-2', targetVersions: ['rhoai-3.5'], status: 'New' }),
        makeFeatureIndex('RHAISTRAT-102', { parentKey: null, targetVersions: ['rhoai-3.5'], status: 'New' })
      ],
      rfes: []
    }
    const details = [
      makeFeatureDetail('RHAISTRAT-100', { parentKey: 'KEY-1', targetVersions: ['rhoai-3.5'] }),
      makeFeatureDetail('RHAISTRAT-101', { parentKey: 'KEY-2', targetVersions: ['rhoai-3.5'] })
    ]
    const readFromStorage = createMockStorage(details)

    const results = findTier1Features(readFromStorage, index, ['KEY-1'])
    expect(results).toHaveLength(1)
    expect(results[0].key).toBe('RHAISTRAT-100')
  })

  it('excludes closed statuses', () => {
    const index = {
      features: [
        makeFeatureIndex('RHAISTRAT-100', { parentKey: 'KEY-1', targetVersions: ['rhoai-3.5'], status: 'Closed' })
      ],
      rfes: []
    }
    const readFromStorage = createMockStorage([])

    const results = findTier1Features(readFromStorage, index, ['KEY-1'])
    expect(results).toHaveLength(0)
  })

  it('excludes features without target versions', () => {
    const index = {
      features: [
        makeFeatureIndex('RHAISTRAT-100', { parentKey: 'KEY-1', targetVersions: null, status: 'In Progress' })
      ],
      rfes: []
    }
    const readFromStorage = createMockStorage([])

    const results = findTier1Features(readFromStorage, index, ['KEY-1'])
    expect(results).toHaveLength(0)
  })
})

describe('findTier1Rfes', () => {
  it('finds RFEs linked to outcome keys with candidate label', () => {
    const index = {
      features: [],
      rfes: [
        makeRfeIndex('RHAIRFE-100', { labels: ['3.5-candidate'], status: 'New' }),
        makeRfeIndex('RHAIRFE-101', { labels: ['3.5-candidate'], status: 'New' })
      ]
    }
    const rfeDetails = [
      makeRfeDetail('RHAIRFE-100', {
        labels: ['3.5-candidate'],
        issueLinks: [{ type: 'Dependency', direction: 'inward', linkedKey: 'KEY-1', linkedSummary: 'Outcome', linkedStatus: 'In Progress' }]
      }),
      makeRfeDetail('RHAIRFE-101', {
        labels: ['3.5-candidate'],
        issueLinks: []
      })
    ]
    const readFromStorage = createMockStorage([], rfeDetails)

    const results = findTier1Rfes(readFromStorage, index, ['KEY-1'], '3.5')
    expect(results).toHaveLength(1)
    expect(results[0].key).toBe('RHAIRFE-100')
  })

  it('excludes Approved RFEs', () => {
    const index = {
      features: [],
      rfes: [
        makeRfeIndex('RHAIRFE-100', { labels: ['3.5-candidate'], status: 'Approved' })
      ]
    }
    const readFromStorage = createMockStorage([], [])

    const results = findTier1Rfes(readFromStorage, index, ['KEY-1'], '3.5')
    expect(results).toHaveLength(0)
  })

  it('excludes closed RFEs', () => {
    const index = {
      features: [],
      rfes: [
        makeRfeIndex('RHAIRFE-100', { labels: ['3.5-candidate'], status: 'Closed' })
      ]
    }
    const readFromStorage = createMockStorage([], [])

    const results = findTier1Rfes(readFromStorage, index, ['KEY-1'], '3.5')
    expect(results).toHaveLength(0)
  })
})

describe('findOutcomeSummaries', () => {
  it('returns summaries for outcome keys found in features', () => {
    const index = {
      features: [
        makeFeatureIndex('KEY-1', { summary: 'Outcome A' }),
        makeFeatureIndex('KEY-2', { summary: 'Outcome B' }),
        makeFeatureIndex('RHAISTRAT-100', { summary: 'Not an outcome' })
      ],
      rfes: []
    }

    const result = findOutcomeSummaries(index, ['KEY-1', 'KEY-2'])
    expect(result).toEqual({
      'KEY-1': 'Outcome A',
      'KEY-2': 'Outcome B'
    })
  })

  it('returns empty for missing keys', () => {
    const index = { features: [], rfes: [] }
    const result = findOutcomeSummaries(index, ['KEY-999'])
    expect(result).toEqual({})
  })

  it('returns empty for empty input', () => {
    const result = findOutcomeSummaries({ features: [] }, [])
    expect(result).toEqual({})
  })
})

describe('findTier2Features', () => {
  it('finds features with matching target version, excluding Tier 1', () => {
    const index = {
      features: [
        makeFeatureIndex('RHAISTRAT-100', { targetVersions: ['rhoai-3.5'] }),
        makeFeatureIndex('RHAISTRAT-101', { targetVersions: ['rhoai-3.5'] }),
        makeFeatureIndex('RHAISTRAT-102', { targetVersions: ['rhoai-3.4'] })
      ],
      rfes: []
    }
    const details = [
      makeFeatureDetail('RHAISTRAT-101', { targetVersions: ['rhoai-3.5'] })
    ]
    const readFromStorage = createMockStorage(details)
    const excludeKeys = new Set(['RHAISTRAT-100'])

    const results = findTier2Features(readFromStorage, index, '3.5', excludeKeys)
    expect(results).toHaveLength(1)
    expect(results[0].key).toBe('RHAISTRAT-101')
  })

  it('excludes closed statuses', () => {
    const index = {
      features: [
        makeFeatureIndex('RHAISTRAT-100', { targetVersions: ['rhoai-3.5'], status: 'Done' })
      ],
      rfes: []
    }
    const readFromStorage = createMockStorage([])

    const results = findTier2Features(readFromStorage, index, '3.5', new Set())
    expect(results).toHaveLength(0)
  })
})

describe('findTier2Rfes', () => {
  it('finds RFEs with candidate label, excluding Tier 1', () => {
    const index = {
      features: [],
      rfes: [
        makeRfeIndex('RHAIRFE-100', { labels: ['3.5-candidate'], status: 'New' }),
        makeRfeIndex('RHAIRFE-101', { labels: ['3.5-candidate'], status: 'New' }),
        makeRfeIndex('RHAIRFE-102', { labels: [], status: 'New' })
      ]
    }
    const rfeDetails = [
      makeRfeDetail('RHAIRFE-101', { labels: ['3.5-candidate'] })
    ]
    const readFromStorage = createMockStorage([], rfeDetails)
    const excludeKeys = new Set(['RHAIRFE-100'])

    const results = findTier2Rfes(readFromStorage, index, '3.5', excludeKeys)
    expect(results).toHaveLength(1)
    expect(results[0].key).toBe('RHAIRFE-101')
  })
})

describe('findTier3Features', () => {
  it('finds In Progress features without target version or fix version', () => {
    const index = {
      features: [
        makeFeatureIndex('RHAISTRAT-100', { status: 'In Progress', targetVersions: null, fixVersions: [] }),
        makeFeatureIndex('RHAISTRAT-101', { status: 'New', targetVersions: null, fixVersions: [] }),
        makeFeatureIndex('RHAISTRAT-102', { status: 'In Progress', targetVersions: ['rhoai-3.5'], fixVersions: [] }),
        makeFeatureIndex('RHAISTRAT-103', { status: 'In Progress', targetVersions: null, fixVersions: ['v1'] })
      ],
      rfes: []
    }
    const details = [
      makeFeatureDetail('RHAISTRAT-100', { status: 'In Progress' })
    ]
    const readFromStorage = createMockStorage(details)

    const results = findTier3Features(readFromStorage, index, new Set())
    expect(results).toHaveLength(1)
    expect(results[0].key).toBe('RHAISTRAT-100')
  })

  it('excludes already-discovered keys', () => {
    const index = {
      features: [
        makeFeatureIndex('RHAISTRAT-100', { status: 'In Progress', targetVersions: null, fixVersions: [] })
      ],
      rfes: []
    }
    const readFromStorage = createMockStorage([])

    const results = findTier3Features(readFromStorage, index, new Set(['RHAISTRAT-100']))
    expect(results).toHaveLength(0)
  })
})

describe('validateKeysFromCache', () => {
  it('validates keys found in features and rfes', () => {
    const index = {
      features: [makeFeatureIndex('RHAISTRAT-100', { summary: 'Feature A' })],
      rfes: [makeRfeIndex('RHAIRFE-100', { summary: 'RFE B' })]
    }

    const results = validateKeysFromCache(index, ['RHAISTRAT-100', 'RHAIRFE-100', 'MISSING-1'])
    expect(results['RHAISTRAT-100']).toEqual({ valid: true, summary: 'Feature A' })
    expect(results['RHAIRFE-100']).toEqual({ valid: true, summary: 'RFE B' })
    expect(results['MISSING-1'].valid).toBe(false)
  })
})
