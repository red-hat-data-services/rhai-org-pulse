import { describe, it, expect, vi } from 'vitest'

var {
  runHealthPipeline
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
        phase: 'GA', epicCount: 3, priority: 'Major'
      }
    ]))
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    expect(result.features).toHaveLength(1)
    var f = result.features[0]
    expect(f.fpdor).toBeDefined()
    expect(f.fpdor.items).toHaveLength(17)
    expect(f.fpdor.totalCount).toBe(17)
    expect(typeof f.fpdor.passedCount).toBe('number')
    expect(typeof f.fpdor.evaluatedCount).toBe('number')
    expect(f.fpdor.confluenceUrl).toContain('442958832')
  })

  it('all 17 items have source jira', async function() {
    var storage = makeStorage(makeCandidatesCache([
      { issueKey: 'T-1', summary: 'F1', status: 'In Progress', components: '', fixVersion: '', deliveryOwner: 'Jane', tier: 1 }
    ]))
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    var items = result.features[0].fpdor.items
    var jiraItems = items.filter(function(i) { return i.source === 'jira' })
    expect(jiraItems).toHaveLength(17)
  })

  it('criteria fail without labels or description enrichment', async function() {
    var storage = makeStorage(makeCandidatesCache([
      { issueKey: 'T-1', summary: 'F1', status: 'In Progress', components: '', fixVersion: '', deliveryOwner: 'Jane', tier: 1 }
    ]))
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    var items = result.features[0].fpdor.items
    var acItem = items.find(function(i) { return i.name === 'Acceptance criteria' })
    var archItem = items.find(function(i) { return i.name === 'Architectural alignment' })
    var riskItem = items.find(function(i) { return i.name === 'Risks & assumptions' })
    expect(acItem.state).toBe('failed')
    expect(acItem.pass).toBe(false)
    expect(archItem.pass).toBeNull()
    expect(riskItem.state).toBe('failed')
    expect(riskItem.pass).toBe(false)
  })

  it('rubric scores alone do not pass criteria (labels/description required)', async function() {
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
    var acItem = items.find(function(i) { return i.name === 'Acceptance criteria' })
    expect(acItem.pass).toBe(false)
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

  it('passes criteria via strat-creator-rubric-pass label', async function() {
    var storage = makeStorage(makeCandidatesCache([
      {
        issueKey: 'T-1', summary: 'F1', status: 'In Progress',
        components: ['Dashboard', 'Platform'], fixVersion: '', deliveryOwner: 'Jane', tier: 1,
        labels: ['strat-creator-rubric-pass', 'strat-creator-auto-created']
      }
    ]))
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    var items = result.features[0].fpdor.items
    expect(items.find(function(i) { return i.name === 'Acceptance criteria' }).pass).toBe(true)
    expect(items.find(function(i) { return i.name === 'Requirements clarity' }).pass).toBe(true)
    expect(items.find(function(i) { return i.name === 'Risks & assumptions' }).pass).toBe(true)
    expect(items.find(function(i) { return i.name === 'Architectural alignment' }).pass).toBe(true)
  })

  it('passes cross-team deps when ≥2 eng components present', async function() {
    var storage = makeStorage(makeCandidatesCache([
      {
        issueKey: 'T-1', summary: 'F1', status: 'In Progress',
        components: ['Documentation', 'UXD', 'Dashboard', 'Platform'], fixVersion: '', deliveryOwner: 'Jane', tier: 1
      }
    ]))
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    var items = result.features[0].fpdor.items
    var engItem = items.find(function(i) { return i.name === 'Cross-team deps' })
    expect(engItem.pass).toBe(true)
    expect(engItem.state).toBe('passed')
  })

  it('fails cross-team deps when only one eng component (Docs/UXD excluded)', async function() {
    var storage = makeStorage(makeCandidatesCache([
      {
        issueKey: 'T-1', summary: 'F1', status: 'In Progress',
        components: ['Dashboard', 'Documentation'], fixVersion: '', deliveryOwner: 'Jane', tier: 1
      }
    ]))
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    var items = result.features[0].fpdor.items
    var engItem = items.find(function(i) { return i.name === 'Cross-team deps' })
    expect(engItem.pass).toBe(false)
  })

  it('fails cross-team deps when only one eng component and no dependency signal', async function() {
    var storage = makeStorage(makeCandidatesCache([
      { issueKey: 'T-1', summary: 'F1', status: 'In Progress', components: ['Dashboard'], fixVersion: '', deliveryOwner: 'Jane', tier: 1 }
    ]))
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    var items = result.features[0].fpdor.items
    var engItem = items.find(function(i) { return i.name === 'Cross-team deps' })
    expect(engItem.pass).toBe(false)
    expect(engItem.state).toBe('failed')
  })

  it('passes delivery owner check when deliveryOwner is set', async function() {
    var storage = makeStorage(makeCandidatesCache([
      {
        issueKey: 'T-1', summary: 'F1', status: 'In Progress',
        components: '', fixVersion: '', deliveryOwner: 'Jane', pm: 'Rick', tier: 1
      }
    ]))
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    var items = result.features[0].fpdor.items
    var ownerItem = items.find(function(i) { return i.name === 'Delivery Owner' })
    expect(ownerItem.pass).toBe(true)
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
    var pmItem = items.find(function(i) { return i.name === 'PM' })
    expect(pmItem.pass).toBe(true)
  })

  it('fails PM check when pm is missing', async function() {
    var storage = makeStorage(makeCandidatesCache([
      { issueKey: 'T-1', summary: 'F1', status: 'In Progress', components: '', fixVersion: '', deliveryOwner: 'Jane', tier: 1 }
    ]))
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    var items = result.features[0].fpdor.items
    var pmItem = items.find(function(i) { return i.name === 'PM' })
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

  it('bridges releaseType from execution detail when candidates cache lacks it', async function() {
    var candidatesData = makeCandidatesCache([
      { issueKey: 'T-1', summary: 'F1', status: 'In Progress', components: '', fixVersion: '', deliveryOwner: 'Jane', tier: 1, phase: '' }
    ])
    candidatesData['releases/execution/index.json'] = {
      features: [{ key: 'T-1', summary: 'F1', status: 'In Progress' }],
      rfes: []
    }
    candidatesData['releases/execution/features/T-1.json'] = {
      key: 'T-1', summary: 'F1', status: 'In Progress',
      releaseType: 'GA'
    }
    var storage = makeStorage(candidatesData)
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    var items = result.features[0].fpdor.items
    var rtItem = items.find(function(i) { return i.name === 'Release Type' })
    expect(rtItem.pass).toBe(true)
    expect(rtItem.state).toBe('passed')
  })

  it('prefers execution detail releaseType over stale candidates cache', async function() {
    var candidatesData = makeCandidatesCache([
      { issueKey: 'T-1', summary: 'F1', status: 'In Progress', components: '', fixVersion: '', deliveryOwner: 'Jane', tier: 1, phase: '' }
    ])
    candidatesData['releases/execution/index.json'] = {
      features: [{ key: 'T-1', summary: 'F1', status: 'In Progress' }],
      rfes: []
    }
    candidatesData['releases/execution/features/T-1.json'] = {
      key: 'T-1', summary: 'F1', status: 'In Progress',
      releaseType: 'Tech Preview'
    }
    var storage = makeStorage(candidatesData)
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    var f = result.features[0]
    expect(f.fpdor.items.find(function(i) { return i.name === 'Release Type' }).pass).toBe(true)
  })

  it('passes docs impact and UXD as separate items when components present', async function() {
    var storage = makeStorage(makeCandidatesCache([
      {
        issueKey: 'T-1', summary: 'F1', status: 'In Progress',
        components: ['UXD', 'Documentation', 'Dashboard', 'Platform'], fixVersion: '', deliveryOwner: 'Jane', tier: 1,
        phase: 'GA', docsRequired: 'Yes'
      }
    ]))
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    var items = result.features[0].fpdor.items
    var engItem = items.find(function(i) { return i.name === 'Cross-team deps' })
    var docsItem = items.find(function(i) { return i.name === 'Docs impact' })
    var uxdItem = items.find(function(i) { return i.name === 'UXD' })
    expect(engItem.pass).toBe(true)
    expect(docsItem.pass).toBe(true)
    expect(uxdItem.pass).toBe(true)
  })

  it('passes mandatory field items with correct candidate data', async function() {
    var storage = makeStorage(makeCandidatesCache([
      {
        issueKey: 'T-1', summary: 'F1', status: 'In Progress',
        components: ['Documentation', 'UXD', 'Dashboard', 'Platform'], fixVersion: '', deliveryOwner: 'Jane',
        pm: 'Rick', tier: 1, targetRelease: '3.5', phase: 'GA', docsRequired: 'Yes',
        priority: 'Major', riceScore: 50, epicCount: 2
      }
    ]))
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    var fpdor = result.features[0].fpdor
    expect(fpdor.totalCount).toBe(17)
    var passed = fpdor.items.filter(function(i) { return i.pass === true })
    var passedNames = passed.map(function(i) { return i.name }).sort()
    expect(passedNames).toEqual(expect.arrayContaining([
      'Child epics',
      'Components',
      'Cross-team deps',
      'Delivery Owner',
      'Docs impact',
      'PM',
      'Priority',
      'Release Type',
      'Target Version',
      'UXD'
    ]))
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
  })
})
