import { describe, it, expect } from 'vitest'

const {
  computeReadiness,
  buildFeatureReadiness,
  computeBlockers,
  hasBlockingViolations,
  computeHygieneStatus,
  computeConfidence,
  collectFilterMeta,
  buildCanonicalKeySet,
  mergeFeatureData
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
    components: ['Platform', 'Serving'],
    approvedBy: null,
    approvedAt: null,
    riceScore: 100,
    storyPoints: 5,
    epicCount: 3,
    docsRequired: 'Required',
    effort: 5,
    releaseType: 'GA'
  }, overrides)
}

function makeFeaturesStore(features) {
  return { lastSyncedAt: '2026-01-01T00:00:00.000Z', totalFeatures: Object.keys(features).length, features }
}

/**
 * Convert feature store format ({ features: { key: { latest, history } } })
 * into unified releases execution storage entries (index + per-feature files).
 * Returns a flat object of storage keys to spread into makeReadFromStorage.
 */
function convertToUnifiedFormat(aiData) {
  if (!aiData || !aiData.features) return {}

  var result = {}
  var indexFeatures = []

  var keys = Object.keys(aiData.features)
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i]
    var entry = aiData.features[key]
    if (!entry || !entry.latest) continue
    var latest = entry.latest

    // Build unified feature file
    var featureFile = {
      key: key,
      summary: latest.title || '',
      status: latest.status || null,
      priority: latest.priority || null,
      components: latest.components || [],
      labels: latest.labels || [],
      riceScore: latest.riceScore != null ? latest.riceScore : null,
      linkedRfeKey: latest.sourceRfe || null,
      aiReview: {
        title: latest.title || '',
        sourceRfe: latest.sourceRfe || null,
        size: latest.size || null,
        recommendation: latest.recommendation || null,
        needsAttention: latest.needsAttention || false,
        humanReviewStatus: latest.humanReviewStatus || null,
        scores: latest.scores || {},
        reviewers: latest.reviewers || {},
        reviewedAt: latest.reviewedAt || null,
        approvedBy: latest.approvedBy || null,
        approvedAt: latest.approvedAt || null,
        labels: latest.labels || [],
        components: latest.components || [],
        history: entry.history || []
      }
    }
    result['releases/execution/features/' + key + '.json'] = featureFile

    // Build index entry with slim aiReview
    indexFeatures.push({
      key: key,
      summary: latest.title || '',
      status: latest.status || null,
      statusCategory: null,
      priority: latest.priority || null,
      assignee: null,
      fixVersions: [],
      labels: latest.labels || [],
      completionPct: 0,
      epicCount: 3,
      issueCount: 0,
      blockerCount: 0,
      health: null,
      lastUpdated: null,
      targetVersions: null,
      pm: null,
      architect: null,
      parentKey: null,
      colorStatus: null,
      ownerStatusColor: null,
      aiReview: {
        recommendation: latest.recommendation || null,
        scores: latest.scores || {},
        humanReviewStatus: latest.humanReviewStatus || null,
        needsAttention: latest.needsAttention || false,
        reviewedAt: latest.reviewedAt || null
      }
    })
  }

  result['releases/execution/index.json'] = {
    fetchedAt: aiData.lastSyncedAt || '2026-01-01T00:00:00.000Z',
    schemaVersion: 'v2',
    featureCount: indexFeatures.length,
    features: indexFeatures
  }

  return result
}

function makeReadFromStorage(overrides) {
  var effective = Object.assign({}, overrides)
  // Merge index features when multiple sources contribute entries
  // (e.g., convertToUnifiedFormat entries + explicit index entries)
  if (effective['releases/execution/index.json']) {
    var idx = effective['releases/execution/index.json']
    if (idx.features) {
      var seen = new Set()
      var deduped = []
      for (var di = 0; di < idx.features.length; di++) {
        if (!seen.has(idx.features[di].key)) {
          seen.add(idx.features[di].key)
          deduped.push(idx.features[di])
        }
      }
      idx.features = deduped
      idx.featureCount = deduped.length
    }
  }
  return function(key) {
    if (Object.prototype.hasOwnProperty.call(effective, key)) {
      return effective[key]
    }
    return null
  }
}

var CONFIG_3_6 = { releases: { '3.6': { release: '3.6' } } }


// ---------------------------------------------------------------------------
// hasBlockingViolations
// ---------------------------------------------------------------------------

describe('hasBlockingViolations', function() {
  it('returns false for null/undefined/empty violations', function() {
    expect(hasBlockingViolations(null)).toBe(false)
    expect(hasBlockingViolations(undefined)).toBe(false)
    expect(hasBlockingViolations([])).toBe(false)
  })

  it('returns true when violations contain a blocking rule', function() {
    expect(hasBlockingViolations([{ id: 'missing-assignee' }])).toBe(true)
    expect(hasBlockingViolations([{ id: 'open-children-on-closed' }])).toBe(true)
  })

  it('returns false for missing-fix-version (no longer blocking)', function() {
    expect(hasBlockingViolations([{ id: 'missing-fix-version' }])).toBe(false)
  })

  it('returns false for missing-target-version (no longer blocking)', function() {
    expect(hasBlockingViolations([{ id: 'missing-target-version' }])).toBe(false)
  })

  it('returns false when violations are all non-blocking', function() {
    expect(hasBlockingViolations([
      { id: 'stale-status-summary' },
      { id: 'missing-color-status' },
      { id: 'missing-rice-score' }
    ])).toBe(false)
  })

  it('returns true when mix of blocking and non-blocking', function() {
    expect(hasBlockingViolations([
      { id: 'stale-status-summary' },
      { id: 'missing-assignee' }
    ])).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// computeConfidence
// ---------------------------------------------------------------------------

describe('computeConfidence', function() {
  it('returns not-ready when not ready', function() {
    expect(computeConfidence(false, null)).toBe('not-ready')
    expect(computeConfidence(false, '3.6.0')).toBe('not-ready')
  })

  it('returns committed when ready and has fixVersion', function() {
    expect(computeConfidence(true, '3.6.0')).toBe('committed')
  })

  it('returns ready when ready but no fixVersion', function() {
    expect(computeConfidence(true, null)).toBe('ready')
    expect(computeConfidence(true, '')).toBe('ready')
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
      expect(result.ready).toEqual([])
      expect(result.filterMeta).toEqual({ components: [], priorities: [], bigRocks: [], targetVersions: [], fixVersions: [], teams: [] })
      expect(result.meta).toEqual({ total: 0, pendingReviewCount: 0, readyCount: 0, versions: [], lastSyncedAt: null, jiraAvailable: false })
    })

    it('returns empty buckets when no features with aiReview exist', function() {
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat({ lastSyncedAt: '2026-01-01T00:00:00.000Z' })
      })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.pendingReview).toEqual([])
      expect(result.ready).toEqual([])
    })
  })

  describe('gate logic — bucket assignment', function() {
    it('humanReviewStatus approved with all gates → goes to ready bucket', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var healthCache = { features: [{ key: 'RHAISTRAT-1', deliveryOwner: 'Alice', pmOwner: 'Jane', targetRelease: 'rhoai-3.6', priorityScore: null, storyPoints: 5, epicCount: 3, releaseType: 'GA', components: ['Platform', 'Serving'], docsRequired: 'Required' }] }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.ready).toHaveLength(1)
      expect(result.ready[0].key).toBe('RHAISTRAT-1')
      expect(result.pendingReview).toHaveLength(0)
    })

    it('humanReviewStatus awaiting-review → goes to pendingReview bucket', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'awaiting-review' }) }
      })
      var readFromStorage = makeReadFromStorage({ ...convertToUnifiedFormat(store) })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.pendingReview).toHaveLength(1)
      expect(result.ready).toHaveLength(0)
    })

    it('humanReviewStatus needs-review → goes to pendingReview bucket', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'needs-review' }) }
      })
      var readFromStorage = makeReadFromStorage({ ...convertToUnifiedFormat(store) })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.pendingReview).toHaveLength(1)
      expect(result.ready).toHaveLength(0)
    })

    it('null humanReviewStatus → goes to pendingReview bucket', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: null }) }
      })
      var readFromStorage = makeReadFromStorage({ ...convertToUnifiedFormat(store) })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.pendingReview).toHaveLength(1)
      expect(result.ready).toHaveLength(0)
    })

    it('skips entries with no latest', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) },
        'RHAISTRAT-2': {}
      })
      var readFromStorage = makeReadFromStorage({ ...convertToUnifiedFormat(store) })
      var result = buildFeatureReadiness(readFromStorage)
      var allFeatures = result.pendingReview.concat(result.ready)
      expect(allFeatures).toHaveLength(1)
      expect(allFeatures[0].key).toBe('RHAISTRAT-1')
    })
  })

  describe('confidence field', function() {
    it('approved feature with fixVersion gets confidence=committed', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var candidateCache = {
        data: { features: [{ issueKey: 'RHAISTRAT-1', tier: 1, fixVersion: '3.6.0', targetRelease: 'rhoai-3.6' }] }
      }
      var healthCache = { features: [{ key: 'RHAISTRAT-1', deliveryOwner: 'Alice', pmOwner: 'Jane', priorityScore: null, storyPoints: 5, epicCount: 3, releaseType: 'GA', components: ['Platform', 'Serving'], docsRequired: 'Required' }] }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/candidates-cache-3.6.json': candidateCache,
        'releases/planning/health-cache-3.6-all.json': healthCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.ready[0].confidence).toBe('committed')
    })

    it('approved feature without fixVersion gets confidence=ready', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var healthCache = { features: [{ key: 'RHAISTRAT-1', deliveryOwner: 'Alice', pmOwner: 'Jane', targetRelease: 'rhoai-3.6', priorityScore: null, storyPoints: 5, epicCount: 3, releaseType: 'GA', components: ['Platform', 'Serving'], docsRequired: 'Required' }] }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.ready[0].confidence).toBe('ready')
    })

    it('non-approved feature gets confidence=not-ready', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: null }) }
      })
      var readFromStorage = makeReadFromStorage({ ...convertToUnifiedFormat(store) })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.pendingReview[0].confidence).toBe('not-ready')
    })
  })

  describe('readinessGates on all features', function() {
    it('strat-creator features have readinessGates with FPDoR fields', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var readFromStorage = makeReadFromStorage({ ...convertToUnifiedFormat(store) })
      var result = buildFeatureReadiness(readFromStorage)
      var feat = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-1' })
      expect(feat.readinessGates).toBeDefined()
      expect(typeof feat.readinessGates.fpDorPassed).toBe('number')
      expect(typeof feat.readinessGates.fpDorTotal).toBe('number')
      expect(typeof feat.readinessGates.fpDorEvaluated).toBe('number')
      expect(feat.readinessGates.noBlockingViolations).toBe(true)
    })

    it('health-pipeline features have readinessGates with FPDoR and noBlockingViolations', function() {
      var store = makeFeaturesStore({})
      var healthCache = {
        features: [{
          key: 'AIPCC-100', summary: 'Test', status: 'In Progress',
          priority: 'Major', deliveryOwner: 'Alice', blockerCount: 0, targetRelease: 'rhoai-3.6'
        }]
      }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      var feat = result.pendingReview[0]
      expect(typeof feat.readinessGates.fpDorPassed).toBe('number')
      expect(typeof feat.readinessGates.fpDorTotal).toBe('number')
      expect(typeof feat.readinessGates.fpDorEvaluated).toBe('number')
      expect(feat.readinessGates.noBlockingViolations).toBe(true)
    })
  })

  describe('hygiene violations integration', function() {
    it('attaches violations from hygiene cache to features', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var violations = [{ id: 'stale-status-summary', name: 'Stale Status', category: 'timeliness', message: 'Status is stale' }]
      var hygieneCache = {
        features: { 'RHAISTRAT-1': { key: 'RHAISTRAT-1', team: 'Alpha', violations: violations } }
      }
      var healthCache = { features: [{ key: 'RHAISTRAT-1', deliveryOwner: 'Alice', pmOwner: 'Jane', targetRelease: 'rhoai-3.6', priorityScore: null, storyPoints: 5, epicCount: 3, releaseType: 'GA', components: ['Platform', 'Serving'], docsRequired: 'Required' }] }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache,
        'releases/hygiene/features-3.6.json': hygieneCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.ready[0].violations).toEqual(violations)
    })

    it('blocking hygiene violation moves approved feature to pendingReview', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var violations = [{ id: 'missing-assignee', name: 'Missing Assignee', category: 'ownership', message: 'No assignee' }]
      var hygieneCache = {
        features: { 'RHAISTRAT-1': { key: 'RHAISTRAT-1', team: 'Alpha', violations: violations } }
      }
      var healthCache = { features: [{ key: 'RHAISTRAT-1', priorityScore: null, storyPoints: 5, releaseType: 'GA', deliveryOwner: 'Alice', pmOwner: 'Jane', targetRelease: 'rhoai-3.6' }] }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache,
        'releases/hygiene/features-3.6.json': hygieneCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.pendingReview).toHaveLength(1)
      expect(result.pendingReview[0].confidence).toBe('not-ready')
      expect(result.pendingReview[0].readinessGates.noBlockingViolations).toBe(false)
    })

    it('non-blocking violations do not affect readiness', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var violations = [{ id: 'stale-status-summary', name: 'Stale', category: 'timeliness', message: 'Stale' }]
      var hygieneCache = {
        features: { 'RHAISTRAT-1': { key: 'RHAISTRAT-1', team: 'Alpha', violations: violations } }
      }
      var healthCache = { features: [{ key: 'RHAISTRAT-1', deliveryOwner: 'Alice', pmOwner: 'Jane', targetRelease: 'rhoai-3.6', priorityScore: null, storyPoints: 5, epicCount: 3, releaseType: 'GA', components: ['Platform', 'Serving'], docsRequired: 'Required' }] }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache,
        'releases/hygiene/features-3.6.json': hygieneCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.ready).toHaveLength(1)
      expect(result.ready[0].readinessGates.noBlockingViolations).toBe(true)
    })

    it('health-pipeline feature with blocking hygiene goes to pendingReview', function() {
      var store = makeFeaturesStore({})
      var healthCache = {
        features: [{
          key: 'AIPCC-100', summary: 'Test', status: 'In Progress',
          priority: 'Major', deliveryOwner: 'Alice', blockerCount: 0, targetRelease: 'rhoai-3.6'
        }]
      }
      var violations = [{ id: 'missing-assignee', name: 'Missing Assignee', category: 'ownership', message: 'No assignee' }]
      var hygieneCache = {
        features: { 'AIPCC-100': { key: 'AIPCC-100', team: 'Beta', violations: violations } }
      }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache,
        'releases/hygiene/features-3.6.json': hygieneCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.pendingReview).toHaveLength(1)
      expect(result.pendingReview[0].readinessGates.noBlockingViolations).toBe(false)
    })
  })

  describe('sort order — approved', function() {
    it('sorts by effectivePriorityScore descending', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-LOW': { latest: makeLatest({ humanReviewStatus: 'approved', priority: 'Minor', scores: { feasibility: 1, testability: 1, scope: 1, architecture: 1 } }) },
        'RHAISTRAT-HIGH': { latest: makeLatest({ humanReviewStatus: 'approved', priority: 'Blocker', scores: { feasibility: 2, testability: 2, scope: 2, architecture: 2 } }) }
      })
      var readFromStorage = makeReadFromStorage({ ...convertToUnifiedFormat(store) })
      var result = buildFeatureReadiness(readFromStorage)
      var all = result.pendingReview.concat(result.ready)
      var highIdx = all.findIndex(function(f) { return f.key === 'RHAISTRAT-HIGH' })
      var lowIdx = all.findIndex(function(f) { return f.key === 'RHAISTRAT-LOW' })
      expect(highIdx).toBeLessThan(lowIdx)
    })

    it('higher rubric score → higher effectivePriorityScore → appears first', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-LOWTOTAL': { latest: makeLatest({ key: 'RHAISTRAT-LOWTOTAL', humanReviewStatus: 'approved', priority: 'Normal', scores: { feasibility: 1, testability: 1, scope: 1, architecture: 1 } }) },
        'RHAISTRAT-HIGHTOTAL': { latest: makeLatest({ key: 'RHAISTRAT-HIGHTOTAL', humanReviewStatus: 'approved', priority: 'Normal', scores: { feasibility: 2, testability: 2, scope: 2, architecture: 2 } }) }
      })
      var readFromStorage = makeReadFromStorage({ ...convertToUnifiedFormat(store) })
      var result = buildFeatureReadiness(readFromStorage)
      var all = result.pendingReview.concat(result.ready)
      var highIdx = all.findIndex(function(f) { return f.key === 'RHAISTRAT-HIGHTOTAL' })
      var lowIdx = all.findIndex(function(f) { return f.key === 'RHAISTRAT-LOWTOTAL' })
      expect(highIdx).toBeLessThan(lowIdx)
    })
  })

  describe('sort order — pendingReview', function() {
    it('higher priority → higher effectivePriorityScore → appears first', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-LOW': { latest: makeLatest({ key: 'RHAISTRAT-LOW', humanReviewStatus: null, priority: 'Minor', scores: { feasibility: 0, testability: 0, scope: 0, architecture: 0 } }) },
        'RHAISTRAT-HIGH': { latest: makeLatest({ key: 'RHAISTRAT-HIGH', humanReviewStatus: null, priority: 'Blocker', scores: { feasibility: 0, testability: 0, scope: 0, architecture: 0 } }) }
      })
      var readFromStorage = makeReadFromStorage({ ...convertToUnifiedFormat(store) })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.pendingReview[0].key).toBe('RHAISTRAT-HIGH')
      expect(result.pendingReview[1].key).toBe('RHAISTRAT-LOW')
    })

    it('equal priority: higher rubric score → higher effectivePriorityScore → appears first', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-A': { latest: makeLatest({ key: 'RHAISTRAT-A', humanReviewStatus: null, priority: 'Normal', size: null, scores: { feasibility: 2, testability: 1, scope: 0, architecture: 0 } }) },
        'RHAISTRAT-B': { latest: makeLatest({ key: 'RHAISTRAT-B', humanReviewStatus: null, priority: 'Normal', size: null, scores: { feasibility: 1, testability: 0, scope: 0, architecture: 0 } }) }
      })
      var readFromStorage = makeReadFromStorage({ ...convertToUnifiedFormat(store) })
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
        ...convertToUnifiedFormat(store),
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
      var healthCache = { features: [{ key: 'RHAISTRAT-1', deliveryOwner: 'Alice', pmOwner: 'Jane', priorityScore: null, storyPoints: 5, epicCount: 3, releaseType: 'GA', components: ['Platform', 'Serving'], docsRequired: 'Required' }] }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        [candidatesKey]: candidateCache,
        'releases/planning/health-cache-3.6-all.json': healthCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      var f = result.ready[0]
      expect(f.tier).toBe(1)
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
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        [candidatesKey]: candidateCache,
        'releases/planning/health-cache-3.6-all.json': healthCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      var f = result.pendingReview.concat(result.ready).find(function(feat) { return feat.key === 'RHAISTRAT-1' })
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
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        [candidatesKey]: candidateCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      var feat = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-1' })
      expect(feat.tier).toBe(2)
    })
  })

  describe('missing candidates cache', function() {
    it('includes all features when configured releases exist but all caches are empty', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6
      })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.pendingReview.concat(result.ready)).toHaveLength(1)
    })

    it('includes all features when no releases are configured', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store)
      })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.pendingReview.concat(result.ready)).toHaveLength(1)
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
          pmOwner: 'Jane PM',
          priorityScore: null,
          storyPoints: 5,
          epicCount: 3,
          releaseType: 'GA',
          components: ['Platform', 'Serving'],
          docsRequired: 'Required'
        }]
      }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      var f = result.ready[0]
      expect(f.tier).toBe(2)
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
        features: [{ key: 'RHAISTRAT-1', tier: 'T3', bigRock: 'Platform', targetRelease: 'rhoai-3.6-health', fixVersions: '3.6.0-health', deliveryOwner: 'Alice', pmOwner: 'Jane', priorityScore: null, storyPoints: 5, epicCount: 3, releaseType: 'GA', components: ['Platform', 'Serving'], docsRequired: 'Required' }]
      }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/candidates-cache-3.6.json': candidateCache,
        'releases/planning/health-cache-3.6-all.json': healthCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      var f = result.ready[0]
      expect(f.tier).toBe(1)
      expect(f.bigRock).toBe('AI Speed')
      expect(f.targetVersions).toEqual(['rhoai-3.6-cand'])
      expect(f.fixVersion).toBe('3.6.0-cand')
    })

    it('health cache components (string) are split into array when ai-impact components are empty', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved', components: [] }) }
      })
      var healthCache = {
        features: [{ key: 'RHAISTRAT-1', components: 'Serving, Training', deliveryOwner: 'Alice', pmOwner: 'Jane', targetRelease: 'rhoai-3.6', priorityScore: null, storyPoints: 5, epicCount: 3, releaseType: 'GA', docsRequired: 'Required' }]
      }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      var feat = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-1' })
      expect(feat.components).toEqual(['Serving', 'Training'])
    })
  })

  describe('health cache cross-reference', function() {
    var healthKey = 'releases/planning/health-cache-3.6-all.json'

    it('feature gets batch-computed priorityScore', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var healthCache = {
        features: [{ key: 'RHAISTRAT-1', deliveryOwner: 'Alice', pmOwner: 'Jane', targetRelease: 'rhoai-3.6', storyPoints: 5, epicCount: 3, releaseType: 'GA', components: ['Platform', 'Serving'], docsRequired: 'Required' }]
      }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        [healthKey]: healthCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      var f = result.ready[0]
      expect(typeof f.effectivePriorityScore).toBe('number')
      expect(f.effectivePriorityScore).toBeGreaterThan(0)
    })

    it('priorityScoreBreakdown has rice, bigRock, targetVersion, priority fields', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var healthCache = {
        features: [{ key: 'RHAISTRAT-1', deliveryOwner: 'Alice', pmOwner: 'Jane', targetRelease: 'rhoai-3.6', storyPoints: 5, epicCount: 3, releaseType: 'GA', components: ['Platform', 'Serving'], docsRequired: 'Required' }]
      }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        [healthKey]: healthCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      var bd = result.ready[0].priorityScoreBreakdown
      expect(typeof bd.rice).toBe('number')
      expect(typeof bd.bigRock).toBe('number')
      expect(typeof bd.targetVersion).toBe('number')
      expect(typeof bd.priority).toBe('number')
    })
  })

  describe('batch scoring', function() {
    it('all features get batch-computed scores from computePriorityScores', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved', priority: 'Blocker', riceScore: 200 }) },
        'RHAISTRAT-2': { latest: makeLatest({ key: 'RHAISTRAT-2', humanReviewStatus: 'approved', priority: 'Minor', riceScore: 10 }) }
      })
      var healthCache = {
        features: [
          { key: 'RHAISTRAT-1', deliveryOwner: 'Alice', pmOwner: 'Jane', targetRelease: 'rhoai-3.6', storyPoints: 5, epicCount: 3, releaseType: 'GA', components: ['Platform', 'Serving'], docsRequired: 'Required' },
          { key: 'RHAISTRAT-2', deliveryOwner: 'Bob', pmOwner: 'Jane', targetRelease: 'rhoai-3.6', storyPoints: 5, epicCount: 3, releaseType: 'GA', components: ['Platform', 'Serving'], docsRequired: 'Required' }
        ]
      }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      var all = result.pendingReview.concat(result.ready)
      var f1 = all.find(function(f) { return f.key === 'RHAISTRAT-1' })
      var f2 = all.find(function(f) { return f.key === 'RHAISTRAT-2' })
      expect(f1.effectivePriorityScore).toBeGreaterThan(f2.effectivePriorityScore)
      expect(f1.priorityScoreBreakdown).toBeDefined()
      expect(f2.priorityScoreBreakdown).toBeDefined()
    })

    it('RICE scores are min-max normalized across the batch', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-HIGH': { latest: makeLatest({ humanReviewStatus: 'approved', riceScore: 1000 }) },
        'RHAISTRAT-LOW': { latest: makeLatest({ key: 'RHAISTRAT-LOW', humanReviewStatus: 'approved', riceScore: 10 }) }
      })
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6
      })
      var result = buildFeatureReadiness(readFromStorage)
      var all = result.pendingReview.concat(result.ready)
      var high = all.find(function(f) { return f.key === 'RHAISTRAT-HIGH' })
      var low = all.find(function(f) { return f.key === 'RHAISTRAT-LOW' })
      expect(high.priorityScoreBreakdown.rice).toBe(100)
      expect(low.priorityScoreBreakdown.rice).toBe(0)
    })
  })

  describe('stable rank', function() {
    it('assigns rank numbers based on global sort position', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-A': { latest: makeLatest({ key: 'RHAISTRAT-A', humanReviewStatus: 'approved', priority: 'Blocker' }) },
        'RHAISTRAT-B': { latest: makeLatest({ key: 'RHAISTRAT-B', humanReviewStatus: null, priority: 'Minor' }) },
        'RHAISTRAT-C': { latest: makeLatest({ key: 'RHAISTRAT-C', humanReviewStatus: null, priority: 'Normal' }) }
      })
      var readFromStorage = makeReadFromStorage({ ...convertToUnifiedFormat(store) })
      var result = buildFeatureReadiness(readFromStorage)
      var all = result.pendingReview.concat(result.ready)
      for (var i = 0; i < all.length; i++) {
        expect(typeof all[i].rank).toBe('number')
        expect(all[i].rank).toBeGreaterThanOrEqual(1)
      }
    })

    it('rank values are unique and contiguous starting from 1', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved', priority: 'Blocker' }) },
        'RHAISTRAT-2': { latest: makeLatest({ key: 'RHAISTRAT-2', humanReviewStatus: null, priority: 'Normal' }) },
        'RHAISTRAT-3': { latest: makeLatest({ key: 'RHAISTRAT-3', humanReviewStatus: null, priority: 'Minor' }) }
      })
      var readFromStorage = makeReadFromStorage({ ...convertToUnifiedFormat(store) })
      var result = buildFeatureReadiness(readFromStorage)
      var all = result.pendingReview.concat(result.ready)
      var ranks = all.map(function(f) { return f.rank }).sort(function(a, b) { return a - b })
      for (var i = 0; i < ranks.length; i++) {
        expect(ranks[i]).toBe(i + 1)
      }
    })

    it('highest-scored feature gets rank 1', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-LOW': { latest: makeLatest({ key: 'RHAISTRAT-LOW', humanReviewStatus: null, priority: 'Minor', riceScore: 10 }) },
        'RHAISTRAT-HIGH': { latest: makeLatest({ key: 'RHAISTRAT-HIGH', humanReviewStatus: null, priority: 'Blocker', riceScore: 1000 }) }
      })
      var readFromStorage = makeReadFromStorage({ ...convertToUnifiedFormat(store) })
      var result = buildFeatureReadiness(readFromStorage)
      var all = result.pendingReview.concat(result.ready)
      var high = all.find(function(f) { return f.key === 'RHAISTRAT-HIGH' })
      var low = all.find(function(f) { return f.key === 'RHAISTRAT-LOW' })
      expect(high.rank).toBe(1)
      expect(low.rank).toBe(2)
    })
  })

  describe('cross-version bigRockPriorityMap', function() {
    it('uses best (lowest) priority number when a rock appears in multiple releases', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: null }) }
      })
      var config = { releases: { '3.5': { release: '3.5' }, '3.6': { release: '3.6' } } }
      var candidateCache35 = {
        data: { features: [{ issueKey: 'RHAISTRAT-1', bigRock: 'AI Efficiency', tier: 1 }] }
      }
      var candidateCache36 = {
        data: { features: [] }
      }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': config,
        'releases/planning/candidates-cache-3.5.json': candidateCache35,
        'releases/planning/candidates-cache-3.6.json': candidateCache36,
        'releases/planning/releases/3.5.json': { release: '3.5', bigRocks: [{ name: 'AI Efficiency', priority: 1 }] },
        'releases/planning/releases/3.6.json': { release: '3.6', bigRocks: [{ name: 'AI Efficiency', priority: 3 }] }
      })
      var result = buildFeatureReadiness(readFromStorage)
      var all = result.pendingReview.concat(result.ready)
      var feat = all.find(function(f) { return f.key === 'RHAISTRAT-1' })
      expect(feat).toBeDefined()
      expect(feat.priorityScoreBreakdown.bigRock).toBeGreaterThan(0)
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
        ...convertToUnifiedFormat(store),
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
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache,
        'releases/hygiene/features-3.6.json': hygieneCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.filterMeta.teams).toEqual(['Alice', 'Bob'])
    })

    it('feature.team comes from hygiene cache, not deliveryOwner', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var healthCache = { features: [{ key: 'RHAISTRAT-1', deliveryOwner: 'wrong-owner', pmOwner: 'Jane', targetRelease: 'rhoai-3.6', priorityScore: null, storyPoints: 5, epicCount: 3, releaseType: 'GA', components: ['Platform', 'Serving'], docsRequired: 'Required' }] }
      var hygieneCache = { features: { 'RHAISTRAT-1': { key: 'RHAISTRAT-1', team: 'Real Team' } } }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache,
        'releases/hygiene/features-3.6.json': hygieneCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      var feat = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-1' })
      expect(feat.team).toBe('Real Team')
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
          { key: 'RHAISTRAT-1', deliveryOwner: 'Alice', pmOwner: 'Jane', targetRelease: 'rhoai-3.6', priorityScore: null, storyPoints: 5, epicCount: 3, releaseType: 'GA', components: ['Platform', 'Serving'], docsRequired: 'Required' },
          { key: 'RHAISTRAT-2', priorityScore: null },
          { key: 'RHAISTRAT-3', priorityScore: null }
        ]
      }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.meta.total).toBe(3)
      expect(result.meta.readyCount).toBe(1)
      expect(result.meta.pendingReviewCount).toBe(2)
      expect(result.meta.versions).toEqual(['3.6'])
    })

    it('meta.versions is empty when no releases are configured', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var readFromStorage = makeReadFromStorage({ ...convertToUnifiedFormat(store) })
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
      var readFromStorage = makeReadFromStorage({ ...convertToUnifiedFormat(store) })
      var result = buildFeatureReadiness(readFromStorage)
      var feat = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-1' })
      expect(feat.rubricTotal).toBe(8)
    })

    it('treats missing score dimensions as 0', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({
          humanReviewStatus: 'approved',
          scores: { feasibility: 2 }
        }) }
      })
      var readFromStorage = makeReadFromStorage({ ...convertToUnifiedFormat(store) })
      var result = buildFeatureReadiness(readFromStorage)
      var feat = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-1' })
      expect(feat.rubricTotal).toBe(2)
    })
  })

  describe('health cache scores fallback', function() {
    it('uses health cache scores when aiReview is not available', function() {
      var store = makeFeaturesStore({})
      var healthCache = {
        features: [{
          key: 'AIPCC-500', summary: 'Health Feature', status: 'In Progress',
          priority: 'Major', deliveryOwner: 'Jane', pm: 'Rick',
          components: ['Dashboard', 'Documentation'], targetRelease: 'rhoai-3.6',
          scores: { feasibility: 2, testability: 2, scope: 2, architecture: 2 }
        }]
      }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      var feat = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'AIPCC-500' })
      expect(feat).toBeDefined()
      expect(feat.rubricTotal).toBe(8)
      expect(feat.scores).toEqual({ feasibility: 2, testability: 2, scope: 2, architecture: 2 })
    })

    it('prefers aiReview scores over health cache scores', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({
          humanReviewStatus: 'approved',
          scores: { feasibility: 3, testability: 3, scope: 3, architecture: 3 }
        }) }
      })
      var healthCache = {
        features: [{
          key: 'RHAISTRAT-1', summary: 'Feature', status: 'In Progress',
          scores: { feasibility: 1, testability: 1, scope: 1, architecture: 1 }
        }]
      }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      var feat = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-1' })
      expect(feat.rubricTotal).toBe(12)
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
      var inOnly = convertToUnifiedFormat(store)
      delete inOnly['releases/execution/features/RHAISTRAT-OUT.json']
      var idx = inOnly['releases/execution/index.json']
      if (idx && idx.features) {
        idx.features = idx.features.filter(function(f) { return f.key !== 'RHAISTRAT-OUT' })
        idx.featureCount = idx.features.length
      }
      var readFromStorage = makeReadFromStorage({
        ...inOnly,
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      var allFeatures = result.pendingReview.concat(result.ready)
      expect(allFeatures).toHaveLength(1)
      expect(allFeatures[0].key).toBe('RHAISTRAT-IN')
    })

    it('includes all features when no configured releases exist', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) },
        'RHAISTRAT-2': { latest: makeLatest({ key: 'RHAISTRAT-2', humanReviewStatus: null }) }
      })
      var readFromStorage = makeReadFromStorage({ ...convertToUnifiedFormat(store) })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.pendingReview.concat(result.ready)).toHaveLength(2)
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
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': config,
        'releases/planning/health-cache-3.5-all.json': { features: [{ key: 'RHAISTRAT-1', deliveryOwner: 'Alice', pmOwner: 'Jane', targetRelease: 'rhoai-3.5', priorityScore: 80, storyPoints: 5, epicCount: 3, releaseType: 'GA', components: ['Platform', 'Serving'], docsRequired: 'Required' }] },
        'releases/planning/health-cache-3.6-all.json': { features: [{ key: 'RHAISTRAT-2', deliveryOwner: 'Bob', pmOwner: 'Jane', targetRelease: 'rhoai-3.6', priorityScore: 60, storyPoints: 5, epicCount: 3, releaseType: 'GA', components: ['Platform', 'Serving'], docsRequired: 'Required' }] }
      })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.ready).toHaveLength(2)
      expect(result.meta.versions).toEqual(['3.5', '3.6'])
    })

    it('duplicate features across versions use first-seen data', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var config = { releases: { '3.5': { release: '3.5' }, '3.6': { release: '3.6' } } }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': config,
        'releases/planning/candidates-cache-3.5.json': { data: { features: [{ issueKey: 'RHAISTRAT-1', tier: 1, bigRock: 'First' }] } },
        'releases/planning/candidates-cache-3.6.json': { data: { features: [{ issueKey: 'RHAISTRAT-1', tier: 2, bigRock: 'Second' }] } }
      })
      var result = buildFeatureReadiness(readFromStorage)
      var allFeatures = result.pendingReview.concat(result.ready)
      expect(allFeatures).toHaveLength(1)
      expect(allFeatures[0].tier).toBe(1)
      expect(allFeatures[0].bigRock).toBe('First')
    })

    it('meta.versions reflects all configured release versions', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var config = { releases: { '3.4': { release: '3.4' }, '3.5': { release: '3.5' }, '3.6': { release: '3.6' } } }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': config
      })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.meta.versions).toEqual(['3.4', '3.5', '3.6'])
    })
  })

  // -------------------------------------------------------------------------
  // computeReadiness (FPDoR-based)
  // -------------------------------------------------------------------------

  describe('computeReadiness', function() {
    function readyFeature(overrides) {
      return Object.assign({
        riceScore: 100,
        storyPoints: 5,
        epicCount: 3,
        targetVersions: ['rhoai-3.6'],
        releaseType: 'GA',
        deliveryOwner: 'Alice',
        pmOwner: 'Jane',
        components: ['Platform', 'Serving'],
        docsRequired: 'Required',
        effort: 5,
        scores: { testability: 2, architecture: 2, feasibility: 2, scope: 2 },
        descriptionSignals: { hasContent: true, signalCount: 3, hasAcceptanceCriteria: true, hasUseCases: true, hasScopeDefinition: true, hasRequirements: false, hasRisks: true, hasArchitectureSignal: true },
        status: 'In Progress',
        violations: null
      }, overrides)
    }

    it('returns isReady=true when all FPDoR items pass, past refinement, no blocking violations', function() {
      var result = computeReadiness(readyFeature())
      expect(result.isReady).toBe(true)
      expect(result.gates.fpDorPassed).toBeGreaterThanOrEqual(6)
      expect(result.gates.fpDorEvaluated).toBeGreaterThanOrEqual(6)
      expect(result.gates.pastRefinement).toBe(true)
      expect(result.gates.noBlockingViolations).toBe(true)
      expect(result.fpdor).toBeDefined()
      expect(result.fpdor.items).toBeDefined()
      expect(Array.isArray(result.fpdor.items)).toBe(true)
    })

    it('returns isReady=false when riceScore is 0', function() {
      var result = computeReadiness(readyFeature({ riceScore: 0 }))
      expect(result.isReady).toBe(false)
      expect(result.gates.fpDorPassed).toBeLessThan(result.gates.fpDorEvaluated)
    })

    it('returns isReady=false when scope not defined (no sizing, no breakdown)', function() {
      var result = computeReadiness(readyFeature({ storyPoints: 0, epicCount: 0, effort: null, tshirtSize: null, scores: {} }))
      expect(result.isReady).toBe(false)
    })

    it('returns isReady=true when storyPoints=0 but has tshirtSize and epicCount > 0', function() {
      var result = computeReadiness(readyFeature({ storyPoints: 0, epicCount: 3, tshirtSize: 'M' }))
      expect(result.isReady).toBe(true)
    })

    it('returns isReady=false when targetVersions is empty', function() {
      var result = computeReadiness(readyFeature({ targetVersions: [] }))
      expect(result.isReady).toBe(false)
    })

    it('returns isReady=false when releaseType is null', function() {
      var result = computeReadiness(readyFeature({ releaseType: null }))
      expect(result.isReady).toBe(false)
    })

    it('returns isReady=false when deliveryOwner is null', function() {
      var result = computeReadiness(readyFeature({ deliveryOwner: null, pmOwner: null }))
      expect(result.isReady).toBe(false)
    })

    it('returns isReady=false when components is empty', function() {
      var result = computeReadiness(readyFeature({ components: [] }))
      expect(result.isReady).toBe(false)
    })

    it('cross-functional passes with multiple components even without docs', function() {
      var result = computeReadiness(readyFeature({ components: ['Platform', 'UI'], docsRequired: null }))
      expect(result.isReady).toBe(true)
    })

    it('cross-functional fails with single non-doc component and no docsRequired', function() {
      var result = computeReadiness(readyFeature({ components: ['Platform'], docsRequired: null }))
      expect(result.isReady).toBe(false)
    })

    it('returns isReady=false when status is New', function() {
      var result = computeReadiness(readyFeature({ status: 'New' }))
      expect(result.isReady).toBe(false)
      expect(result.gates.pastRefinement).toBe(false)
    })

    it('returns isReady=false when status is Refinement', function() {
      var result = computeReadiness(readyFeature({ status: 'Refinement' }))
      expect(result.isReady).toBe(false)
      expect(result.gates.pastRefinement).toBe(false)
    })

    it('returns isReady=false when status is null', function() {
      var result = computeReadiness(readyFeature({ status: null }))
      expect(result.isReady).toBe(false)
      expect(result.gates.pastRefinement).toBe(false)
    })

    it('returns isReady=false when blocking violations exist', function() {
      var result = computeReadiness(readyFeature({ violations: [{ id: 'missing-assignee' }] }))
      expect(result.isReady).toBe(false)
      expect(result.gates.noBlockingViolations).toBe(false)
    })

    it('non-blocking violations do not fail the gate', function() {
      var result = computeReadiness(readyFeature({ violations: [{ id: 'stale-status-summary' }] }))
      expect(result.isReady).toBe(true)
      expect(result.gates.noBlockingViolations).toBe(true)
    })

    it('gates has fpDorPassed, fpDorTotal, fpDorEvaluated', function() {
      var result = computeReadiness(readyFeature())
      expect(typeof result.gates.fpDorPassed).toBe('number')
      expect(typeof result.gates.fpDorTotal).toBe('number')
      expect(typeof result.gates.fpDorEvaluated).toBe('number')
    })

    it('fpdor object contains items array with individual checks', function() {
      var result = computeReadiness(readyFeature())
      expect(result.fpdor.items.length).toBeGreaterThan(0)
      for (var i = 0; i < result.fpdor.items.length; i++) {
        expect(result.fpdor.items[i]).toHaveProperty('name')
        expect(result.fpdor.items[i]).toHaveProperty('pass')
        expect(result.fpdor.items[i]).toHaveProperty('source')
      }
    })

    // --- Scope Defined tests ---

    it('scope defined passes with epicCount > 0 (no pipeline)', function() {
      var result = computeReadiness(readyFeature({ scores: {}, epicCount: 3, storyPoints: 0 }))
      var scopeItem = result.fpdor.items.find(function(i) { return i.name === 'Scope Defined' })
      expect(scopeItem.pass).toBe(true)
    })

    it('scope defined passes with storyPoints > 0 (no pipeline)', function() {
      var result = computeReadiness(readyFeature({ scores: {}, epicCount: 0, storyPoints: 5 }))
      var scopeItem = result.fpdor.items.find(function(i) { return i.name === 'Scope Defined' })
      expect(scopeItem.pass).toBe(true)
    })

    it('scope defined passes with effort > 0 (no pipeline)', function() {
      var result = computeReadiness(readyFeature({ scores: {}, epicCount: 0, storyPoints: 0, effort: 5 }))
      var scopeItem = result.fpdor.items.find(function(i) { return i.name === 'Scope Defined' })
      expect(scopeItem.pass).toBe(true)
    })

    it('scope defined passes with tshirtSize (no pipeline)', function() {
      var result = computeReadiness(readyFeature({ scores: {}, epicCount: 0, storyPoints: 0, tshirtSize: 'L' }))
      var scopeItem = result.fpdor.items.find(function(i) { return i.name === 'Scope Defined' })
      expect(scopeItem.pass).toBe(true)
    })

    it('scope defined fails when no epicCount and no sizing (no pipeline)', function() {
      var result = computeReadiness(readyFeature({ scores: {}, epicCount: 0, storyPoints: 0, effort: null, tshirtSize: null }))
      var scopeItem = result.fpdor.items.find(function(i) { return i.name === 'Scope Defined' })
      expect(scopeItem.pass).toBe(false)
    })

    it('scope defined passes with scope score >= 2 (pipeline)', function() {
      var result = computeReadiness(readyFeature({ scores: { scope: 2, testability: 2, architecture: 2, feasibility: 2 } }))
      var scopeItem = result.fpdor.items.find(function(i) { return i.name === 'Scope Defined' })
      expect(scopeItem.pass).toBe(true)
    })

    // --- Cross-functional tests ---

    it('cross-functional passes with 2 non-doc components', function() {
      var result = computeReadiness(readyFeature({ components: ['Platform', 'Serving'] }))
      var cfItem = result.fpdor.items.find(function(i) { return i.name === 'Cross-functional Engagement' })
      expect(cfItem.pass).toBe(true)
    })

    it('cross-functional fails with single component', function() {
      var result = computeReadiness(readyFeature({ components: ['Platform'] }))
      var cfItem = result.fpdor.items.find(function(i) { return i.name === 'Cross-functional Engagement' })
      expect(cfItem.pass).toBe(false)
    })

    it('cross-functional fails with Documentation + 1 other (need >= 3)', function() {
      var result = computeReadiness(readyFeature({ components: ['Documentation', 'Platform'] }))
      var cfItem = result.fpdor.items.find(function(i) { return i.name === 'Cross-functional Engagement' })
      expect(cfItem.pass).toBe(false)
    })

    it('cross-functional passes with Documentation + 2 others (>= 3)', function() {
      var result = computeReadiness(readyFeature({ components: ['Documentation', 'Platform', 'Serving'] }))
      var cfItem = result.fpdor.items.find(function(i) { return i.name === 'Cross-functional Engagement' })
      expect(cfItem.pass).toBe(true)
    })

    // --- Requirements Clarity tests ---

    it('requirements clarity passes with scope score >= 2', function() {
      var result = computeReadiness(readyFeature({ scores: { testability: 2, architecture: 2, feasibility: 2, scope: 2 } }))
      var reqItem = result.fpdor.items.find(function(i) { return i.name === 'Requirements Clarity' })
      expect(reqItem.pass).toBe(true)
    })

    it('requirements clarity fails with scope score < 2', function() {
      var result = computeReadiness(readyFeature({ scores: { testability: 2, architecture: 2, feasibility: 2, scope: 1 } }))
      var reqItem = result.fpdor.items.find(function(i) { return i.name === 'Requirements Clarity' })
      expect(reqItem.pass).toBe(false)
    })

    it('requirements clarity falls back to description signals when no scope score', function() {
      var result = computeReadiness(readyFeature({ scores: { testability: 2, architecture: 2, feasibility: 2 }, descriptionSignals: { hasContent: true, signalCount: 3 } }))
      var reqItem = result.fpdor.items.find(function(i) { return i.name === 'Requirements Clarity' })
      expect(reqItem.pass).toBe(true)
    })

    it('requirements clarity fails when description has < 2 signals and no scope score', function() {
      var result = computeReadiness(readyFeature({ scores: { testability: 2, architecture: 2, feasibility: 2 }, descriptionSignals: { hasContent: true, signalCount: 1 } }))
      var reqItem = result.fpdor.items.find(function(i) { return i.name === 'Requirements Clarity' })
      expect(reqItem.pass).toBe(false)
    })

    it('FPDoR has 11 items total', function() {
      var result = computeReadiness(readyFeature())
      expect(result.fpdor.items.length).toBe(11)
      expect(result.fpdor.totalCount).toBe(11)
    })
  })

  // -------------------------------------------------------------------------
  // Cache-based feature discovery (health-pipeline features)
  // -------------------------------------------------------------------------

  describe('cache-based feature discovery', function() {
    it('discovers features in health cache but not in ai-impact', function() {
      var store = makeFeaturesStore({})
      var healthCache = {
        features: [{ key: 'AIPCC-100', summary: 'AIPCC Feature', status: 'In Progress', priority: 'Major', deliveryOwner: 'Alice', blockerCount: 0, targetRelease: 'rhoai-3.6' }]
      }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.ready.length + result.pendingReview.length).toBe(1)
      var feat = result.ready[0] || result.pendingReview[0]
      expect(feat.key).toBe('AIPCC-100')
      expect(feat.dataSource).toBe('health-pipeline')
      expect(feat.recommendation).toBeNull()
      expect(feat.rubricTotal).toBe(0)
    })

    it('health-pipeline feature always goes to pendingReview (no approval/rubric)', function() {
      var store = makeFeaturesStore({})
      var healthCache = {
        features: [{
          key: 'AIPCC-200', summary: 'Ready AIPCC', status: 'In Progress',
          priority: 'Major', deliveryOwner: 'Bob', blockerCount: 0, targetRelease: 'rhoai-3.6'
        }]
      }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.pendingReview).toHaveLength(1)
      expect(result.pendingReview[0].key).toBe('AIPCC-200')
    })

    it('health-pipeline feature missing owner goes to pendingReview', function() {
      var store = makeFeaturesStore({})
      var healthCache = {
        features: [{
          key: 'AIPCC-300', summary: 'No Owner', status: 'In Progress',
          priority: 'Normal', deliveryOwner: null, blockerCount: 0, targetRelease: 'rhoai-3.6'
        }]
      }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.pendingReview).toHaveLength(1)
      expect(result.pendingReview[0].key).toBe('AIPCC-300')
    })

    it('strat-creator features get dataSource strat-creator', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var healthCache = {
        features: [{ key: 'RHAISTRAT-1', deliveryOwner: 'Alice', pmOwner: 'Jane', targetRelease: 'rhoai-3.6', priorityScore: 70, storyPoints: 5, epicCount: 3, releaseType: 'GA', components: ['Platform', 'Serving'], docsRequired: 'Required' }]
      }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.ready[0].dataSource).toBe('strat-creator')
    })

    it('feature in both ai-impact and health cache is NOT duplicated', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var healthCache = {
        features: [
          { key: 'RHAISTRAT-1', priorityScore: 70 },
          { key: 'AIPCC-100', summary: 'AIPCC', status: 'In Progress', priority: 'Major', deliveryOwner: 'Alice', blockerCount: 0, targetRelease: 'rhoai-3.6' }
        ]
      }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      var allFeatures = result.ready.concat(result.pendingReview)
      var keys = allFeatures.map(function(f) { return f.key })
      expect(keys).toHaveLength(2)
      expect(keys).toContain('RHAISTRAT-1')
      expect(keys).toContain('AIPCC-100')
    })

    it('health-pipeline features get batch-computed priority score', function() {
      var store = makeFeaturesStore({})
      var healthCache = {
        features: [{
          key: 'AIPCC-500', summary: 'Scored', status: 'In Progress',
          priority: 'Major', deliveryOwner: 'Alice', blockerCount: 0,
          targetRelease: 'rhoai-3.6'
        }]
      }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      var feat = result.pendingReview[0]
      expect(typeof feat.effectivePriorityScore).toBe('number')
      expect(feat.effectivePriorityScore).toBeGreaterThan(0)
    })

    it('readinessGates are populated on health-pipeline features', function() {
      var store = makeFeaturesStore({})
      var healthCache = {
        features: [{
          key: 'AIPCC-800', summary: 'Gates test', status: 'New',
          priority: 'Normal', deliveryOwner: 'Alice', blockerCount: 1, targetRelease: null
        }]
      }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      var feat = result.pendingReview[0]
      expect(typeof feat.readinessGates.fpDorPassed).toBe('number')
      expect(typeof feat.readinessGates.fpDorTotal).toBe('number')
      expect(typeof feat.readinessGates.fpDorEvaluated).toBe('number')
      expect(feat.readinessGates.pastRefinement).toBe(false)
      expect(feat.readinessGates.noBlockingViolations).toBe(true)
    })

    it('works when no AI review data exists', function() {
      var healthCache = {
        features: [{
          key: 'AIPCC-900', summary: 'No ai-impact', status: 'In Progress',
          priority: 'Major', deliveryOwner: 'Alice', blockerCount: 0, targetRelease: 'rhoai-3.6'
        }]
      }
      var readFromStorage = makeReadFromStorage({
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.pendingReview).toHaveLength(1)
      expect(result.pendingReview[0].key).toBe('AIPCC-900')
    })

    it('meta counts include health-pipeline features', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var healthCache = {
        features: [
          { key: 'RHAISTRAT-1', deliveryOwner: 'Alice', pmOwner: 'Jane', targetRelease: 'rhoai-3.6', priorityScore: 70, storyPoints: 5, epicCount: 3, releaseType: 'GA', components: ['Platform', 'Serving'], docsRequired: 'Required' },
          { key: 'AIPCC-1000', summary: 'AIPCC Ready', status: 'In Progress', priority: 'Major', deliveryOwner: 'Alice', blockerCount: 0, targetRelease: 'rhoai-3.6' }
        ]
      }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.meta.total).toBe(2)
      expect(result.meta.readyCount).toBe(1)
    })
  })

  describe('hygiene alias lookup', function() {
    it('finds hygiene cache via registry displayName when config key differs', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var violations = [{ id: 'stale-status-summary', name: 'Stale', category: 'timeliness', message: 'Stale' }]
      var hygieneCache = {
        features: { 'RHAISTRAT-1': { key: 'RHAISTRAT-1', team: 'Alpha', violations: violations } }
      }
      var healthCache = { features: [{ key: 'RHAISTRAT-1', deliveryOwner: 'Alice', pmOwner: 'Jane', targetRelease: 'rhoai-3.6', priorityScore: null, storyPoints: 5, epicCount: 3, releaseType: 'GA', components: ['Platform', 'Serving'], docsRequired: 'Required' }] }
      var registryData = {
        releases: [
          { id: 'rhoai-3.6', displayName: 'RHOAI 3.6', fixVersions: ['RHOAI-3.6'], state: 'active', milestones: {} }
        ]
      }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache,
        'releases/registry.json': registryData,
        'releases/hygiene/features-RHOAI 3.6.json': hygieneCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      var feat = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-1' })
      expect(feat.violations).toEqual(violations)
    })

    it('finds hygiene cache via registry id alias', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var violations = [{ id: 'missing-assignee', name: 'No assignee', category: 'ownership', message: 'No assignee' }]
      var hygieneCache = {
        features: { 'RHAISTRAT-1': { key: 'RHAISTRAT-1', team: 'Alpha', violations: violations } }
      }
      var healthCache = { features: [{ key: 'RHAISTRAT-1', priorityScore: null }] }
      var registryData = {
        releases: [
          { id: 'rhoai-3.6', displayName: 'RHOAI 3.6', fixVersions: ['RHOAI-3.6'], state: 'active', milestones: {} }
        ]
      }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache,
        'releases/registry.json': registryData,
        'releases/hygiene/features-rhoai-3.6.json': hygieneCache
      })
      var result = buildFeatureReadiness(readFromStorage)
      expect(result.pendingReview[0].violations).toEqual(violations)
      expect(result.pendingReview[0].readinessGates.noBlockingViolations).toBe(false)
    })

    it('prefers direct config key match over alias', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var directViolations = [{ id: 'stale-status-summary', name: 'Direct', category: 'timeliness', message: 'Direct' }]
      var aliasViolations = [{ id: 'missing-assignee', name: 'Alias', category: 'ownership', message: 'Alias' }]
      var healthCache = { features: [{ key: 'RHAISTRAT-1', deliveryOwner: 'Alice', pmOwner: 'Jane', targetRelease: 'rhoai-3.6', priorityScore: null, storyPoints: 5, epicCount: 3, releaseType: 'GA', components: ['Platform', 'Serving'], docsRequired: 'Required' }] }
      var registryData = {
        releases: [
          { id: 'rhoai-3.6', displayName: 'RHOAI 3.6', fixVersions: [], state: 'active', milestones: {} }
        ]
      }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache,
        'releases/registry.json': registryData,
        'releases/hygiene/features-3.6.json': { features: { 'RHAISTRAT-1': { key: 'RHAISTRAT-1', team: 'A', violations: directViolations } } },
        'releases/hygiene/features-RHOAI 3.6.json': { features: { 'RHAISTRAT-1': { key: 'RHAISTRAT-1', team: 'A', violations: aliasViolations } } }
      })
      var result = buildFeatureReadiness(readFromStorage)
      var feat = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-1' })
      expect(feat.violations).toEqual(directViolations)
    })
  })

  describe('hygieneIndex independent of teamIndex', function() {
    it('indexes violations separately from team across versions', function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var violations = [{ id: 'stale-status-summary', name: 'Stale', category: 'timeliness', message: 'Stale' }]
      var config = { releases: { '3.5': { release: '3.5' }, '3.6': { release: '3.6' } } }
      var healthCache = { features: [{ key: 'RHAISTRAT-1', priorityScore: null }] }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': config,
        'releases/planning/health-cache-3.5-all.json': healthCache,
        'releases/planning/health-cache-3.6-all.json': healthCache,
        'releases/hygiene/features-3.5.json': { features: { 'RHAISTRAT-1': { key: 'RHAISTRAT-1', team: 'Alpha' } } },
        'releases/hygiene/features-3.6.json': { features: { 'RHAISTRAT-1': { key: 'RHAISTRAT-1', violations: violations } } }
      })
      var result = buildFeatureReadiness(readFromStorage)
      var feat = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-1' })
      expect(feat.team).toBe('Alpha')
      expect(feat.violations).toEqual(violations)
    })
  })


  describe('collectFilterMeta', function() {
    it('splits merged bigRock into separate Set entries', function() {
      var allComponents = []
      var allPriorities = new Set()
      var allBigRocks = new Set()
      var allTargetVersions = new Set()
      var allFixVersions = new Set()
      var allTeams = new Set()

      var feature = {
        bigRock: 'Rock A, Rock B',
        priority: 'Major',
        components: ['Platform'],
        targetVersions: ['3.6'],
        fixVersion: '',
        team: ''
      }

      collectFilterMeta(feature, allComponents, allPriorities, allBigRocks, allTargetVersions, allFixVersions, allTeams)

      expect(allBigRocks.has('Rock A')).toBe(true)
      expect(allBigRocks.has('Rock B')).toBe(true)
      expect(allBigRocks.has('Rock A, Rock B')).toBe(false)
      expect(allBigRocks.size).toBe(2)
    })

    it('adds single bigRock as one entry', function() {
      var allBigRocks = new Set()

      collectFilterMeta(
        { bigRock: 'Rock A', priority: null, components: [], targetVersions: [], fixVersion: '', team: '' },
        [], new Set(), allBigRocks, new Set(), new Set(), new Set()
      )

      expect(allBigRocks.has('Rock A')).toBe(true)
      expect(allBigRocks.size).toBe(1)
    })

    it('skips empty bigRock', function() {
      var allBigRocks = new Set()

      collectFilterMeta(
        { bigRock: '', priority: null, components: [], targetVersions: [], fixVersion: '', team: '' },
        [], new Set(), allBigRocks, new Set(), new Set(), new Set()
      )

      expect(allBigRocks.size).toBe(0)
    })
  })

})

// ---------------------------------------------------------------------------
// deriveHumanReviewStatusFromLabels
// ---------------------------------------------------------------------------

const { deriveHumanReviewStatusFromLabels } = require('../feature-readiness')

describe('deriveHumanReviewStatusFromLabels', function() {
  it('returns approved when sign-off label present', function() {
    expect(deriveHumanReviewStatusFromLabels(['strat-creator-human-sign-off'])).toBe('approved')
  })

  it('returns needs-review when needs-attention label present', function() {
    expect(deriveHumanReviewStatusFromLabels(['strat-creator-needs-attention'])).toBe('needs-review')
  })

  it('returns awaiting-review for other labels', function() {
    expect(deriveHumanReviewStatusFromLabels(['some-label'])).toBe('awaiting-review')
  })

  it('returns awaiting-review for null', function() {
    expect(deriveHumanReviewStatusFromLabels(null)).toBe('awaiting-review')
  })

  it('sign-off takes precedence over needs-attention', function() {
    expect(deriveHumanReviewStatusFromLabels(['strat-creator-needs-attention', 'strat-creator-human-sign-off'])).toBe('approved')
  })
})

// ---------------------------------------------------------------------------
// Pass 3: execution index features
// ---------------------------------------------------------------------------

describe('buildFeatureReadiness — pass 3 (execution index)', function() {
  function makeExecIndex(features) {
    return { features: features, fetchedAt: '2026-06-09T00:00:00Z', schemaVersion: 'v2', featureCount: features.length }
  }

  function makeExecFeature(key, overrides) {
    return Object.assign({
      key: key,
      summary: 'Exec Feature ' + key,
      status: 'In Progress',
      priority: 'Major',
      assignee: 'Jane Doe',
      components: ['UI'],
      labels: [],
      targetVersions: ['rhoai-3.6'],
      fixVersions: [],
      team: 'Platform'
    }, overrides)
  }

  it('includes execution index features not in caches or ai-impact', function() {
    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(makeFeaturesStore({})),
      'releases/planning/config.json': CONFIG_3_6,
      'releases/execution/index.json': makeExecIndex([
        makeExecFeature('RHAISTRAT-999')
      ])
    })

    var result = buildFeatureReadiness(readFromStorage)
    expect(result.meta.total).toBe(1)
    expect(result.pendingReview[0].key).toBe('RHAISTRAT-999')
    expect(result.pendingReview[0].dataSource).toBe('execution')
    expect(result.pendingReview[0].title).toBe('Exec Feature RHAISTRAT-999')
    expect(result.pendingReview[0].deliveryOwner).toBe('Jane Doe')
    expect(result.pendingReview[0].team).toBe('Platform')
  })

  it('execution feature with sign-off but no rubric goes to pendingReview', function() {
    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(makeFeaturesStore({})),
      'releases/planning/config.json': CONFIG_3_6,
      'releases/execution/index.json': makeExecIndex([
        makeExecFeature('RHAISTRAT-888', {
          labels: ['strat-creator-human-sign-off'],
          assignee: 'John',
          status: 'In Progress',
          targetVersions: ['rhoai-3.6']
        })
      ])
    })

    var result = buildFeatureReadiness(readFromStorage)
    expect(result.pendingReview.length).toBe(1)
    expect(result.pendingReview[0].confidence).toBe('not-ready')
    expect(result.pendingReview[0].humanReviewStatus).toBe('approved')
    expect(typeof result.pendingReview[0].readinessGates.fpDorPassed).toBe('number')
    expect(typeof result.pendingReview[0].readinessGates.fpDorEvaluated).toBe('number')
  })

  it('execution feature in Refinement status is not ready', function() {
    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(makeFeaturesStore({})),
      'releases/planning/config.json': CONFIG_3_6,
      'releases/execution/index.json': makeExecIndex([
        makeExecFeature('RHAISTRAT-777', {
          labels: ['strat-creator-human-sign-off'],
          status: 'Refinement'
        })
      ])
    })

    var result = buildFeatureReadiness(readFromStorage)
    expect(result.pendingReview.length).toBe(1)
    expect(result.pendingReview[0].readinessGates.pastRefinement).toBe(false)
  })

  it('skips closed features from execution index', function() {
    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(makeFeaturesStore({})),
      'releases/planning/config.json': CONFIG_3_6,
      'releases/execution/index.json': makeExecIndex([
        makeExecFeature('RHAISTRAT-666', { status: 'Closed' }),
        makeExecFeature('RHAISTRAT-667', { status: 'Resolved' }),
        makeExecFeature('RHAISTRAT-668', { status: 'In Progress' })
      ])
    })

    var result = buildFeatureReadiness(readFromStorage)
    expect(result.meta.total).toBe(1)
    expect(result.pendingReview[0].key).toBe('RHAISTRAT-668')
  })

  it('does not duplicate features already in strat-creator pass', function() {
    var store = makeFeaturesStore({
      'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
    })
    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(store),
      'releases/planning/config.json': CONFIG_3_6,
      'releases/execution/index.json': makeExecIndex([
        makeExecFeature('RHAISTRAT-1')
      ])
    })

    var result = buildFeatureReadiness(readFromStorage)
    var keys = result.pendingReview.concat(result.ready).map(function(f) { return f.key })
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('does not duplicate features already in health-pipeline pass', function() {
    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(makeFeaturesStore({})),
      'releases/planning/config.json': CONFIG_3_6,
      'releases/planning/health-cache-3.6-all.json': {
        features: [{ key: 'RHAISTRAT-50', summary: 'Health Feature', status: 'In Progress', priority: 'Major' }]
      },
      'releases/execution/index.json': makeExecIndex([
        makeExecFeature('RHAISTRAT-50')
      ])
    })

    var result = buildFeatureReadiness(readFromStorage)
    var keys = result.pendingReview.concat(result.ready).map(function(f) { return f.key })
    expect(new Set(keys).size).toBe(keys.length)
    var feature = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-50' })
    expect(feature.dataSource).toBe('health-pipeline')
  })

  it('populates filter metadata from execution features', function() {
    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(makeFeaturesStore({})),
      'releases/planning/config.json': CONFIG_3_6,
      'releases/execution/index.json': makeExecIndex([
        makeExecFeature('RHAISTRAT-444', {
          components: ['NewComp'],
          team: 'NewTeam',
          priority: 'Blocker',
          targetVersions: ['rhoai-4.0']
        })
      ])
    })

    var result = buildFeatureReadiness(readFromStorage)
    expect(result.filterMeta.components).toContain('NewComp')
    expect(result.filterMeta.teams).toContain('NewTeam')
    expect(result.filterMeta.priorities).toContain('Blocker')
    expect(result.filterMeta.targetVersions).toContain('rhoai-4.0')
  })

  it('execution feature with fix version still goes to pendingReview (no rubric)', function() {
    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(makeFeaturesStore({})),
      'releases/planning/config.json': CONFIG_3_6,
      'releases/execution/index.json': makeExecIndex([
        makeExecFeature('RHAISTRAT-333', {
          labels: ['strat-creator-human-sign-off'],
          fixVersions: ['rhoai-3.6'],
          assignee: 'Alice',
          status: 'In Progress',
          targetVersions: ['rhoai-3.6']
        })
      ])
    })

    var result = buildFeatureReadiness(readFromStorage)
    expect(result.pendingReview[0].confidence).toBe('not-ready')
    expect(result.pendingReview[0].fixVersion).toBe('rhoai-3.6')
  })

  it('handles string components from execution index', function() {
    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(makeFeaturesStore({})),
      'releases/planning/config.json': CONFIG_3_6,
      'releases/execution/index.json': makeExecIndex([
        makeExecFeature('RHAISTRAT-222', { components: 'UI, API, Docs' })
      ])
    })

    var result = buildFeatureReadiness(readFromStorage)
    expect(result.pendingReview[0].components).toEqual(['UI', 'API', 'Docs'])
  })

  it('handles multiple execution features sorted by priority score', function() {
    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(makeFeaturesStore({})),
      'releases/planning/config.json': CONFIG_3_6,
      'releases/execution/index.json': makeExecIndex([
        makeExecFeature('RHAISTRAT-A', { priority: 'Minor' }),
        makeExecFeature('RHAISTRAT-B', { priority: 'Blocker' }),
        makeExecFeature('RHAISTRAT-C', { priority: 'Major' })
      ])
    })

    var result = buildFeatureReadiness(readFromStorage)
    expect(result.pendingReview.length).toBe(3)
    expect(result.pendingReview[0].key).toBe('RHAISTRAT-B')
    expect(result.pendingReview[result.pendingReview.length - 1].key).toBe('RHAISTRAT-A')
  })

  it('handles empty execution index gracefully', function() {
    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(makeFeaturesStore({})),
      'releases/planning/config.json': CONFIG_3_6,
      'releases/execution/index.json': makeExecIndex([])
    })

    var result = buildFeatureReadiness(readFromStorage)
    expect(result.meta.total).toBe(0)
  })

  it('handles missing execution index gracefully', function() {
    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(makeFeaturesStore({})),
      'releases/planning/config.json': CONFIG_3_6
    })

    var result = buildFeatureReadiness(readFromStorage)
    expect(result.meta.total).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Pass 3: Jira features as primary source
// ---------------------------------------------------------------------------

describe('buildFeatureReadiness — pass 3 (jiraFeatures)', function() {
  function makeExecIndex(features) {
    return { features: features, fetchedAt: '2026-06-09T00:00:00Z', schemaVersion: 'v2', featureCount: features.length }
  }

  function makeExecFeature(key, overrides) {
    return Object.assign({
      key: key,
      summary: 'Exec Feature ' + key,
      status: 'In Progress',
      priority: 'Major',
      assignee: 'Jane Doe',
      components: ['UI'],
      labels: [],
      targetVersions: ['rhoai-3.6'],
      fixVersions: [],
      team: 'Platform'
    }, overrides)
  }

  function makeJiraMap(features) {
    var map = new Map()
    for (var i = 0; i < features.length; i++) {
      map.set(features[i].key, features[i])
    }
    return map
  }

  function makeJiraFeature(key, overrides) {
    return Object.assign({
      key: key,
      summary: 'Jira Feature ' + key,
      status: 'In Progress',
      issueType: 'Feature',
      assignee: 'Alice',
      team: 'Platform',
      components: ['Dashboard'],
      labels: [],
      fixVersions: [],
      targetVersions: ['rhoai-3.6'],
      priority: 'Major',
      riceScore: null
    }, overrides)
  }

  it('uses jiraFeatures as pass 3 source when provided', function() {
    var jiraFeatures = makeJiraMap([
      makeJiraFeature('RHAISTRAT-900')
    ])
    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(makeFeaturesStore({})),
      'releases/planning/config.json': CONFIG_3_6,
      'releases/execution/index.json': makeExecIndex([])
    })

    var result = buildFeatureReadiness(readFromStorage, jiraFeatures)
    expect(result.meta.total).toBe(1)
    expect(result.pendingReview[0].key).toBe('RHAISTRAT-900')
    expect(result.pendingReview[0].dataSource).toBe('jira')
    expect(result.pendingReview[0].title).toBe('Jira Feature RHAISTRAT-900')
  })

  it('falls back to execution index when jiraFeatures is null', function() {
    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(makeFeaturesStore({})),
      'releases/planning/config.json': CONFIG_3_6,
      'releases/execution/index.json': makeExecIndex([
        makeExecFeature('RHAISTRAT-800')
      ])
    })

    var result = buildFeatureReadiness(readFromStorage, null)
    expect(result.meta.total).toBe(1)
    expect(result.pendingReview[0].key).toBe('RHAISTRAT-800')
    expect(result.pendingReview[0].dataSource).toBe('execution')
  })

  it('falls back to execution index when jiraFeatures is empty Map', function() {
    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(makeFeaturesStore({})),
      'releases/planning/config.json': CONFIG_3_6,
      'releases/execution/index.json': makeExecIndex([
        makeExecFeature('RHAISTRAT-700')
      ])
    })

    var result = buildFeatureReadiness(readFromStorage, new Map())
    expect(result.meta.total).toBe(1)
    expect(result.pendingReview[0].key).toBe('RHAISTRAT-700')
    expect(result.pendingReview[0].dataSource).toBe('execution')
  })

  it('does not duplicate features already in strat-creator pass', function() {
    var store = makeFeaturesStore({
      'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
    })
    var jiraFeatures = makeJiraMap([
      makeJiraFeature('RHAISTRAT-1')
    ])
    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(store),
      'releases/planning/config.json': CONFIG_3_6,
      'releases/execution/index.json': makeExecIndex([])
    })

    var result = buildFeatureReadiness(readFromStorage, jiraFeatures)
    var keys = result.pendingReview.concat(result.ready).map(function(f) { return f.key })
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('does not duplicate features already in health-pipeline pass', function() {
    var jiraFeatures = makeJiraMap([
      makeJiraFeature('RHAISTRAT-50')
    ])
    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(makeFeaturesStore({})),
      'releases/planning/config.json': CONFIG_3_6,
      'releases/planning/health-cache-3.6-all.json': {
        features: [{ key: 'RHAISTRAT-50', summary: 'Health Feature', status: 'In Progress', priority: 'Major' }]
      },
      'releases/execution/index.json': makeExecIndex([])
    })

    var result = buildFeatureReadiness(readFromStorage, jiraFeatures)
    var keys = result.pendingReview.concat(result.ready).map(function(f) { return f.key })
    expect(new Set(keys).size).toBe(keys.length)
    var feature = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-50' })
    expect(feature.dataSource).toBe('health-pipeline')
  })

  it('enriches Jira features with execution index data when available', function() {
    var jiraFeatures = makeJiraMap([
      makeJiraFeature('RHAISTRAT-600', { riceScore: null })
    ])
    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(makeFeaturesStore({})),
      'releases/planning/config.json': CONFIG_3_6,
      'releases/execution/index.json': makeExecIndex([
        makeExecFeature('RHAISTRAT-600', { riceScore: 250, blockerCount: 3 })
      ])
    })

    var result = buildFeatureReadiness(readFromStorage, jiraFeatures)
    expect(result.meta.total).toBe(1)
    var feature = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-600' })
    expect(feature.dataSource).toBe('jira')
    expect(feature.riceScore).toBe(250)
    expect(typeof feature.readinessGates.fpDorPassed).toBe('number')
  })

  it('Jira feature with sign-off but no rubric goes to pendingReview', function() {
    var jiraFeatures = makeJiraMap([
      makeJiraFeature('RHAISTRAT-500', {
        labels: ['strat-creator-human-sign-off'],
        assignee: 'Alice',
        team: 'MyTeam',
        status: 'In Progress',
        targetVersions: ['rhoai-3.6'],
        fixVersions: ['rhoai-3.6'],
        colorStatus: 'Green',
        releaseType: 'GA',
        docsRequired: 'Yes',
        targetEnd: '2026-09-15'
      })
    ])
    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(makeFeaturesStore({})),
      'releases/planning/config.json': CONFIG_3_6,
      'releases/execution/index.json': makeExecIndex([])
    })

    var result = buildFeatureReadiness(readFromStorage, jiraFeatures)
    expect(result.pendingReview.length).toBe(1)
    expect(result.pendingReview[0].confidence).toBe('not-ready')
    expect(result.pendingReview[0].humanReviewStatus).toBe('approved')
    expect(typeof result.pendingReview[0].readinessGates.fpDorPassed).toBe('number')
    expect(typeof result.pendingReview[0].readinessGates.fpDorEvaluated).toBe('number')
  })

  it('Jira feature with fix version still goes to pendingReview (no rubric)', function() {
    var jiraFeatures = makeJiraMap([
      makeJiraFeature('RHAISTRAT-400', {
        labels: ['strat-creator-human-sign-off'],
        fixVersions: ['rhoai-3.6'],
        assignee: 'Alice',
        status: 'In Progress',
        targetVersions: ['rhoai-3.6']
      })
    ])
    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(makeFeaturesStore({})),
      'releases/planning/config.json': CONFIG_3_6,
      'releases/execution/index.json': makeExecIndex([])
    })

    var result = buildFeatureReadiness(readFromStorage, jiraFeatures)
    expect(result.pendingReview[0].confidence).toBe('not-ready')
    expect(result.pendingReview[0].fixVersion).toBe('rhoai-3.6')
  })

  it('skips closed Jira features', function() {
    var jiraFeatures = makeJiraMap([
      makeJiraFeature('RHAISTRAT-C1', { status: 'Closed' }),
      makeJiraFeature('RHAISTRAT-C2', { status: 'Resolved' }),
      makeJiraFeature('RHAISTRAT-C3', { status: 'In Progress' })
    ])
    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(makeFeaturesStore({})),
      'releases/planning/config.json': CONFIG_3_6,
      'releases/execution/index.json': makeExecIndex([])
    })

    var result = buildFeatureReadiness(readFromStorage, jiraFeatures)
    expect(result.meta.total).toBe(1)
    expect(result.pendingReview[0].key).toBe('RHAISTRAT-C3')
  })

  it('Jira feature in Refinement status is not ready', function() {
    var jiraFeatures = makeJiraMap([
      makeJiraFeature('RHAISTRAT-REF', {
        labels: ['strat-creator-human-sign-off'],
        status: 'Refinement'
      })
    ])
    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(makeFeaturesStore({})),
      'releases/planning/config.json': CONFIG_3_6,
      'releases/execution/index.json': makeExecIndex([])
    })

    var result = buildFeatureReadiness(readFromStorage, jiraFeatures)
    expect(result.pendingReview.length).toBe(1)
    expect(result.pendingReview[0].readinessGates.pastRefinement).toBe(false)
  })

  it('populates filter metadata from Jira features', function() {
    var jiraFeatures = makeJiraMap([
      makeJiraFeature('RHAISTRAT-META', {
        components: ['NewJiraComp'],
        team: 'JiraTeam',
        priority: 'Critical',
        targetVersions: ['rhoai-4.0']
      })
    ])
    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(makeFeaturesStore({})),
      'releases/planning/config.json': CONFIG_3_6,
      'releases/execution/index.json': makeExecIndex([])
    })

    var result = buildFeatureReadiness(readFromStorage, jiraFeatures)
    expect(result.filterMeta.components).toContain('NewJiraComp')
    expect(result.filterMeta.teams).toContain('JiraTeam')
    expect(result.filterMeta.priorities).toContain('Critical')
    expect(result.filterMeta.targetVersions).toContain('rhoai-4.0')
  })

  it('prefers Jira riceScore over execution index riceScore', function() {
    var jiraFeatures = makeJiraMap([
      makeJiraFeature('RHAISTRAT-RICE', { riceScore: 100 })
    ])
    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(makeFeaturesStore({})),
      'releases/planning/config.json': CONFIG_3_6,
      'releases/execution/index.json': makeExecIndex([
        makeExecFeature('RHAISTRAT-RICE', { riceScore: 50 })
      ])
    })

    var result = buildFeatureReadiness(readFromStorage, jiraFeatures)
    var feature = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-RICE' })
    expect(feature.riceScore).toBe(100)
  })

  it('uses execution index riceScore when Jira riceScore is null', function() {
    var jiraFeatures = makeJiraMap([
      makeJiraFeature('RHAISTRAT-RICE2', { riceScore: null })
    ])
    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(makeFeaturesStore({})),
      'releases/planning/config.json': CONFIG_3_6,
      'releases/execution/index.json': makeExecIndex([
        makeExecFeature('RHAISTRAT-RICE2', { riceScore: 75 })
      ])
    })

    var result = buildFeatureReadiness(readFromStorage, jiraFeatures)
    var feature = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-RICE2' })
    expect(feature.riceScore).toBe(75)
  })

  it('includes Jira features not present in execution index', function() {
    var jiraFeatures = makeJiraMap([
      makeJiraFeature('RHAISTRAT-JONLY', { summary: 'Jira only feature' })
    ])
    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(makeFeaturesStore({})),
      'releases/planning/config.json': CONFIG_3_6,
      'releases/execution/index.json': makeExecIndex([])
    })

    var result = buildFeatureReadiness(readFromStorage, jiraFeatures)
    expect(result.meta.total).toBe(1)
    expect(result.pendingReview[0].title).toBe('Jira only feature')
  })

  it('handles multiple Jira features sorted by priority score', function() {
    var jiraFeatures = makeJiraMap([
      makeJiraFeature('RHAISTRAT-J1', { priority: 'Minor' }),
      makeJiraFeature('RHAISTRAT-J2', { priority: 'Blocker' }),
      makeJiraFeature('RHAISTRAT-J3', { priority: 'Major' })
    ])
    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(makeFeaturesStore({})),
      'releases/planning/config.json': CONFIG_3_6,
      'releases/execution/index.json': makeExecIndex([])
    })

    var result = buildFeatureReadiness(readFromStorage, jiraFeatures)
    expect(result.pendingReview.length).toBe(3)
    expect(result.pendingReview[0].key).toBe('RHAISTRAT-J2')
    expect(result.pendingReview[result.pendingReview.length - 1].key).toBe('RHAISTRAT-J1')
  })

  it('Jira feature without assignee fails FPDoR owners check', function() {
    var jiraFeatures = makeJiraMap([
      makeJiraFeature('RHAISTRAT-NOOWN', {
        assignee: null,
        labels: ['strat-creator-human-sign-off']
      })
    ])
    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(makeFeaturesStore({})),
      'releases/planning/config.json': CONFIG_3_6,
      'releases/execution/index.json': makeExecIndex([])
    })

    var result = buildFeatureReadiness(readFromStorage, jiraFeatures)
    expect(result.pendingReview.length).toBe(1)
    expect(result.pendingReview[0].readinessGates.fpDorPassed).toBeLessThan(result.pendingReview[0].readinessGates.fpDorEvaluated)
  })

  it('Jira feature without target version fails FPDoR target version check', function() {
    var jiraFeatures = makeJiraMap([
      makeJiraFeature('RHAISTRAT-NOTV', {
        targetVersions: [],
        labels: ['strat-creator-human-sign-off']
      })
    ])
    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(makeFeaturesStore({})),
      'releases/planning/config.json': CONFIG_3_6,
      'releases/execution/index.json': makeExecIndex([])
    })

    var result = buildFeatureReadiness(readFromStorage, jiraFeatures)
    expect(result.pendingReview.length).toBe(1)
    expect(result.pendingReview[0].readinessGates.fpDorPassed).toBeLessThan(result.pendingReview[0].readinessGates.fpDorEvaluated)
  })
})

// ---------------------------------------------------------------------------
// All-hygiene-files loading via listStorageFiles
// ---------------------------------------------------------------------------

describe('buildFeatureReadiness - all-hygiene-files loading', function() {
  function makeExecIndex(features) {
    return { features: features, fetchedAt: '2026-06-09T00:00:00Z', schemaVersion: 'v2', featureCount: features.length }
  }

  function makeExecFeature(key, overrides) {
    return Object.assign({
      key: key,
      summary: 'Exec Feature ' + key,
      status: 'In Progress',
      priority: 'Major',
      assignee: 'Jane Doe',
      components: ['UI'],
      labels: [],
      targetVersions: ['rhoai-3.6'],
      fixVersions: [],
      team: 'Platform'
    }, overrides)
  }

  function makeJiraMap(features) {
    var map = new Map()
    for (var i = 0; i < features.length; i++) {
      map.set(features[i].key, features[i])
    }
    return map
  }

  function makeJiraFeature(key, overrides) {
    return Object.assign({
      key: key,
      summary: 'Jira Feature ' + key,
      status: 'In Progress',
      issueType: 'Feature',
      assignee: 'Alice',
      team: 'Platform',
      components: ['Dashboard'],
      labels: [],
      fixVersions: [],
      targetVersions: ['rhoai-3.6'],
      priority: 'Major',
      riceScore: null
    }, overrides)
  }

  it('loads team and violations from non-configured hygiene files via listStorageFiles', function() {
    var jiraFeatures = makeJiraMap([
      makeJiraFeature('RHAISTRAT-500', { team: null })
    ])

    var readFromStorage = makeReadFromStorage({
      'ai-impact/features.json': makeFeaturesStore({}),
      'releases/planning/config.json': { releases: { '3.6': { release: '3.6' } } },
      'releases/execution/index.json': makeExecIndex([]),
      'releases/hygiene/features-rhoai-3.7.json': {
        features: {
          'RHAISTRAT-500': {
            team: 'Llama Stack Core',
            violations: [{ id: 'missing-fix-version', name: 'Missing Fix Version' }]
          }
        }
      }
    })

    var listStorageFiles = function(dir) {
      if (dir === 'releases/hygiene') return ['features-rhoai-3.7.json']
      return []
    }

    var result = buildFeatureReadiness(readFromStorage, jiraFeatures, listStorageFiles)
    var feature = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-500' })
    expect(feature).toBeDefined()
    expect(feature.team).toBe('Llama Stack Core')
    expect(feature.violations).toEqual([{ id: 'missing-fix-version', name: 'Missing Fix Version' }])
  })

  it('does not overwrite team from configured version with non-configured version data', function() {
    var readFromStorage = makeReadFromStorage({
      'ai-impact/features.json': makeFeaturesStore({}),
      'releases/planning/config.json': { releases: { '3.6': { release: '3.6' } } },
      'releases/execution/index.json': makeExecIndex([
        makeExecFeature('RHAISTRAT-600', { team: null })
      ]),
      'releases/hygiene/features-3.6.json': {
        features: {
          'RHAISTRAT-600': { team: 'RHOAI Dashboard', violations: [] }
        }
      },
      'releases/hygiene/features-rhoai-3.7.json': {
        features: {
          'RHAISTRAT-600': { team: 'Llama Stack Core', violations: [{ id: 'test' }] }
        }
      }
    })

    var listStorageFiles = function(dir) {
      if (dir === 'releases/hygiene') return ['features-3.6.json', 'features-rhoai-3.7.json']
      return []
    }

    var result = buildFeatureReadiness(readFromStorage, null, listStorageFiles)
    var feature = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-600' })
    expect(feature).toBeDefined()
    expect(feature.team).toBe('RHOAI Dashboard')
  })

  it('works without listStorageFiles (backward compatible)', function() {
    var readFromStorage = makeReadFromStorage({
      'ai-impact/features.json': makeFeaturesStore({}),
      'releases/planning/config.json': { releases: { '3.6': { release: '3.6' } } },
      'releases/execution/index.json': makeExecIndex([
        makeExecFeature('RHAISTRAT-700')
      ])
    })

    var result = buildFeatureReadiness(readFromStorage, null)
    expect(result.pendingReview.concat(result.ready).length).toBeGreaterThan(0)
  })

  it('handles listStorageFiles throwing an error gracefully', function() {
    var readFromStorage = makeReadFromStorage({
      'ai-impact/features.json': makeFeaturesStore({}),
      'releases/planning/config.json': { releases: { '3.6': { release: '3.6' } } },
      'releases/execution/index.json': makeExecIndex([
        makeExecFeature('RHAISTRAT-800')
      ])
    })

    var listStorageFiles = function() {
      throw new Error('directory not found')
    }

    var result = buildFeatureReadiness(readFromStorage, null, listStorageFiles)
    expect(result.pendingReview.concat(result.ready).length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Jira data fallback for passes 1 and 2
// ---------------------------------------------------------------------------

describe('buildFeatureReadiness - Jira data fallback enrichment', function() {
  function makeJiraMap(features) {
    var map = new Map()
    for (var i = 0; i < features.length; i++) {
      map.set(features[i].key, features[i])
    }
    return map
  }

  function makeJiraFeature(key, overrides) {
    return Object.assign({
      key: key,
      summary: 'Jira Feature ' + key,
      status: 'In Progress',
      issueType: 'Feature',
      assignee: 'JiraAssignee',
      team: 'JiraTeam',
      components: ['JiraComp'],
      labels: [],
      fixVersions: [],
      targetVersions: ['rhoai-3.6'],
      priority: 'Major',
      riceScore: null
    }, overrides)
  }

  it('pass 1: uses Jira team when teamIndex has no entry', function() {
    var jiraFeatures = makeJiraMap([
      makeJiraFeature('RHAISTRAT-1', { team: 'JiraTeamFallback' })
    ])

    var readFromStorage = makeReadFromStorage({
      'ai-impact/features.json': makeFeaturesStore({
        'RHAISTRAT-1': {
          latest: makeLatest({ key: 'RHAISTRAT-1', humanReviewStatus: 'approved' })
        }
      }),
      'releases/planning/config.json': { releases: { '3.6': { release: '3.6' } } },
      'releases/planning/candidates-cache-3.6.json': {
        data: { features: [{ issueKey: 'RHAISTRAT-1', tier: 1, bigRock: 'Rock' }] }
      },
      'releases/execution/index.json': { features: [], fetchedAt: '2026-06-09T00:00:00Z', schemaVersion: 'v2', featureCount: 0 }
    })

    var result = buildFeatureReadiness(readFromStorage, jiraFeatures)
    var feature = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-1' })
    expect(feature).toBeDefined()
    expect(feature.team).toBe('JiraTeamFallback')
  })

  it('pass 1: uses Jira components when strat-creator and health-cache are empty', function() {
    var jiraFeatures = makeJiraMap([
      makeJiraFeature('RHAISTRAT-1', { components: ['CompFromJira'] })
    ])

    var readFromStorage = makeReadFromStorage({
      'ai-impact/features.json': makeFeaturesStore({
        'RHAISTRAT-1': {
          latest: makeLatest({ key: 'RHAISTRAT-1', components: [] })
        }
      }),
      'releases/planning/config.json': { releases: { '3.6': { release: '3.6' } } },
      'releases/planning/candidates-cache-3.6.json': {
        data: { features: [{ issueKey: 'RHAISTRAT-1', tier: 1, bigRock: 'Rock' }] }
      },
      'releases/execution/index.json': { features: [], fetchedAt: '2026-06-09T00:00:00Z', schemaVersion: 'v2', featureCount: 0 }
    })

    var result = buildFeatureReadiness(readFromStorage, jiraFeatures)
    var feature = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-1' })
    expect(feature).toBeDefined()
    expect(feature.components).toEqual(['CompFromJira'])
  })

  it('pass 1: uses Jira assignee as deliveryOwner when healthData has none', function() {
    var jiraFeatures = makeJiraMap([
      makeJiraFeature('RHAISTRAT-1', { assignee: 'JiraOwner' })
    ])

    var readFromStorage = makeReadFromStorage({
      'ai-impact/features.json': makeFeaturesStore({
        'RHAISTRAT-1': {
          latest: makeLatest({ key: 'RHAISTRAT-1' })
        }
      }),
      'releases/planning/config.json': { releases: { '3.6': { release: '3.6' } } },
      'releases/planning/candidates-cache-3.6.json': {
        data: { features: [{ issueKey: 'RHAISTRAT-1', tier: 1, bigRock: 'Rock' }] }
      },
      'releases/execution/index.json': { features: [], fetchedAt: '2026-06-09T00:00:00Z', schemaVersion: 'v2', featureCount: 0 }
    })

    var result = buildFeatureReadiness(readFromStorage, jiraFeatures)
    var feature = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-1' })
    expect(feature).toBeDefined()
    expect(feature.deliveryOwner).toBe('JiraOwner')
  })

  it('pass 2: uses Jira team when teamIndex has no entry', function() {
    var jiraFeatures = makeJiraMap([
      makeJiraFeature('RHAISTRAT-HP1', { team: 'JiraTeamHP' })
    ])

    var readFromStorage = makeReadFromStorage({
      'ai-impact/features.json': makeFeaturesStore({}),
      'releases/planning/config.json': { releases: { '3.6': { release: '3.6' } } },
      'releases/planning/health-cache-3.6-all.json': {
        features: [{
          key: 'RHAISTRAT-HP1',
          summary: 'Health Feature',
          status: 'In Progress',
          priority: 'Major',
          components: '',
          assignee: 'Owner'
        }]
      },
      'releases/execution/index.json': { features: [], fetchedAt: '2026-06-09T00:00:00Z', schemaVersion: 'v2', featureCount: 0 }
    })

    var result = buildFeatureReadiness(readFromStorage, jiraFeatures)
    var feature = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-HP1' })
    expect(feature).toBeDefined()
    expect(feature.team).toBe('JiraTeamHP')
  })

  it('pass 2: uses Jira components when health-cache components are empty', function() {
    var jiraFeatures = makeJiraMap([
      makeJiraFeature('RHAISTRAT-HP2', { components: ['JiraCompHP'] })
    ])

    var readFromStorage = makeReadFromStorage({
      'ai-impact/features.json': makeFeaturesStore({}),
      'releases/planning/config.json': { releases: { '3.6': { release: '3.6' } } },
      'releases/planning/health-cache-3.6-all.json': {
        features: [{
          key: 'RHAISTRAT-HP2',
          summary: 'Health Feature',
          status: 'In Progress',
          priority: 'Major',
          components: '',
          assignee: 'Owner'
        }]
      },
      'releases/execution/index.json': { features: [], fetchedAt: '2026-06-09T00:00:00Z', schemaVersion: 'v2', featureCount: 0 }
    })

    var result = buildFeatureReadiness(readFromStorage, jiraFeatures)
    var feature = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-HP2' })
    expect(feature).toBeDefined()
    expect(feature.components).toEqual(['JiraCompHP'])
  })
})

// ---------------------------------------------------------------------------
// Hygiene violations from cache (hygieneIndex)
// ---------------------------------------------------------------------------

describe('buildFeatureReadiness - hygiene violations from cache', function() {
  function makeExecIndex(features) {
    return { features: features, fetchedAt: '2026-06-09T00:00:00Z', schemaVersion: 'v2', featureCount: features.length }
  }

  function makeJiraMap(features) {
    var map = new Map()
    for (var i = 0; i < features.length; i++) {
      map.set(features[i].key, features[i])
    }
    return map
  }

  function makeJiraFeature(key, overrides) {
    return Object.assign({
      key: key,
      summary: 'Jira Feature ' + key,
      status: 'In Progress',
      issueType: 'Feature',
      assignee: null,
      team: null,
      components: [],
      labels: [],
      fixVersions: [],
      targetVersions: ['rhoai-3.6'],
      priority: 'Major',
      riceScore: null,
      statusSummary: null,
      colorStatus: null,
      releaseType: null,
      docsRequired: null,
      targetEnd: null
    }, overrides)
  }

  it('attaches cached violations from hygieneIndex', function() {
    var jiraFeatures = makeJiraMap([
      makeJiraFeature('RHAISTRAT-DYN2', {
        status: 'In Progress',
        assignee: null
      })
    ])

    var readFromStorage = makeReadFromStorage({
      'ai-impact/features.json': makeFeaturesStore({}),
      'releases/planning/config.json': { releases: { '3.6': { release: '3.6' } } },
      'releases/execution/index.json': makeExecIndex([]),
      'releases/hygiene/features-3.6.json': {
        features: {
          'RHAISTRAT-DYN2': {
            team: 'CachedTeam',
            violations: [{ id: 'cached-violation', name: 'Cached Violation' }]
          }
        }
      }
    })

    var result = buildFeatureReadiness(readFromStorage, jiraFeatures)
    var feature = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-DYN2' })
    expect(feature).toBeDefined()
    expect(feature.violations).toEqual([{ id: 'cached-violation', name: 'Cached Violation' }])
  })

  it('returns null violations for features not in hygieneIndex', function() {
    var jiraFeatures = makeJiraMap([
      makeJiraFeature('RHAISTRAT-DYN1', {
        status: 'In Progress',
        assignee: null,
        team: null
      })
    ])

    var readFromStorage = makeReadFromStorage({
      'ai-impact/features.json': makeFeaturesStore({}),
      'releases/planning/config.json': { releases: { '3.6': { release: '3.6' } } },
      'releases/execution/index.json': makeExecIndex([])
    })

    var result = buildFeatureReadiness(readFromStorage, jiraFeatures)
    var feature = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-DYN1' })
    expect(feature).toBeDefined()
    expect(feature.violations).toBeNull()
  })

  it('returns null violations for execution index features', function() {
    var readFromStorage = makeReadFromStorage({
      'ai-impact/features.json': makeFeaturesStore({}),
      'releases/planning/config.json': { releases: { '3.6': { release: '3.6' } } },
      'releases/execution/index.json': makeExecIndex([{
        key: 'RHAISTRAT-DYN3',
        summary: 'Exec Feature',
        status: 'In Progress',
        priority: 'Major',
        assignee: null,
        components: [],
        labels: [],
        targetVersions: ['rhoai-3.6'],
        fixVersions: [],
        team: null
      }])
    })

    var result = buildFeatureReadiness(readFromStorage, null)
    var feature = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-DYN3' })
    expect(feature).toBeDefined()
    expect(feature.violations).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// computeHygieneStatus
// ---------------------------------------------------------------------------
describe('computeHygieneStatus', function() {
  it('returns unknown for null violations', function() {
    expect(computeHygieneStatus(null)).toBe('unknown')
  })

  it('returns unknown for undefined violations', function() {
    expect(computeHygieneStatus(undefined)).toBe('unknown')
  })

  it('returns unknown for non-array violations', function() {
    expect(computeHygieneStatus('not-an-array')).toBe('unknown')
  })

  it('returns clean for empty violations array', function() {
    expect(computeHygieneStatus([])).toBe('clean')
  })

  it('returns warning for non-blocking violations only', function() {
    expect(computeHygieneStatus([{ id: 'some-minor-issue' }])).toBe('warning')
  })

  it('returns blocking when a blocking violation is present', function() {
    expect(computeHygieneStatus([{ id: 'missing-assignee' }])).toBe('blocking')
    expect(computeHygieneStatus([{ id: 'open-children-on-closed' }])).toBe('blocking')
  })

  it('returns warning for missing-fix-version (no longer blocking)', function() {
    expect(computeHygieneStatus([{ id: 'missing-fix-version' }])).toBe('warning')
  })

  it('returns warning for missing-target-version (no longer blocking)', function() {
    expect(computeHygieneStatus([{ id: 'missing-target-version' }])).toBe('warning')
  })

  it('returns blocking when mix of blocking and non-blocking', function() {
    expect(computeHygieneStatus([
      { id: 'some-minor-issue' },
      { id: 'missing-assignee' }
    ])).toBe('blocking')
  })
})

// ---------------------------------------------------------------------------
// buildCanonicalKeySet
// ---------------------------------------------------------------------------
describe('buildCanonicalKeySet', function() {
  it('builds union of keys from all sources', function() {
    var jiraFeatures = new Map([['RHAISTRAT-1', {}], ['RHAISTRAT-2', {}]])
    var aiReviewMap = { 'RHAISTRAT-2': {}, 'RHAISTRAT-3': {} }
    var execFeatures = [{ key: 'RHAISTRAT-3' }, { key: 'RHAISTRAT-4' }]
    var healthIndex = new Map([['RHAISTRAT-4', {}], ['RHAISTRAT-5', {}]])

    var keys = buildCanonicalKeySet(jiraFeatures, aiReviewMap, execFeatures, healthIndex)
    expect(keys.size).toBe(5)
    expect(keys.has('RHAISTRAT-1')).toBe(true)
    expect(keys.has('RHAISTRAT-2')).toBe(true)
    expect(keys.has('RHAISTRAT-3')).toBe(true)
    expect(keys.has('RHAISTRAT-4')).toBe(true)
    expect(keys.has('RHAISTRAT-5')).toBe(true)
  })

  it('handles null jiraFeatures', function() {
    var aiReviewMap = { 'RHAISTRAT-1': {} }
    var execFeatures = [{ key: 'RHAISTRAT-2' }]
    var healthIndex = new Map()

    var keys = buildCanonicalKeySet(null, aiReviewMap, execFeatures, healthIndex)
    expect(keys.size).toBe(2)
  })

  it('handles all empty sources', function() {
    var keys = buildCanonicalKeySet(null, {}, [], new Map())
    expect(keys.size).toBe(0)
  })

  it('deduplicates keys across sources', function() {
    var jiraFeatures = new Map([['RHAISTRAT-1', {}]])
    var aiReviewMap = { 'RHAISTRAT-1': {} }
    var execFeatures = [{ key: 'RHAISTRAT-1' }]
    var healthIndex = new Map([['RHAISTRAT-1', {}]])

    var keys = buildCanonicalKeySet(jiraFeatures, aiReviewMap, execFeatures, healthIndex)
    expect(keys.size).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// mergeFeatureData
// ---------------------------------------------------------------------------
describe('mergeFeatureData', function() {
  it('prefers Jira data for status, priority, targetVersions', function() {
    var jiraFeatures = new Map([['K-1', { summary: 'Jira Title', status: 'In Progress', priority: 'Blocker', targetVersions: ['3.6'], fixVersions: ['3.6'], labels: [], components: [] }]])
    var aiReviewMap = { 'K-1': { latest: { title: 'AI Title', status: 'New', priority: 'Minor', labels: [] } } }
    var healthIndex = new Map([['K-1', { summary: 'Health Title', status: 'Refinement', priority: 'Major' }]])

    var result = mergeFeatureData('K-1', jiraFeatures, aiReviewMap, new Map(), healthIndex, new Map(), new Map(), new Map())
    expect(result.title).toBe('Jira Title')
    expect(result.status).toBe('In Progress')
    expect(result.priority).toBe('Blocker')
    expect(result.targetVersions).toEqual(['3.6'])
    expect(result.fixVersion).toBe('3.6')
  })

  it('falls back through resolution chain when Jira is absent', function() {
    var aiReviewMap = { 'K-1': { latest: { title: 'AI Title', status: 'New', priority: 'Minor', labels: [], scores: { feasibility: 2 }, reviewers: {} } } }
    var healthIndex = new Map([['K-1', { summary: 'Health Title', status: 'Refinement' }]])

    var result = mergeFeatureData('K-1', null, aiReviewMap, new Map(), healthIndex, new Map(), new Map(), new Map())
    expect(result.title).toBe('AI Title')
    expect(result.status).toBe('New')
    expect(result.priority).toBe('Minor')
    expect(result.dataSource).toBe('strat-creator')
  })

  it('derives dataSource correctly', function() {
    var healthIndex = new Map([['K-1', { summary: 'H' }]])
    var r1 = mergeFeatureData('K-1', null, { 'K-1': { latest: { labels: [] } } }, new Map(), healthIndex, new Map(), new Map(), new Map())
    expect(r1.dataSource).toBe('strat-creator')

    var r2 = mergeFeatureData('K-1', null, {}, new Map(), healthIndex, new Map(), new Map(), new Map())
    expect(r2.dataSource).toBe('health-pipeline')

    var jira = new Map([['K-1', { summary: 'J', status: 'New' }]])
    var r3 = mergeFeatureData('K-1', jira, {}, new Map(), new Map(), new Map(), new Map(), new Map())
    expect(r3.dataSource).toBe('jira')

    var exec = new Map([['K-1', { summary: 'E', key: 'K-1' }]])
    var r4 = mergeFeatureData('K-1', null, {}, new Map(), new Map(), new Map(), new Map(), exec)
    expect(r4.dataSource).toBe('execution')
  })

  it('computes hygieneStatus from violations', function() {
    var hygieneIndex = new Map([['K-1', [{ id: 'missing-assignee' }]]])
    var r1 = mergeFeatureData('K-1', null, {}, new Map(), new Map(), hygieneIndex, new Map(), new Map())
    expect(r1.hygieneStatus).toBe('blocking')

    var r2 = mergeFeatureData('K-2', null, {}, new Map(), new Map(), new Map(), new Map(), new Map())
    expect(r2.hygieneStatus).toBe('unknown')
  })

  it('merges scores from aiReview only', function() {
    var aiReviewMap = { 'K-1': { latest: { scores: { feasibility: 2, testability: 1, scope: 2, architecture: 1 }, labels: [] } } }
    var result = mergeFeatureData('K-1', null, aiReviewMap, new Map(), new Map(), new Map(), new Map(), new Map())
    expect(result.rubricTotal).toBe(6)
    expect(result.scores.feasibility).toBe(2)
  })

  it('returns rubricTotal 0 when no aiReview', function() {
    var result = mergeFeatureData('K-1', null, {}, new Map(), new Map(), new Map(), new Map(), new Map())
    expect(result.rubricTotal).toBe(0)
    expect(result.scores).toEqual({})
  })

  it('resolves fixVersion from exec when no other source', function() {
    var exec = new Map([['K-1', { key: 'K-1', fixVersions: ['3.6'], labels: [] }]])
    var result = mergeFeatureData('K-1', null, {}, new Map(), new Map(), new Map(), new Map(), exec)
    expect(result.fixVersion).toBe('3.6')
  })

  it('resolves targetVersions from exec when no other source', function() {
    var exec = new Map([['K-1', { key: 'K-1', targetVersions: ['4.0'], labels: [] }]])
    var result = mergeFeatureData('K-1', null, {}, new Map(), new Map(), new Map(), new Map(), exec)
    expect(result.targetVersions).toEqual(['4.0'])
  })
})

// ---------------------------------------------------------------------------
// buildFeatureReadiness — single-pass data merging
// ---------------------------------------------------------------------------
describe('buildFeatureReadiness — single-pass merging', function() {
  var CONFIG_3_6 = { releases: { '3.6': { release: '3.6' } } }



  it('feature with aiReview + Jira gets rubric scores AND Jira status', function() {
    var store = makeFeaturesStore({
      'RHAISTRAT-1': { latest: makeLatest({ status: 'OldStatus', humanReviewStatus: 'approved' }) }
    })
    var jiraFeatures = new Map([['RHAISTRAT-1', {
      summary: 'Jira Summary',
      status: 'In Progress',
      priority: 'Critical',
      targetVersions: ['3.6'],
      fixVersions: [],
      labels: ['strat-creator-human-sign-off'],
      components: [],
      assignee: 'Bob',
      pmOwner: 'Alice'
    }]])

    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(store),
      'releases/planning/config.json': CONFIG_3_6
    })
    var result = buildFeatureReadiness(readFromStorage, jiraFeatures)

    var all = result.pendingReview.concat(result.ready)
    var feature = all.find(function(f) { return f.key === 'RHAISTRAT-1' })
    expect(feature).toBeDefined()
    expect(feature.status).toBe('In Progress')
    expect(feature.priority).toBe('Critical')
    expect(feature.rubricTotal).toBe(8)
    expect(feature.dataSource).toBe('strat-creator')
  })

  it('feature with only Jira data appears on list', function() {
    var store = makeFeaturesStore({})
    var jiraFeatures = new Map([['RHAISTRAT-JIRA', {
      summary: 'Jira Only Feature',
      status: 'In Progress',
      priority: 'Major',
      targetVersions: ['3.6'],
      fixVersions: [],
      labels: [],
      components: ['Backend'],
      assignee: 'Bob'
    }]])

    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(store),
      'releases/planning/config.json': CONFIG_3_6
    })
    var result = buildFeatureReadiness(readFromStorage, jiraFeatures)
    var feature = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-JIRA' })
    expect(feature).toBeDefined()
    expect(feature.dataSource).toBe('jira')
    expect(feature.status).toBe('In Progress')
    expect(feature.components).toEqual(['Backend'])
  })

  it('feature with null hygiene shows hygieneStatus unknown', function() {
    var store = makeFeaturesStore({
      'RHAISTRAT-1': { latest: makeLatest() }
    })
    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(store),
      'releases/planning/config.json': CONFIG_3_6,
      'releases/planning/candidates-cache-3.6.json': {
        data: { features: [{ issueKey: 'RHAISTRAT-1', tier: 1, targetRelease: '3.6' }] }
      }
    })
    var result = buildFeatureReadiness(readFromStorage)
    var feature = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-1' })
    expect(feature.hygieneStatus).toBe('unknown')
    expect(feature.violations).toBeNull()
  })

  it('meta includes jiraAvailable flag', function() {
    var store = makeFeaturesStore({})
    var readFromStorage = makeReadFromStorage(convertToUnifiedFormat(store))

    var r1 = buildFeatureReadiness(readFromStorage, null)
    expect(r1.meta.jiraAvailable).toBe(false)

    var r2 = buildFeatureReadiness(readFromStorage, new Map())
    expect(r2.meta.jiraAvailable).toBe(true)
  })

  it('no feature is excluded — all sources contribute to canonical set', function() {
    var store = makeFeaturesStore({
      'RHAISTRAT-AI': { latest: makeLatest() }
    })
    var jiraFeatures = new Map([['RHAISTRAT-JIRA', {
      summary: 'Jira Feature', status: 'In Progress', priority: 'Major',
      targetVersions: [], fixVersions: [], labels: [], components: []
    }]])

    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(store),
      'releases/planning/config.json': CONFIG_3_6,
      'releases/planning/health-cache-3.6-all.json': {
        features: [{ key: 'RHAISTRAT-HEALTH', summary: 'Health Feature', status: 'In Progress', priority: 'Major' }]
      },
      'releases/planning/candidates-cache-3.6.json': {
        data: { features: [
          { issueKey: 'RHAISTRAT-AI', tier: 1, targetRelease: '3.6' },
          { issueKey: 'RHAISTRAT-HEALTH', tier: 2, targetRelease: '3.6' }
        ]}
      }
    })

    var result = buildFeatureReadiness(readFromStorage, jiraFeatures)
    var allKeys = result.pendingReview.concat(result.ready).map(function(f) { return f.key })
    expect(allKeys).toContain('RHAISTRAT-AI')
    expect(allKeys).toContain('RHAISTRAT-JIRA')
    expect(allKeys).toContain('RHAISTRAT-HEALTH')
  })
})
