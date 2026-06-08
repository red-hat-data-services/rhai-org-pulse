import { describe, it, expect } from 'vitest'

const {
  buildFeatureReadiness,
  computeBlockers,
  computeBestAvailableScore
} = require('../feature-readiness')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLatest(overrides) {
  return Object.assign({
    key: 'RHAISTRAT-1',
    title: 'Test Feature',
    sourceRfe: null,
    priority: 'Normal',
    status: 'In Progress',
    size: 'M',
    recommendation: null,
    needsAttention: null,
    humanReviewStatus: null,
    scores: { feasibility: 2, testability: 2, scope: 2, architecture: 2 },
    reviewers: { feasibility: 'approve', testability: 'approve', scope: 'approve', architecture: 'approve' },
    reviewedAt: '2026-01-01T00:00:00.000Z',
    components: [],
    approvedBy: null,
    approvedAt: null
  }, overrides)
}

function makeFeaturesStore(features) {
  return { lastSyncedAt: '2026-01-01T00:00:00.000Z', totalFeatures: Object.keys(features).length, features }
}

function makeReadFromStorage(overrides) {
  return function(key) {
    if (Object.prototype.hasOwnProperty.call(overrides, key)) {
      return overrides[key]
    }
    return null
  }
}

var CONFIG_3_6 = { releases: { '3.6': { release: '3.6' } } }

// ---------------------------------------------------------------------------
// computeBestAvailableScore
//
// Formula: weighted average of active signals, normalized by sum of active weights.
//   RICE (w=30) or Rubric proxy (w=30, when no RICE)
//   Tier (w=30) — only when tier present
//   Priority (w=25) — always
//   Size/complexity (w=15) — only when size present
// ---------------------------------------------------------------------------

describe('computeBestAvailableScore', function() {
  describe('signals: rubric proxy + priority only (no riceScore, no tier, no size)', function() {
    // totalWeight = 30 + 25 = 55

    it('Blocker priority + rubricTotal=8 → 100', function() {
      // (1.0*30 + 1.0*25) / 55 * 100 = 100
      expect(computeBestAvailableScore({ priority: 'Blocker', rubricTotal: 8 })).toBe(100)
    })

    it('Normal priority + rubricTotal=4 → 45', function() {
      // (0.5*30 + 0.4*25) / 55 * 100 = round(45.45) = 45
      expect(computeBestAvailableScore({ priority: 'Normal', rubricTotal: 4 })).toBe(45)
    })

    it('unknown priority uses 0.4 fallback', function() {
      // (0*30 + 0.4*25) / 55 * 100 = round(18.18) = 18
      expect(computeBestAvailableScore({ priority: 'Unknown', rubricTotal: 0 })).toBe(18)
    })

    it('missing priority uses 0.4 fallback', function() {
      expect(computeBestAvailableScore({ rubricTotal: 0 })).toBe(18)
    })

    it('missing rubricTotal defaults to 0', function() {
      // (0*30 + 1.0*25) / 55 * 100 = round(45.45) = 45
      expect(computeBestAvailableScore({ priority: 'Blocker' })).toBe(45)
    })
  })

  describe('signals: rubric proxy + priority + size (no riceScore, no tier)', function() {
    // totalWeight = 30 + 25 + 15 = 70

    it('Blocker + rubricTotal=8 + XS size → 100', function() {
      // (1.0*30 + 1.0*25 + 1.0*15) / 70 * 100 = 100
      expect(computeBestAvailableScore({ priority: 'Blocker', rubricTotal: 8, size: 'XS' })).toBe(100)
    })

    it('Normal + rubricTotal=0 + M size → 27', function() {
      // (0*30 + 0.4*25 + 0.6*15) / 70 * 100 = round(27.14) = 27
      expect(computeBestAvailableScore({ priority: 'Normal', rubricTotal: 0, size: 'M' })).toBe(27)
    })

    it('Minor + rubricTotal=0 + XL size → 11', function() {
      // (0*30 + 0.2*25 + 0.2*15) / 70 * 100 = round(8/70*100) = round(11.43) = 11
      expect(computeBestAvailableScore({ priority: 'Minor', rubricTotal: 0, size: 'XL' })).toBe(11)
    })
  })

  describe('signals: rubric proxy + tier + priority + size (no riceScore)', function() {
    // totalWeight = 30 + 30 + 25 + 15 = 100

    it('Blocker + rubricTotal=8 + T1 + XS → 100', function() {
      // (1.0*30 + 1.0*30 + 1.0*25 + 1.0*15) / 100 * 100 = 100
      expect(computeBestAvailableScore({ priority: 'Blocker', rubricTotal: 8, tier: 'T1', size: 'XS' })).toBe(100)
    })

    it('Normal + rubricTotal=4 + T2 + M → 52', function() {
      // rubricProxy=4/8=0.5, tier=T2=0.6, priority=0.4, size=M=0.6
      // (0.5*30 + 0.6*30 + 0.4*25 + 0.6*15) / 100 * 100
      // = (15 + 18 + 10 + 9) / 100 * 100 = 52
      expect(computeBestAvailableScore({ priority: 'Normal', rubricTotal: 4, tier: 'T2', size: 'M' })).toBe(52)
    })
  })

  describe('signals: RICE + tier + priority + size (riceScore present)', function() {
    // totalWeight = 30 + 30 + 25 + 15 = 100

    it('max RICE (16900) + T1 + Blocker + XS → 100', function() {
      // riceNorm = 16900/16900 = 1.0
      expect(computeBestAvailableScore({ priority: 'Blocker', riceScore: 16900, tier: 'T1', size: 'XS', rubricTotal: 0 })).toBe(100)
    })

    it('zero RICE + T1 + Blocker + XS → 70', function() {
      // (0*30 + 1.0*30 + 1.0*25 + 1.0*15) / 100 * 100 = 70
      expect(computeBestAvailableScore({ priority: 'Blocker', riceScore: 0, tier: 'T1', size: 'XS', rubricTotal: 8 })).toBe(70)
    })

    it('RICE present drops rubric proxy', function() {
      // riceNorm = 1690/16900 = 0.1, rubricTotal=8 should NOT contribute
      // (0.1*30 + 1.0*30 + 1.0*25 + 1.0*15) / 100 * 100 = round(73)
      var withRice = computeBestAvailableScore({ priority: 'Blocker', riceScore: 1690, tier: 'T1', size: 'XS', rubricTotal: 8 })
      var withoutRice = computeBestAvailableScore({ priority: 'Blocker', riceScore: 1690, tier: 'T1', size: 'XS', rubricTotal: 0 })
      expect(withRice).toBe(withoutRice)
    })
  })
})

// ---------------------------------------------------------------------------
// computeBlockers
// ---------------------------------------------------------------------------

describe('computeBlockers', function() {
  describe('blockingDimensions', function() {
    it('includes dimensions with verdict revise or reject', function() {
      var feature = {
        reviewers: { feasibility: 'revise', testability: 'approve', scope: 'reject', architecture: 'approve' },
        scores: { feasibility: 1, testability: 3, scope: 2, architecture: 2 },
        humanReviewStatus: null
      }
      var result = computeBlockers(feature)
      var dims = result.blockingDimensions.map(function(d) { return d.dimension })
      expect(dims).toContain('feasibility')
      expect(dims).toContain('scope')
      expect(dims).not.toContain('testability')
      expect(dims).not.toContain('architecture')
    })

    it('carries the verdict and score for each blocking dimension', function() {
      var feature = {
        reviewers: { feasibility: 'revise', scope: 'reject' },
        scores: { feasibility: 1, scope: 2 },
        humanReviewStatus: null
      }
      var result = computeBlockers(feature)
      var feasEntry = result.blockingDimensions.find(function(d) { return d.dimension === 'feasibility' })
      var scopeEntry = result.blockingDimensions.find(function(d) { return d.dimension === 'scope' })
      expect(feasEntry.verdict).toBe('revise')
      expect(feasEntry.score).toBe(1)
      expect(scopeEntry.verdict).toBe('reject')
      expect(scopeEntry.score).toBe(2)
    })

    it('returns empty blockingDimensions when all reviewers approve', function() {
      var feature = {
        reviewers: { feasibility: 'approve', testability: 'approve', scope: 'approve', architecture: 'approve' },
        scores: { feasibility: 3, testability: 3, scope: 3, architecture: 3 },
        humanReviewStatus: null
      }
      var result = computeBlockers(feature)
      expect(result.blockingDimensions).toEqual([])
    })

    it('returns empty blockingDimensions when reviewers is absent', function() {
      var feature = { humanReviewStatus: null }
      var result = computeBlockers(feature)
      expect(result.blockingDimensions).toEqual([])
    })

    it('score is null when scores map lacks the dimension', function() {
      var feature = {
        reviewers: { feasibility: 'revise' },
        scores: {},
        humanReviewStatus: null
      }
      var result = computeBlockers(feature)
      expect(result.blockingDimensions[0].score).toBeNull()
    })
  })

  describe('actionRequired', function() {
    it('needs-review → returns the needs-attention action string', function() {
      var feature = { reviewers: {}, humanReviewStatus: 'needs-review' }
      var result = computeBlockers(feature)
      expect(result.actionRequired).toBe(
        'Open the Jira issue, add Staff Engineer feedback in the description, then remove the strat-creator-needs-attention label to unblock re-refinement'
      )
    })

    it('awaiting-review → returns the awaiting-review action string', function() {
      var feature = { reviewers: {}, humanReviewStatus: 'awaiting-review' }
      var result = computeBlockers(feature)
      expect(result.actionRequired).toBe(
        'Open the Jira issue and add the strat-creator-human-sign-off label when ready'
      )
    })

    it('approved humanReviewStatus → actionRequired is null', function() {
      var feature = { reviewers: {}, humanReviewStatus: 'approved' }
      var result = computeBlockers(feature)
      expect(result.actionRequired).toBeNull()
    })

    it('null humanReviewStatus → actionRequired is null', function() {
      var feature = { reviewers: {}, humanReviewStatus: null }
      var result = computeBlockers(feature)
      expect(result.actionRequired).toBeNull()
    })

    it('no failing dimensions + null humanReviewStatus → blockingDimensions=[], actionRequired=null', function() {
      var feature = {
        reviewers: { feasibility: 'approve', testability: 'approve' },
        scores: { feasibility: 3, testability: 3 },
        humanReviewStatus: null
      }
      var result = computeBlockers(feature)
      expect(result.blockingDimensions).toEqual([])
      expect(result.actionRequired).toBeNull()
    })
  })

  describe('productPath parameter', function() {
    it('defaults to strat-creator text when productPath is not provided', function() {
      var feature = { reviewers: {}, humanReviewStatus: 'needs-review' }
      var result = computeBlockers(feature)
      expect(result.actionRequired).toContain('strat-creator-needs-attention')
    })

    it('needs-review with health-pipeline returns generic action text', function() {
      var feature = { reviewers: {}, humanReviewStatus: 'needs-review' }
      var result = computeBlockers(feature, 'health-pipeline')
      expect(result.actionRequired).toBe(
        'Open the Jira issue, resolve the flagged dimensions, and update the feature status'
      )
    })

    it('awaiting-review with health-pipeline returns DoR action text', function() {
      var feature = { reviewers: {}, humanReviewStatus: 'awaiting-review' }
      var result = computeBlockers(feature, 'health-pipeline')
      expect(result.actionRequired).toBe(
        'Open the Jira issue and verify all Definition of Readiness checks pass'
      )
    })

    it('approved with health-pipeline still returns null', function() {
      var feature = { reviewers: {}, humanReviewStatus: 'approved' }
      var result = computeBlockers(feature, 'health-pipeline')
      expect(result.actionRequired).toBeNull()
    })

    it('null humanReviewStatus with health-pipeline still returns null', function() {
      var feature = { reviewers: {}, humanReviewStatus: null }
      var result = computeBlockers(feature, 'health-pipeline')
      expect(result.actionRequired).toBeNull()
    })
  })
})

// ---------------------------------------------------------------------------
// buildFeatureReadiness
// ---------------------------------------------------------------------------

describe('buildFeatureReadiness', function() {
  describe('empty / null store', function() {
    it('returns empty buckets when ai-impact key returns null', function() {
      var readFromStorage = makeReadFromStorage({})
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.pendingReview).toEqual([])
      expect(result.approved).toEqual([])
      expect(result.filterMeta).toEqual({})
      expect(result.meta).toEqual({})
    })

    it('returns empty buckets when features object is missing', function() {
      var readFromStorage = makeReadFromStorage({
        'ai-impact/features.json': { lastSyncedAt: '2026-01-01T00:00:00.000Z' }
      })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.pendingReview).toEqual([])
      expect(result.approved).toEqual([])
    })
  })

  describe('gate logic — bucket assignment', function() {
    it('humanReviewStatus approved → goes to approved bucket', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var readFromStorage = makeReadFromStorage({ 'ai-impact/features.json': store })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.approved).toHaveLength(1)
      expect(result.approved[0].key).toBe('RHAISTRAT-1')
      expect(result.pendingReview).toHaveLength(0)
    })

    it('humanReviewStatus awaiting-review → goes to pendingReview bucket', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'awaiting-review' }) }
      })
      var readFromStorage = makeReadFromStorage({ 'ai-impact/features.json': store })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.pendingReview).toHaveLength(1)
      expect(result.approved).toHaveLength(0)
    })

    it('humanReviewStatus needs-review → goes to pendingReview bucket', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'needs-review' }) }
      })
      var readFromStorage = makeReadFromStorage({ 'ai-impact/features.json': store })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.pendingReview).toHaveLength(1)
      expect(result.approved).toHaveLength(0)
    })

    it('null humanReviewStatus → goes to pendingReview bucket', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: null }) }
      })
      var readFromStorage = makeReadFromStorage({ 'ai-impact/features.json': store })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.pendingReview).toHaveLength(1)
      expect(result.approved).toHaveLength(0)
    })

    it('skips entries with no latest', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) },
        'RHAISTRAT-2': {}
      })
      var readFromStorage = makeReadFromStorage({ 'ai-impact/features.json': store })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.approved).toHaveLength(1)
      expect(result.pendingReview).toHaveLength(0)
    })
  })

  describe('sort order — approved', function() {
    it('sorts by effectivePriorityScore descending', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-LOW': { latest: makeLatest({ humanReviewStatus: 'approved', priority: 'Minor', scores: { feasibility: 1, testability: 1, scope: 1, architecture: 1 } }) },
        'RHAISTRAT-HIGH': { latest: makeLatest({ humanReviewStatus: 'approved', priority: 'Blocker', scores: { feasibility: 2, testability: 2, scope: 2, architecture: 2 } }) }
      })
      var readFromStorage = makeReadFromStorage({ 'ai-impact/features.json': store })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.approved[0].key).toBe('RHAISTRAT-HIGH')
      expect(result.approved[1].key).toBe('RHAISTRAT-LOW')
    })

    it('higher rubric score → higher effectivePriorityScore → appears first', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-LOWTOTAL': { latest: makeLatest({ key: 'RHAISTRAT-LOWTOTAL', humanReviewStatus: 'approved', priority: 'Normal', scores: { feasibility: 1, testability: 1, scope: 1, architecture: 1 } }) },
        'RHAISTRAT-HIGHTOTAL': { latest: makeLatest({ key: 'RHAISTRAT-HIGHTOTAL', humanReviewStatus: 'approved', priority: 'Normal', scores: { feasibility: 2, testability: 2, scope: 2, architecture: 2 } }) }
      })
      var readFromStorage = makeReadFromStorage({ 'ai-impact/features.json': store })
      var result = buildFeatureReadiness(readFromStorage)
      var highIdx = result.approved.findIndex(function(f) { return f.key === 'RHAISTRAT-HIGHTOTAL' })
      var lowIdx = result.approved.findIndex(function(f) { return f.key === 'RHAISTRAT-LOWTOTAL' })
      expect(highIdx).toBeLessThan(lowIdx)
    })
  })

  describe('sort order — pendingReview', function() {
    it('higher priority → higher effectivePriorityScore → appears first', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-LOW': { latest: makeLatest({ key: 'RHAISTRAT-LOW', humanReviewStatus: null, priority: 'Minor', scores: { feasibility: 0, testability: 0, scope: 0, architecture: 0 } }) },
        'RHAISTRAT-HIGH': { latest: makeLatest({ key: 'RHAISTRAT-HIGH', humanReviewStatus: null, priority: 'Blocker', scores: { feasibility: 0, testability: 0, scope: 0, architecture: 0 } }) }
      })
      var readFromStorage = makeReadFromStorage({ 'ai-impact/features.json': store })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.pendingReview[0].key).toBe('RHAISTRAT-HIGH')
      expect(result.pendingReview[1].key).toBe('RHAISTRAT-LOW')
    })

    it('equal priority + equal size: higher rubric score → higher effectivePriorityScore → appears first', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-A': { latest: makeLatest({ key: 'RHAISTRAT-A', humanReviewStatus: null, priority: 'Normal', size: null, scores: { feasibility: 1, testability: 0, scope: 0, architecture: 0 } }) },
        'RHAISTRAT-B': { latest: makeLatest({ key: 'RHAISTRAT-B', humanReviewStatus: null, priority: 'Normal', size: null, scores: { feasibility: 0, testability: 0, scope: 0, architecture: 0 } }) }
      })
      var readFromStorage = makeReadFromStorage({ 'ai-impact/features.json': store })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.pendingReview[0].key).toBe('RHAISTRAT-A')
    })

    it('tiebreaker: equal effectivePriorityScore → higher rubricTotal first', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-TIE-A': { latest: makeLatest({ key: 'RHAISTRAT-TIE-A', humanReviewStatus: null, priority: 'Normal', scores: { feasibility: 2, testability: 2, scope: 2, architecture: 2 } }) },
        'RHAISTRAT-TIE-B': { latest: makeLatest({ key: 'RHAISTRAT-TIE-B', humanReviewStatus: null, priority: 'Normal', scores: { feasibility: 1, testability: 1, scope: 1, architecture: 1 } }) }
      })
      var healthCache = {
        features: [
          { key: 'RHAISTRAT-TIE-A', priorityScore: 70 },
          { key: 'RHAISTRAT-TIE-B', priorityScore: 70 }
        ]
      }
      var readFromStorage = makeReadFromStorage({
        'ai-impact/features.json': store,
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      var idxA = result.pendingReview.findIndex(function(f) { return f.key === 'RHAISTRAT-TIE-A' })
      var idxB = result.pendingReview.findIndex(function(f) { return f.key === 'RHAISTRAT-TIE-B' })
      expect(idxA).toBeLessThan(idxB)
    })
  })

  describe('candidates cache cross-reference', function() {
    var candidatesKey = 'releases/planning/candidates-cache-3.6.json'

    it('populates tier, bigRock, targetVersions, fixVersion from matching candidate', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var candidateCache = {
        data: {
          features: [
            { issueKey: 'RHAISTRAT-1', tier: 1, bigRock: 'AI Efficiency', targetRelease: 'rhoai-3.6', fixVersion: '3.6.0' }
          ]
        }
      }
      var readFromStorage = makeReadFromStorage({
        'ai-impact/features.json': store,
        'releases/planning/config.json': CONFIG_3_6,
        [candidatesKey]: candidateCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      var f = result.approved[0]
      expect(f.tier).toBe('T1')
      expect(f.bigRock).toBe('AI Efficiency')
      expect(f.targetVersions).toEqual(['rhoai-3.6'])
      expect(f.fixVersion).toBe('3.6.0')
    })

    it('leaves tier/bigRock/targetVersions empty when no candidate matches but feature is in health cache', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var candidateCache = {
        data: { features: [{ issueKey: 'RHAISTRAT-999', tier: 2, bigRock: 'Other', targetRelease: 'rhoai-3.5', fixVersion: '3.5.0' }] }
      }
      var healthCache = {
        features: [{ key: 'RHAISTRAT-1', priorityScore: null }]
      }
      var readFromStorage = makeReadFromStorage({
        'ai-impact/features.json': store,
        'releases/planning/config.json': CONFIG_3_6,
        [candidatesKey]: candidateCache,
        'releases/planning/health-cache-3.6-all.json': healthCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      var f = result.approved[0]
      expect(f.tier).toBeNull()
      expect(f.bigRock).toBeNull()
      expect(f.targetVersions).toEqual([])
      expect(f.fixVersion).toBeNull()
    })

    it('tier is normalized to T-string (numeric 2 → T2)', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var candidateCache = {
        data: { features: [{ issueKey: 'RHAISTRAT-1', tier: 2 }] }
      }
      var readFromStorage = makeReadFromStorage({
        'ai-impact/features.json': store,
        'releases/planning/config.json': CONFIG_3_6,
        [candidatesKey]: candidateCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.approved[0].tier).toBe('T2')
    })
  })

  describe('missing candidates cache', function() {
    it('includes all features when configured releases exist but all caches are empty', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var readFromStorage = makeReadFromStorage({
        'ai-impact/features.json': store,
        'releases/planning/config.json': CONFIG_3_6
      })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.approved).toHaveLength(1)
      var f = result.approved[0]
      expect(f.tier).toBeNull()
      expect(f.bigRock).toBeNull()
      expect(f.targetVersions).toEqual([])
      expect(f.fixVersion).toBeNull()
    })

    it('includes all features when no releases are configured', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var readFromStorage = makeReadFromStorage({
        'ai-impact/features.json': store
      })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.approved).toHaveLength(1)
      var f = result.approved[0]
      expect(f.tier).toBeNull()
      expect(f.bigRock).toBeNull()
      expect(f.targetVersions).toEqual([])
      expect(f.fixVersion).toBeNull()
    })

    it('falls back to health cache for tier, bigRock, targetVersions, fixVersion when candidates cache is absent', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var healthCache = {
        features: [{
          key: 'RHAISTRAT-1',
          tier: 'T2',
          bigRock: 'Platform Efficiency',
          targetRelease: 'rhoai-3.6',
          fixVersions: '3.6.0',
          deliveryOwner: 'Jane Smith',
          priorityScore: null
        }]
      }
      var readFromStorage = makeReadFromStorage({
        'ai-impact/features.json': store,
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      var f = result.approved[0]
      expect(f.tier).toBe('T2')
      expect(f.bigRock).toBe('Platform Efficiency')
      expect(f.targetVersions).toEqual(['rhoai-3.6'])
      expect(f.fixVersion).toBe('3.6.0')
      expect(f.deliveryOwner).toBe('Jane Smith')
    })

    it('candidates cache takes priority over health cache for tier/bigRock/targetVersions/fixVersion', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var candidateCache = {
        data: { features: [{ issueKey: 'RHAISTRAT-1', tier: 1, bigRock: 'AI Speed', targetRelease: 'rhoai-3.6-cand', fixVersion: '3.6.0-cand' }] }
      }
      var healthCache = {
        features: [{ key: 'RHAISTRAT-1', tier: 'T3', bigRock: 'Platform', targetRelease: 'rhoai-3.6-health', fixVersions: '3.6.0-health', priorityScore: null }]
      }
      var readFromStorage = makeReadFromStorage({
        'ai-impact/features.json': store,
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/candidates-cache-3.6.json': candidateCache,
        'releases/planning/health-cache-3.6-all.json': healthCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      var f = result.approved[0]
      expect(f.tier).toBe('T1')
      expect(f.bigRock).toBe('AI Speed')
      expect(f.targetVersions).toEqual(['rhoai-3.6-cand'])
      expect(f.fixVersion).toBe('3.6.0-cand')
    })

    it('health cache components (string) are split into array when ai-impact components are empty', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved', components: [] }) }
      })
      var healthCache = {
        features: [{ key: 'RHAISTRAT-1', components: 'Serving, Training', priorityScore: null }]
      }
      var readFromStorage = makeReadFromStorage({
        'ai-impact/features.json': store,
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.approved[0].components).toEqual(['Serving', 'Training'])
    })
  })

  describe('health cache cross-reference', function() {
    var healthKey = 'releases/planning/health-cache-3.6-all.json'

    it('feature in health cache gets priorityScore from cache, priorityScoreFallback=false', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var healthCache = {
        features: [{ key: 'RHAISTRAT-1', priorityScore: 87, priorityBreakdown: { rice: 50, bigRock: 100 } }]
      }
      var readFromStorage = makeReadFromStorage({
        'ai-impact/features.json': store,
        'releases/planning/config.json': CONFIG_3_6,
        [healthKey]: healthCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      var f = result.approved[0]
      expect(f.priorityScore).toBe(87)
      expect(f.effectivePriorityScore).toBe(87)
      expect(f.priorityScoreFallback).toBe(false)
    })

    it('feature NOT in health cache gets best-available score, priorityScoreFallback=true', function() {
      // makeLatest defaults: priority='Normal', size='M', scores all 2 (rubricTotal=8)
      // No RICE, no tier → signals: rubricProxy(8/8=1.0,w=30) + priority(0.4,w=25) + size(M=0.6,w=15)
      // totalWeight=70, weightedSum=1.0*30+0.4*25+0.6*15=30+10+9=49
      // score=round(49/70*100)=round(70)=70
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var candidateCache = {
        data: { features: [{ issueKey: 'RHAISTRAT-1', tier: null, bigRock: null }] }
      }
      var healthCache = {
        features: [{ key: 'RHAISTRAT-999', priorityScore: 50 }]
      }
      var readFromStorage = makeReadFromStorage({
        'ai-impact/features.json': store,
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/candidates-cache-3.6.json': candidateCache,
        [healthKey]: healthCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      var f = result.approved[0]
      expect(f.priorityScore).toBeNull()
      expect(f.priorityScoreFallback).toBe(true)
      expect(f.effectivePriorityScore).toBe(70)
    })

    it('RICE score present on feature improves estimated score over rubric proxy', function() {
      // riceScore=16900 (max) vs rubricTotal=8 (max): with RICE, score should be higher than without
      var storeWithRice = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved', priority: 'Normal' }) }
      })
      // Manually inject riceScore onto latest
      storeWithRice.features['RHAISTRAT-1'].latest.riceScore = 1690 // 10% of max
      storeWithRice.features['RHAISTRAT-1'].latest.scores = { feasibility: 0, testability: 0, scope: 0, architecture: 0 }

      var storeWithoutRice = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved', priority: 'Normal', scores: { feasibility: 0, testability: 0, scope: 0, architecture: 0 } }) }
      })

      var rfWithRice = makeReadFromStorage({ 'ai-impact/features.json': storeWithRice })
      var rfWithoutRice = makeReadFromStorage({ 'ai-impact/features.json': storeWithoutRice })

      var withRice = buildFeatureReadiness(rfWithRice).approved[0].effectivePriorityScore
      var withoutRice = buildFeatureReadiness(rfWithoutRice).approved[0].effectivePriorityScore

      // riceNorm=1690/16900≈0.1 > rubricProxy=0/8=0 → RICE-path score should be higher
      // confirming riceScore is used in place of rubric proxy when present
      expect(withRice).toBeGreaterThan(withoutRice)
    })

    it('health cache with priorityBreakdown is reflected in priorityScoreBreakdown', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var breakdown = { rice: 60, bigRock: 80, priority: 70, complexity: 50 }
      var healthCache = {
        features: [{ key: 'RHAISTRAT-1', priorityScore: 70, priorityBreakdown: breakdown }]
      }
      var readFromStorage = makeReadFromStorage({
        'ai-impact/features.json': store,
        'releases/planning/config.json': CONFIG_3_6,
        [healthKey]: healthCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.approved[0].priorityScoreBreakdown).toEqual(breakdown)
    })
  })

  describe('filterMeta', function() {
    it('contains unique sorted arrays of priorities, components, bigRocks, targetVersions, fixVersions', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved', priority: 'Critical', components: ['Serving', 'Platform'] }) },
        'RHAISTRAT-2': { latest: makeLatest({ key: 'RHAISTRAT-2', humanReviewStatus: 'approved', priority: 'Normal', components: ['Platform'] }) }
      })
      var candidateCache = {
        data: {
          features: [
            { issueKey: 'RHAISTRAT-1', tier: 1, bigRock: 'AI Efficiency', targetRelease: 'rhoai-3.6', fixVersion: '3.6.0' },
            { issueKey: 'RHAISTRAT-2', tier: 2, bigRock: 'Platform', targetRelease: 'rhoai-3.6', fixVersion: '3.6.0' }
          ]
        }
      }
      var readFromStorage = makeReadFromStorage({
        'ai-impact/features.json': store,
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/candidates-cache-3.6.json': candidateCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      var fm = result.filterMeta
      expect(fm.priorities).toEqual(['Critical', 'Normal'])
      expect(fm.components).toEqual(['Platform', 'Serving'])
      expect(fm.bigRocks).toEqual(['AI Efficiency', 'Platform'])
      expect(fm.targetVersions).toEqual(['rhoai-3.6'])
      expect(fm.fixVersions).toEqual(['3.6.0'])
    })

    it('filterMeta is empty collections when no candidates or health cache data', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved', priority: 'Normal', components: [] }) }
      })
      var readFromStorage = makeReadFromStorage({ 'ai-impact/features.json': store })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.filterMeta.bigRocks).toEqual([])
      expect(result.filterMeta.targetVersions).toEqual([])
      expect(result.filterMeta.fixVersions).toEqual([])
      expect(result.filterMeta.teams).toEqual([])
    })

    it('filterMeta.teams is populated from hygiene cache team values', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) },
        'RHAISTRAT-2': { latest: makeLatest({ key: 'RHAISTRAT-2', humanReviewStatus: 'approved' }) }
      })
      var healthCache = {
        features: [
          { key: 'RHAISTRAT-1', priorityScore: null },
          { key: 'RHAISTRAT-2', priorityScore: null }
        ]
      }
      var hygieneCache = {
        features: {
          'RHAISTRAT-1': { key: 'RHAISTRAT-1', team: 'Alice' },
          'RHAISTRAT-2': { key: 'RHAISTRAT-2', team: 'Bob' }
        }
      }
      var readFromStorage = makeReadFromStorage({
        'ai-impact/features.json': store,
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache,
        'releases/hygiene/features-3.6.json': hygieneCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.filterMeta.teams).toEqual(['Alice', 'Bob'])
    })

    it('filterMeta.teams deduplicates team names', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) },
        'RHAISTRAT-2': { latest: makeLatest({ key: 'RHAISTRAT-2', humanReviewStatus: 'approved' }) }
      })
      var healthCache = {
        features: [
          { key: 'RHAISTRAT-1', priorityScore: null },
          { key: 'RHAISTRAT-2', priorityScore: null }
        ]
      }
      var hygieneCache = {
        features: {
          'RHAISTRAT-1': { key: 'RHAISTRAT-1', team: 'Alice' },
          'RHAISTRAT-2': { key: 'RHAISTRAT-2', team: 'Alice' }
        }
      }
      var readFromStorage = makeReadFromStorage({
        'ai-impact/features.json': store,
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache,
        'releases/hygiene/features-3.6.json': hygieneCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.filterMeta.teams).toEqual(['Alice'])
    })

    it('feature.team comes from hygiene cache, not deliveryOwner', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var healthCache = { features: [{ key: 'RHAISTRAT-1', deliveryOwner: 'wrong-owner', priorityScore: null }] }
      var hygieneCache = { features: { 'RHAISTRAT-1': { key: 'RHAISTRAT-1', team: 'Real Team' } } }
      var readFromStorage = makeReadFromStorage({
        'ai-impact/features.json': store,
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache,
        'releases/hygiene/features-3.6.json': hygieneCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.approved[0].team).toBe('Real Team')
      expect(result.filterMeta.teams).toEqual(['Real Team'])
    })
  })

  describe('meta', function() {
    it('contains correct counts and versions array', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) },
        'RHAISTRAT-2': { latest: makeLatest({ key: 'RHAISTRAT-2', humanReviewStatus: null }) },
        'RHAISTRAT-3': { latest: makeLatest({ key: 'RHAISTRAT-3', humanReviewStatus: 'needs-review' }) }
      })
      var healthCache = {
        features: [
          { key: 'RHAISTRAT-1', priorityScore: null },
          { key: 'RHAISTRAT-2', priorityScore: null },
          { key: 'RHAISTRAT-3', priorityScore: null }
        ]
      }
      var readFromStorage = makeReadFromStorage({
        'ai-impact/features.json': store,
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.meta.total).toBe(3)
      expect(result.meta.approvedCount).toBe(1)
      expect(result.meta.pendingReviewCount).toBe(2)
      expect(result.meta.versions).toEqual(['3.6'])
    })

    it('meta.versions is empty when no releases are configured', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var readFromStorage = makeReadFromStorage({ 'ai-impact/features.json': store })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.meta.versions).toEqual([])
    })
  })

  describe('rubricTotal calculation', function() {
    it('sums all four dimension scores', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({
          humanReviewStatus: 'approved',
          priority: 'Normal',
          scores: { feasibility: 3, testability: 2, scope: 1, architecture: 2 }
        }) }
      })
      var readFromStorage = makeReadFromStorage({ 'ai-impact/features.json': store })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.approved[0].rubricTotal).toBe(8)
    })

    it('treats missing score dimensions as 0', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({
          humanReviewStatus: 'approved',
          scores: { feasibility: 2 }
        }) }
      })
      var readFromStorage = makeReadFromStorage({ 'ai-impact/features.json': store })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.approved[0].rubricTotal).toBe(2)
    })
  })

  describe('version-scoping guard', function() {
    it('excludes features not in any cache when caches have data', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-IN': { latest: makeLatest({ humanReviewStatus: 'approved' }) },
        'RHAISTRAT-OUT': { latest: makeLatest({ key: 'RHAISTRAT-OUT', humanReviewStatus: 'approved' }) }
      })
      var healthCache = {
        features: [{ key: 'RHAISTRAT-IN', priorityScore: 80 }]
      }
      var readFromStorage = makeReadFromStorage({
        'ai-impact/features.json': store,
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.approved).toHaveLength(1)
      expect(result.approved[0].key).toBe('RHAISTRAT-IN')
    })

    it('includes all features when no configured releases exist', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) },
        'RHAISTRAT-2': { latest: makeLatest({ key: 'RHAISTRAT-2', humanReviewStatus: null }) }
      })
      var readFromStorage = makeReadFromStorage({
        'ai-impact/features.json': store
      })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.approved).toHaveLength(1)
      expect(result.pendingReview).toHaveLength(1)
    })

    it('includes features that are only in candidates cache (not health cache)', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var candidateCache = {
        data: { features: [{ issueKey: 'RHAISTRAT-1', tier: 1, bigRock: 'Test' }] }
      }
      var readFromStorage = makeReadFromStorage({
        'ai-impact/features.json': store,
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/candidates-cache-3.6.json': candidateCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.approved).toHaveLength(1)
    })

    it('includes features that are only in health cache (not candidates cache)', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var healthCache = {
        features: [{ key: 'RHAISTRAT-1', priorityScore: 55 }]
      }
      var readFromStorage = makeReadFromStorage({
        'ai-impact/features.json': store,
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.approved).toHaveLength(1)
    })

    it('meta counts reflect only cache-scoped features', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-IN': { latest: makeLatest({ humanReviewStatus: 'approved' }) },
        'RHAISTRAT-OUT': { latest: makeLatest({ key: 'RHAISTRAT-OUT', humanReviewStatus: null }) }
      })
      var healthCache = {
        features: [{ key: 'RHAISTRAT-IN', priorityScore: null }]
      }
      var readFromStorage = makeReadFromStorage({
        'ai-impact/features.json': store,
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.meta.total).toBe(1)
      expect(result.meta.approvedCount).toBe(1)
      expect(result.meta.pendingReviewCount).toBe(0)
    })
  })

  describe('multi-version loading', function() {
    it('merges features from multiple configured versions', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) },
        'RHAISTRAT-2': { latest: makeLatest({ key: 'RHAISTRAT-2', humanReviewStatus: 'approved' }) }
      })
      var config = { releases: { '3.5': { release: '3.5' }, '3.6': { release: '3.6' } } }
      var readFromStorage = makeReadFromStorage({
        'ai-impact/features.json': store,
        'releases/planning/config.json': config,
        'releases/planning/health-cache-3.5-all.json': { features: [{ key: 'RHAISTRAT-1', priorityScore: 80 }] },
        'releases/planning/health-cache-3.6-all.json': { features: [{ key: 'RHAISTRAT-2', priorityScore: 60 }] }
      })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.approved).toHaveLength(2)
      expect(result.meta.versions).toEqual(['3.5', '3.6'])
    })

    it('duplicate features across versions use first-seen data', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var config = { releases: { '3.5': { release: '3.5' }, '3.6': { release: '3.6' } } }
      var readFromStorage = makeReadFromStorage({
        'ai-impact/features.json': store,
        'releases/planning/config.json': config,
        'releases/planning/candidates-cache-3.5.json': { data: { features: [{ issueKey: 'RHAISTRAT-1', tier: 1, bigRock: 'First' }] } },
        'releases/planning/candidates-cache-3.6.json': { data: { features: [{ issueKey: 'RHAISTRAT-1', tier: 2, bigRock: 'Second' }] } }
      })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.approved).toHaveLength(1)
      expect(result.approved[0].tier).toBe('T1')
      expect(result.approved[0].bigRock).toBe('First')
    })

    it('team data merges across versions (first-seen wins)', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var config = { releases: { '3.5': { release: '3.5' }, '3.6': { release: '3.6' } } }
      var readFromStorage = makeReadFromStorage({
        'ai-impact/features.json': store,
        'releases/planning/config.json': config,
        'releases/planning/health-cache-3.5-all.json': { features: [{ key: 'RHAISTRAT-1', priorityScore: null }] },
        'releases/hygiene/features-3.5.json': { features: { 'RHAISTRAT-1': { key: 'RHAISTRAT-1', team: 'Alpha' } } },
        'releases/hygiene/features-3.6.json': { features: { 'RHAISTRAT-1': { key: 'RHAISTRAT-1', team: 'Beta' } } }
      })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.approved[0].team).toBe('Alpha')
    })

    it('meta.versions reflects all configured release versions', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var config = { releases: { '3.4': { release: '3.4' }, '3.5': { release: '3.5' }, '3.6': { release: '3.6' } } }
      var readFromStorage = makeReadFromStorage({
        'ai-impact/features.json': store,
        'releases/planning/config.json': config
      })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.meta.versions).toEqual(['3.4', '3.5', '3.6'])
    })
  })

})
