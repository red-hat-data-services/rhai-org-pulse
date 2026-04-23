import { describe, it, expect, vi, beforeEach } from 'vitest'
const { runPipeline, buildCandidateResponse } = require('../../server/pipeline')

function makeIssue(key, opts) {
  const o = opts || {}
  return {
    key,
    fields: {
      summary: o.summary || `Summary for ${key}`,
      status: { name: o.status || 'In Progress' },
      priority: { name: o.priority || 'Major' },
      components: (o.components || []).map(c => ({ name: c })),
      labels: o.labels || [],
      fixVersions: (o.fixVersions || []).map(v => ({ name: v })),
      issuelinks: o.issuelinks || [],
      assignee: o.assignee ? { displayName: o.assignee } : null,
      description: o.description || '',
      customfield_10855: o.targetVersion ? [{ name: o.targetVersion }] : null,
      customfield_10469: o.pm ? { displayName: o.pm } : null,
      customfield_10851: o.phase ? { value: o.phase } : null
    }
  }
}

function makeConfig() {
  return {
    fieldMapping: {
      team: 'customfield_team',
      architect: 'customfield_arch',
      rfeLinkType: 'is required by'
    },
    customFieldIds: {
      targetVersion: 'customfield_10855',
      productManager: 'customfield_10469',
      releaseType: 'customfield_10851'
    }
  }
}

describe('runPipeline', () => {
  let mockFetchAll
  let mockJiraRequest

  beforeEach(() => {
    mockJiraRequest = vi.fn()
    mockFetchAll = vi.fn()
  })

  it('discovers Tier 1 features from outcome children', async () => {
    const tier1Issues = [
      makeIssue('RHAISTRAT-100', { targetVersion: 'rhoai-3.5', status: 'In Progress' }),
      makeIssue('RHAISTRAT-101', { targetVersion: 'rhoai-3.5', status: 'New' })
    ]

    mockFetchAll
      .mockResolvedValueOnce([{ key: 'RHAISTRAT-1513', fields: { summary: 'MaaS Outcome' } }]) // summaries
      .mockResolvedValueOnce(tier1Issues) // outcome features
      .mockResolvedValueOnce([]) // outcome rfes
      .mockResolvedValueOnce([]) // tier2 features
      .mockResolvedValueOnce([]) // tier2 rfes
      .mockResolvedValueOnce([]) // tier3 features

    const config = makeConfig()
    const bigRocks = [
      { priority: 1, name: 'MaaS', outcomeKeys: ['RHAISTRAT-1513'], pillar: 'Inference' }
    ]

    const result = await runPipeline(config, bigRocks, '3.5', mockFetchAll, mockJiraRequest)

    expect(result.features).toHaveLength(2)
    expect(result.tier1Features).toBe(2)
    expect(result.features[0].bigRock).toBe('MaaS')
    expect(result.features[0].tier).toBe(1)
  })

  it('filters features without matching target release', async () => {
    const tier1Issues = [
      makeIssue('RHAISTRAT-100', { targetVersion: 'rhoai-3.4', status: 'In Progress' }),
      makeIssue('RHAISTRAT-101', { targetVersion: 'rhoai-3.5', status: 'New' })
    ]

    mockFetchAll
      .mockResolvedValueOnce([{ key: 'KEY-1', fields: { summary: 'Outcome' } }])
      .mockResolvedValueOnce(tier1Issues) // outcome features
      .mockResolvedValueOnce([]) // outcome rfes
      .mockResolvedValueOnce([]) // tier2 features
      .mockResolvedValueOnce([]) // tier2 rfes
      .mockResolvedValueOnce([]) // tier3 features

    const config = makeConfig()
    const bigRocks = [
      { priority: 1, name: 'Rock', outcomeKeys: ['KEY-1'], pillar: 'Platform' }
    ]

    const result = await runPipeline(config, bigRocks, '3.5', mockFetchAll, mockJiraRequest)

    expect(result.features).toHaveLength(1)
    expect(result.features[0].issueKey).toBe('RHAISTRAT-101')
    expect(result.skippedCount).toBe(1)
  })

  it('filters terminal status features', async () => {
    const tier1Issues = [
      makeIssue('RHAISTRAT-100', { targetVersion: 'rhoai-3.5', status: 'Review' }),
      makeIssue('RHAISTRAT-101', { targetVersion: 'rhoai-3.5', status: 'In Progress' })
    ]

    mockFetchAll
      .mockResolvedValueOnce([{ key: 'KEY-1', fields: { summary: 'Outcome' } }])
      .mockResolvedValueOnce(tier1Issues) // outcome features
      .mockResolvedValueOnce([]) // outcome rfes
      .mockResolvedValueOnce([]) // tier2 features
      .mockResolvedValueOnce([]) // tier2 rfes
      .mockResolvedValueOnce([]) // tier3 features

    const config = makeConfig()
    const bigRocks = [
      { priority: 1, name: 'Rock', outcomeKeys: ['KEY-1'], pillar: 'Platform' }
    ]

    const result = await runPipeline(config, bigRocks, '3.5', mockFetchAll, mockJiraRequest)

    expect(result.features).toHaveLength(1)
    expect(result.terminalFilteredCount).toBe(1)
  })

  it('deduplicates features across multiple rocks', async () => {
    const sharedIssue = makeIssue('RHAISTRAT-100', { targetVersion: 'rhoai-3.5' })

    mockFetchAll
      .mockResolvedValueOnce([
        { key: 'KEY-1', fields: { summary: 'Outcome 1' } },
        { key: 'KEY-2', fields: { summary: 'Outcome 2' } }
      ])
      .mockResolvedValueOnce([sharedIssue]) // rock A outcome features
      .mockResolvedValueOnce([]) // rock A outcome rfes
      .mockResolvedValueOnce([sharedIssue]) // rock B outcome features
      .mockResolvedValueOnce([]) // rock B outcome rfes
      .mockResolvedValueOnce([]) // tier2 features
      .mockResolvedValueOnce([]) // tier2 rfes
      .mockResolvedValueOnce([]) // tier3

    const config = makeConfig()
    const bigRocks = [
      { priority: 1, name: 'Rock A', outcomeKeys: ['KEY-1'], pillar: 'Inference' },
      { priority: 2, name: 'Rock B', outcomeKeys: ['KEY-2'], pillar: 'Platform' }
    ]

    const result = await runPipeline(config, bigRocks, '3.5', mockFetchAll, mockJiraRequest)

    expect(result.features).toHaveLength(1)
    expect(result.features[0].bigRock).toBe('Rock A, Rock B')
  })

  it('applies rockFilter', async () => {
    mockFetchAll
      .mockResolvedValueOnce([{ key: 'KEY-1', fields: { summary: 'Outcome' } }])
      .mockResolvedValueOnce([makeIssue('RHAISTRAT-100', { targetVersion: 'rhoai-3.5' })]) // outcome features
      .mockResolvedValueOnce([]) // outcome rfes
      .mockResolvedValueOnce([]) // tier2 features
      .mockResolvedValueOnce([]) // tier2 rfes
      .mockResolvedValueOnce([]) // tier3 features

    const config = makeConfig()
    const bigRocks = [
      { priority: 1, name: 'MaaS', outcomeKeys: ['KEY-1'], pillar: 'Inference' },
      { priority: 2, name: 'Other', outcomeKeys: ['KEY-2'], pillar: 'Platform' }
    ]

    const result = await runPipeline(config, bigRocks, '3.5', mockFetchAll, mockJiraRequest, { rockFilter: 'MaaS' })

    expect(result.features).toHaveLength(1)
    expect(result.features[0].bigRock).toBe('MaaS')
  })

  it('throws for invalid rockFilter', async () => {
    const config = makeConfig()
    const bigRocks = [
      { priority: 1, name: 'MaaS', outcomeKeys: ['KEY-1'], pillar: 'Inference' }
    ]

    await expect(
      runPipeline(config, bigRocks, '3.5', mockFetchAll, mockJiraRequest, { rockFilter: 'NonExistent' })
    ).rejects.toThrow('No matching rock found')
  })

  it('skips rocks without outcome keys', async () => {
    mockFetchAll
      .mockResolvedValueOnce([]) // summaries (empty)
      .mockResolvedValueOnce([]) // tier2 features
      .mockResolvedValueOnce([]) // tier2 rfes
      .mockResolvedValueOnce([]) // tier3 features

    const config = makeConfig()
    const bigRocks = [
      { priority: 1, name: 'NoOutcome', outcomeKeys: [], pillar: 'Platform' }
    ]

    const result = await runPipeline(config, bigRocks, '3.5', mockFetchAll, mockJiraRequest)

    expect(result.features).toHaveLength(0)
    expect(result.rocksWithoutOutcomes).toContain('NoOutcome')
  })

  it('discovers RFEs with candidate labels', async () => {
    const rfeIssue = makeIssue('RHAIRFE-100', {
      status: 'New',
      labels: ['3.5-candidate']
    })

    mockFetchAll
      .mockResolvedValueOnce([{ key: 'KEY-1', fields: { summary: 'Outcome' } }])
      .mockResolvedValueOnce([]) // outcome features
      .mockResolvedValueOnce([rfeIssue]) // outcome rfes
      .mockResolvedValueOnce([]) // tier2 features
      .mockResolvedValueOnce([]) // tier2 rfes
      .mockResolvedValueOnce([]) // tier3 features

    const config = makeConfig()
    const bigRocks = [
      { priority: 1, name: 'Rock', outcomeKeys: ['KEY-1'], pillar: 'Data' }
    ]

    const result = await runPipeline(config, bigRocks, '3.5', mockFetchAll, mockJiraRequest)

    expect(result.rfes).toHaveLength(1)
    expect(result.rfes[0].issueKey).toBe('RHAIRFE-100')
    expect(result.tier1Rfes).toBe(1)
  })

  it('skips Approved RFEs via JQL filter', async () => {
    mockFetchAll
      .mockResolvedValueOnce([{ key: 'KEY-1', fields: { summary: 'Outcome' } }])
      .mockResolvedValueOnce([]) // outcome features
      .mockResolvedValueOnce([]) // outcome rfes (Approved excluded by JQL)
      .mockResolvedValueOnce([]) // tier2 features
      .mockResolvedValueOnce([]) // tier2 rfes
      .mockResolvedValueOnce([]) // tier3 features

    const config = makeConfig()
    const bigRocks = [
      { priority: 1, name: 'Rock', outcomeKeys: ['KEY-1'], pillar: 'Data' }
    ]

    const result = await runPipeline(config, bigRocks, '3.5', mockFetchAll, mockJiraRequest)
    expect(result.rfes).toHaveLength(0)
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
      release: '3.5'
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
  })
})
