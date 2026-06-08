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
  // features is an object: { 'RHAISTRAT-1': { latest: {...} }, ... }
  return { lastSyncedAt: '2026-01-01T00:00:00.000Z', totalFeatures: Object.keys(features).length, features }
}

function makeReadFromStorage(overrides) {
  // overrides is a plain object of { key: value }
  return function(key) {
    if (Object.prototype.hasOwnProperty.call(overrides, key)) {
      return overrides[key]
    }
    return null
  }
}

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
})

// ---------------------------------------------------------------------------
// buildFeatureReadiness
// ---------------------------------------------------------------------------

describe('buildFeatureReadiness', function() {
  describe('empty / null store', function() {
    it('returns empty buckets when ai-impact key returns null', function() {
      var readFromStorage = makeReadFromStorage({})
      var result = buildFeatureReadiness(readFromStorage, '3.6')
      expect(result.pendingReview).toEqual([])
      expect(result.approved).toEqual([])
      expect(result.filterMeta).toEqual({})
      expect(result.meta).toEqual({})
    })

    it('returns empty buckets when features object is missing', function() {
      var readFromStorage = makeReadFromStorage({
        'ai-impact/features.json': { lastSyncedAt: '2026-01-01T00:00:00.000Z' }
      })
      var result = buildFeatureReadiness(readFromStorage, '3.6')
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
      var result = buildFeatureReadiness(readFromStorage, null)
      expect(result.approved).toHaveLength(1)
      expect(result.approved[0].key).toBe('RHAISTRAT-1')
      expect(result.pendingReview).toHaveLength(0)
    })

    it('humanReviewStatus awaiting-review → goes to pendingReview bucket', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'awaiting-review' }) }
      })
      var readFromStorage = makeReadFromStorage({ 'ai-impact/features.json': store })
      var result = buildFeatureReadiness(readFromStorage, null)
      expect(result.pendingReview).toHaveLength(1)
      expect(result.approved).toHaveLength(0)
    })

    it('humanReviewStatus needs-review → goes to pendingReview bucket', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'needs-review' }) }
      })
      var readFromStorage = makeReadFromStorage({ 'ai-impact/features.json': store })
      var result = buildFeatureReadiness(readFromStorage, null)
      expect(result.pendingReview).toHaveLength(1)
      expect(result.approved).toHaveLength(0)
    })

    it('null humanReviewStatus → goes to pendingReview bucket', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: null }) }
      })
      var readFromStorage = makeReadFromStorage({ 'ai-impact/features.json': store })
      var result = buildFeatureReadiness(readFromStorage, null)
      expect(result.pendingReview).toHaveLength(1)
      expect(result.approved).toHaveLength(0)
    })

    it('skips entries with no latest', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) },
        'RHAISTRAT-2': {}
      })
      var readFromStorage = makeReadFromStorage({ 'ai-impact/features.json': store })
      var result = buildFeatureReadiness(readFromStorage, null)
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
      var result = buildFeatureReadiness(readFromStorage, null)
      expect(result.approved[0].key).toBe('RHAISTRAT-HIGH')
      expect(result.approved[1].key).toBe('RHAISTRAT-LOW')
    })

    it('higher rubric score → higher effectivePriorityScore → appears first', function() {
      // Same priority; rubric IS part of the primary score with the best-available algorithm
      var store = makeFeaturesStore({
        'RHAISTRAT-LOWTOTAL': { latest: makeLatest({ key: 'RHAISTRAT-LOWTOTAL', humanReviewStatus: 'approved', priority: 'Normal', scores: { feasibility: 1, testability: 1, scope: 1, architecture: 1 } }) },
        'RHAISTRAT-HIGHTOTAL': { latest: makeLatest({ key: 'RHAISTRAT-HIGHTOTAL', humanReviewStatus: 'approved', priority: 'Normal', scores: { feasibility: 2, testability: 2, scope: 2, architecture: 2 } }) }
      })
      var readFromStorage = makeReadFromStorage({ 'ai-impact/features.json': store })
      var result = buildFeatureReadiness(readFromStorage, null)
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
      var result = buildFeatureReadiness(readFromStorage, null)
      expect(result.pendingReview[0].key).toBe('RHAISTRAT-HIGH')
      expect(result.pendingReview[1].key).toBe('RHAISTRAT-LOW')
    })

    it('equal priority + equal size: higher rubric score → higher effectivePriorityScore → appears first', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-A': { latest: makeLatest({ key: 'RHAISTRAT-A', humanReviewStatus: null, priority: 'Normal', size: null, scores: { feasibility: 1, testability: 0, scope: 0, architecture: 0 } }) },
        'RHAISTRAT-B': { latest: makeLatest({ key: 'RHAISTRAT-B', humanReviewStatus: null, priority: 'Normal', size: null, scores: { feasibility: 0, testability: 0, scope: 0, architecture: 0 } }) }
      })
      var readFromStorage = makeReadFromStorage({ 'ai-impact/features.json': store })
      var result = buildFeatureReadiness(readFromStorage, null)
      // A: rubricProxy=1/8=0.125, priority=0.4; B: rubricProxy=0, priority=0.4
      // A score > B score → A comes first
      expect(result.pendingReview[0].key).toBe('RHAISTRAT-A')
    })

    it('tiebreaker: equal effectivePriorityScore → higher rubricTotal first', function() {
      // Force equal scores: both Normal + same rubric proxy by keeping rubricTotal identical,
      // differentiate only by rubricTotal for the tiebreaker.
      // Use no-size features so (rubric + priority) / 55 is the formula.
      // Both same priority + same rubricTotal → equal score → tiebreaker must not reorder.
      // Actually, verify the secondary sort: use health cache to pin the effectivePriorityScore.
      var store = makeFeaturesStore({
        'RHAISTRAT-TIE-A': { latest: makeLatest({ key: 'RHAISTRAT-TIE-A', humanReviewStatus: null, priority: 'Normal', scores: { feasibility: 2, testability: 2, scope: 2, architecture: 2 } }) },
        'RHAISTRAT-TIE-B': { latest: makeLatest({ key: 'RHAISTRAT-TIE-B', humanReviewStatus: null, priority: 'Normal', scores: { feasibility: 1, testability: 1, scope: 1, architecture: 1 } }) }
      })
      var healthKey = 'releases/planning/health-cache-3.6.json'
      var healthCache = {
        features: [
          { key: 'RHAISTRAT-TIE-A', priorityScore: 70 },
          { key: 'RHAISTRAT-TIE-B', priorityScore: 70 }
        ]
      }
      var readFromStorage = makeReadFromStorage({
        'ai-impact/features.json': store,
        [healthKey]: healthCache
      })
      var result = buildFeatureReadiness(readFromStorage, '3.6')
      // Both pinned to score 70. TIE-A rubricTotal=8, TIE-B rubricTotal=4 → TIE-A first
      var idxA = result.pendingReview.findIndex(function(f) { return f.key === 'RHAISTRAT-TIE-A' })
      var idxB = result.pendingReview.findIndex(function(f) { return f.key === 'RHAISTRAT-TIE-B' })
      expect(idxA).toBeLessThan(idxB)
    })
  })

  describe('candidates cache cross-reference', function() {
    var version = '3.6'
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
        [candidatesKey]: candidateCache
      })
      var result = buildFeatureReadiness(readFromStorage, version)
      var f = result.approved[0]
      expect(f.tier).toBe('T1')
      expect(f.bigRock).toBe('AI Efficiency')
      expect(f.targetVersions).toEqual(['rhoai-3.6'])
      expect(f.fixVersion).toBe('3.6.0')
    })

    it('leaves tier/bigRock/targetVersions empty when no candidate matches', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var candidateCache = {
        data: { features: [{ issueKey: 'RHAISTRAT-999', tier: 2, bigRock: 'Other', targetRelease: 'rhoai-3.5', fixVersion: '3.5.0' }] }
      }
      var readFromStorage = makeReadFromStorage({
        'ai-impact/features.json': store,
        [candidatesKey]: candidateCache
      })
      var result = buildFeatureReadiness(readFromStorage, version)
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
        [candidatesKey]: candidateCache
      })
      var result = buildFeatureReadiness(readFromStorage, version)
      expect(result.approved[0].tier).toBe('T2')
    })
  })

  describe('missing candidates cache', function() {
    it('approved features still returned with null tier/bigRock and empty targetVersions when candidates cache and health cache are absent', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var readFromStorage = makeReadFromStorage({
        'ai-impact/features.json': store
      })
      var result = buildFeatureReadiness(readFromStorage, '3.6')
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
        'releases/planning/health-cache-3.6.json': healthCache
      })
      var result = buildFeatureReadiness(readFromStorage, '3.6')
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
        'releases/planning/candidates-cache-3.6.json': candidateCache,
        'releases/planning/health-cache-3.6.json': healthCache
      })
      var result = buildFeatureReadiness(readFromStorage, '3.6')
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
        'releases/planning/health-cache-3.6.json': healthCache
      })
      var result = buildFeatureReadiness(readFromStorage, '3.6')
      expect(result.approved[0].components).toEqual(['Serving', 'Training'])
    })
  })

  describe('health cache cross-reference', function() {
    var version = '3.6'
    var healthKey = 'releases/planning/health-cache-3.6.json'

    it('feature in health cache gets priorityScore from cache, priorityScoreFallback=false', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var healthCache = {
        features: [{ key: 'RHAISTRAT-1', priorityScore: 87, priorityBreakdown: { rice: 50, bigRock: 100 } }]
      }
      var readFromStorage = makeReadFromStorage({
        'ai-impact/features.json': store,
        [healthKey]: healthCache
      })
      var result = buildFeatureReadiness(readFromStorage, version)
      var f = result.approved[0]
      expect(f.priorityScore).toBe(87)
      expect(f.effectivePriorityScore).toBe(87)
      expect(f.priorityScoreFallback).toBe(false)
    })

    it('feature NOT in health cache gets best-available score, priorityScoreFallback=true', function() {
      // makeLatest defaults: priority='Normal', size='M', scores all 2 (rubricTotal=8)
      // No RICE, no tier (no candidates cache) → signals: rubricProxy(8/8=1.0,w=30) + priority(0.4,w=25) + size(M=0.6,w=15)
      // totalWeight=70, weightedSum=1.0*30+0.4*25+0.6*15=30+10+9=49
      // score=round(49/70*100)=round(70)=70
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var healthCache = {
        features: [{ key: 'RHAISTRAT-999', priorityScore: 50 }]
      }
      var readFromStorage = makeReadFromStorage({
        'ai-impact/features.json': store,
        [healthKey]: healthCache
      })
      var result = buildFeatureReadiness(readFromStorage, version)
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

      var withRice = buildFeatureReadiness(rfWithRice, null).approved[0].effectivePriorityScore
      var withoutRice = buildFeatureReadiness(rfWithoutRice, null).approved[0].effectivePriorityScore

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
        [healthKey]: healthCache
      })
      var result = buildFeatureReadiness(readFromStorage, version)
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
        'releases/planning/candidates-cache-3.6.json': candidateCache
      })
      var result = buildFeatureReadiness(readFromStorage, '3.6')
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
      var result = buildFeatureReadiness(readFromStorage, null)
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
      var hygieneCache = {
        features: {
          'RHAISTRAT-1': { key: 'RHAISTRAT-1', team: 'Alice' },
          'RHAISTRAT-2': { key: 'RHAISTRAT-2', team: 'Bob' }
        }
      }
      var readFromStorage = makeReadFromStorage({
        'ai-impact/features.json': store,
        'releases/hygiene/features-3.6.json': hygieneCache
      })
      var result = buildFeatureReadiness(readFromStorage, '3.6')
      expect(result.filterMeta.teams).toEqual(['Alice', 'Bob'])
    })

    it('filterMeta.teams deduplicates team names', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) },
        'RHAISTRAT-2': { latest: makeLatest({ key: 'RHAISTRAT-2', humanReviewStatus: 'approved' }) }
      })
      var hygieneCache = {
        features: {
          'RHAISTRAT-1': { key: 'RHAISTRAT-1', team: 'Alice' },
          'RHAISTRAT-2': { key: 'RHAISTRAT-2', team: 'Alice' }
        }
      }
      var readFromStorage = makeReadFromStorage({
        'ai-impact/features.json': store,
        'releases/hygiene/features-3.6.json': hygieneCache
      })
      var result = buildFeatureReadiness(readFromStorage, '3.6')
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
        'releases/planning/health-cache-3.6.json': healthCache,
        'releases/hygiene/features-3.6.json': hygieneCache
      })
      var result = buildFeatureReadiness(readFromStorage, '3.6')
      expect(result.approved[0].team).toBe('Real Team')
      expect(result.filterMeta.teams).toEqual(['Real Team'])
    })
  })

  describe('meta', function() {
    it('contains correct counts and version', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) },
        'RHAISTRAT-2': { latest: makeLatest({ key: 'RHAISTRAT-2', humanReviewStatus: null }) },
        'RHAISTRAT-3': { latest: makeLatest({ key: 'RHAISTRAT-3', humanReviewStatus: 'needs-review' }) }
      })
      var readFromStorage = makeReadFromStorage({ 'ai-impact/features.json': store })
      var result = buildFeatureReadiness(readFromStorage, '3.6')
      expect(result.meta.total).toBe(3)
      expect(result.meta.approvedCount).toBe(1)
      expect(result.meta.pendingReviewCount).toBe(2)
      expect(result.meta.version).toBe('3.6')
    })

    it('meta.version is null when no version is passed', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var readFromStorage = makeReadFromStorage({ 'ai-impact/features.json': store })
      var result = buildFeatureReadiness(readFromStorage, null)
      expect(result.meta.version).toBeNull()
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
      var result = buildFeatureReadiness(readFromStorage, null)
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
      var result = buildFeatureReadiness(readFromStorage, null)
      expect(result.approved[0].rubricTotal).toBe(2)
    })
  })
})
