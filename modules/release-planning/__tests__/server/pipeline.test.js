import { describe, it, expect } from 'vitest'
const { runPipeline, buildCandidateResponse } = require('../../server/pipeline')

function makeFeatureIndex(key, opts) {
  var o = opts || {}
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
  var o = opts || {}
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
  var o = opts || {}
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
  var o = opts || {}
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
  var store = {
    'feature-traffic/index.json': index
  }
  if (featureDetails) {
    for (var i = 0; i < featureDetails.length; i++) {
      store['feature-traffic/features/' + featureDetails[i].key + '.json'] = featureDetails[i]
    }
  }
  if (rfeDetails) {
    for (var j = 0; j < rfeDetails.length; j++) {
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
    var index = {
      features: [
        makeFeatureIndex('RHAISTRAT-1513', { summary: 'MaaS Outcome', status: 'New' }),
        makeFeatureIndex('RHAISTRAT-100', { parentKey: 'RHAISTRAT-1513', targetVersions: ['rhoai-3.5'], status: 'In Progress' }),
        makeFeatureIndex('RHAISTRAT-101', { parentKey: 'RHAISTRAT-1513', targetVersions: ['rhoai-3.5'], status: 'New' })
      ],
      rfes: []
    }
    var details = [
      makeFeatureDetail('RHAISTRAT-100', { parentKey: 'RHAISTRAT-1513', targetVersions: ['rhoai-3.5'] }),
      makeFeatureDetail('RHAISTRAT-101', { parentKey: 'RHAISTRAT-1513', targetVersions: ['rhoai-3.5'], status: 'New' })
    ]
    var readFromStorage = createMockStorage(index, details)

    var config = makeConfig()
    var bigRocks = [
      { priority: 1, name: 'MaaS', outcomeKeys: ['RHAISTRAT-1513'], pillar: 'Inference' }
    ]

    var result = runPipeline(config, bigRocks, '3.5', readFromStorage)

    expect(result.features).toHaveLength(2)
    expect(result.tier1Features).toBe(2)
    expect(result.features[0].bigRock).toBe('MaaS')
    expect(result.features[0].tier).toBe(1)
  })

  it('filters features without matching target release', () => {
    var index = {
      features: [
        makeFeatureIndex('KEY-1', { summary: 'Outcome', status: 'New' }),
        makeFeatureIndex('RHAISTRAT-100', { parentKey: 'KEY-1', targetVersions: ['rhoai-3.4'], status: 'In Progress' }),
        makeFeatureIndex('RHAISTRAT-101', { parentKey: 'KEY-1', targetVersions: ['rhoai-3.5'], status: 'New' })
      ],
      rfes: []
    }
    var details = [
      makeFeatureDetail('RHAISTRAT-100', { parentKey: 'KEY-1', targetVersions: ['rhoai-3.4'] }),
      makeFeatureDetail('RHAISTRAT-101', { parentKey: 'KEY-1', targetVersions: ['rhoai-3.5'], status: 'New' })
    ]
    var readFromStorage = createMockStorage(index, details)

    var config = makeConfig()
    var bigRocks = [
      { priority: 1, name: 'Rock', outcomeKeys: ['KEY-1'], pillar: 'Platform' }
    ]

    var result = runPipeline(config, bigRocks, '3.5', readFromStorage)

    expect(result.features).toHaveLength(1)
    expect(result.features[0].issueKey).toBe('RHAISTRAT-101')
    expect(result.skippedCount).toBe(1)
  })

  it('filters terminal status features', () => {
    var index = {
      features: [
        makeFeatureIndex('KEY-1', { summary: 'Outcome', status: 'New' }),
        makeFeatureIndex('RHAISTRAT-100', { parentKey: 'KEY-1', targetVersions: ['rhoai-3.5'], status: 'Review' }),
        makeFeatureIndex('RHAISTRAT-101', { parentKey: 'KEY-1', targetVersions: ['rhoai-3.5'], status: 'In Progress' })
      ],
      rfes: []
    }
    var details = [
      makeFeatureDetail('RHAISTRAT-100', { parentKey: 'KEY-1', targetVersions: ['rhoai-3.5'], status: 'Review' }),
      makeFeatureDetail('RHAISTRAT-101', { parentKey: 'KEY-1', targetVersions: ['rhoai-3.5'] })
    ]
    var readFromStorage = createMockStorage(index, details)

    var config = makeConfig()
    var bigRocks = [
      { priority: 1, name: 'Rock', outcomeKeys: ['KEY-1'], pillar: 'Platform' }
    ]

    var result = runPipeline(config, bigRocks, '3.5', readFromStorage)

    expect(result.features).toHaveLength(1)
    // Terminal feature is discovered and filtered in both Tier 1 and Tier 2 scans
    expect(result.terminalFilteredCount).toBe(2)
  })

  it('deduplicates features across multiple rocks sharing an outcome', () => {
    var index = {
      features: [
        makeFeatureIndex('KEY-1', { summary: 'Outcome 1', status: 'New' }),
        makeFeatureIndex('RHAISTRAT-100', { parentKey: 'KEY-1', targetVersions: ['rhoai-3.5'] })
      ],
      rfes: []
    }
    var details = [
      makeFeatureDetail('RHAISTRAT-100', { parentKey: 'KEY-1', targetVersions: ['rhoai-3.5'] })
    ]
    var readFromStorage = createMockStorage(index, details)

    var config = makeConfig()
    var bigRocks = [
      { priority: 1, name: 'Rock A', outcomeKeys: ['KEY-1'], pillar: 'Inference' },
      { priority: 2, name: 'Rock B', outcomeKeys: ['KEY-1'], pillar: 'Platform' }
    ]

    var result = runPipeline(config, bigRocks, '3.5', readFromStorage)

    expect(result.features).toHaveLength(1)
    expect(result.features[0].bigRock).toBe('Rock A, Rock B')
  })

  it('applies rockFilter', () => {
    var index = {
      features: [
        makeFeatureIndex('KEY-1', { summary: 'Outcome', status: 'New' }),
        makeFeatureIndex('RHAISTRAT-100', { parentKey: 'KEY-1', targetVersions: ['rhoai-3.5'] })
      ],
      rfes: []
    }
    var details = [
      makeFeatureDetail('RHAISTRAT-100', { parentKey: 'KEY-1', targetVersions: ['rhoai-3.5'] })
    ]
    var readFromStorage = createMockStorage(index, details)

    var config = makeConfig()
    var bigRocks = [
      { priority: 1, name: 'MaaS', outcomeKeys: ['KEY-1'], pillar: 'Inference' },
      { priority: 2, name: 'Other', outcomeKeys: ['KEY-2'], pillar: 'Platform' }
    ]

    var result = runPipeline(config, bigRocks, '3.5', readFromStorage, { rockFilter: 'MaaS' })

    expect(result.features).toHaveLength(1)
    expect(result.features[0].bigRock).toBe('MaaS')
  })

  it('throws for invalid rockFilter', () => {
    var readFromStorage = createMockStorage({ features: [], rfes: [] })
    var config = makeConfig()
    var bigRocks = [
      { priority: 1, name: 'MaaS', outcomeKeys: ['KEY-1'], pillar: 'Inference' }
    ]

    expect(function() {
      runPipeline(config, bigRocks, '3.5', readFromStorage, { rockFilter: 'NonExistent' })
    }).toThrow('No matching rock found')
  })

  it('skips rocks without outcome keys', () => {
    var index = { features: [], rfes: [] }
    var readFromStorage = createMockStorage(index)

    var config = makeConfig()
    var bigRocks = [
      { priority: 1, name: 'NoOutcome', outcomeKeys: [], pillar: 'Platform' }
    ]

    var result = runPipeline(config, bigRocks, '3.5', readFromStorage)

    expect(result.features).toHaveLength(0)
    expect(result.rocksWithoutOutcomes).toContain('NoOutcome')
  })

  it('discovers RFEs linked to outcomes', () => {
    var index = {
      features: [
        makeFeatureIndex('KEY-1', { summary: 'Outcome', status: 'New' })
      ],
      rfes: [
        makeRfeIndex('RHAIRFE-100', { labels: ['3.5-candidate'], status: 'New' })
      ]
    }
    var rfeDetails = [
      makeRfeDetail('RHAIRFE-100', {
        labels: ['3.5-candidate'],
        issueLinks: [{ type: 'Dependency', direction: 'inward', linkedKey: 'KEY-1', linkedSummary: 'Outcome', linkedStatus: 'In Progress' }]
      })
    ]
    var readFromStorage = createMockStorage(index, [], rfeDetails)

    var config = makeConfig()
    var bigRocks = [
      { priority: 1, name: 'Rock', outcomeKeys: ['KEY-1'], pillar: 'Data' }
    ]

    var result = runPipeline(config, bigRocks, '3.5', readFromStorage)

    expect(result.rfes).toHaveLength(1)
    expect(result.rfes[0].issueKey).toBe('RHAIRFE-100')
    expect(result.tier1Rfes).toBe(1)
  })

  it('excludes Approved RFEs', () => {
    var index = {
      features: [
        makeFeatureIndex('KEY-1', { summary: 'Outcome', status: 'New' })
      ],
      rfes: [
        makeRfeIndex('RHAIRFE-100', { labels: ['3.5-candidate'], status: 'Approved' })
      ]
    }
    var readFromStorage = createMockStorage(index, [], [])

    var config = makeConfig()
    var bigRocks = [
      { priority: 1, name: 'Rock', outcomeKeys: ['KEY-1'], pillar: 'Data' }
    ]

    var result = runPipeline(config, bigRocks, '3.5', readFromStorage)
    expect(result.rfes).toHaveLength(0)
  })

  it('discovers Tier 2 and Tier 3 features', () => {
    var index = {
      features: [
        makeFeatureIndex('KEY-1', { summary: 'Outcome', status: 'New' }),
        makeFeatureIndex('RHAISTRAT-100', { parentKey: 'KEY-1', targetVersions: ['rhoai-3.5'] }),
        makeFeatureIndex('RHAISTRAT-200', { parentKey: null, targetVersions: ['rhoai-3.5'], status: 'New' }),
        makeFeatureIndex('RHAISTRAT-300', { parentKey: null, targetVersions: null, fixVersions: [], status: 'In Progress' })
      ],
      rfes: []
    }
    var details = [
      makeFeatureDetail('RHAISTRAT-100', { parentKey: 'KEY-1', targetVersions: ['rhoai-3.5'] }),
      makeFeatureDetail('RHAISTRAT-200', { targetVersions: ['rhoai-3.5'], status: 'New' }),
      makeFeatureDetail('RHAISTRAT-300', { status: 'In Progress' })
    ]
    var readFromStorage = createMockStorage(index, details)

    var config = makeConfig()
    var bigRocks = [
      { priority: 1, name: 'Rock', outcomeKeys: ['KEY-1'], pillar: 'Platform' }
    ]

    var result = runPipeline(config, bigRocks, '3.5', readFromStorage)

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
    var pipelineResult = {
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
      release: '3.5'
    }

    var bigRocks = [
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

    var response = buildCandidateResponse(pipelineResult, '3.5', bigRocks, false)

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
  })
})
