import { describe, it, expect, vi } from 'vitest'

var {
  runHealthPipeline,
  buildEmptyCache
} = require('../../../server/planning/health/health-pipeline')

function makeStorage(data) {
  var store = {}
  if (data) {
    for (var k in data) store[k] = data[k]
  }
  return {
    readFromStorage: async function(key) {
      return store[key] ? JSON.parse(JSON.stringify(store[key])) : null
    },
    writeToStorage: async function(key, value) {
      store[key] = value
    },
    _store: store
  }
}

function makeCandidatesCache(features) {
  return {
    'releases/planning/candidates-cache-3.5.json': {
      cachedAt: '2026-04-26T00:00:00Z',
      data: { features: features }
    }
  }
}

describe('FPDoR in health pipeline', function() {
  it('computes fpdor for each health feature', async function() {
    var storage = makeStorage(makeCandidatesCache([
      {
        issueKey: 'T-1', summary: 'Feature 1', status: 'In Progress',
        components: ['Dashboard'], fixVersion: '', deliveryOwner: 'Jane',
        pm: 'Rick', tier: 1, targetRelease: '3.5',
        phase: 'GA', epicCount: 3
      }
    ]))
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    expect(result.features).toHaveLength(1)
    var f = result.features[0]
    expect(f.fpdor).toBeDefined()
    expect(f.fpdor.items).toHaveLength(13)
    expect(f.fpdor.totalCount).toBe(13)
    expect(typeof f.fpdor.passedCount).toBe('number')
    expect(typeof f.fpdor.evaluatedCount).toBe('number')
  })

  it('all 13 items have source jira', async function() {
    var storage = makeStorage(makeCandidatesCache([
      { issueKey: 'T-1', summary: 'F1', status: 'In Progress', components: '', fixVersion: '', deliveryOwner: 'Jane', tier: 1 }
    ]))
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    var items = result.features[0].fpdor.items
    var jiraItems = items.filter(function(i) { return i.source === 'jira' })
    expect(jiraItems).toHaveLength(13)
  })

  it('pipeline-backed items fail when no execution detail has scores', async function() {
    var storage = makeStorage(makeCandidatesCache([
      { issueKey: 'T-1', summary: 'F1', status: 'In Progress', components: '', fixVersion: '', deliveryOwner: 'Jane', tier: 1 }
    ]))
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    var items = result.features[0].fpdor.items
    var acItem = items.find(function(i) { return i.name === 'Acceptance Criteria' })
    var archItem = items.find(function(i) { return i.name === 'Architectural Alignment' })
    var riskItem = items.find(function(i) { return i.name === 'Risks & Assumptions' })
    expect(acItem.state).toBe('failed')
    expect(acItem.pass).toBe(false)
    expect(archItem.state).toBe('failed')
    expect(archItem.pass).toBe(false)
    expect(riskItem.state).toBe('failed')
    expect(riskItem.pass).toBe(false)
  })

  it('pipeline-backed items pass when execution detail has high scores', async function() {
    var candidatesData = makeCandidatesCache([
      { issueKey: 'T-1', summary: 'F1', status: 'In Progress', components: ['Dashboard'], fixVersion: '', deliveryOwner: 'Jane', tier: 1 }
    ])
    candidatesData['releases/execution/index.json'] = {
      features: [{ key: 'T-1', summary: 'F1', status: 'In Progress', epicCount: 3 }],
      rfes: []
    }
    candidatesData['releases/execution/features/T-1.json'] = {
      key: 'T-1', summary: 'F1', status: 'In Progress',
      aiReview: {
        scores: { feasibility: 2, testability: 2, scope: 2, architecture: 2 }
      }
    }
    var storage = makeStorage(candidatesData)
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    var items = result.features[0].fpdor.items
    var acItem = items.find(function(i) { return i.name === 'Acceptance Criteria' })
    var archItem = items.find(function(i) { return i.name === 'Architectural Alignment' })
    var riskItem = items.find(function(i) { return i.name === 'Risks & Assumptions' })
    expect(acItem.state).toBe('passed')
    expect(acItem.pass).toBe(true)
    expect(archItem.state).toBe('passed')
    expect(archItem.pass).toBe(true)
    expect(riskItem.state).toBe('passed')
    expect(riskItem.pass).toBe(true)
  })

  it('includes scores in health cache output when bridged from execution', async function() {
    var candidatesData = makeCandidatesCache([
      { issueKey: 'T-1', summary: 'F1', status: 'In Progress', components: ['Dashboard'], fixVersion: '', deliveryOwner: 'Jane', tier: 1 }
    ])
    candidatesData['releases/execution/index.json'] = {
      features: [{ key: 'T-1', summary: 'F1', status: 'In Progress', epicCount: 3 }],
      rfes: []
    }
    candidatesData['releases/execution/features/T-1.json'] = {
      key: 'T-1', summary: 'F1', status: 'In Progress',
      aiReview: {
        scores: { feasibility: 1, testability: 0, scope: 2, architecture: 1 }
      }
    }
    var storage = makeStorage(candidatesData)
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    var f = result.features[0]
    expect(f.scores).toEqual({ feasibility: 1, testability: 0, scope: 2, architecture: 1 })
  })

  it('fails pipeline-backed items when execution scores are below threshold', async function() {
    var candidatesData = makeCandidatesCache([
      { issueKey: 'T-1', summary: 'F1', status: 'In Progress', components: ['Dashboard'], fixVersion: '', deliveryOwner: 'Jane', tier: 1 }
    ])
    candidatesData['releases/execution/index.json'] = {
      features: [{ key: 'T-1', summary: 'F1', status: 'In Progress', epicCount: 3 }],
      rfes: []
    }
    candidatesData['releases/execution/features/T-1.json'] = {
      key: 'T-1', summary: 'F1', status: 'In Progress',
      aiReview: {
        scores: { feasibility: 0, testability: 1, scope: 0, architecture: 1 }
      }
    }
    var storage = makeStorage(candidatesData)
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    var items = result.features[0].fpdor.items
    var acItem = items.find(function(i) { return i.name === 'Acceptance Criteria' })
    var archItem = items.find(function(i) { return i.name === 'Architectural Alignment' })
    var riskItem = items.find(function(i) { return i.name === 'Risks & Assumptions' })
    expect(acItem.pass).toBe(false)
    expect(archItem.pass).toBe(false)
    expect(riskItem.pass).toBe(false)
  })

  it('passes cross-functional engineering when ≥2 eng components present', async function() {
    var storage = makeStorage(makeCandidatesCache([
      {
        issueKey: 'T-1', summary: 'F1', status: 'In Progress',
        components: ['Documentation', 'UXD', 'Dashboard', 'Platform'], fixVersion: '', deliveryOwner: 'Jane', tier: 1
      }
    ]))
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    var items = result.features[0].fpdor.items
    var engItem = items.find(function(i) { return i.name === 'Cross-functional Engineering' })
    expect(engItem.pass).toBe(true)
    expect(engItem.state).toBe('passed')
  })

  it('fails cross-functional engineering when only one eng component (Docs/UXD excluded)', async function() {
    var storage = makeStorage(makeCandidatesCache([
      {
        issueKey: 'T-1', summary: 'F1', status: 'In Progress',
        components: ['Dashboard', 'Documentation'], fixVersion: '', deliveryOwner: 'Jane', tier: 1
      }
    ]))
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    var items = result.features[0].fpdor.items
    var engItem = items.find(function(i) { return i.name === 'Cross-functional Engineering' })
    expect(engItem.pass).toBe(false)
  })

  it('fails cross-functional engineering when only one eng component and no dependency signal', async function() {
    var storage = makeStorage(makeCandidatesCache([
      { issueKey: 'T-1', summary: 'F1', status: 'In Progress', components: ['Dashboard'], fixVersion: '', deliveryOwner: 'Jane', tier: 1 }
    ]))
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    var items = result.features[0].fpdor.items
    var engItem = items.find(function(i) { return i.name === 'Cross-functional Engineering' })
    expect(engItem.pass).toBe(false)
    expect(engItem.state).toBe('failed')
  })

  it('passes assignee check when deliveryOwner is set', async function() {
    var storage = makeStorage(makeCandidatesCache([
      {
        issueKey: 'T-1', summary: 'F1', status: 'In Progress',
        components: '', fixVersion: '', deliveryOwner: 'Jane', pm: 'Rick', tier: 1
      }
    ]))
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    var items = result.features[0].fpdor.items
    var assigneeItem = items.find(function(i) { return i.name === 'Assignee' })
    expect(assigneeItem.pass).toBe(true)
  })

  it('passes PM check when pm is set', async function() {
    var storage = makeStorage(makeCandidatesCache([
      {
        issueKey: 'T-1', summary: 'F1', status: 'In Progress',
        components: '', fixVersion: '', deliveryOwner: 'Jane', pm: 'Rick', tier: 1
      }
    ]))
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    var items = result.features[0].fpdor.items
    var pmItem = items.find(function(i) { return i.name === 'PM Assigned' })
    expect(pmItem.pass).toBe(true)
  })

  it('fails PM check when pm is missing', async function() {
    var storage = makeStorage(makeCandidatesCache([
      { issueKey: 'T-1', summary: 'F1', status: 'In Progress', components: '', fixVersion: '', deliveryOwner: 'Jane', tier: 1 }
    ]))
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    var items = result.features[0].fpdor.items
    var pmItem = items.find(function(i) { return i.name === 'PM Assigned' })
    expect(pmItem.pass).toBe(false)
  })

  it('passes target version check when targetRelease is set', async function() {
    var storage = makeStorage(makeCandidatesCache([
      {
        issueKey: 'T-1', summary: 'F1', status: 'In Progress',
        components: '', fixVersion: '', deliveryOwner: 'Jane', tier: 1,
        targetRelease: '3.5'
      }
    ]))
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    var items = result.features[0].fpdor.items
    var tvItem = items.find(function(i) { return i.name === 'Target Version' })
    expect(tvItem.pass).toBe(true)
  })

  it('passes release type check when phase is set', async function() {
    var storage = makeStorage(makeCandidatesCache([
      {
        issueKey: 'T-1', summary: 'F1', status: 'In Progress',
        components: '', fixVersion: '', deliveryOwner: 'Jane', tier: 1,
        phase: 'GA'
      }
    ]))
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    var items = result.features[0].fpdor.items
    var rtItem = items.find(function(i) { return i.name === 'Release Type' })
    expect(rtItem.pass).toBe(true)
  })

  it('passes documentation and UXD as separate items when components present', async function() {
    var storage = makeStorage(makeCandidatesCache([
      {
        issueKey: 'T-1', summary: 'F1', status: 'In Progress',
        components: ['UXD', 'Documentation', 'Dashboard', 'Platform'], fixVersion: '', deliveryOwner: 'Jane', tier: 1,
        phase: 'GA', docsRequired: 'Yes'
      }
    ]))
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    var items = result.features[0].fpdor.items
    var engItem = items.find(function(i) { return i.name === 'Cross-functional Engineering' })
    var docsItem = items.find(function(i) { return i.name === 'Documentation' })
    var uxdItem = items.find(function(i) { return i.name === 'UXD' })
    expect(engItem.pass).toBe(true)
    expect(docsItem.pass).toBe(true)
    expect(uxdItem.pass).toBe(true)
  })

  it('passes 7 of 13 jira items with correct candidate data (no enrichment)', async function() {
    var storage = makeStorage(makeCandidatesCache([
      {
        issueKey: 'T-1', summary: 'F1', status: 'In Progress',
        components: ['Documentation', 'UXD', 'Dashboard', 'Platform'], fixVersion: '', deliveryOwner: 'Jane',
        pm: 'Rick', tier: 1, targetRelease: '3.5', phase: 'GA', docsRequired: 'Yes'
      }
    ]))
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    var fpdor = result.features[0].fpdor
    expect(fpdor.evaluatedCount).toBe(13)
    expect(fpdor.totalCount).toBe(13)
    var passed = fpdor.items.filter(function(i) { return i.pass === true })
    var passedNames = passed.map(function(i) { return i.name }).sort()
    expect(passedNames).toEqual([
      'Assignee',
      'Cross-functional Engineering',
      'Documentation',
      'PM Assigned',
      'Release Type',
      'Target Version',
      'UXD'
    ])
  })

  it('includes fpdorReadiness in summary with correct aggregation', async function() {
    var storage = makeStorage(makeCandidatesCache([
      {
        issueKey: 'T-1', summary: 'F1', status: 'In Progress',
        components: ['Documentation', 'UXD', 'Dashboard'], fixVersion: '', deliveryOwner: 'Jane',
        pm: 'Rick', tier: 1, targetRelease: '3.5', phase: 'GA'
      },
      {
        issueKey: 'T-2', summary: 'F2', status: 'New',
        components: '', fixVersion: '', deliveryOwner: 'Bob', tier: 2
      }
    ]))
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    expect(result.summary.fpdorReadiness).toBeDefined()
    expect(result.summary.fpdorReadiness.totalFeatures).toBe(2)
    expect(typeof result.summary.fpdorReadiness.fullyPassed).toBe('number')
  })

  it('buildEmptyCache includes fpdorReadiness: null', function() {
    var cache = buildEmptyCache('3.5', [])
    expect(cache.summary.fpdorReadiness).toBeNull()
  })

  it('preserves old dor, dod, planningStatus fields alongside fpdor', async function() {
    var storage = makeStorage(makeCandidatesCache([
      { issueKey: 'T-1', summary: 'F1', status: 'In Progress', components: '', fixVersion: '', deliveryOwner: 'Jane', tier: 1 }
    ]))
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    var f = result.features[0]
    expect(f.dor).toBeUndefined()
    expect(f.dod).toBeUndefined()
    expect(f.planningStatus).toBeDefined()
    expect(f.fpdor).toBeDefined()
  })

  it('sets healthCacheVersion to 4', async function() {
    var storage = makeStorage(makeCandidatesCache([
      { issueKey: 'T-1', summary: 'F1', status: 'In Progress', components: '', fixVersion: '', deliveryOwner: 'Jane', tier: 1 }
    ]))
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    expect(result.healthCacheVersion).toBe(4)
  })
})
