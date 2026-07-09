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
    readFromStorage: function(key) {
      return store[key] ? JSON.parse(JSON.stringify(store[key])) : null
    },
    writeToStorage: function(key, value) {
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
    expect(f.fpdor.items).toHaveLength(10)
    expect(f.fpdor.totalCount).toBe(10)
    expect(typeof f.fpdor.passedCount).toBe('number')
    expect(typeof f.fpdor.evaluatedCount).toBe('number')
  })

  it('has 6 jira items and 3 strat-pipeline items', async function() {
    var storage = makeStorage(makeCandidatesCache([
      { issueKey: 'T-1', summary: 'F1', status: 'In Progress', components: '', fixVersion: '', deliveryOwner: 'Jane', tier: 1 }
    ]))
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    var items = result.features[0].fpdor.items
    var jiraItems = items.filter(function(i) { return i.source === 'jira' })
    var rubricItems = items.filter(function(i) { return i.source === 'strat-pipeline' })
    expect(jiraItems).toHaveLength(7)
    expect(rubricItems).toHaveLength(3)
  })

  it('marks rubric items as not-evaluated when no execution detail has scores', async function() {
    var storage = makeStorage(makeCandidatesCache([
      { issueKey: 'T-1', summary: 'F1', status: 'In Progress', components: '', fixVersion: '', deliveryOwner: 'Jane', tier: 1 }
    ]))
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    var items = result.features[0].fpdor.items
    var rubricItems = items.filter(function(i) { return i.source === 'strat-pipeline' })
    for (var i = 0; i < rubricItems.length; i++) {
      expect(rubricItems[i].state).toBe('not-evaluated')
      expect(rubricItems[i].pass).toBeNull()
    }
  })

  it('evaluates rubric items when execution detail file has aiReview.scores', async function() {
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
    var rubricItems = items.filter(function(i) { return i.source === 'strat-pipeline' })
    for (var i = 0; i < rubricItems.length; i++) {
      expect(rubricItems[i].state).toBe('passed')
      expect(rubricItems[i].pass).toBe(true)
    }
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

  it('fails rubric items when execution scores are below threshold', async function() {
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
    var archItem = items.find(function(i) { return i.name === 'Architecture Review' })
    var riskItem = items.find(function(i) { return i.name === 'Risks & Assumptions' })
    expect(acItem.pass).toBe(false)
    expect(archItem.pass).toBe(false)
    expect(riskItem.pass).toBe(false)
  })

  it('passes components check when components are set', async function() {
    var storage = makeStorage(makeCandidatesCache([
      {
        issueKey: 'T-1', summary: 'F1', status: 'In Progress',
        components: ['Dashboard', 'API'], fixVersion: '', deliveryOwner: 'Jane', tier: 1
      }
    ]))
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    var items = result.features[0].fpdor.items
    var compItem = items.find(function(i) { return i.name === 'Components' })
    expect(compItem.pass).toBe(true)
    expect(compItem.state).toBe('passed')
  })

  it('fails components check when components empty', async function() {
    var storage = makeStorage(makeCandidatesCache([
      { issueKey: 'T-1', summary: 'F1', status: 'In Progress', components: '', fixVersion: '', deliveryOwner: 'Jane', tier: 1 }
    ]))
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    var items = result.features[0].fpdor.items
    var compItem = items.find(function(i) { return i.name === 'Components' })
    expect(compItem.pass).toBe(false)
    expect(compItem.state).toBe('failed')
  })

  it('passes owner check when both delivery owner and PM are set', async function() {
    var storage = makeStorage(makeCandidatesCache([
      {
        issueKey: 'T-1', summary: 'F1', status: 'In Progress',
        components: '', fixVersion: '', deliveryOwner: 'Jane', pm: 'Rick', tier: 1
      }
    ]))
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    var items = result.features[0].fpdor.items
    var ownerItem = items.find(function(i) { return i.name === 'Assignee + PM' })
    expect(ownerItem.pass).toBe(true)
  })

  it('fails owner check when PM is missing', async function() {
    var storage = makeStorage(makeCandidatesCache([
      { issueKey: 'T-1', summary: 'F1', status: 'In Progress', components: '', fixVersion: '', deliveryOwner: 'Jane', tier: 1 }
    ]))
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    var items = result.features[0].fpdor.items
    var ownerItem = items.find(function(i) { return i.name === 'Assignee + PM' })
    expect(ownerItem.pass).toBe(false)
  })

  it('passes target version check when targetRelease and phase are set', async function() {
    var storage = makeStorage(makeCandidatesCache([
      {
        issueKey: 'T-1', summary: 'F1', status: 'In Progress',
        components: '', fixVersion: '', deliveryOwner: 'Jane', tier: 1,
        targetRelease: '3.5', phase: 'GA'
      }
    ]))
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    var items = result.features[0].fpdor.items
    var tvItem = items.find(function(i) { return i.name === 'Target Version + Release Type' })
    expect(tvItem.pass).toBe(true)
  })

  it('passes cross-functional check when Documentation component present', async function() {
    var storage = makeStorage(makeCandidatesCache([
      {
        issueKey: 'T-1', summary: 'F1', status: 'In Progress',
        components: ['Dashboard', 'Documentation'], fixVersion: '', deliveryOwner: 'Jane', tier: 1
      }
    ]))
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    var items = result.features[0].fpdor.items
    var cfItem = items.find(function(i) { return i.name === 'Cross-functional Engagement' })
    expect(cfItem.pass).toBe(true)
  })

  it('passes 4 of 6 jira items with correct candidate data (no enrichment)', async function() {
    var storage = makeStorage(makeCandidatesCache([
      {
        issueKey: 'T-1', summary: 'F1', status: 'In Progress',
        components: ['Dashboard', 'Documentation'], fixVersion: '', deliveryOwner: 'Jane',
        pm: 'Rick', tier: 1, targetRelease: '3.5', phase: 'GA'
      }
    ]))
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    var fpdor = result.features[0].fpdor
    expect(fpdor.evaluatedCount).toBe(7)
    expect(fpdor.passedCount).toBe(4)
    var passed = fpdor.items.filter(function(i) { return i.pass === true })
    var passedNames = passed.map(function(i) { return i.name }).sort()
    expect(passedNames).toEqual([
      'Assignee + PM',
      'Components',
      'Cross-functional Engagement',
      'Target Version + Release Type'
    ])
  })

  it('includes fpdorReadiness in summary with correct aggregation', async function() {
    var storage = makeStorage(makeCandidatesCache([
      {
        issueKey: 'T-1', summary: 'F1', status: 'In Progress',
        components: ['Dashboard', 'Documentation'], fixVersion: '', deliveryOwner: 'Jane',
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
    expect(f.dor).toBeDefined()
    expect(f.dor.gate).toBe('dor')
    expect(f.dod).toBeDefined()
    expect(f.dod.gate).toBe('dod')
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
