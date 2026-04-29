import { describe, it, expect } from 'vitest'
const { runPipeline, buildCandidateResponse } = require('../../server/pipeline')

function makeFeatureIndex(key, opts) {
  const o = opts || {}
  return {
    key: key,
    summary: o.summary || 'Summary for ' + key,
    status: o.status || 'In Progress',
    statusCategory: o.statusCategory || 'In Progress',
    priority: o.priority || 'Major',
    assignee: o.assignee || 'Test User',
    fixVersions: o.fixVersions || [],
    targetVersions: o.targetVersions || null,
    pm: o.pm || null,
    architect: o.architect || null,
    parentKey: o.parentKey || null,
    labels: o.labels || [],
    completionPct: 0,
    epicCount: 0,
    issueCount: 0,
    blockerCount: 0,
    health: 'YELLOW',
    lastUpdated: '2026-01-01T00:00:00.000+0000'
  }
}

function makeFeatureDetail(key, opts) {
  const o = opts || {}
  return {
    key: key,
    summary: o.summary || 'Summary for ' + key,
    status: o.status || 'In Progress',
    statusCategory: o.statusCategory || 'In Progress',
    priority: o.priority || 'Major',
    assignee: o.assignee ? { displayName: o.assignee, accountId: 'acc-' + key } : null,
    fixVersions: o.fixVersions || [],
    targetVersions: o.targetVersions || null,
    pm: o.pm ? { displayName: o.pm, accountId: 'pm-' + key } : null,
    architect: o.architect ? { displayName: o.architect, accountId: 'arch-' + key } : null,
    parentKey: o.parentKey || null,
    labels: o.labels || [],
    components: o.components || [],
    created: '2025-01-01T00:00:00.000+0000',
    updated: '2026-01-01T00:00:00.000+0000',
    statusNotes: null,
    issueLinks: o.issueLinks || [],
    epics: [],
    metrics: {},
    topology: { repos: [] }
  }
}

function makeRfeIndex(key, opts) {
  const o = opts || {}
  return {
    key: key,
    summary: o.summary || 'RFE ' + key,
    status: o.status || 'New',
    statusCategory: o.statusCategory || 'To Do',
    priority: o.priority || 'Major',
    assignee: o.assignee || null,
    fixVersions: o.fixVersions || [],
    labels: o.labels || [],
    lastUpdated: '2026-01-01T00:00:00.000+0000'
  }
}

function makeRfeDetail(key, opts) {
  const o = opts || {}
  return {
    key: key,
    summary: o.summary || 'RFE ' + key,
    status: o.status || 'New',
    statusCategory: o.statusCategory || 'To Do',
    priority: o.priority || 'Major',
    assignee: null,
    fixVersions: o.fixVersions || [],
    labels: o.labels || [],
    components: o.components || [],
    created: '2025-01-01T00:00:00.000+0000',
    updated: '2026-01-01T00:00:00.000+0000',
    description: null,
    issueLinks: o.issueLinks || []
  }
}

function createMockStorage(index, featureDetails, rfeDetails) {
  const store = {
    'feature-traffic/index.json': index
  }
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

function makeConfig() {
  return {
    fieldMapping: {
      team: 'components',
      architect: 'architect',
      rfeLinkType: 'is required by'
    },
    customFieldIds: {
      targetVersion: 'targetVersions',
      productManager: 'pm',
      releaseType: 'phase'
    }
  }
}

describe('runPipeline', () => {
  it('discovers Tier 1 features from outcome children', () => {
    const index = {
      features: [
        makeFeatureIndex('RHAISTRAT-1513', { summary: 'MaaS Outcome', status: 'New' }),
        makeFeatureIndex('RHAISTRAT-100', { parentKey: 'RHAISTRAT-1513', targetVersions: ['rhoai-3.5'], status: 'In Progress' }),
        makeFeatureIndex('RHAISTRAT-101', { parentKey: 'RHAISTRAT-1513', targetVersions: ['rhoai-3.5'], status: 'New' })
      ],
      rfes: []
    }
    const details = [
      makeFeatureDetail('RHAISTRAT-100', { parentKey: 'RHAISTRAT-1513', targetVersions: ['rhoai-3.5'] }),
      makeFeatureDetail('RHAISTRAT-101', { parentKey: 'RHAISTRAT-1513', targetVersions: ['rhoai-3.5'], status: 'New' })
    ]
    const readFromStorage = createMockStorage(index, details)

    const config = makeConfig()
    const bigRocks = [
      { priority: 1, name: 'MaaS', outcomeKeys: ['RHAISTRAT-1513'], pillar: 'Inference' }
    ]

    const result = runPipeline(config, bigRocks, '3.5', readFromStorage)

    expect(result.features).toHaveLength(2)
    expect(result.tier1Features).toBe(2)
    expect(result.features[0].bigRock).toBe('MaaS')
    expect(result.features[0].tier).toBe(1)
  })

  it('filters features without matching target release', () => {
    const index = {
      features: [
        makeFeatureIndex('KEY-1', { summary: 'Outcome', status: 'New' }),
        makeFeatureIndex('RHAISTRAT-100', { parentKey: 'KEY-1', targetVersions: ['rhoai-3.4'], status: 'In Progress' }),
        makeFeatureIndex('RHAISTRAT-101', { parentKey: 'KEY-1', targetVersions: ['rhoai-3.5'], status: 'New' })
      ],
      rfes: []
    }
    const details = [
      makeFeatureDetail('RHAISTRAT-100', { parentKey: 'KEY-1', targetVersions: ['rhoai-3.4'] }),
      makeFeatureDetail('RHAISTRAT-101', { parentKey: 'KEY-1', targetVersions: ['rhoai-3.5'], status: 'New' })
    ]
    const readFromStorage = createMockStorage(index, details)

    const config = makeConfig()
    const bigRocks = [
      { priority: 1, name: 'Rock', outcomeKeys: ['KEY-1'], pillar: 'Platform' }
    ]

    const result = runPipeline(config, bigRocks, '3.5', readFromStorage)

    expect(result.features).toHaveLength(1)
    expect(result.features[0].issueKey).toBe('RHAISTRAT-101')
    expect(result.skippedCount).toBe(1)
  })

  it('filters terminal status features', () => {
    const index = {
      features: [
        makeFeatureIndex('KEY-1', { summary: 'Outcome', status: 'New' }),
        makeFeatureIndex('RHAISTRAT-100', { parentKey: 'KEY-1', targetVersions: ['rhoai-3.5'], status: 'Review' }),
        makeFeatureIndex('RHAISTRAT-101', { parentKey: 'KEY-1', targetVersions: ['rhoai-3.5'], status: 'In Progress' })
      ],
      rfes: []
    }
    const details = [
      makeFeatureDetail('RHAISTRAT-100', { parentKey: 'KEY-1', targetVersions: ['rhoai-3.5'], status: 'Review' }),
      makeFeatureDetail('RHAISTRAT-101', { parentKey: 'KEY-1', targetVersions: ['rhoai-3.5'] })
    ]
    const readFromStorage = createMockStorage(index, details)

    const config = makeConfig()
    const bigRocks = [
      { priority: 1, name: 'Rock', outcomeKeys: ['KEY-1'], pillar: 'Platform' }
    ]

    const result = runPipeline(config, bigRocks, '3.5', readFromStorage)

    expect(result.features).toHaveLength(1)
    // Terminal feature is discovered and filtered in both Tier 1 and Tier 2 scans
    expect(result.terminalFilteredCount).toBe(2)
  })

  it('deduplicates features across multiple rocks sharing an outcome', () => {
    const index = {
      features: [
        makeFeatureIndex('KEY-1', { summary: 'Outcome 1', status: 'New' }),
        makeFeatureIndex('RHAISTRAT-100', { parentKey: 'KEY-1', targetVersions: ['rhoai-3.5'] })
      ],
      rfes: []
    }
    const details = [
      makeFeatureDetail('RHAISTRAT-100', { parentKey: 'KEY-1', targetVersions: ['rhoai-3.5'] })
    ]
    const readFromStorage = createMockStorage(index, details)

    const config = makeConfig()
    const bigRocks = [
      { priority: 1, name: 'Rock A', outcomeKeys: ['KEY-1'], pillar: 'Inference' },
      { priority: 2, name: 'Rock B', outcomeKeys: ['KEY-1'], pillar: 'Platform' }
    ]

    const result = runPipeline(config, bigRocks, '3.5', readFromStorage)

    expect(result.features).toHaveLength(1)
    expect(result.features[0].bigRock).toBe('Rock A, Rock B')
  })

  it('applies rockFilter', () => {
    const index = {
      features: [
        makeFeatureIndex('KEY-1', { summary: 'Outcome', status: 'New' }),
        makeFeatureIndex('RHAISTRAT-100', { parentKey: 'KEY-1', targetVersions: ['rhoai-3.5'] })
      ],
      rfes: []
    }
    const details = [
      makeFeatureDetail('RHAISTRAT-100', { parentKey: 'KEY-1', targetVersions: ['rhoai-3.5'] })
    ]
    const readFromStorage = createMockStorage(index, details)

    const config = makeConfig()
    const bigRocks = [
      { priority: 1, name: 'MaaS', outcomeKeys: ['KEY-1'], pillar: 'Inference' },
      { priority: 2, name: 'Other', outcomeKeys: ['KEY-2'], pillar: 'Platform' }
    ]

    const result = runPipeline(config, bigRocks, '3.5', readFromStorage, { rockFilter: 'MaaS' })

    expect(result.features).toHaveLength(1)
    expect(result.features[0].bigRock).toBe('MaaS')
  })

  it('throws for invalid rockFilter', () => {
    const readFromStorage = createMockStorage({ features: [], rfes: [] })
    const config = makeConfig()
    const bigRocks = [
      { priority: 1, name: 'MaaS', outcomeKeys: ['KEY-1'], pillar: 'Inference' }
    ]

    expect(function() {
      runPipeline(config, bigRocks, '3.5', readFromStorage, { rockFilter: 'NonExistent' })
    }).toThrow('No matching rock found')
  })

  it('skips rocks without outcome keys', () => {
    const index = { features: [], rfes: [] }
    const readFromStorage = createMockStorage(index)

    const config = makeConfig()
    const bigRocks = [
      { priority: 1, name: 'NoOutcome', outcomeKeys: [], pillar: 'Platform' }
    ]

    const result = runPipeline(config, bigRocks, '3.5', readFromStorage)

    expect(result.features).toHaveLength(0)
    expect(result.rocksWithoutOutcomes).toContain('NoOutcome')
    // TBD rocks are tracked in rocksWithoutOutcomes but NOT in warnings
    expect(result.warnings).not.toEqual(
      expect.arrayContaining([expect.stringContaining('NoOutcome')])
    )
  })

  it('filters invalid outcome keys before processing', () => {
    const index = {
      features: [
        makeFeatureIndex('KEY-1', { summary: 'Valid Outcome', status: 'New' }),
        makeFeatureIndex('RHAISTRAT-100', { parentKey: 'KEY-1', targetVersions: ['rhoai-3.5'] })
      ],
      rfes: []
    }
    const details = [
      makeFeatureDetail('RHAISTRAT-100', { parentKey: 'KEY-1', targetVersions: ['rhoai-3.5'] })
    ]
    const readFromStorage = createMockStorage(index, details)

    const config = makeConfig()
    const bigRocks = [
      { priority: 1, name: 'Rock', outcomeKeys: ['KEY-1', 'not valid', '', 123, 'KEY-2'], pillar: 'Platform' }
    ]

    const result = runPipeline(config, bigRocks, '3.5', readFromStorage)

    expect(result.features).toHaveLength(1)
    expect(result.features[0].issueKey).toBe('RHAISTRAT-100')
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('invalid outcome key')])
    )
  })

  it('provides diagnostic detail when rock has outcomes but no qualifying features', () => {
    const index = {
      features: [
        makeFeatureIndex('KEY-1', { summary: 'Outcome', status: 'New' }),
        makeFeatureIndex('RHAISTRAT-100', { parentKey: 'KEY-1', targetVersions: ['rhoai-3.4'], status: 'In Progress' }),
        makeFeatureIndex('RHAISTRAT-101', { parentKey: 'KEY-1', targetVersions: null, status: 'New' }),
        makeFeatureIndex('RHAISTRAT-102', { parentKey: 'KEY-1', targetVersions: ['rhoai-3.5'], status: 'Closed' })
      ],
      rfes: []
    }
    const details = [
      makeFeatureDetail('RHAISTRAT-100', { parentKey: 'KEY-1', targetVersions: ['rhoai-3.4'] }),
      makeFeatureDetail('RHAISTRAT-102', { parentKey: 'KEY-1', targetVersions: ['rhoai-3.5'], status: 'Closed' })
    ]
    const readFromStorage = createMockStorage(index, details)

    const config = makeConfig()
    const bigRocks = [
      { priority: 1, name: 'TestRock', outcomeKeys: ['KEY-1'], pillar: 'Platform' }
    ]

    const result = runPipeline(config, bigRocks, '3.5', readFromStorage)

    // Should have a diagnostic warning with filter breakdown
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('candidate(s) with matching parentKey')])
    )
    // Should mention specific filter reasons
    const diagWarning = result.warnings.find(function(w) { return w.indexOf('candidate(s) with matching parentKey') !== -1 })
    expect(diagWarning).toBeDefined()
    expect(diagWarning).toContain('excluded')
  })

  it('warns about missing parentKey when no features match at all', () => {
    const index = {
      features: [
        makeFeatureIndex('KEY-1', { summary: 'Outcome', status: 'New' })
      ],
      rfes: []
    }
    const readFromStorage = createMockStorage(index)

    const config = makeConfig()
    const bigRocks = [
      { priority: 1, name: 'EmptyRock', outcomeKeys: ['KEY-1'], pillar: 'Platform' }
    ]

    const result = runPipeline(config, bigRocks, '3.5', readFromStorage)

    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('no features with matching parentKey found in the index')])
    )
  })

  it('accumulates warnings for empty index', () => {
    const index = { features: [], rfes: [] }
    const readFromStorage = createMockStorage(index)

    const config = makeConfig()
    const bigRocks = [
      { priority: 1, name: 'Rock', outcomeKeys: ['KEY-999'], pillar: 'Platform' }
    ]

    const result = runPipeline(config, bigRocks, '3.5', readFromStorage)

    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Feature-traffic index is empty')
      ])
    )
  })

  it('returns missingOutcomes array listing keys not found in index', () => {
    const index = {
      features: [
        makeFeatureIndex('KEY-1', { summary: 'Outcome Found' })
      ],
      rfes: []
    }
    const readFromStorage = createMockStorage(index)

    const config = makeConfig()
    const bigRocks = [
      { priority: 1, name: 'Rock', outcomeKeys: ['KEY-1', 'KEY-999', 'KEY-888'], pillar: 'Platform' }
    ]

    const result = runPipeline(config, bigRocks, '3.5', readFromStorage)

    expect(result.missingOutcomes).toBeDefined()
    expect(result.missingOutcomes).toContain('KEY-999')
    expect(result.missingOutcomes).toContain('KEY-888')
    expect(result.missingOutcomes).not.toContain('KEY-1')
    // Missing outcomes should NOT be in warnings (downgraded to info)
    expect(result.warnings).not.toEqual(
      expect.arrayContaining([expect.stringContaining('not found in feature-traffic data')])
    )
  })

  it('discovers RFEs linked to outcomes', () => {
    const index = {
      features: [
        makeFeatureIndex('KEY-1', { summary: 'Outcome', status: 'New' })
      ],
      rfes: [
        makeRfeIndex('RHAIRFE-100', { labels: ['3.5-candidate'], status: 'New' })
      ]
    }
    const rfeDetails = [
      makeRfeDetail('RHAIRFE-100', {
        labels: ['3.5-candidate'],
        issueLinks: [{ type: 'Dependency', direction: 'inward', linkedKey: 'KEY-1', linkedSummary: 'Outcome', linkedStatus: 'In Progress' }]
      })
    ]
    const readFromStorage = createMockStorage(index, [], rfeDetails)

    const config = makeConfig()
    const bigRocks = [
      { priority: 1, name: 'Rock', outcomeKeys: ['KEY-1'], pillar: 'Data' }
    ]

    const result = runPipeline(config, bigRocks, '3.5', readFromStorage)

    expect(result.rfes).toHaveLength(1)
    expect(result.rfes[0].issueKey).toBe('RHAIRFE-100')
    expect(result.tier1Rfes).toBe(1)
  })

  it('excludes Approved RFEs', () => {
    const index = {
      features: [
        makeFeatureIndex('KEY-1', { summary: 'Outcome', status: 'New' })
      ],
      rfes: [
        makeRfeIndex('RHAIRFE-100', { labels: ['3.5-candidate'], status: 'Approved' })
      ]
    }
    const readFromStorage = createMockStorage(index, [], [])

    const config = makeConfig()
    const bigRocks = [
      { priority: 1, name: 'Rock', outcomeKeys: ['KEY-1'], pillar: 'Data' }
    ]

    const result = runPipeline(config, bigRocks, '3.5', readFromStorage)
    expect(result.rfes).toHaveLength(0)
  })

  it('discovers Tier 2 and Tier 3 features', () => {
    const index = {
      features: [
        makeFeatureIndex('KEY-1', { summary: 'Outcome', status: 'New' }),
        makeFeatureIndex('RHAISTRAT-100', { parentKey: 'KEY-1', targetVersions: ['rhoai-3.5'] }),
        makeFeatureIndex('RHAISTRAT-200', { parentKey: null, targetVersions: ['rhoai-3.5'], status: 'New' }),
        makeFeatureIndex('RHAISTRAT-300', { parentKey: null, targetVersions: null, fixVersions: [], status: 'In Progress' })
      ],
      rfes: []
    }
    const details = [
      makeFeatureDetail('RHAISTRAT-100', { parentKey: 'KEY-1', targetVersions: ['rhoai-3.5'] }),
      makeFeatureDetail('RHAISTRAT-200', { targetVersions: ['rhoai-3.5'], status: 'New' }),
      makeFeatureDetail('RHAISTRAT-300', { status: 'In Progress' })
    ]
    const readFromStorage = createMockStorage(index, details)

    const config = makeConfig()
    const bigRocks = [
      { priority: 1, name: 'Rock', outcomeKeys: ['KEY-1'], pillar: 'Platform' }
    ]

    const result = runPipeline(config, bigRocks, '3.5', readFromStorage)

    expect(result.tier1Features).toBe(1)
    expect(result.tier2Features).toBe(1)
    expect(result.tier3Features).toBe(1)
    expect(result.features).toHaveLength(3)
    expect(result.features[0].tier).toBe(1)
    expect(result.features[1].tier).toBe(2)
    expect(result.features[2].tier).toBe(3)
  })
})

describe('buildCandidateResponse', () => {
  it('builds a complete response object', () => {
    const pipelineResult = {
      features: [
        { issueKey: 'RHAISTRAT-100', status: 'In Progress', priority: 'Major', components: 'Serving', bigRock: 'MaaS', tier: 1, labels: '' },
        { issueKey: 'RHAISTRAT-200', status: 'New', priority: 'Normal', components: 'Platform', bigRock: '', tier: 2, labels: '' }
      ],
      rfes: [
        { issueKey: 'RHAIRFE-100', status: 'Approved', priority: 'Major', components: 'Serving', bigRock: 'MaaS', tier: 1, labels: '3.5-candidate' }
      ],
      tier1Features: 1,
      tier1Rfes: 1,
      tier2Features: 1,
      tier2Rfes: 0,
      tier3Features: 0,
      outcomeSummaries: { 'KEY-1': 'MaaS Outcome' },
      perRockStats: { 'MaaS': { features: 1, rfes: 1 } },
      release: '3.5',
      warnings: ['test warning']
    }

    const bigRocks = [
      {
        priority: 1,
        name: 'MaaS',
        fullName: 'MaaS (continue from 3.4)',
        pillar: 'Inference',
        state: 'continue from 3.4',
        owner: 'Pat Johnson',
        outcomeKeys: ['KEY-1'],
        notes: ''
      }
    ]

    const response = buildCandidateResponse(pipelineResult, '3.5', bigRocks, false)

    expect(response.version).toBe('3.5')
    expect(response.demoMode).toBe(false)
    expect(response.summary.totalFeatures).toBe(2)
    expect(response.summary.totalRfes).toBe(1)
    expect(response.summary.tier1.features).toBe(1)
    expect(response.summary.tier2.features).toBe(1)
    expect(response.bigRocks).toHaveLength(1)
    expect(response.bigRocks[0].featureCount).toBe(1)
    expect(response.features).toHaveLength(2)
    expect(response.rfes).toHaveLength(1)
    expect(response.filterOptions.statuses).toContain('In Progress')
    expect(response.filterOptions.pillars).toContain('Inference')
    expect(response.pipelineWarnings).toEqual(['test warning'])
  })

  it('omits pipelineWarnings when empty', () => {
    const pipelineResult = {
      features: [],
      rfes: [],
      tier1Features: 0,
      tier1Rfes: 0,
      tier2Features: 0,
      tier2Rfes: 0,
      tier3Features: 0,
      outcomeSummaries: {},
      perRockStats: {},
      release: '3.5',
      warnings: []
    }

    const response = buildCandidateResponse(pipelineResult, '3.5', [], false)

    expect(response.pipelineWarnings).toBeUndefined()
  })
})
