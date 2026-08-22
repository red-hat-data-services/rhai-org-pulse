import { describe, it, expect } from 'vitest'

const {
  computeReadiness,
  buildFeatureReadiness,
  buildCanonicalFeatures,
  computeBlockers,
  hasBlockingViolations,
  computeHygieneStatus,
  computeConfidence,
  collectFilterMeta,
  isHiddenFromFeaturesList,
  shouldIncludeInCanonical,
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
    sourceRfe: 'RHAIRFE-1',
    priority: 'Normal',
    status: 'In Progress',
    size: 'M',
    recommendation: null,
    needsAttention: null,
    humanReviewStatus: null,
    scores: { feasibility: 2, testability: 2, scope: 2, architecture: 2 },
    reviewers: { feasibility: 'approve', testability: 'approve', scope: 'approve', architecture: 'approve' },
    reviewedAt: '2026-01-01T00:00:00.000Z',
    components: ['Platform', 'Serving', 'UXD', 'Documentation'],
    labels: ['strat-creator-auto-created', 'strat-creator-rubric-pass', 'strat-creator-human-sign-off'],
    approvedBy: null,
    approvedAt: null,
    riceScore: 100,
    storyPoints: 5,
    epicCount: 3,
    docsRequired: 'Yes',
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
      docsRequired: latest.docsRequired != null ? latest.docsRequired : null,
      releaseType: latest.releaseType || null,
      epicCount: latest.epicCount != null ? latest.epicCount : 3,
      assignee: latest.deliveryOwner || latest.assignee || 'Alice',
      pm: latest.pmOwner || latest.pm || 'Jane',
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
      epicCount: latest.epicCount != null ? latest.epicCount : 3,
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

  it('returns false for missing-assignee (no longer blocking)', function() {
    expect(hasBlockingViolations([{ id: 'missing-assignee' }])).toBe(false)
  })

  it('returns false for open-children-on-closed (no longer blocking)', function() {
    expect(hasBlockingViolations([{ id: 'open-children-on-closed' }])).toBe(false)
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

  it('returns false when mix includes formerly-blocking rules', function() {
    expect(hasBlockingViolations([
      { id: 'stale-status-summary' },
      { id: 'missing-assignee' }
    ])).toBe(false)
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
    it('returns empty buckets when ai-impact key returns null', async function() {
      var readFromStorage = makeReadFromStorage({})
      var result = await buildFeatureReadiness(readFromStorage)
      expect(result.pendingReview).toEqual([])
      expect(result.ready).toEqual([])
      expect(result.filterMeta).toEqual({ components: [], priorities: [], bigRocks: [], targetVersions: [], fixVersions: [], teams: [], projects: [] })
      expect(result.meta).toEqual({ total: 0, pendingReviewCount: 0, readyCount: 0, versions: [], lastSyncedAt: null, jiraAvailable: false })
    })

    it('returns empty buckets when no features with aiReview exist', async function() {
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat({ lastSyncedAt: '2026-01-01T00:00:00.000Z' })
      })
      var result = await buildFeatureReadiness(readFromStorage)
      expect(result.pendingReview).toEqual([])
      expect(result.ready).toEqual([])
    })
  })

  describe('gate logic — bucket assignment', function() {
    it('humanReviewStatus approved with all gates → goes to ready bucket', async function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var healthCache = { features: [{ key: 'RHAISTRAT-1', deliveryOwner: 'Alice', pmOwner: 'Jane', targetRelease: 'rhoai-3.6', priorityScore: null, storyPoints: 5, epicCount: 3, releaseType: 'GA', components: ['Platform', 'Serving', 'UXD', 'Documentation'], docsRequired: 'Yes' }] }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache
      })
      var result = await buildFeatureReadiness(readFromStorage)
      expect(result.ready).toHaveLength(1)
      expect(result.ready[0].key).toBe('RHAISTRAT-1')
      expect(result.pendingReview).toHaveLength(0)
    })

    it('humanReviewStatus awaiting-review → goes to pendingReview bucket', async function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'awaiting-review' }) }
      })
      var readFromStorage = makeReadFromStorage({ ...convertToUnifiedFormat(store) })
      var result = await buildFeatureReadiness(readFromStorage)
      expect(result.pendingReview).toHaveLength(1)
      expect(result.ready).toHaveLength(0)
    })

    it('humanReviewStatus needs-review → goes to pendingReview bucket', async function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'needs-review' }) }
      })
      var readFromStorage = makeReadFromStorage({ ...convertToUnifiedFormat(store) })
      var result = await buildFeatureReadiness(readFromStorage)
      expect(result.pendingReview).toHaveLength(1)
      expect(result.ready).toHaveLength(0)
    })

    it('null humanReviewStatus → goes to pendingReview bucket', async function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: null }) }
      })
      var readFromStorage = makeReadFromStorage({ ...convertToUnifiedFormat(store) })
      var result = await buildFeatureReadiness(readFromStorage)
      expect(result.pendingReview).toHaveLength(1)
      expect(result.ready).toHaveLength(0)
    })

    it('skips entries with no latest', async function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) },
        'RHAISTRAT-2': {}
      })
      var readFromStorage = makeReadFromStorage({ ...convertToUnifiedFormat(store) })
      var result = await buildFeatureReadiness(readFromStorage)
      var allFeatures = result.pendingReview.concat(result.ready)
      expect(allFeatures).toHaveLength(1)
      expect(allFeatures[0].key).toBe('RHAISTRAT-1')
    })
  })

  describe('confidence field', function() {
    it('approved feature with fixVersion gets confidence=committed', async function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var candidateCache = {
        data: { features: [{ issueKey: 'RHAISTRAT-1', tier: 1, fixVersion: '3.6.0', targetRelease: 'rhoai-3.6' }] }
      }
      var healthCache = { features: [{ key: 'RHAISTRAT-1', deliveryOwner: 'Alice', pmOwner: 'Jane', priorityScore: null, storyPoints: 5, epicCount: 3, releaseType: 'GA', components: ['Platform', 'Serving', 'UXD', 'Documentation'], docsRequired: 'Yes' }] }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/candidates-cache-3.6.json': candidateCache,
        'releases/planning/health-cache-3.6-all.json': healthCache
      })
      var result = await buildFeatureReadiness(readFromStorage)
      expect(result.ready[0].confidence).toBe('committed')
      expect(result.ready[0].isAiFirst).toBe(true)
      expect(Array.isArray(result.ready[0].labels)).toBe(true)
    })

    it('approved feature without fixVersion gets confidence=ready', async function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var healthCache = { features: [{ key: 'RHAISTRAT-1', deliveryOwner: 'Alice', pmOwner: 'Jane', targetRelease: 'rhoai-3.6', priorityScore: null, storyPoints: 5, epicCount: 3, releaseType: 'GA', components: ['Platform', 'Serving', 'UXD', 'Documentation'], docsRequired: 'Yes' }] }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache
      })
      var result = await buildFeatureReadiness(readFromStorage)
      expect(result.ready[0].confidence).toBe('ready')
    })

    it('non-approved feature gets confidence=not-ready', async function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: null }) }
      })
      var readFromStorage = makeReadFromStorage({ ...convertToUnifiedFormat(store) })
      var result = await buildFeatureReadiness(readFromStorage)
      expect(result.pendingReview[0].confidence).toBe('not-ready')
    })
  })

  describe('readinessGates on all features', function() {
    it('strat-creator features have readinessGates with FPDoR fields', async function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var readFromStorage = makeReadFromStorage({ ...convertToUnifiedFormat(store) })
      var result = await buildFeatureReadiness(readFromStorage)
      var feat = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-1' })
      expect(feat.readinessGates).toBeDefined()
      expect(typeof feat.readinessGates.fpDorPassed).toBe('number')
      expect(typeof feat.readinessGates.fpDorTotal).toBe('number')
      expect(typeof feat.readinessGates.fpDorEvaluated).toBe('number')
      expect(feat.readinessGates.noBlockingViolations).toBe(true)
    })

    it('health-pipeline features have readinessGates with FPDoR and noBlockingViolations', async function() {
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
      var result = await buildFeatureReadiness(readFromStorage)
      var feat = result.pendingReview[0]
      expect(typeof feat.readinessGates.fpDorPassed).toBe('number')
      expect(typeof feat.readinessGates.fpDorTotal).toBe('number')
      expect(typeof feat.readinessGates.fpDorEvaluated).toBe('number')
      expect(feat.readinessGates.noBlockingViolations).toBe(true)
    })
  })

  describe('hygiene violations integration', function() {
    it('attaches violations from hygiene cache to features', async function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var violations = [{ id: 'stale-status-summary', name: 'Stale Status', category: 'timeliness', message: 'Status is stale' }]
      var hygieneCache = {
        features: { 'RHAISTRAT-1': { key: 'RHAISTRAT-1', team: 'Alpha', violations: violations } }
      }
      var healthCache = { features: [{ key: 'RHAISTRAT-1', deliveryOwner: 'Alice', pmOwner: 'Jane', targetRelease: 'rhoai-3.6', priorityScore: null, storyPoints: 5, epicCount: 3, releaseType: 'GA', components: ['Platform', 'Serving', 'UXD', 'Documentation'], docsRequired: 'Yes' }] }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache,
        'releases/hygiene/features-3.6.json': hygieneCache
      })
      var result = await buildFeatureReadiness(readFromStorage)
      expect(result.ready[0].violations).toEqual(violations)
    })

    it('hygiene violations do not move approved ready features to pendingReview', async function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var violations = [{ id: 'missing-assignee', name: 'Missing Assignee', category: 'ownership', message: 'No assignee' }]
      var hygieneCache = {
        features: { 'RHAISTRAT-1': { key: 'RHAISTRAT-1', team: 'Alpha', violations: violations } }
      }
      var healthCache = { features: [{ key: 'RHAISTRAT-1', priorityScore: null, storyPoints: 5, epicCount: 3, releaseType: 'GA', deliveryOwner: 'Alice', pmOwner: 'Jane', targetRelease: 'rhoai-3.6', components: ['Platform', 'Serving', 'UXD', 'Documentation'], docsRequired: 'Yes' }] }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache,
        'releases/hygiene/features-3.6.json': hygieneCache
      })
      var result = await buildFeatureReadiness(readFromStorage)
      expect(result.ready).toHaveLength(1)
      expect(result.ready[0].confidence).not.toBe('not-ready')
      expect(result.ready[0].readinessGates.noBlockingViolations).toBe(true)
      expect(result.ready[0].violations).toEqual(violations)
    })

    it('non-blocking violations do not affect readiness', async function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var violations = [{ id: 'stale-status-summary', name: 'Stale', category: 'timeliness', message: 'Stale' }]
      var hygieneCache = {
        features: { 'RHAISTRAT-1': { key: 'RHAISTRAT-1', team: 'Alpha', violations: violations } }
      }
      var healthCache = { features: [{ key: 'RHAISTRAT-1', deliveryOwner: 'Alice', pmOwner: 'Jane', targetRelease: 'rhoai-3.6', priorityScore: null, storyPoints: 5, epicCount: 3, releaseType: 'GA', components: ['Platform', 'Serving', 'UXD', 'Documentation'], docsRequired: 'Yes' }] }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache,
        'releases/hygiene/features-3.6.json': hygieneCache
      })
      var result = await buildFeatureReadiness(readFromStorage)
      expect(result.ready).toHaveLength(1)
      expect(result.ready[0].readinessGates.noBlockingViolations).toBe(true)
    })

    it('health-pipeline feature with hygiene violations still has noBlockingViolations=true (hygiene decoupled)', async function() {
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
      var result = await buildFeatureReadiness(readFromStorage)
      expect(result.pendingReview).toHaveLength(1)
      expect(result.pendingReview[0].readinessGates.noBlockingViolations).toBe(true)
    })
  })

  describe('sort order — approved', function() {
    it('sorts by effectivePriorityScore descending', async function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-LOW': { latest: makeLatest({ humanReviewStatus: 'approved', priority: 'Minor', scores: { feasibility: 1, testability: 1, scope: 1, architecture: 1 } }) },
        'RHAISTRAT-HIGH': { latest: makeLatest({ humanReviewStatus: 'approved', priority: 'Blocker', scores: { feasibility: 2, testability: 2, scope: 2, architecture: 2 } }) }
      })
      var readFromStorage = makeReadFromStorage({ ...convertToUnifiedFormat(store) })
      var result = await buildFeatureReadiness(readFromStorage)
      var all = result.pendingReview.concat(result.ready)
      var highIdx = all.findIndex(function(f) { return f.key === 'RHAISTRAT-HIGH' })
      var lowIdx = all.findIndex(function(f) { return f.key === 'RHAISTRAT-LOW' })
      expect(highIdx).toBeLessThan(lowIdx)
    })

    it('higher rubric score → higher effectivePriorityScore → appears first', async function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-LOWTOTAL': { latest: makeLatest({ key: 'RHAISTRAT-LOWTOTAL', humanReviewStatus: 'approved', priority: 'Normal', scores: { feasibility: 1, testability: 1, scope: 1, architecture: 1 } }) },
        'RHAISTRAT-HIGHTOTAL': { latest: makeLatest({ key: 'RHAISTRAT-HIGHTOTAL', humanReviewStatus: 'approved', priority: 'Normal', scores: { feasibility: 2, testability: 2, scope: 2, architecture: 2 } }) }
      })
      var readFromStorage = makeReadFromStorage({ ...convertToUnifiedFormat(store) })
      var result = await buildFeatureReadiness(readFromStorage)
      var all = result.pendingReview.concat(result.ready)
      var highIdx = all.findIndex(function(f) { return f.key === 'RHAISTRAT-HIGHTOTAL' })
      var lowIdx = all.findIndex(function(f) { return f.key === 'RHAISTRAT-LOWTOTAL' })
      expect(highIdx).toBeLessThan(lowIdx)
    })
  })

  describe('sort order — pendingReview', function() {
    it('higher priority → higher effectivePriorityScore → appears first', async function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-LOW': { latest: makeLatest({ key: 'RHAISTRAT-LOW', humanReviewStatus: null, priority: 'Minor', scores: { feasibility: 0, testability: 0, scope: 0, architecture: 0 } }) },
        'RHAISTRAT-HIGH': { latest: makeLatest({ key: 'RHAISTRAT-HIGH', humanReviewStatus: null, priority: 'Blocker', scores: { feasibility: 0, testability: 0, scope: 0, architecture: 0 } }) }
      })
      var readFromStorage = makeReadFromStorage({ ...convertToUnifiedFormat(store) })
      var result = await buildFeatureReadiness(readFromStorage)
      expect(result.pendingReview[0].key).toBe('RHAISTRAT-HIGH')
      expect(result.pendingReview[1].key).toBe('RHAISTRAT-LOW')
    })

    it('equal priority: higher rubric score → higher effectivePriorityScore → appears first', async function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-A': { latest: makeLatest({ key: 'RHAISTRAT-A', humanReviewStatus: null, priority: 'Normal', size: null, scores: { feasibility: 2, testability: 1, scope: 0, architecture: 0 } }) },
        'RHAISTRAT-B': { latest: makeLatest({ key: 'RHAISTRAT-B', humanReviewStatus: null, priority: 'Normal', size: null, scores: { feasibility: 1, testability: 0, scope: 0, architecture: 0 } }) }
      })
      var readFromStorage = makeReadFromStorage({ ...convertToUnifiedFormat(store) })
      var result = await buildFeatureReadiness(readFromStorage)
      expect(result.pendingReview[0].key).toBe('RHAISTRAT-A')
    })

    it('tiebreaker: equal effectivePriorityScore → higher rubricTotal first', async function() {
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
      var result = await buildFeatureReadiness(readFromStorage)
      var idxA = result.pendingReview.findIndex(function(f) { return f.key === 'RHAISTRAT-TIE-A' })
      var idxB = result.pendingReview.findIndex(function(f) { return f.key === 'RHAISTRAT-TIE-B' })
      expect(idxA).toBeLessThan(idxB)
    })
  })

  describe('candidates cache cross-reference', function() {
    var candidatesKey = 'releases/planning/candidates-cache-3.6.json'

    it('populates tier, bigRock, targetVersions, fixVersion from matching candidate', async function() {
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
      var healthCache = { features: [{ key: 'RHAISTRAT-1', deliveryOwner: 'Alice', pmOwner: 'Jane', priorityScore: null, storyPoints: 5, epicCount: 3, releaseType: 'GA', components: ['Platform', 'Serving', 'UXD', 'Documentation'], docsRequired: 'Yes' }] }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        [candidatesKey]: candidateCache,
        'releases/planning/health-cache-3.6-all.json': healthCache
      })
      var result = await buildFeatureReadiness(readFromStorage)
      var f = result.ready[0]
      expect(f.tier).toBe(1)
      expect(f.bigRock).toBe('AI Efficiency')
      expect(f.targetVersions).toEqual(['rhoai-3.6'])
      expect(f.fixVersion).toBe('3.6.0')
    })

    it('leaves tier/bigRock/targetVersions empty when no candidate matches but feature is in health cache', async function() {
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
      var result = await buildFeatureReadiness(readFromStorage)
      var f = result.pendingReview.concat(result.ready).find(function(feat) { return feat.key === 'RHAISTRAT-1' })
      expect(f.tier).toBeNull()
      expect(f.bigRock).toBeNull()
      expect(f.targetVersions).toEqual([])
      expect(f.fixVersion).toBeNull()
    })

    it('tier is normalized to T-string (numeric 2 → T2)', async function() {
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
      var result = await buildFeatureReadiness(readFromStorage)
      var feat = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-1' })
      expect(feat.tier).toBe(2)
    })
  })

  describe('missing candidates cache', function() {
    it('includes all features when configured releases exist but all caches are empty', async function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6
      })
      var result = await buildFeatureReadiness(readFromStorage)
      expect(result.pendingReview.concat(result.ready)).toHaveLength(1)
    })

    it('includes all features when no releases are configured', async function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store)
      })
      var result = await buildFeatureReadiness(readFromStorage)
      expect(result.pendingReview.concat(result.ready)).toHaveLength(1)
    })

    it('falls back to health cache for tier, bigRock, targetVersions, fixVersion when candidates cache is absent', async function() {
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
          components: ['Platform', 'Serving', 'UXD'],
          docsRequired: 'Required'
        }]
      }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache
      })
      var result = await buildFeatureReadiness(readFromStorage)
      var f = result.ready[0]
      expect(f.tier).toBe(2)
      expect(f.bigRock).toBe('Platform Efficiency')
      expect(f.targetVersions).toEqual(['rhoai-3.6'])
      expect(f.fixVersion).toBe('3.6.0')
      expect(f.deliveryOwner).toBe('Jane Smith')
    })

    it('candidates cache takes priority over health cache for tier/bigRock/targetVersions/fixVersion', async function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var candidateCache = {
        data: { features: [{ issueKey: 'RHAISTRAT-1', tier: 1, bigRock: 'AI Speed', targetRelease: 'rhoai-3.6-cand', fixVersion: '3.6.0-cand' }] }
      }
      var healthCache = {
        features: [{ key: 'RHAISTRAT-1', tier: 'T3', bigRock: 'Platform', targetRelease: 'rhoai-3.6-health', fixVersions: '3.6.0-health', deliveryOwner: 'Alice', pmOwner: 'Jane', priorityScore: null, storyPoints: 5, epicCount: 3, releaseType: 'GA', components: ['Platform', 'Serving', 'UXD', 'Documentation'], docsRequired: 'Yes' }]
      }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/candidates-cache-3.6.json': candidateCache,
        'releases/planning/health-cache-3.6-all.json': healthCache
      })
      var result = await buildFeatureReadiness(readFromStorage)
      var f = result.ready[0]
      expect(f.tier).toBe(1)
      expect(f.bigRock).toBe('AI Speed')
      expect(f.targetVersions).toEqual(['rhoai-3.6-cand'])
      expect(f.fixVersion).toBe('3.6.0-cand')
    })

    it('health cache components (string) are split into array when ai-impact components are empty', async function() {
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
      var result = await buildFeatureReadiness(readFromStorage)
      var feat = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-1' })
      expect(feat.components).toEqual(['Serving', 'Training'])
    })
  })

  describe('health cache cross-reference', function() {
    var healthKey = 'releases/planning/health-cache-3.6-all.json'

    it('feature gets batch-computed priorityScore', async function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var healthCache = {
        features: [{ key: 'RHAISTRAT-1', deliveryOwner: 'Alice', pmOwner: 'Jane', targetRelease: 'rhoai-3.6', storyPoints: 5, epicCount: 3, releaseType: 'GA', components: ['Platform', 'Serving', 'UXD', 'Documentation'], docsRequired: 'Yes' }]
      }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        [healthKey]: healthCache
      })
      var result = await buildFeatureReadiness(readFromStorage)
      var f = result.ready[0]
      expect(typeof f.effectivePriorityScore).toBe('number')
      expect(f.effectivePriorityScore).toBeGreaterThan(0)
    })

    it('priorityScoreBreakdown has rice, bigRock, targetVersion, priority fields', async function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var healthCache = {
        features: [{ key: 'RHAISTRAT-1', deliveryOwner: 'Alice', pmOwner: 'Jane', targetRelease: 'rhoai-3.6', storyPoints: 5, epicCount: 3, releaseType: 'GA', components: ['Platform', 'Serving', 'UXD', 'Documentation'], docsRequired: 'Yes' }]
      }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        [healthKey]: healthCache
      })
      var result = await buildFeatureReadiness(readFromStorage)
      var bd = result.ready[0].priorityScoreBreakdown
      expect(typeof bd.rice).toBe('number')
      expect(typeof bd.bigRock).toBe('number')
      expect(typeof bd.targetVersion).toBe('number')
      expect(typeof bd.priority).toBe('number')
    })
  })

  describe('batch scoring', function() {
    it('all features get batch-computed scores from computePriorityScores', async function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved', priority: 'Blocker', riceScore: 200 }) },
        'RHAISTRAT-2': { latest: makeLatest({ key: 'RHAISTRAT-2', humanReviewStatus: 'approved', priority: 'Minor', riceScore: 10 }) }
      })
      var healthCache = {
        features: [
          { key: 'RHAISTRAT-1', deliveryOwner: 'Alice', pmOwner: 'Jane', targetRelease: 'rhoai-3.6', storyPoints: 5, epicCount: 3, releaseType: 'GA', components: ['Platform', 'Serving', 'UXD', 'Documentation'], docsRequired: 'Yes' },
          { key: 'RHAISTRAT-2', deliveryOwner: 'Bob', pmOwner: 'Jane', targetRelease: 'rhoai-3.6', storyPoints: 5, epicCount: 3, releaseType: 'GA', components: ['Platform', 'Serving', 'UXD', 'Documentation'], docsRequired: 'Yes' }
        ]
      }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache
      })
      var result = await buildFeatureReadiness(readFromStorage)
      var all = result.pendingReview.concat(result.ready)
      var f1 = all.find(function(f) { return f.key === 'RHAISTRAT-1' })
      var f2 = all.find(function(f) { return f.key === 'RHAISTRAT-2' })
      expect(f1.effectivePriorityScore).toBeGreaterThan(f2.effectivePriorityScore)
      expect(f1.priorityScoreBreakdown).toBeDefined()
      expect(f2.priorityScoreBreakdown).toBeDefined()
    })

    it('RICE scores are min-max normalized across the batch', async function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-HIGH': { latest: makeLatest({ humanReviewStatus: 'approved', riceScore: 1000 }) },
        'RHAISTRAT-LOW': { latest: makeLatest({ key: 'RHAISTRAT-LOW', humanReviewStatus: 'approved', riceScore: 10 }) }
      })
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6
      })
      var result = await buildFeatureReadiness(readFromStorage)
      var all = result.pendingReview.concat(result.ready)
      var high = all.find(function(f) { return f.key === 'RHAISTRAT-HIGH' })
      var low = all.find(function(f) { return f.key === 'RHAISTRAT-LOW' })
      expect(high.priorityScoreBreakdown.rice).toBe(100)
      expect(low.priorityScoreBreakdown.rice).toBe(0)
    })
  })

  describe('stable rank', function() {
    it('assigns rank numbers based on global sort position', async function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-A': { latest: makeLatest({ key: 'RHAISTRAT-A', humanReviewStatus: 'approved', priority: 'Blocker' }) },
        'RHAISTRAT-B': { latest: makeLatest({ key: 'RHAISTRAT-B', humanReviewStatus: null, priority: 'Minor' }) },
        'RHAISTRAT-C': { latest: makeLatest({ key: 'RHAISTRAT-C', humanReviewStatus: null, priority: 'Normal' }) }
      })
      var readFromStorage = makeReadFromStorage({ ...convertToUnifiedFormat(store) })
      var result = await buildFeatureReadiness(readFromStorage)
      var all = result.pendingReview.concat(result.ready)
      for (var i = 0; i < all.length; i++) {
        expect(typeof all[i].rank).toBe('number')
        expect(all[i].rank).toBeGreaterThanOrEqual(1)
      }
    })

    it('rank values are unique and contiguous starting from 1', async function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved', priority: 'Blocker' }) },
        'RHAISTRAT-2': { latest: makeLatest({ key: 'RHAISTRAT-2', humanReviewStatus: null, priority: 'Normal' }) },
        'RHAISTRAT-3': { latest: makeLatest({ key: 'RHAISTRAT-3', humanReviewStatus: null, priority: 'Minor' }) }
      })
      var readFromStorage = makeReadFromStorage({ ...convertToUnifiedFormat(store) })
      var result = await buildFeatureReadiness(readFromStorage)
      var all = result.pendingReview.concat(result.ready)
      var ranks = all.map(function(f) { return f.rank }).sort(function(a, b) { return a - b })
      for (var i = 0; i < ranks.length; i++) {
        expect(ranks[i]).toBe(i + 1)
      }
    })

    it('highest-scored feature gets rank 1', async function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-LOW': { latest: makeLatest({ key: 'RHAISTRAT-LOW', humanReviewStatus: null, priority: 'Minor', riceScore: 10 }) },
        'RHAISTRAT-HIGH': { latest: makeLatest({ key: 'RHAISTRAT-HIGH', humanReviewStatus: null, priority: 'Blocker', riceScore: 1000 }) }
      })
      var readFromStorage = makeReadFromStorage({ ...convertToUnifiedFormat(store) })
      var result = await buildFeatureReadiness(readFromStorage)
      var all = result.pendingReview.concat(result.ready)
      var high = all.find(function(f) { return f.key === 'RHAISTRAT-HIGH' })
      var low = all.find(function(f) { return f.key === 'RHAISTRAT-LOW' })
      expect(high.rank).toBe(1)
      expect(low.rank).toBe(2)
    })
  })

  describe('cross-version bigRockPriorityMap', function() {
    it('uses best (lowest) priority number when a rock appears in multiple releases', async function() {
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
      var result = await buildFeatureReadiness(readFromStorage)
      var all = result.pendingReview.concat(result.ready)
      var feat = all.find(function(f) { return f.key === 'RHAISTRAT-1' })
      expect(feat).toBeDefined()
      expect(feat.priorityScoreBreakdown.bigRock).toBeGreaterThan(0)
    })
  })

  describe('filterMeta', function() {
    it('contains unique sorted arrays of priorities, components, bigRocks, targetVersions, fixVersions', async function() {
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
      var result = await buildFeatureReadiness(readFromStorage)
      var fm = result.filterMeta
      expect(fm.priorities).toEqual(['Critical', 'Normal'])
      expect(fm.components).toEqual(['Platform', 'Serving'])
      expect(fm.bigRocks).toEqual(['AI Efficiency', 'Platform'])
      expect(fm.targetVersions).toEqual(['rhoai-3.6'])
      expect(fm.fixVersions).toEqual(['3.6.0'])
    })

    it('filterMeta.teams is populated from hygiene cache team values', async function() {
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
      var result = await buildFeatureReadiness(readFromStorage)
      expect(result.filterMeta.teams).toEqual(['Alice', 'Bob'])
    })

    it('feature.team comes from hygiene cache, not deliveryOwner', async function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var healthCache = { features: [{ key: 'RHAISTRAT-1', deliveryOwner: 'wrong-owner', pmOwner: 'Jane', targetRelease: 'rhoai-3.6', priorityScore: null, storyPoints: 5, epicCount: 3, releaseType: 'GA', components: ['Platform', 'Serving', 'UXD', 'Documentation'], docsRequired: 'Yes' }] }
      var hygieneCache = { features: { 'RHAISTRAT-1': { key: 'RHAISTRAT-1', team: 'Real Team' } } }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache,
        'releases/hygiene/features-3.6.json': hygieneCache
      })
      var result = await buildFeatureReadiness(readFromStorage)
      var feat = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-1' })
      expect(feat.team).toBe('Real Team')
      expect(result.filterMeta.teams).toEqual(['Real Team'])
    })
  })

  describe('meta', function() {
    it('contains correct counts and versions array', async function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) },
        'RHAISTRAT-2': { latest: makeLatest({ key: 'RHAISTRAT-2', humanReviewStatus: null }) },
        'RHAISTRAT-3': { latest: makeLatest({ key: 'RHAISTRAT-3', humanReviewStatus: 'needs-review' }) }
      })
      var healthCache = {
        features: [
          { key: 'RHAISTRAT-1', deliveryOwner: 'Alice', pmOwner: 'Jane', targetRelease: 'rhoai-3.6', priorityScore: null, storyPoints: 5, epicCount: 3, releaseType: 'GA', components: ['Platform', 'Serving', 'UXD', 'Documentation'], docsRequired: 'Yes' },
          { key: 'RHAISTRAT-2', priorityScore: null },
          { key: 'RHAISTRAT-3', priorityScore: null }
        ]
      }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache
      })
      var result = await buildFeatureReadiness(readFromStorage)
      expect(result.meta.total).toBe(3)
      expect(result.meta.readyCount).toBe(1)
      expect(result.meta.pendingReviewCount).toBe(2)
      expect(result.meta.versions).toEqual(['3.6'])
    })

    it('meta.versions is empty when no releases are configured', async function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var readFromStorage = makeReadFromStorage({ ...convertToUnifiedFormat(store) })
      var result = await buildFeatureReadiness(readFromStorage)
      expect(result.meta.versions).toEqual([])
    })
  })

  describe('rubricTotal calculation', function() {
    it('sums all four dimension scores', async function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({
          humanReviewStatus: 'approved',
          priority: 'Normal',
          scores: { feasibility: 3, testability: 2, scope: 1, architecture: 2 }
        }) }
      })
      var readFromStorage = makeReadFromStorage({ ...convertToUnifiedFormat(store) })
      var result = await buildFeatureReadiness(readFromStorage)
      var feat = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-1' })
      expect(feat.rubricTotal).toBe(8)
    })

    it('treats missing score dimensions as 0', async function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({
          humanReviewStatus: 'approved',
          scores: { feasibility: 2 }
        }) }
      })
      var readFromStorage = makeReadFromStorage({ ...convertToUnifiedFormat(store) })
      var result = await buildFeatureReadiness(readFromStorage)
      var feat = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-1' })
      expect(feat.rubricTotal).toBe(2)
    })
  })

  describe('health cache scores fallback', function() {
    it('uses health cache scores when aiReview is not available', async function() {
      var store = makeFeaturesStore({})
      var healthCache = {
        features: [{
          key: 'AIPCC-500', summary: 'Health Feature', status: 'In Progress',
          priority: 'Major', deliveryOwner: 'Jane', pm: 'Rick',
          components: ['Documentation', 'UXD', 'Dashboard'], targetRelease: 'rhoai-3.6',
          scores: { feasibility: 2, testability: 2, scope: 2, architecture: 2 }
        }]
      }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache
      })
      var result = await buildFeatureReadiness(readFromStorage)
      var feat = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'AIPCC-500' })
      expect(feat).toBeDefined()
      expect(feat.rubricTotal).toBe(8)
      expect(feat.scores).toEqual({ feasibility: 2, testability: 2, scope: 2, architecture: 2 })
    })

    it('prefers aiReview scores over health cache scores', async function() {
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
      var result = await buildFeatureReadiness(readFromStorage)
      var feat = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-1' })
      expect(feat.rubricTotal).toBe(12)
    })
  })

  describe('version-scoping guard', function() {
    it('excludes features not in any cache when caches have data', async function() {
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
      var result = await buildFeatureReadiness(readFromStorage)
      var allFeatures = result.pendingReview.concat(result.ready)
      expect(allFeatures).toHaveLength(1)
      expect(allFeatures[0].key).toBe('RHAISTRAT-IN')
    })

    it('includes all features when no configured releases exist', async function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) },
        'RHAISTRAT-2': { latest: makeLatest({ key: 'RHAISTRAT-2', humanReviewStatus: null }) }
      })
      var readFromStorage = makeReadFromStorage({ ...convertToUnifiedFormat(store) })
      var result = await buildFeatureReadiness(readFromStorage)
      expect(result.pendingReview.concat(result.ready)).toHaveLength(2)
    })
  })

  describe('multi-version loading', function() {
    it('merges features from multiple configured versions', async function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) },
        'RHAISTRAT-2': { latest: makeLatest({ key: 'RHAISTRAT-2', humanReviewStatus: 'approved' }) }
      })
      var config = { releases: { '3.5': { release: '3.5' }, '3.6': { release: '3.6' } } }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': config,
        'releases/planning/health-cache-3.5-all.json': { features: [{ key: 'RHAISTRAT-1', deliveryOwner: 'Alice', pmOwner: 'Jane', targetRelease: 'rhoai-3.5', priorityScore: 80, storyPoints: 5, epicCount: 3, releaseType: 'GA', components: ['Platform', 'Serving', 'UXD', 'Documentation'], docsRequired: 'Yes' }] },
        'releases/planning/health-cache-3.6-all.json': { features: [{ key: 'RHAISTRAT-2', deliveryOwner: 'Bob', pmOwner: 'Jane', targetRelease: 'rhoai-3.6', priorityScore: 60, storyPoints: 5, epicCount: 3, releaseType: 'GA', components: ['Platform', 'Serving', 'UXD', 'Documentation'], docsRequired: 'Yes' }] }
      })
      var result = await buildFeatureReadiness(readFromStorage)
      expect(result.ready).toHaveLength(2)
      expect(result.meta.versions).toEqual(['3.5', '3.6'])
    })

    it('duplicate features across versions use first-seen data', async function() {
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
      var result = await buildFeatureReadiness(readFromStorage)
      var allFeatures = result.pendingReview.concat(result.ready)
      expect(allFeatures).toHaveLength(1)
      expect(allFeatures[0].tier).toBe(1)
      expect(allFeatures[0].bigRock).toBe('First')
    })

    it('meta.versions reflects all configured release versions', async function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var config = { releases: { '3.4': { release: '3.4' }, '3.5': { release: '3.5' }, '3.6': { release: '3.6' } } }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': config
      })
      var result = await buildFeatureReadiness(readFromStorage)
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
        priority: 'Major',
        sourceRfe: 'RHAIRFE-1',
        components: ['Documentation', 'UXD', 'Platform', 'Serving'],
        docsRequired: 'Yes',
        effort: 5,
        scores: { testability: 2, architecture: 2, feasibility: 2, scope: 2 },
        labels: [],
        descriptionSignals: {
          hasContent: true,
          signalCount: 4,
          hasAcceptanceCriteria: true,
          hasUseCases: true,
          hasScopeDefinition: true,
          hasRequirements: true,
          hasRisks: true,
          hasArchitectureSignal: true,
          hasArchitectureNotRequired: false,
          hasCrossFunctionalDependency: false,
          hasNaNoUx: false,
          matchedSections: [
            { kind: 'acceptanceCriteria', title: 'Acceptance Criteria' },
            { kind: 'requirements', title: 'Requirements' },
            { kind: 'risks', title: 'Risks' },
            { kind: 'architecture', title: 'Architecture' }
          ]
        },
        status: 'In Progress',
        violations: null
      }, overrides)
    }

    it('returns isReady=true when all applicable FPDoR items pass', function() {
      var result = computeReadiness(readyFeature())
      expect(result.isReady).toBe(true)
      expect(result.gates.fpDorTotal).toBe(17)
      expect(result.fpdor.allApplicablePassed).toBe(true)
      expect(result.fpdor.totalCount).toBe(17)
      expect(result.gates.pastRefinement).toBe(true)
      expect(result.gates.noBlockingViolations).toBe(true)
    })

    it('returns isReady=false when riceScore is 0', function() {
      var result = computeReadiness(readyFeature({ riceScore: 0 }))
      expect(result.isReady).toBe(false)
      expect(result.gates.fpDorPassed).toBeLessThan(result.gates.fpDorEvaluated)
    })

    it('returns isReady=false when child epics missing (no epicCount / decomposition label)', function() {
      var result = computeReadiness(readyFeature({ epicCount: 0, labels: [] }))
      expect(result.isReady).toBe(false)
      var child = result.fpdor.items.find(function(i) { return i.name === 'Child epics' })
      expect(child.pass).toBe(false)
    })

    it('returns isReady=true when epicCount > 0', function() {
      var result = computeReadiness(readyFeature({ epicCount: 3 }))
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
      var result = computeReadiness(readyFeature({ components: [], docsRequired: null }))
      expect(result.isReady).toBe(false)
    })

    it('docs impact fails without Docs Required; UXD is N/A without component or N/A note', function() {
      var result = computeReadiness(readyFeature({ components: ['Platform', 'Serving'], docsRequired: null }))
      expect(result.isReady).toBe(false)
      var docsItem = result.fpdor.items.find(function(i) { return i.name === 'Docs impact' })
      var uxdItem = result.fpdor.items.find(function(i) { return i.name === 'UXD' })
      var engItem = result.fpdor.items.find(function(i) { return i.name === 'Cross-team deps' })
      expect(engItem.pass).toBe(true)
      expect(docsItem.pass).toBe(false)
      expect(uxdItem.pass).toBeNull()
    })

    it('cross-team deps fails with single eng component and no dependency signal', function() {
      var result = computeReadiness(readyFeature({ components: ['Platform', 'Documentation', 'UXD'], docsRequired: 'Yes' }))
      expect(result.isReady).toBe(false)
      var engItem = result.fpdor.items.find(function(i) { return i.name === 'Cross-team deps' })
      expect(engItem.pass).toBe(false)
    })

    it('returns isReady=true when status is New if all FPDoR items pass', function() {
      var result = computeReadiness(readyFeature({ status: 'New' }))
      expect(result.isReady).toBe(true)
      expect(result.gates.pastRefinement).toBe(false)
    })

    it('returns isReady=true when status is Refinement if all FPDoR items pass', function() {
      var result = computeReadiness(readyFeature({ status: 'Refinement' }))
      expect(result.isReady).toBe(true)
      expect(result.gates.pastRefinement).toBe(false)
    })

    it('returns isReady=true when status is null if all FPDoR items pass', function() {
      var result = computeReadiness(readyFeature({ status: null }))
      expect(result.isReady).toBe(true)
      expect(result.gates.pastRefinement).toBe(false)
    })

    it('hygiene violations do not gate readiness (BLOCKING_HYGIENE_RULES is empty)', function() {
      var result = computeReadiness(readyFeature({ violations: [{ id: 'missing-assignee' }] }))
      expect(result.isReady).toBe(true)
      expect(result.gates.noBlockingViolations).toBe(true)
    })

    it('non-blocking violations do not fail the gate', function() {
      var result = computeReadiness(readyFeature({ violations: [{ id: 'stale-status-summary' }] }))
      expect(result.isReady).toBe(true)
      expect(result.gates.noBlockingViolations).toBe(true)
    })

    it('gates has fpDorPassed, fpDorTotal, fpDorEvaluated, fpDorApplicable', function() {
      var result = computeReadiness(readyFeature())
      expect(typeof result.gates.fpDorPassed).toBe('number')
      expect(typeof result.gates.fpDorTotal).toBe('number')
      expect(typeof result.gates.fpDorEvaluated).toBe('number')
      expect(typeof result.gates.fpDorApplicable).toBe('number')
    })

    it('fpdor object contains items array with individual checks and groups', function() {
      var result = computeReadiness(readyFeature())
      expect(result.fpdor.items.length).toBe(17)
      for (var i = 0; i < result.fpdor.items.length; i++) {
        expect(result.fpdor.items[i]).toHaveProperty('name')
        expect(result.fpdor.items[i]).toHaveProperty('pass')
        expect(result.fpdor.items[i]).toHaveProperty('source')
        expect(result.fpdor.items[i]).toHaveProperty('group')
      }
      expect(result.fpdor.confluenceUrl).toContain('442958832')
    })

    // --- Child epics (formerly Scope Defined) ---

    it('child epics passes with epicCount > 0', function() {
      var result = computeReadiness(readyFeature({ epicCount: 3 }))
      var child = result.fpdor.items.find(function(i) { return i.name === 'Child epics' })
      expect(child.pass).toBe(true)
    })

    it('child epics fails when epicCount is 0 and no decomposition label', function() {
      var result = computeReadiness(readyFeature({ epicCount: 0, labels: [] }))
      var child = result.fpdor.items.find(function(i) { return i.name === 'Child epics' })
      expect(child.pass).toBe(false)
    })

    it('child epics passes via epic-creator-auto-decomposed without epicCount', function() {
      var result = computeReadiness(readyFeature({ epicCount: 0, labels: ['epic-creator-auto-decomposed'] }))
      var child = result.fpdor.items.find(function(i) { return i.name === 'Child epics' })
      expect(child.pass).toBe(true)
      expect(child.detail).toContain('epic-creator-auto-decomposed')
    })

    it('source RFE passes with RFE link; sizing alone does not satisfy child epics', function() {
      var result = computeReadiness(readyFeature({ epicCount: 0, storyPoints: 5, sourceRfe: 'RFE-123', labels: [] }))
      var child = result.fpdor.items.find(function(i) { return i.name === 'Child epics' })
      var rfe = result.fpdor.items.find(function(i) { return i.name === 'Source RFE / AI SDLC' })
      expect(child.pass).toBe(false)
      expect(rfe.pass).toBe(true)
    })

    // --- Strat-creator sign-off (humanVerified) tests ---

    it('humanVerified is set on criteria items when strat-creator-human-sign-off label present', function() {
      var result = computeReadiness(readyFeature({ labels: ['strat-creator-auto-created', 'strat-creator-human-sign-off'] }))
      var items = result.fpdor.items
      var reqItem = items.find(function(i) { return i.name === 'Requirements clarity' })
      var acItem = items.find(function(i) { return i.name === 'Acceptance criteria' })
      var archItem = items.find(function(i) { return i.name === 'Architectural alignment' })
      var riskItem = items.find(function(i) { return i.name === 'Risks & assumptions' })
      expect(reqItem.humanVerified).toBe(true)
      expect(acItem.humanVerified).toBe(true)
      expect(archItem.humanVerified).toBe(true)
      expect(riskItem.humanVerified).toBe(true)
    })

    it('humanVerified is not set on mandatory field items when sign-off label present', function() {
      var result = computeReadiness(readyFeature({ labels: ['strat-creator-auto-created', 'strat-creator-human-sign-off'] }))
      var items = result.fpdor.items
      var riceItem = items.find(function(i) { return i.name === 'RICE' })
      var engItem = items.find(function(i) { return i.name === 'Cross-team deps' })
      var docsItem = items.find(function(i) { return i.name === 'Docs impact' })
      var tvItem = items.find(function(i) { return i.name === 'Target Version' })
      expect(riceItem.humanVerified).toBeUndefined()
      expect(engItem.humanVerified).toBeUndefined()
      expect(docsItem.humanVerified).toBeUndefined()
      expect(tvItem.humanVerified).toBeUndefined()
    })

    it('humanVerified is not set when sign-off label is absent', function() {
      var result = computeReadiness(readyFeature({ labels: [] }))
      var items = result.fpdor.items
      var reqItem = items.find(function(i) { return i.name === 'Requirements clarity' })
      expect(reqItem.humanVerified).toBeUndefined()
    })

    it('feature human sign-off is N/A for Legacy features', function() {
      var result = computeReadiness(readyFeature({ labels: [] }))
      var signOff = result.fpdor.items.find(function(i) { return i.name === 'Feature human sign-off' })
      expect(signOff.pass).toBeNull()
    })

    it('feature human sign-off passes via strat-creator-human* for AI First', function() {
      var result = computeReadiness(readyFeature({ labels: ['strat-creator-auto-created', 'strat-creator-human-sign-off'] }))
      var signOff = result.fpdor.items.find(function(i) { return i.name === 'Feature human sign-off' })
      expect(signOff.pass).toBe(true)
      expect(signOff.detail).toContain('strat-creator-human')
    })

    it('feature human sign-off fails for AI First without human* or rp-qg1-pass', function() {
      var result = computeReadiness(readyFeature({ labels: ['strat-creator-auto-created'] }))
      var signOff = result.fpdor.items.find(function(i) { return i.name === 'Feature human sign-off' })
      expect(signOff.pass).toBe(false)
      expect(result.isReady).toBe(false)
    })

    // --- Cross-team deps / Docs impact / UXD ---

    it('cross-team deps passes with ≥2 eng components (Docs/UXD excluded)', function() {
      var result = computeReadiness(readyFeature({ components: ['Platform', 'Serving', 'Documentation', 'UXD'] }))
      var engItem = result.fpdor.items.find(function(i) { return i.name === 'Cross-team deps' })
      expect(engItem.pass).toBe(true)
    })

    it('cross-team deps fails with only Documentation and UXD', function() {
      var result = computeReadiness(readyFeature({ components: ['Documentation', 'UXD'], docsRequired: 'Yes' }))
      var engItem = result.fpdor.items.find(function(i) { return i.name === 'Cross-team deps' })
      expect(engItem.pass).toBe(false)
    })

    it('cross-team deps passes with single eng component plus dependency signal', function() {
      var result = computeReadiness(readyFeature({
        components: ['Platform', 'Documentation', 'UXD'],
        docsRequired: 'Yes',
        descriptionSignals: {
          hasContent: true,
          signalCount: 3,
          hasAcceptanceCriteria: true,
          hasUseCases: true,
          hasScopeDefinition: true,
          hasRequirements: true,
          hasRisks: true,
          hasArchitectureSignal: true,
          hasCrossFunctionalDependency: true,
          matchedSections: []
        }
      }))
      var engItem = result.fpdor.items.find(function(i) { return i.name === 'Cross-team deps' })
      expect(engItem.pass).toBe(true)
    })

    it('docs impact passes for Docs Required Yes with Documentation component', function() {
      var result = computeReadiness(readyFeature({ components: ['Platform', 'Serving', 'UXD', 'Documentation'], docsRequired: 'Yes' }))
      var docsItem = result.fpdor.items.find(function(i) { return i.name === 'Docs impact' })
      expect(docsItem.pass).toBe(true)
    })

    it('docs impact passes when Docs Required is No', function() {
      var result = computeReadiness(readyFeature({ components: ['Platform', 'Serving', 'UXD'], docsRequired: 'No' }))
      var docsItem = result.fpdor.items.find(function(i) { return i.name === 'Docs impact' })
      expect(docsItem.pass).toBe(true)
    })

    it('docs impact fails when Docs Required is Yes without Documentation component', function() {
      var result = computeReadiness(readyFeature({ components: ['Platform', 'Serving', 'UXD'], docsRequired: 'Yes' }))
      var docsItem = result.fpdor.items.find(function(i) { return i.name === 'Docs impact' })
      expect(docsItem.pass).toBe(false)
    })

    it('docs impact fails when Docs Required unset', function() {
      var result = computeReadiness(readyFeature({ components: ['Platform', 'Serving', 'UXD'], docsRequired: null }))
      var docsItem = result.fpdor.items.find(function(i) { return i.name === 'Docs impact' })
      expect(docsItem.pass).toBe(false)
    })

    it('docs impact ignores unverified rp-qg1-pass without fields', function() {
      var result = computeReadiness(readyFeature({
        components: ['Platform', 'Serving', 'UXD'],
        docsRequired: null,
        labels: ['rp-qg1-pass']
      }))
      var docsItem = result.fpdor.items.find(function(i) { return i.name === 'Docs impact' })
      expect(docsItem.pass).toBe(false)
    })

    it('docs impact passes via bot-verified rp-qg1-pass without fields', function() {
      var result = computeReadiness(readyFeature({
        components: ['Platform', 'Serving', 'UXD'],
        docsRequired: null,
        labels: ['rp-qg1-pass'],
        qg1PassVerified: true
      }))
      var docsItem = result.fpdor.items.find(function(i) { return i.name === 'Docs impact' })
      expect(docsItem.pass).toBe(true)
      expect(docsItem.detail).toContain('rp-qg1-pass')
    })

    it('mandatory shortcuts ignore hand-applied rp-qg1-pass', function() {
      var result = computeReadiness(readyFeature({
        targetVersions: [],
        releaseType: null,
        priority: null,
        riceScore: null,
        docsRequired: null,
        labels: ['rp-qg1-pass']
      }))
      expect(result.isReady).toBe(false)
      expect(result.fpdor.items.find(function(i) { return i.name === 'Target Version' }).pass).toBe(false)
      expect(result.fpdor.items.find(function(i) { return i.name === 'RICE' }).pass).toBe(false)
    })

    it('mandatory shortcuts accept bot-verified rp-qg1-pass', function() {
      var result = computeReadiness(readyFeature({
        targetVersions: [],
        releaseType: null,
        priority: null,
        riceScore: null,
        docsRequired: null,
        labels: ['rp-qg1-pass'],
        qg1PassVerified: true
      }))
      expect(result.fpdor.items.find(function(i) { return i.name === 'Target Version' }).pass).toBe(true)
      expect(result.fpdor.items.find(function(i) { return i.name === 'Release Type' }).pass).toBe(true)
      expect(result.fpdor.items.find(function(i) { return i.name === 'Priority' }).pass).toBe(true)
      expect(result.fpdor.items.find(function(i) { return i.name === 'RICE' }).pass).toBe(true)
      expect(result.fpdor.items.find(function(i) { return i.name === 'Docs impact' }).pass).toBe(true)
    })

    it('AI First sign-off ignores unverified rp-qg1-pass', function() {
      var result = computeReadiness(readyFeature({
        labels: ['strat-creator-auto-created', 'rp-qg1-pass']
      }))
      var signOff = result.fpdor.items.find(function(i) { return i.name === 'Feature human sign-off' })
      expect(signOff.pass).toBe(false)
    })

    it('AI First sign-off passes via bot-verified rp-qg1-pass', function() {
      var result = computeReadiness(readyFeature({
        labels: ['strat-creator-auto-created', 'rp-qg1-pass'],
        qg1PassVerified: true
      }))
      var signOff = result.fpdor.items.find(function(i) { return i.name === 'Feature human sign-off' })
      expect(signOff.pass).toBe(true)
      expect(signOff.detail).toContain('rp-qg1-pass')
    })

    it('UXD is not-checked without UXD component or N/A note', function() {
      var result = computeReadiness(readyFeature({ components: ['Platform', 'Serving', 'Documentation'], docsRequired: 'Yes' }))
      var uxdItem = result.fpdor.items.find(function(i) { return i.name === 'UXD' })
      expect(uxdItem.pass).toBeNull()
    })

    it('UXD passes with UXD component', function() {
      var result = computeReadiness(readyFeature({ components: ['Platform', 'Serving', 'UXD'] }))
      var uxdItem = result.fpdor.items.find(function(i) { return i.name === 'UXD' })
      expect(uxdItem.pass).toBe(true)
    })

    it('UXD passes via N/A – no UX in description signals', function() {
      var result = computeReadiness(readyFeature({
        components: ['Platform', 'Serving', 'Documentation'],
        docsRequired: 'Yes',
        descriptionSignals: Object.assign({}, readyFeature().descriptionSignals, { hasNaNoUx: true })
      }))
      var uxdItem = result.fpdor.items.find(function(i) { return i.name === 'UXD' })
      expect(uxdItem.pass).toBe(true)
      expect(uxdItem.detail).toMatch(/N\/A/i)
    })

    // --- Requirements / AC / Risks / Arch (labels then description; no rubric scores) ---

    it('requirements clarity passes via strat-creator-rubric-pass (not scores)', function() {
      var result = computeReadiness(readyFeature({
        scores: {},
        descriptionSignals: { hasContent: true, signalCount: 0, hasRequirements: false, hasUseCases: false, hasScopeDefinition: false, hasAcceptanceCriteria: false, hasRisks: false, hasArchitectureSignal: false, matchedSections: [] },
        labels: ['strat-creator-rubric-pass']
      }))
      var reqItem = result.fpdor.items.find(function(i) { return i.name === 'Requirements clarity' })
      expect(reqItem.pass).toBe(true)
      expect(reqItem.detail).toContain('strat-creator-rubric-pass')
    })

    it('requirements clarity ignores low rubric scores and uses description', function() {
      var result = computeReadiness(readyFeature({
        scores: { scope: 1, testability: 1, architecture: 1, feasibility: 1 },
        descriptionSignals: {
          hasContent: true,
          hasRequirements: true,
          hasUseCases: false,
          hasScopeDefinition: false,
          hasAcceptanceCriteria: true,
          hasRisks: true,
          hasArchitectureSignal: true,
          matchedSections: [{ kind: 'requirements', title: 'Problem Statement' }]
        }
      }))
      var reqItem = result.fpdor.items.find(function(i) { return i.name === 'Requirements clarity' })
      expect(reqItem.pass).toBe(true)
      expect(reqItem.detail).toContain('description')
    })

    it('requirements clarity fails without label or requirement-oriented signals', function() {
      var result = computeReadiness(readyFeature({
        scores: {},
        labels: [],
        descriptionSignals: {
          hasContent: true,
          signalCount: 1,
          hasRequirements: false,
          hasUseCases: false,
          hasScopeDefinition: false,
          hasAcceptanceCriteria: true,
          hasRisks: true,
          hasArchitectureSignal: false,
          matchedSections: []
        }
      }))
      var reqItem = result.fpdor.items.find(function(i) { return i.name === 'Requirements clarity' })
      expect(reqItem.pass).toBe(false)
    })

    it('acceptance criteria passes via description Success Criteria section', function() {
      var result = computeReadiness(readyFeature({
        scores: {},
        labels: [],
        descriptionSignals: {
          hasContent: true,
          hasAcceptanceCriteria: true,
          hasRequirements: true,
          hasUseCases: true,
          hasScopeDefinition: true,
          hasRisks: true,
          hasArchitectureSignal: true,
          matchedSections: [{ kind: 'acceptanceCriteria', title: 'Success Criteria' }]
        }
      }))
      var acItem = result.fpdor.items.find(function(i) { return i.name === 'Acceptance criteria' })
      expect(acItem.pass).toBe(true)
      expect(acItem.detail).toContain('Success Criteria')
    })

    it('architectural alignment is not-checked without signals', function() {
      var result = computeReadiness(readyFeature({
        scores: {},
        labels: [],
        descriptionSignals: {
          hasContent: true,
          hasAcceptanceCriteria: true,
          hasRequirements: true,
          hasUseCases: true,
          hasScopeDefinition: true,
          hasRisks: true,
          hasArchitectureSignal: false,
          hasArchitectureNotRequired: false,
          matchedSections: []
        }
      }))
      var archItem = result.fpdor.items.find(function(i) { return i.name === 'Architectural alignment' })
      expect(archItem.pass).toBeNull()
    })

    it('architectural alignment passes when architecture not required', function() {
      var result = computeReadiness(readyFeature({
        scores: {},
        labels: [],
        descriptionSignals: Object.assign({}, readyFeature().descriptionSignals, {
          hasArchitectureSignal: false,
          hasArchitectureNotRequired: true
        })
      }))
      var archItem = result.fpdor.items.find(function(i) { return i.name === 'Architectural alignment' })
      expect(archItem.pass).toBe(true)
    })

    it('priority passes via field; Components passes with eng component', function() {
      var result = computeReadiness(readyFeature({ priority: 'Critical' }))
      expect(result.fpdor.items.find(function(i) { return i.name === 'Priority' }).pass).toBe(true)
      expect(result.fpdor.items.find(function(i) { return i.name === 'Components' }).pass).toBe(true)
      expect(result.fpdor.items.find(function(i) { return i.name === 'Delivery Owner' }).pass).toBe(true)
      expect(result.fpdor.items.find(function(i) { return i.name === 'PM' }).pass).toBe(true)
    })

    it('FPDoR has 17 items total', function() {
      var result = computeReadiness(readyFeature())
      expect(result.fpdor.totalCount).toBe(17)
      expect(result.fpdor.items).toHaveLength(17)
    })
  })

  // -------------------------------------------------------------------------
  // Cache-based feature discovery (health-pipeline features)
  // -------------------------------------------------------------------------

  describe('cache-based feature discovery', function() {
    it('discovers features in health cache but not in ai-impact', async function() {
      var store = makeFeaturesStore({})
      var healthCache = {
        features: [{ key: 'AIPCC-100', summary: 'AIPCC Feature', status: 'In Progress', priority: 'Major', deliveryOwner: 'Alice', blockerCount: 0, targetRelease: 'rhoai-3.6' }]
      }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache
      })
      var result = await buildFeatureReadiness(readFromStorage)
      expect(result.ready.length + result.pendingReview.length).toBe(1)
      var feat = result.ready[0] || result.pendingReview[0]
      expect(feat.key).toBe('AIPCC-100')
      expect(feat.dataSource).toBe('health-pipeline')
      expect(feat.recommendation).toBeNull()
      expect(feat.rubricTotal).toBe(0)
    })

    it('health-pipeline feature always goes to pendingReview (no approval/rubric)', async function() {
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
      var result = await buildFeatureReadiness(readFromStorage)
      expect(result.pendingReview).toHaveLength(1)
      expect(result.pendingReview[0].key).toBe('AIPCC-200')
    })

    it('health-pipeline feature missing owner goes to pendingReview', async function() {
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
      var result = await buildFeatureReadiness(readFromStorage)
      expect(result.pendingReview).toHaveLength(1)
      expect(result.pendingReview[0].key).toBe('AIPCC-300')
    })

    it('strat-creator features get dataSource strat-creator', async function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var healthCache = {
        features: [{ key: 'RHAISTRAT-1', deliveryOwner: 'Alice', pmOwner: 'Jane', targetRelease: 'rhoai-3.6', priorityScore: 70, storyPoints: 5, epicCount: 3, releaseType: 'GA', components: ['Platform', 'Serving', 'UXD', 'Documentation'], docsRequired: 'Yes' }]
      }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache
      })
      var result = await buildFeatureReadiness(readFromStorage)
      expect(result.ready[0].dataSource).toBe('strat-creator')
    })

    it('feature in both ai-impact and health cache is NOT duplicated', async function() {
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
      var result = await buildFeatureReadiness(readFromStorage)
      var allFeatures = result.ready.concat(result.pendingReview)
      var keys = allFeatures.map(function(f) { return f.key })
      expect(keys).toHaveLength(2)
      expect(keys).toContain('RHAISTRAT-1')
      expect(keys).toContain('AIPCC-100')
    })

    it('health-pipeline features get batch-computed priority score', async function() {
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
      var result = await buildFeatureReadiness(readFromStorage)
      var feat = result.pendingReview[0]
      expect(typeof feat.effectivePriorityScore).toBe('number')
      expect(feat.effectivePriorityScore).toBeGreaterThan(0)
    })

    it('readinessGates are populated on health-pipeline features', async function() {
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
      var result = await buildFeatureReadiness(readFromStorage)
      var feat = result.pendingReview[0]
      expect(typeof feat.readinessGates.fpDorPassed).toBe('number')
      expect(typeof feat.readinessGates.fpDorTotal).toBe('number')
      expect(typeof feat.readinessGates.fpDorEvaluated).toBe('number')
      expect(feat.readinessGates.pastRefinement).toBe(false)
      expect(feat.readinessGates.noBlockingViolations).toBe(true)
    })

    it('works when no AI review data exists', async function() {
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
      var result = await buildFeatureReadiness(readFromStorage)
      expect(result.pendingReview).toHaveLength(1)
      expect(result.pendingReview[0].key).toBe('AIPCC-900')
    })

    it('meta counts include health-pipeline features', async function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var healthCache = {
        features: [
          { key: 'RHAISTRAT-1', deliveryOwner: 'Alice', pmOwner: 'Jane', targetRelease: 'rhoai-3.6', priorityScore: 70, storyPoints: 5, epicCount: 3, releaseType: 'GA', components: ['Platform', 'Serving', 'UXD', 'Documentation'], docsRequired: 'Yes' },
          { key: 'AIPCC-1000', summary: 'AIPCC Ready', status: 'In Progress', priority: 'Major', deliveryOwner: 'Alice', blockerCount: 0, targetRelease: 'rhoai-3.6' }
        ]
      }
      var readFromStorage = makeReadFromStorage({
        ...convertToUnifiedFormat(store),
        'releases/planning/config.json': CONFIG_3_6,
        'releases/planning/health-cache-3.6-all.json': healthCache
      })
      var result = await buildFeatureReadiness(readFromStorage)
      expect(result.meta.total).toBe(2)
      expect(result.meta.readyCount).toBe(1)
    })
  })

  describe('hygiene alias lookup', function() {
    it('finds hygiene cache via registry displayName when config key differs', async function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var violations = [{ id: 'stale-status-summary', name: 'Stale', category: 'timeliness', message: 'Stale' }]
      var hygieneCache = {
        features: { 'RHAISTRAT-1': { key: 'RHAISTRAT-1', team: 'Alpha', violations: violations } }
      }
      var healthCache = { features: [{ key: 'RHAISTRAT-1', deliveryOwner: 'Alice', pmOwner: 'Jane', targetRelease: 'rhoai-3.6', priorityScore: null, storyPoints: 5, epicCount: 3, releaseType: 'GA', components: ['Platform', 'Serving', 'UXD', 'Documentation'], docsRequired: 'Yes' }] }
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
      var result = await buildFeatureReadiness(readFromStorage)
      var feat = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-1' })
      expect(feat.violations).toEqual(violations)
    })

    it('finds hygiene cache via registry id alias', async function() {
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
      var result = await buildFeatureReadiness(readFromStorage)
      expect(result.pendingReview[0].violations).toEqual(violations)
      expect(result.pendingReview[0].readinessGates.noBlockingViolations).toBe(true)
    })

    it('prefers direct config key match over alias', async function() {
      var store = makeFeaturesStore({
        'RHAISTRAT-1': { latest: makeLatest({ humanReviewStatus: 'approved' }) }
      })
      var directViolations = [{ id: 'stale-status-summary', name: 'Direct', category: 'timeliness', message: 'Direct' }]
      var aliasViolations = [{ id: 'missing-assignee', name: 'Alias', category: 'ownership', message: 'Alias' }]
      var healthCache = { features: [{ key: 'RHAISTRAT-1', deliveryOwner: 'Alice', pmOwner: 'Jane', targetRelease: 'rhoai-3.6', priorityScore: null, storyPoints: 5, epicCount: 3, releaseType: 'GA', components: ['Platform', 'Serving', 'UXD', 'Documentation'], docsRequired: 'Yes' }] }
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
      var result = await buildFeatureReadiness(readFromStorage)
      var feat = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-1' })
      expect(feat.violations).toEqual(directViolations)
    })
  })

  describe('hygieneIndex independent of teamIndex', function() {
    it('indexes violations separately from team across versions', async function() {
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
      var result = await buildFeatureReadiness(readFromStorage)
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

    it('collects project into allProjects when provided', function() {
      var allProjects = new Set()
      collectFilterMeta(
        { project: 'RHAIENG', bigRock: '', priority: null, components: [], targetVersions: [], fixVersion: '', team: '' },
        [], new Set(), new Set(), new Set(), new Set(), new Set(), allProjects
      )
      expect(allProjects.has('RHAIENG')).toBe(true)
    })
  })

  describe('isHiddenFromFeaturesList', function() {
    it('hides Closed, Done, Resolved, and Cancelled', function() {
      expect(isHiddenFromFeaturesList('Closed')).toBe(true)
      expect(isHiddenFromFeaturesList('Done')).toBe(true)
      expect(isHiddenFromFeaturesList('Resolved')).toBe(true)
      expect(isHiddenFromFeaturesList('Cancelled')).toBe(true)
    })

    it('keeps active planning statuses', function() {
      expect(isHiddenFromFeaturesList('In Progress')).toBe(false)
      expect(isHiddenFromFeaturesList('New')).toBe(false)
      expect(isHiddenFromFeaturesList('Refinement')).toBe(false)
      expect(isHiddenFromFeaturesList(null)).toBe(false)
    })
  })

  describe('shouldIncludeInCanonical', function() {
    it('never includes Cancelled', function() {
      expect(shouldIncludeInCanonical('Cancelled', false)).toBe(false)
      expect(shouldIncludeInCanonical('Cancelled', true)).toBe(false)
    })

    it('excludes Closed/Done/Resolved when includeClosed is false', function() {
      expect(shouldIncludeInCanonical('Closed', false)).toBe(false)
      expect(shouldIncludeInCanonical('Done', false)).toBe(false)
      expect(shouldIncludeInCanonical('Resolved', false)).toBe(false)
      expect(shouldIncludeInCanonical('In Progress', false)).toBe(true)
    })

    it('keeps Closed/Done/Resolved when includeClosed is true', function() {
      expect(shouldIncludeInCanonical('Closed', true)).toBe(true)
      expect(shouldIncludeInCanonical('Done', true)).toBe(true)
      expect(shouldIncludeInCanonical('Resolved', true)).toBe(true)
      expect(shouldIncludeInCanonical('In Progress', true)).toBe(true)
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

  it('includes execution index features not in caches or ai-impact', async function() {
    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(makeFeaturesStore({})),
      'releases/planning/config.json': CONFIG_3_6,
      'releases/execution/index.json': makeExecIndex([
        makeExecFeature('RHAISTRAT-999')
      ])
    })

    var result = await buildFeatureReadiness(readFromStorage)
    expect(result.meta.total).toBe(1)
    expect(result.pendingReview[0].key).toBe('RHAISTRAT-999')
    expect(result.pendingReview[0].dataSource).toBe('execution')
    expect(result.pendingReview[0].title).toBe('Exec Feature RHAISTRAT-999')
    expect(result.pendingReview[0].deliveryOwner).toBe('Jane Doe')
    expect(result.pendingReview[0].team).toBe('Platform')
  })

  it('execution feature with sign-off but no rubric goes to pendingReview', async function() {
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

    var result = await buildFeatureReadiness(readFromStorage)
    expect(result.pendingReview.length).toBe(1)
    expect(result.pendingReview[0].confidence).toBe('not-ready')
    expect(result.pendingReview[0].humanReviewStatus).toBe('approved')
    expect(typeof result.pendingReview[0].readinessGates.fpDorPassed).toBe('number')
    expect(typeof result.pendingReview[0].readinessGates.fpDorEvaluated).toBe('number')
  })

  it('execution feature in Refinement status is not ready', async function() {
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

    var result = await buildFeatureReadiness(readFromStorage)
    expect(result.pendingReview.length).toBe(1)
    expect(result.pendingReview[0].readinessGates.pastRefinement).toBe(false)
  })

  it('skips closed features from execution index', async function() {
    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(makeFeaturesStore({})),
      'releases/planning/config.json': CONFIG_3_6,
      'releases/execution/index.json': makeExecIndex([
        makeExecFeature('RHAISTRAT-666', { status: 'Closed' }),
        makeExecFeature('RHAISTRAT-667', { status: 'Resolved' }),
        makeExecFeature('RHAISTRAT-668', { status: 'In Progress' })
      ])
    })

    var result = await buildFeatureReadiness(readFromStorage)
    expect(result.meta.total).toBe(1)
    expect(result.pendingReview[0].key).toBe('RHAISTRAT-668')
  })

  it('does not duplicate features already in strat-creator pass', async function() {
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

    var result = await buildFeatureReadiness(readFromStorage)
    var keys = result.pendingReview.concat(result.ready).map(function(f) { return f.key })
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('does not duplicate features already in health-pipeline pass', async function() {
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

    var result = await buildFeatureReadiness(readFromStorage)
    var keys = result.pendingReview.concat(result.ready).map(function(f) { return f.key })
    expect(new Set(keys).size).toBe(keys.length)
    var feature = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-50' })
    expect(feature.dataSource).toBe('health-pipeline')
  })

  it('populates filter metadata from execution features', async function() {
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

    var result = await buildFeatureReadiness(readFromStorage)
    expect(result.filterMeta.components).toContain('NewComp')
    expect(result.filterMeta.teams).toContain('NewTeam')
    expect(result.filterMeta.priorities).toContain('Blocker')
    expect(result.filterMeta.targetVersions).toContain('rhoai-4.0')
  })

  it('execution feature with fix version still goes to pendingReview (no rubric)', async function() {
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

    var result = await buildFeatureReadiness(readFromStorage)
    expect(result.pendingReview[0].confidence).toBe('not-ready')
    expect(result.pendingReview[0].fixVersion).toBe('rhoai-3.6')
  })

  it('handles string components from execution index', async function() {
    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(makeFeaturesStore({})),
      'releases/planning/config.json': CONFIG_3_6,
      'releases/execution/index.json': makeExecIndex([
        makeExecFeature('RHAISTRAT-222', { components: 'UI, API, Docs' })
      ])
    })

    var result = await buildFeatureReadiness(readFromStorage)
    expect(result.pendingReview[0].components).toEqual(['UI', 'API', 'Docs'])
  })

  it('handles multiple execution features sorted by priority score', async function() {
    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(makeFeaturesStore({})),
      'releases/planning/config.json': CONFIG_3_6,
      'releases/execution/index.json': makeExecIndex([
        makeExecFeature('RHAISTRAT-A', { priority: 'Minor' }),
        makeExecFeature('RHAISTRAT-B', { priority: 'Blocker' }),
        makeExecFeature('RHAISTRAT-C', { priority: 'Major' })
      ])
    })

    var result = await buildFeatureReadiness(readFromStorage)
    expect(result.pendingReview.length).toBe(3)
    expect(result.pendingReview[0].key).toBe('RHAISTRAT-B')
    expect(result.pendingReview[result.pendingReview.length - 1].key).toBe('RHAISTRAT-A')
  })

  it('handles empty execution index gracefully', async function() {
    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(makeFeaturesStore({})),
      'releases/planning/config.json': CONFIG_3_6,
      'releases/execution/index.json': makeExecIndex([])
    })

    var result = await buildFeatureReadiness(readFromStorage)
    expect(result.meta.total).toBe(0)
  })

  it('handles missing execution index gracefully', async function() {
    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(makeFeaturesStore({})),
      'releases/planning/config.json': CONFIG_3_6
    })

    var result = await buildFeatureReadiness(readFromStorage)
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

  it('uses jiraFeatures as pass 3 source when provided', async function() {
    var jiraFeatures = makeJiraMap([
      makeJiraFeature('RHAISTRAT-900')
    ])
    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(makeFeaturesStore({})),
      'releases/planning/config.json': CONFIG_3_6,
      'releases/execution/index.json': makeExecIndex([])
    })

    var result = await buildFeatureReadiness(readFromStorage, jiraFeatures)
    expect(result.meta.total).toBe(1)
    expect(result.pendingReview[0].key).toBe('RHAISTRAT-900')
    expect(result.pendingReview[0].dataSource).toBe('jira')
    expect(result.pendingReview[0].title).toBe('Jira Feature RHAISTRAT-900')
  })

  it('prefers explicit jira epicCount for Child epics over stale exec count of 0', async function() {
    var jiraFeatures = makeJiraMap([
      makeJiraFeature('RHAISTRAT-2198', {
        epicCount: 2,
        components: ['Platform', 'Serving', 'UXD', 'Documentation'],
        docsRequired: 'Yes',
        labels: ['strat-creator-auto-created', 'strat-creator-human-sign-off', 'rp-qg1-pass'],
        riceScore: 50,
        releaseType: 'GA',
        pmOwner: 'Jane'
      })
    ])
    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(makeFeaturesStore({
        'RHAISTRAT-2198': {
          key: 'RHAISTRAT-2198',
          summary: 'Validated Models',
          status: 'In Progress',
          epicCount: 0
        }
      })),
      'releases/planning/config.json': CONFIG_3_6,
      'releases/execution/index.json': makeExecIndex([
        { key: 'RHAISTRAT-2198', epicCount: 0 }
      ])
    })

    var result = await buildFeatureReadiness(readFromStorage, jiraFeatures)
    var feature = result.pendingReview.concat(result.ready).find(function(f) {
      return f.key === 'RHAISTRAT-2198'
    })
    expect(feature).toBeTruthy()
    expect(feature.epicCount).toBe(2)
    var child = feature.fpdor.items.find(function(i) { return i.name === 'Child epics' })
    expect(child.pass).toBe(true)
  })

  it('uses exec epicCount when live jira omits epicCount (request path does not discover children)', async function() {
    var jiraFeature = makeJiraFeature('RHAISTRAT-1473', {
      components: ['Platform', 'Serving', 'UXD', 'Documentation'],
      docsRequired: 'Yes',
      labels: ['strat-creator-auto-created', 'strat-creator-human-sign-off', 'rp-qg1-pass'],
      riceScore: 50,
      releaseType: 'GA',
      pmOwner: 'Jane'
    })
    delete jiraFeature.epicCount
    var jiraFeatures = makeJiraMap([jiraFeature])
    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(makeFeaturesStore({})),
      'releases/planning/config.json': CONFIG_3_6,
      'releases/planning/health-cache-3.6-all.json': {
        features: [{
          key: 'RHAISTRAT-1473',
          deliveryOwner: 'Alice',
          pmOwner: 'Jane',
          targetRelease: 'rhoai-3.6',
          storyPoints: 5,
          epicCount: 0,
          releaseType: 'GA',
          components: ['Platform', 'Serving', 'UXD', 'Documentation'],
          docsRequired: 'Yes'
        }]
      },
      'releases/execution/index.json': makeExecIndex([
        {
          key: 'RHAISTRAT-1473',
          summary: 'Tool Calling',
          status: 'Release Pending',
          epicCount: 5,
          components: ['Platform', 'Serving', 'UXD', 'Documentation'],
          docsRequired: 'Yes',
          labels: ['strat-creator-auto-created', 'strat-creator-human-sign-off', 'rp-qg1-pass'],
          riceScore: 50,
          releaseType: 'GA',
          assignee: 'Alice',
          pm: 'Jane'
        }
      ])
    })

    var result = await buildFeatureReadiness(readFromStorage, jiraFeatures)
    var feature = result.pendingReview.concat(result.ready).find(function(f) {
      return f.key === 'RHAISTRAT-1473'
    })
    expect(feature).toBeTruthy()
    expect(feature.epicCount).toBe(5)
    var child = feature.fpdor.items.find(function(i) { return i.name === 'Child epics' })
    expect(child.pass).toBe(true)
  })

  it('falls back to execution index when jiraFeatures is null', async function() {
    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(makeFeaturesStore({})),
      'releases/planning/config.json': CONFIG_3_6,
      'releases/execution/index.json': makeExecIndex([
        makeExecFeature('RHAISTRAT-800')
      ])
    })

    var result = await buildFeatureReadiness(readFromStorage, null)
    expect(result.meta.total).toBe(1)
    expect(result.pendingReview[0].key).toBe('RHAISTRAT-800')
    expect(result.pendingReview[0].dataSource).toBe('execution')
  })

  it('falls back to execution index when jiraFeatures is empty Map', async function() {
    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(makeFeaturesStore({})),
      'releases/planning/config.json': CONFIG_3_6,
      'releases/execution/index.json': makeExecIndex([
        makeExecFeature('RHAISTRAT-700')
      ])
    })

    var result = await buildFeatureReadiness(readFromStorage, new Map())
    expect(result.meta.total).toBe(1)
    expect(result.pendingReview[0].key).toBe('RHAISTRAT-700')
    expect(result.pendingReview[0].dataSource).toBe('execution')
  })

  it('does not duplicate features already in strat-creator pass', async function() {
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

    var result = await buildFeatureReadiness(readFromStorage, jiraFeatures)
    var keys = result.pendingReview.concat(result.ready).map(function(f) { return f.key })
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('does not duplicate features already in health-pipeline pass', async function() {
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

    var result = await buildFeatureReadiness(readFromStorage, jiraFeatures)
    var keys = result.pendingReview.concat(result.ready).map(function(f) { return f.key })
    expect(new Set(keys).size).toBe(keys.length)
    var feature = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-50' })
    expect(feature.dataSource).toBe('health-pipeline')
  })

  it('enriches Jira features with execution index data when available', async function() {
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

    var result = await buildFeatureReadiness(readFromStorage, jiraFeatures)
    expect(result.meta.total).toBe(1)
    var feature = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-600' })
    expect(feature.dataSource).toBe('jira')
    expect(feature.riceScore).toBe(250)
    expect(typeof feature.readinessGates.fpDorPassed).toBe('number')
  })

  it('Jira feature with sign-off but no rubric goes to pendingReview', async function() {
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

    var result = await buildFeatureReadiness(readFromStorage, jiraFeatures)
    expect(result.pendingReview.length).toBe(1)
    expect(result.pendingReview[0].confidence).toBe('not-ready')
    expect(result.pendingReview[0].humanReviewStatus).toBe('approved')
    expect(typeof result.pendingReview[0].readinessGates.fpDorPassed).toBe('number')
    expect(typeof result.pendingReview[0].readinessGates.fpDorEvaluated).toBe('number')
  })

  it('Jira feature with fix version still goes to pendingReview (no rubric)', async function() {
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

    var result = await buildFeatureReadiness(readFromStorage, jiraFeatures)
    expect(result.pendingReview[0].confidence).toBe('not-ready')
    expect(result.pendingReview[0].fixVersion).toBe('rhoai-3.6')
  })

  it('skips closed Jira features', async function() {
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

    var result = await buildFeatureReadiness(readFromStorage, jiraFeatures)
    expect(result.meta.total).toBe(1)
    expect(result.pendingReview[0].key).toBe('RHAISTRAT-C3')
  })

  it('Jira feature in Refinement status is not ready', async function() {
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

    var result = await buildFeatureReadiness(readFromStorage, jiraFeatures)
    expect(result.pendingReview.length).toBe(1)
    expect(result.pendingReview[0].readinessGates.pastRefinement).toBe(false)
  })

  it('populates filter metadata from Jira features', async function() {
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

    var result = await buildFeatureReadiness(readFromStorage, jiraFeatures)
    expect(result.filterMeta.components).toContain('NewJiraComp')
    expect(result.filterMeta.teams).toContain('JiraTeam')
    expect(result.filterMeta.priorities).toContain('Critical')
    expect(result.filterMeta.targetVersions).toContain('rhoai-4.0')
  })

  it('prefers Jira riceScore over execution index riceScore', async function() {
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

    var result = await buildFeatureReadiness(readFromStorage, jiraFeatures)
    var feature = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-RICE' })
    expect(feature.riceScore).toBe(100)
  })

  it('uses execution index riceScore when Jira riceScore is null', async function() {
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

    var result = await buildFeatureReadiness(readFromStorage, jiraFeatures)
    var feature = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-RICE2' })
    expect(feature.riceScore).toBe(75)
  })

  it('includes Jira features not present in execution index', async function() {
    var jiraFeatures = makeJiraMap([
      makeJiraFeature('RHAISTRAT-JONLY', { summary: 'Jira only feature' })
    ])
    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(makeFeaturesStore({})),
      'releases/planning/config.json': CONFIG_3_6,
      'releases/execution/index.json': makeExecIndex([])
    })

    var result = await buildFeatureReadiness(readFromStorage, jiraFeatures)
    expect(result.meta.total).toBe(1)
    expect(result.pendingReview[0].title).toBe('Jira only feature')
  })

  it('handles multiple Jira features sorted by priority score', async function() {
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

    var result = await buildFeatureReadiness(readFromStorage, jiraFeatures)
    expect(result.pendingReview.length).toBe(3)
    expect(result.pendingReview[0].key).toBe('RHAISTRAT-J2')
    expect(result.pendingReview[result.pendingReview.length - 1].key).toBe('RHAISTRAT-J1')
  })

  it('Jira feature without assignee fails FPDoR owners check', async function() {
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

    var result = await buildFeatureReadiness(readFromStorage, jiraFeatures)
    expect(result.pendingReview.length).toBe(1)
    expect(result.pendingReview[0].readinessGates.fpDorPassed).toBeLessThan(result.pendingReview[0].readinessGates.fpDorEvaluated)
  })

  it('Jira feature without target version fails FPDoR target version check', async function() {
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

    var result = await buildFeatureReadiness(readFromStorage, jiraFeatures)
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

  it('loads team and violations from non-configured hygiene files via listStorageFiles', async function() {
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

    var result = await buildFeatureReadiness(readFromStorage, jiraFeatures, listStorageFiles)
    var feature = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-500' })
    expect(feature).toBeDefined()
    expect(feature.team).toBe('Llama Stack Core')
    expect(feature.violations).toEqual([{ id: 'missing-fix-version', name: 'Missing Fix Version' }])
  })

  it('does not overwrite team from configured version with non-configured version data', async function() {
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

    var result = await buildFeatureReadiness(readFromStorage, null, listStorageFiles)
    var feature = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-600' })
    expect(feature).toBeDefined()
    expect(feature.team).toBe('RHOAI Dashboard')
  })

  it('works without await listStorageFiles (backward compatible)', async function() {
    var readFromStorage = makeReadFromStorage({
      'ai-impact/features.json': makeFeaturesStore({}),
      'releases/planning/config.json': { releases: { '3.6': { release: '3.6' } } },
      'releases/execution/index.json': makeExecIndex([
        makeExecFeature('RHAISTRAT-700')
      ])
    })

    var result = await buildFeatureReadiness(readFromStorage, null)
    expect(result.pendingReview.concat(result.ready).length).toBeGreaterThan(0)
  })

  it('handles listStorageFiles throwing an error gracefully', async function() {
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

    var result = await buildFeatureReadiness(readFromStorage, null, listStorageFiles)
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

  it('pass 1: uses Jira team when teamIndex has no entry', async function() {
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

    var result = await buildFeatureReadiness(readFromStorage, jiraFeatures)
    var feature = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-1' })
    expect(feature).toBeDefined()
    expect(feature.team).toBe('JiraTeamFallback')
  })

  it('pass 1: uses Jira components when strat-creator and health-cache are empty', async function() {
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

    var result = await buildFeatureReadiness(readFromStorage, jiraFeatures)
    var feature = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-1' })
    expect(feature).toBeDefined()
    expect(feature.components).toEqual(['CompFromJira'])
  })

  it('pass 1: uses Jira assignee as deliveryOwner when healthData has none', async function() {
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

    var result = await buildFeatureReadiness(readFromStorage, jiraFeatures)
    var feature = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-1' })
    expect(feature).toBeDefined()
    expect(feature.deliveryOwner).toBe('JiraOwner')
  })

  it('pass 2: uses Jira team when teamIndex has no entry', async function() {
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

    var result = await buildFeatureReadiness(readFromStorage, jiraFeatures)
    var feature = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-HP1' })
    expect(feature).toBeDefined()
    expect(feature.team).toBe('JiraTeamHP')
  })

  it('pass 2: uses Jira components when health-cache components are empty', async function() {
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

    var result = await buildFeatureReadiness(readFromStorage, jiraFeatures)
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

  it('attaches cached violations from hygieneIndex', async function() {
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

    var result = await buildFeatureReadiness(readFromStorage, jiraFeatures)
    var feature = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-DYN2' })
    expect(feature).toBeDefined()
    expect(feature.violations).toEqual([{ id: 'cached-violation', name: 'Cached Violation' }])
  })

  it('returns null violations for features not in hygieneIndex', async function() {
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

    var result = await buildFeatureReadiness(readFromStorage, jiraFeatures)
    var feature = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-DYN1' })
    expect(feature).toBeDefined()
    expect(feature.violations).toBeNull()
  })

  it('returns null violations for execution index features', async function() {
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

    var result = await buildFeatureReadiness(readFromStorage, null)
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

  it('returns warning for missing-assignee (no longer blocking)', function() {
    expect(computeHygieneStatus([{ id: 'missing-assignee' }])).toBe('warning')
  })

  it('returns warning for open-children-on-closed (no longer blocking)', function() {
    expect(computeHygieneStatus([{ id: 'open-children-on-closed' }])).toBe('warning')
  })

  it('returns warning for missing-fix-version (no longer blocking)', function() {
    expect(computeHygieneStatus([{ id: 'missing-fix-version' }])).toBe('warning')
  })

  it('returns warning for missing-target-version (no longer blocking)', function() {
    expect(computeHygieneStatus([{ id: 'missing-target-version' }])).toBe('warning')
  })

  it('returns warning when mix includes formerly-blocking rules', function() {
    expect(computeHygieneStatus([
      { id: 'some-minor-issue' },
      { id: 'missing-assignee' }
    ])).toBe('warning')
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
    expect(r1.hygieneStatus).toBe('warning')

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



  it('feature with aiReview + Jira gets rubric scores AND Jira status', async function() {
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
    var result = await buildFeatureReadiness(readFromStorage, jiraFeatures)

    var all = result.pendingReview.concat(result.ready)
    var feature = all.find(function(f) { return f.key === 'RHAISTRAT-1' })
    expect(feature).toBeDefined()
    expect(feature.status).toBe('In Progress')
    expect(feature.priority).toBe('Critical')
    expect(feature.rubricTotal).toBe(8)
    expect(feature.dataSource).toBe('strat-creator')
  })

  it('feature with only Jira data appears on list', async function() {
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
    var result = await buildFeatureReadiness(readFromStorage, jiraFeatures)
    var feature = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-JIRA' })
    expect(feature).toBeDefined()
    expect(feature.dataSource).toBe('jira')
    expect(feature.status).toBe('In Progress')
    expect(feature.components).toEqual(['Backend'])
  })

  it('feature with null hygiene shows hygieneStatus unknown', async function() {
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
    var result = await buildFeatureReadiness(readFromStorage)
    var feature = result.pendingReview.concat(result.ready).find(function(f) { return f.key === 'RHAISTRAT-1' })
    expect(feature.hygieneStatus).toBe('unknown')
    expect(feature.violations).toBeNull()
  })

  it('meta includes jiraAvailable flag', async function() {
    var store = makeFeaturesStore({})
    var readFromStorage = makeReadFromStorage(convertToUnifiedFormat(store))

    var r1 = await buildFeatureReadiness(readFromStorage, null)
    expect(r1.meta.jiraAvailable).toBe(false)

    var r2 = await buildFeatureReadiness(readFromStorage, new Map())
    expect(r2.meta.jiraAvailable).toBe(true)
  })

  it('no feature is excluded — all sources contribute to canonical set', async function() {
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

    var result = await buildFeatureReadiness(readFromStorage, jiraFeatures)
    var allKeys = result.pendingReview.concat(result.ready).map(function(f) { return f.key })
    expect(allKeys).toContain('RHAISTRAT-AI')
    expect(allKeys).toContain('RHAISTRAT-JIRA')
    expect(allKeys).toContain('RHAISTRAT-HEALTH')
  })
})

// ---------------------------------------------------------------------------
// buildCanonicalFeatures (shared pipeline builder)
// ---------------------------------------------------------------------------

describe('buildCanonicalFeatures', function() {
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
      project: key.split('-')[0],
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

  it('includes RHAISTRAT and eng-project features with FPDoR fields', async function() {
    var jiraFeatures = makeJiraMap([
      makeJiraFeature('RHAISTRAT-100'),
      makeJiraFeature('RHAIENG-200', { project: 'RHAIENG', summary: 'Eng Initiative' }),
      makeJiraFeature('RHELAI-300', { project: 'RHELAI' })
    ])
    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(makeFeaturesStore({})),
      'releases/planning/config.json': CONFIG_3_6,
      'releases/execution/index.json': { features: [], fetchedAt: null, schemaVersion: 'v2', featureCount: 0 }
    })

    var result = await buildCanonicalFeatures({
      readFromStorage: readFromStorage,
      jiraFeatures: jiraFeatures,
      includeClosed: false
    })

    var keys = result.features.map(function(f) { return f.key }).sort()
    expect(keys).toEqual(['RHAIENG-200', 'RHAISTRAT-100', 'RHELAI-300'])
    result.features.forEach(function(f) {
      expect(f.fpdor).toBeTruthy()
      expect(f).toHaveProperty('confidence')
      expect(f).toHaveProperty('isAiFirst')
      expect(f).toHaveProperty('isReady')
      expect(f.project).toBeTruthy()
    })
  })

  it('excludes Closed by default but keeps them when includeClosed is true', async function() {
    var jiraFeatures = makeJiraMap([
      makeJiraFeature('RHAI-1', { project: 'RHAI', status: 'In Progress' }),
      makeJiraFeature('RHAI-2', { project: 'RHAI', status: 'Closed' }),
      makeJiraFeature('RHAI-3', { project: 'RHAI', status: 'Done' }),
      makeJiraFeature('RHAI-4', { project: 'RHAI', status: 'Cancelled' })
    ])
    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(makeFeaturesStore({})),
      'releases/planning/config.json': CONFIG_3_6,
      'releases/execution/index.json': { features: [], fetchedAt: null, schemaVersion: 'v2', featureCount: 0 }
    })

    var openOnly = await buildCanonicalFeatures({
      readFromStorage: readFromStorage,
      jiraFeatures: jiraFeatures,
      includeClosed: false
    })
    expect(openOnly.features.map(function(f) { return f.key })).toEqual(['RHAI-1'])

    var withClosed = await buildCanonicalFeatures({
      readFromStorage: readFromStorage,
      jiraFeatures: jiraFeatures,
      includeClosed: true
    })
    var withClosedKeys = withClosed.features.map(function(f) { return f.key }).sort()
    expect(withClosedKeys).toEqual(['RHAI-1', 'RHAI-2', 'RHAI-3'])
    expect(withClosedKeys).not.toContain('RHAI-4')
  })

  it('Features List path strips isReady and matches open-only canonical set', async function() {
    var jiraFeatures = makeJiraMap([
      makeJiraFeature('INFERENG-9', { project: 'INFERENG' }),
      makeJiraFeature('INFERENG-10', { project: 'INFERENG', status: 'Resolved' })
    ])
    var readFromStorage = makeReadFromStorage({
      ...convertToUnifiedFormat(makeFeaturesStore({})),
      'releases/planning/config.json': CONFIG_3_6,
      'releases/execution/index.json': { features: [], fetchedAt: null, schemaVersion: 'v2', featureCount: 0 }
    })

    var canonical = await buildCanonicalFeatures({
      readFromStorage: readFromStorage,
      jiraFeatures: jiraFeatures,
      includeClosed: false
    })
    var list = await buildFeatureReadiness(readFromStorage, jiraFeatures)
    var listKeys = list.pendingReview.concat(list.ready).map(function(f) { return f.key })

    expect(canonical.features.map(function(f) { return f.key })).toEqual(['INFERENG-9'])
    expect(listKeys).toEqual(['INFERENG-9'])
    expect(list.pendingReview.concat(list.ready)[0].isReady).toBeUndefined()
  })
})
