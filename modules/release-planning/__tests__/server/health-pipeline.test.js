import { describe, it, expect, vi } from 'vitest'

const {
  runHealthPipeline,
  loadFeaturesForRelease,
  loadFeaturesFromCandidates,
  loadMilestones,
  backfillFreezeDatesFromSmartsheet,
  deriveFreezeDates,
  computeMilestoneInfo,
  computePlanningDeadline,
  getFeaturePhase,
  buildEmptyCache,
  splitCommaString,
  passesPhaseFilter
} = require('../../server/health/health-pipeline')

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

describe('getFeaturePhase', function() {
  it('maps Tech Preview to TP', function() {
    expect(getFeaturePhase({ releaseType: 'Tech Preview' })).toBe('TP')
  })

  it('maps Developer Preview to DP', function() {
    expect(getFeaturePhase({ releaseType: 'Developer Preview' })).toBe('DP')
  })

  it('maps General Availability to GA', function() {
    expect(getFeaturePhase({ releaseType: 'General Availability' })).toBe('GA')
  })

  it('maps TP shorthand to TP', function() {
    expect(getFeaturePhase({ releaseType: 'TP' })).toBe('TP')
  })

  it('infers GA from fixVersions containing GA', function() {
    expect(getFeaturePhase({ fixVersions: ['rhoai-3.5 GA'] })).toBe('GA')
  })

  it('infers TP from fixVersions containing EA1', function() {
    expect(getFeaturePhase({ fixVersions: ['rhoai-3.5-EA1'] })).toBe('TP')
  })

  it('infers DP from fixVersions containing EA2', function() {
    expect(getFeaturePhase({ fixVersions: ['rhoai-3.5-EA2'] })).toBe('DP')
  })

  it('returns empty string when no releaseType or matching fixVersions', function() {
    expect(getFeaturePhase({ fixVersions: [] })).toBe('')
    expect(getFeaturePhase({})).toBe('')
  })
})

describe('computeMilestoneInfo', function() {
  var milestones = {
    ea1Freeze: '2026-05-01',
    ea1Target: '2026-05-15',
    ea2Freeze: '2026-06-15',
    ea2Target: '2026-07-01',
    gaFreeze: '2026-08-01',
    gaTarget: '2026-08-15'
  }

  it('returns Unknown when milestones is null', function() {
    var result = computeMilestoneInfo(null, new Date())
    expect(result.currentPhase).toBe('Unknown')
    expect(result.daysToNextMilestone).toBeNull()
    expect(result.nextMilestone).toBeNull()
  })

  it('returns Pre-EA1 for dates before ea1Freeze', function() {
    var result = computeMilestoneInfo(milestones, new Date('2026-04-15T12:00:00Z'))
    expect(result.currentPhase).toBe('Pre-EA1')
    expect(result.nextMilestone).toBe('EA1 Code Freeze')
  })

  it('returns EA1 Freeze when today is after ea1Freeze', function() {
    var result = computeMilestoneInfo(milestones, new Date('2026-05-05T12:00:00Z'))
    expect(result.currentPhase).toBe('EA1 Freeze')
    expect(result.nextMilestone).toBe('EA1 Release')
  })

  it('returns Post-GA when after gaTarget', function() {
    var result = computeMilestoneInfo(milestones, new Date('2026-09-01T12:00:00Z'))
    expect(result.currentPhase).toBe('Post-GA')
    expect(result.nextMilestone).toBeNull()
  })

  it('computes correct daysToNextMilestone', function() {
    var result = computeMilestoneInfo(milestones, new Date('2026-04-28T12:00:00Z'))
    expect(result.daysToNextMilestone).toBe(3)
    expect(result.nextMilestone).toBe('EA1 Code Freeze')
  })
})

describe('buildEmptyCache', function() {
  it('returns correct structure with zero counts', function() {
    var cache = buildEmptyCache('3.5', ['some warning'])
    expect(cache.version).toBe('3.5')
    expect(cache.cachedAt).toBeDefined()
    expect(cache.milestones).toBeNull()
    expect(cache.summary.totalFeatures).toBe(0)
    expect(cache.summary.byRisk).toEqual({ green: 0, yellow: 0, red: 0 })
    expect(cache.summary.dorCompletionRate).toBe(0)
    expect(cache.summary.averageRiceScore).toBeNull()
    expect(cache.features).toEqual([])
    expect(cache.enrichmentStatus.warnings).toContain('some warning')
  })
})

describe('splitCommaString', function() {
  it('returns empty array for null', function() {
    expect(splitCommaString(null)).toEqual([])
  })

  it('returns empty array for empty string', function() {
    expect(splitCommaString('')).toEqual([])
  })

  it('splits and trims comma-separated values', function() {
    expect(splitCommaString('A, B, C')).toEqual(['A', 'B', 'C'])
  })

  it('filters out empty segments', function() {
    expect(splitCommaString('A,,B')).toEqual(['A', 'B'])
  })

  it('returns single item for no comma', function() {
    expect(splitCommaString('OnlyOne')).toEqual(['OnlyOne'])
  })
})

describe('passesPhaseFilter', function() {
  it('passes all features when phase is null', function() {
    expect(passesPhaseFilter({ fixVersion: 'rhoai-3.5-EA2' }, '3.5', null)).toBe(true)
  })

  it('passes features without phase-specific fixVersion', function() {
    expect(passesPhaseFilter({ fixVersion: 'rhoai-3.5' }, '3.5', 'EA2')).toBe(true)
  })

  it('passes features with matching phase fixVersion', function() {
    expect(passesPhaseFilter({ fixVersion: 'rhoai-3.5-EA2' }, '3.5', 'EA2')).toBe(true)
  })

  it('rejects features with different phase fixVersion', function() {
    expect(passesPhaseFilter({ fixVersion: 'rhoai-3.5-EA1' }, '3.5', 'EA2')).toBe(false)
  })

  it('handles empty fixVersion', function() {
    expect(passesPhaseFilter({ fixVersion: '' }, '3.5', 'EA1')).toBe(true)
  })
})

describe('computePlanningDeadline', function() {
  var milestones = {
    ea1Freeze: '2026-05-01',
    ea2Freeze: '2026-06-18',
    gaFreeze: '2026-08-01'
  }

  it('returns null when milestones is null', function() {
    expect(computePlanningDeadline(null, 'EA1')).toBeNull()
  })

  it('returns null when phase is null', function() {
    expect(computePlanningDeadline(milestones, null)).toBeNull()
  })

  it('computes deadline as freeze minus 7 days for EA1', function() {
    var result = computePlanningDeadline(milestones, 'EA1')
    expect(result.date).toBe('2026-04-24')
  })

  it('computes deadline as freeze minus 7 days for EA2', function() {
    var result = computePlanningDeadline(milestones, 'EA2')
    expect(result.date).toBe('2026-06-11')
  })

  it('computes deadline as freeze minus 7 days for GA', function() {
    var result = computePlanningDeadline(milestones, 'GA')
    expect(result.date).toBe('2026-07-25')
  })

  it('returns null for unknown phase', function() {
    expect(computePlanningDeadline(milestones, 'XYZ')).toBeNull()
  })
})

describe('loadFeaturesFromCandidates', function() {
  it('returns warning when candidates cache is empty', function() {
    var storage = makeStorage({})
    var result = loadFeaturesFromCandidates(storage.readFromStorage, '3.5', null)
    expect(result.features).toEqual([])
    expect(result.warnings[0]).toContain('No candidates found')
  })

  it('maps candidate fields to health feature shape', function() {
    var storage = makeStorage({
      'release-planning/candidates-cache-3.5.json': {
        cachedAt: '2026-04-26T00:00:00Z',
        data: {
          features: [{
            issueKey: 'RHOAIENG-1001',
            summary: 'Feature 1',
            status: 'In Progress',
            priority: 'Major',
            phase: 'GA',
            components: 'Backend, API',
            fixVersion: 'rhoai-3.5',
            targetRelease: 'rhoai-3.5',
            deliveryOwner: 'Jane',
            pm: 'Bob',
            bigRock: 'MaaS',
            tier: 1,
            labels: 'test, feature',
            rfe: 'RHAIRFE-100'
          }]
        }
      }
    })
    var result = loadFeaturesFromCandidates(storage.readFromStorage, '3.5', null)
    expect(result.features).toHaveLength(1)
    var f = result.features[0]
    expect(f.key).toBe('RHOAIENG-1001')
    expect(f.components).toEqual(['Backend', 'API'])
    expect(f.fixVersions).toEqual(['rhoai-3.5'])
    expect(f.targetVersions).toEqual(['rhoai-3.5'])
    expect(f.assignee).toBe('Jane')
    expect(f.deliveryOwner).toBe('Jane')
    expect(f.tier).toBe(1)
    expect(f.bigRock).toBe('MaaS')
    expect(f.labels).toEqual(['test', 'feature'])
  })

  it('excludes closed features', function() {
    var storage = makeStorage({
      'release-planning/candidates-cache-3.5.json': {
        cachedAt: '2026-04-26T00:00:00Z',
        data: {
          features: [
            { issueKey: 'T-1', status: 'Closed', components: '', fixVersion: '', tier: 1 },
            { issueKey: 'T-2', status: 'In Progress', components: '', fixVersion: '', tier: 1 }
          ]
        }
      }
    })
    var result = loadFeaturesFromCandidates(storage.readFromStorage, '3.5', null)
    expect(result.features).toHaveLength(1)
    expect(result.features[0].key).toBe('T-2')
  })

  it('applies phase filter', function() {
    var storage = makeStorage({
      'release-planning/candidates-cache-3.5.json': {
        cachedAt: '2026-04-26T00:00:00Z',
        data: {
          features: [
            { issueKey: 'T-1', status: 'In Progress', components: '', fixVersion: 'rhoai-3.5-EA1', tier: 1 },
            { issueKey: 'T-2', status: 'In Progress', components: '', fixVersion: 'rhoai-3.5-EA2', tier: 1 },
            { issueKey: 'T-3', status: 'In Progress', components: '', fixVersion: 'rhoai-3.5', tier: 1 }
          ]
        }
      }
    })
    var result = loadFeaturesFromCandidates(storage.readFromStorage, '3.5', 'EA2')
    expect(result.features).toHaveLength(2)
    var keys = result.features.map(function(f) { return f.key })
    expect(keys).toContain('T-2')
    expect(keys).toContain('T-3')
    expect(keys).not.toContain('T-1')
  })
})

describe('loadFeaturesForRelease', function() {
  it('returns warning when index is empty', function() {
    var storage = makeStorage({})
    var result = loadFeaturesForRelease(storage.readFromStorage, '3.5')
    expect(result.features).toEqual([])
    expect(result.warnings).toContain('Feature-traffic index is empty -- run a feature-traffic refresh first')
  })

  it('filters features by targetVersions match', function() {
    var storage = makeStorage({
      'feature-traffic/index.json': {
        features: [
          { key: 'T-1', targetVersions: ['rhoai-3.5'], fixVersions: [], status: 'In Progress' },
          { key: 'T-2', targetVersions: ['rhoai-3.6'], fixVersions: [], status: 'In Progress' }
        ]
      }
    })
    var result = loadFeaturesForRelease(storage.readFromStorage, '3.5')
    expect(result.features).toHaveLength(1)
    expect(result.features[0].key).toBe('T-1')
  })

  it('filters features by fixVersions match', function() {
    var storage = makeStorage({
      'feature-traffic/index.json': {
        features: [
          { key: 'T-1', targetVersions: [], fixVersions: ['rhoai-3.5 EA1'], status: 'In Progress' }
        ]
      }
    })
    var result = loadFeaturesForRelease(storage.readFromStorage, '3.5')
    expect(result.features).toHaveLength(1)
  })

  it('excludes closed features', function() {
    var storage = makeStorage({
      'feature-traffic/index.json': {
        features: [
          { key: 'T-1', targetVersions: ['rhoai-3.5'], fixVersions: [], status: 'Closed' }
        ]
      }
    })
    var result = loadFeaturesForRelease(storage.readFromStorage, '3.5')
    expect(result.features).toHaveLength(0)
  })

  it('merges detail data onto features', function() {
    var storage = makeStorage({
      'feature-traffic/index.json': {
        features: [
          { key: 'T-1', targetVersions: ['rhoai-3.5'], fixVersions: [], status: 'In Progress' }
        ]
      },
      'feature-traffic/features/T-1.json': {
        pm: { displayName: 'Jane PM' },
        components: ['Model Serving'],
        releaseType: 'General Availability'
      }
    })
    var result = loadFeaturesForRelease(storage.readFromStorage, '3.5')
    expect(result.features[0].pm).toEqual({ displayName: 'Jane PM' })
    expect(result.features[0].components).toEqual(['Model Serving'])
    expect(result.features[0].releaseType).toBe('General Availability')
  })
})

describe('loadMilestones', function() {
  function ppCache(releases) {
    return {
      'release-analysis/product-pages-releases-cache.json': {
        source: 'api',
        fetchedAt: '2026-04-26T00:00:00Z',
        releases: releases
      }
    }
  }

  it('returns milestones from Product Pages cache', function() {
    var storage = makeStorage(ppCache([
      { productName: 'rhoai', releaseNumber: 'rhoai-3.5.EA1', dueDate: '2026-05-15', codeFreezeDate: '2026-05-01' },
      { productName: 'rhoai', releaseNumber: 'rhoai-3.5.EA2', dueDate: '2026-07-01', codeFreezeDate: '2026-06-15' },
      { productName: 'rhoai', releaseNumber: 'rhoai-3.5', dueDate: '2026-08-15', codeFreezeDate: '2026-08-01' }
    ]))
    var result = loadMilestones(storage.readFromStorage, '3.5')
    expect(result).not.toBeNull()
    expect(result.ea1Freeze).toBe('2026-05-01')
    expect(result.ea1Target).toBe('2026-05-15')
    expect(result.ea2Freeze).toBe('2026-06-15')
    expect(result.ea2Target).toBe('2026-07-01')
    expect(result.gaFreeze).toBe('2026-08-01')
    expect(result.gaTarget).toBe('2026-08-15')
  })

  it('returns null when cache is missing', function() {
    var storage = makeStorage({})
    expect(loadMilestones(storage.readFromStorage, '3.5')).toBeNull()
  })

  it('returns null when no matching version', function() {
    var storage = makeStorage(ppCache([
      { productName: 'rhoai', releaseNumber: 'rhoai-3.4', dueDate: '2026-03-01', codeFreezeDate: '2026-02-15' }
    ]))
    expect(loadMilestones(storage.readFromStorage, '3.5')).toBeNull()
  })

  it('handles missing codeFreezeDate', function() {
    var storage = makeStorage(ppCache([
      { productName: 'rhoai', releaseNumber: 'rhoai-3.5.EA1', dueDate: '2026-05-15', codeFreezeDate: null },
      { productName: 'rhoai', releaseNumber: 'rhoai-3.5', dueDate: '2026-08-15', codeFreezeDate: null }
    ]))
    var result = loadMilestones(storage.readFromStorage, '3.5')
    expect(result).not.toBeNull()
    expect(result.ea1Freeze).toBeNull()
    expect(result.ea1Target).toBe('2026-05-15')
    expect(result.gaFreeze).toBeNull()
    expect(result.gaTarget).toBe('2026-08-15')
  })

  it('returns partial milestones when only some phases exist', function() {
    var storage = makeStorage(ppCache([
      { productName: 'rhoai', releaseNumber: 'rhoai-3.5', dueDate: '2026-08-15', codeFreezeDate: '2026-08-01' }
    ]))
    var result = loadMilestones(storage.readFromStorage, '3.5')
    expect(result).not.toBeNull()
    expect(result.ea1Freeze).toBeNull()
    expect(result.ea1Target).toBeNull()
    expect(result.ea2Freeze).toBeNull()
    expect(result.ea2Target).toBeNull()
    expect(result.gaFreeze).toBe('2026-08-01')
    expect(result.gaTarget).toBe('2026-08-15')
  })
})

const smartsheetClient = require('../../../../shared/server/smartsheet')
vi.spyOn(smartsheetClient, 'isConfigured')
vi.spyOn(smartsheetClient, 'discoverReleasesPartial')

describe('backfillFreezeDatesFromSmartsheet', function() {
  beforeEach(function() {
    smartsheetClient.isConfigured.mockReturnValue(false)
    smartsheetClient.discoverReleasesPartial.mockResolvedValue([])
  })

  it('returns milestones unchanged when Smartsheet is not configured and milestones have freeze dates', async function() {
    smartsheetClient.isConfigured.mockReturnValue(false)
    var milestones = {
      ea1Freeze: '2026-05-01', ea1Target: '2026-05-15',
      ea2Freeze: '2026-06-15', ea2Target: '2026-07-01',
      gaFreeze: '2026-08-01', gaTarget: '2026-08-15'
    }
    var result = await backfillFreezeDatesFromSmartsheet(milestones, '3.5')
    expect(result.milestones).toEqual(milestones)
    expect(result.warnings).toHaveLength(0)
  })

  it('warns when neither source is configured and milestones is null', async function() {
    smartsheetClient.isConfigured.mockReturnValue(false)
    var result = await backfillFreezeDatesFromSmartsheet(null, '3.5')
    expect(result.milestones).toBeNull()
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('Neither Product Pages nor Smartsheet')])
    )
  })

  it('warns when freeze dates missing and Smartsheet not configured', async function() {
    smartsheetClient.isConfigured.mockReturnValue(false)
    var milestones = {
      ea1Freeze: null, ea1Target: '2026-05-15',
      ea2Freeze: null, ea2Target: '2026-07-01',
      gaFreeze: null, gaTarget: '2026-08-15'
    }
    var result = await backfillFreezeDatesFromSmartsheet(milestones, '3.5')
    expect(result.milestones).toEqual(milestones)
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('Smartsheet is not configured')])
    )
  })

  it('skips fallback when milestones already have freeze dates', async function() {
    smartsheetClient.isConfigured.mockReturnValue(true)
    var milestones = {
      ea1Freeze: '2026-05-01', ea1Target: '2026-05-15',
      ea2Freeze: '2026-06-15', ea2Target: '2026-07-01',
      gaFreeze: '2026-08-01', gaTarget: '2026-08-15'
    }
    var result = await backfillFreezeDatesFromSmartsheet(milestones, '3.5')
    expect(result.milestones).toEqual(milestones)
    expect(result.warnings).toHaveLength(0)
    expect(smartsheetClient.discoverReleasesPartial).not.toHaveBeenCalled()
  })

  it('loads everything from Smartsheet when milestones is null', async function() {
    smartsheetClient.isConfigured.mockReturnValue(true)
    smartsheetClient.discoverReleasesPartial.mockResolvedValue([
      { version: '3.5', ea1Freeze: '2026-05-15', ea1Target: '2026-06-18', ea2Freeze: '2026-06-19', ea2Target: '2026-07-16', gaFreeze: '2026-07-24', gaTarget: '2026-08-20' }
    ])
    var result = await backfillFreezeDatesFromSmartsheet(null, '3.5')
    expect(result.milestones).not.toBeNull()
    expect(result.milestones.ea1Freeze).toBe('2026-05-15')
    expect(result.milestones.gaTarget).toBe('2026-08-20')
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('Using Smartsheet')])
    )
  })

  it('merges Smartsheet freeze dates into Product Pages milestones', async function() {
    smartsheetClient.isConfigured.mockReturnValue(true)
    smartsheetClient.discoverReleasesPartial.mockResolvedValue([
      { version: '3.5', ea1Freeze: '2026-05-15', ea1Target: '2026-06-18', ea2Freeze: '2026-06-19', ea2Target: '2026-07-16', gaFreeze: '2026-07-24', gaTarget: '2026-08-20' }
    ])
    var milestones = {
      ea1Freeze: null, ea1Target: '2026-06-18',
      ea2Freeze: null, ea2Target: '2026-07-16',
      gaFreeze: null, gaTarget: '2026-08-20'
    }
    var result = await backfillFreezeDatesFromSmartsheet(milestones, '3.5')
    expect(result.milestones.ea1Freeze).toBe('2026-05-15')
    expect(result.milestones.ea2Freeze).toBe('2026-06-19')
    expect(result.milestones.gaFreeze).toBe('2026-07-24')
    // Product Pages target dates preserved
    expect(result.milestones.ea1Target).toBe('2026-06-18')
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('Backfilled freeze dates')])
    )
  })

  it('returns null when Smartsheet has no matching version', async function() {
    smartsheetClient.isConfigured.mockReturnValue(true)
    smartsheetClient.discoverReleasesPartial.mockResolvedValue([
      { version: '3.4', ea1Freeze: '2026-01-01', ea1Target: '2026-02-01', ea2Freeze: '2026-03-01', ea2Target: '2026-04-01', gaFreeze: '2026-05-01', gaTarget: '2026-06-01' }
    ])
    var result = await backfillFreezeDatesFromSmartsheet(null, '3.5')
    expect(result.milestones).toBeNull()
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('No milestone data found')])
    )
  })

  it('handles Smartsheet API errors gracefully', async function() {
    smartsheetClient.isConfigured.mockReturnValue(true)
    smartsheetClient.discoverReleasesPartial.mockRejectedValue(new Error('API timeout'))
    var milestones = {
      ea1Freeze: null, ea1Target: '2026-06-18',
      ea2Freeze: null, ea2Target: '2026-07-16',
      gaFreeze: null, gaTarget: '2026-08-20'
    }
    var result = await backfillFreezeDatesFromSmartsheet(milestones, '3.5')
    expect(result.milestones).toEqual(milestones)
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('Smartsheet fallback failed')])
    )
  })
})

describe('deriveFreezeDates', function() {
  it('returns null milestones unchanged', function() {
    var result = deriveFreezeDates(null)
    expect(result.milestones).toBeNull()
    expect(result.warnings).toHaveLength(0)
  })

  it('derives all freeze dates from target dates', function() {
    var milestones = {
      ea1Freeze: null, ea1Target: '2026-06-18',
      ea2Freeze: null, ea2Target: '2026-07-16',
      gaFreeze: null, gaTarget: '2026-08-20'
    }
    var result = deriveFreezeDates(milestones)
    expect(result.milestones.ea1Freeze).toBe('2026-05-19')
    expect(result.milestones.ea2Freeze).toBe('2026-06-16')
    expect(result.milestones.gaFreeze).toBe('2026-07-21')
    expect(result.warnings[0]).toContain('Derived freeze dates')
    expect(result.warnings[0]).toContain('ea1Freeze')
    expect(result.warnings[0]).toContain('ea2Freeze')
    expect(result.warnings[0]).toContain('gaFreeze')
  })

  it('does not overwrite existing freeze dates', function() {
    var milestones = {
      ea1Freeze: '2026-05-01', ea1Target: '2026-06-18',
      ea2Freeze: null, ea2Target: '2026-07-16',
      gaFreeze: '2026-08-01', gaTarget: '2026-08-20'
    }
    var result = deriveFreezeDates(milestones)
    expect(result.milestones.ea1Freeze).toBe('2026-05-01')
    expect(result.milestones.ea2Freeze).toBe('2026-06-16')
    expect(result.milestones.gaFreeze).toBe('2026-08-01')
    expect(result.warnings[0]).toContain('ea2Freeze')
    expect(result.warnings[0]).not.toContain('ea1Freeze')
    expect(result.warnings[0]).not.toContain('gaFreeze')
  })

  it('produces no warnings when all freeze dates already exist', function() {
    var milestones = {
      ea1Freeze: '2026-05-01', ea1Target: '2026-06-18',
      ea2Freeze: '2026-06-15', ea2Target: '2026-07-16',
      gaFreeze: '2026-08-01', gaTarget: '2026-08-20'
    }
    var result = deriveFreezeDates(milestones)
    expect(result.warnings).toHaveLength(0)
  })

  it('handles month boundary rollover correctly', function() {
    var milestones = {
      ea1Freeze: null, ea1Target: '2026-01-15',
      ea2Freeze: null, ea2Target: null,
      gaFreeze: null, gaTarget: null
    }
    var result = deriveFreezeDates(milestones)
    expect(result.milestones.ea1Freeze).toBe('2025-12-16')
    expect(result.milestones.ea2Freeze).toBeNull()
    expect(result.milestones.gaFreeze).toBeNull()
  })
})

describe('runHealthPipeline', function() {
  beforeEach(function() {
    smartsheetClient.isConfigured.mockReturnValue(false)
  })

  function makeCandidatesCache(features) {
    return {
      'release-planning/candidates-cache-3.5.json': {
        cachedAt: '2026-04-26T00:00:00Z',
        data: { features: features }
      }
    }
  }

  it('writes empty cache when no candidates found', async function() {
    var storage = makeStorage({})
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    expect(result.features).toEqual([])
    expect(result.summary.totalFeatures).toBe(0)
    expect(storage._store['release-planning/health-cache-3.5-all.json']).toBeDefined()
  })

  it('writes cache with assessed features to storage', async function() {
    var storage = makeStorage(makeCandidatesCache([
      { issueKey: 'T-1', summary: 'Feature 1', status: 'In Progress', components: '', fixVersion: '', deliveryOwner: 'Jane', tier: 1 }
    ]))
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    expect(result.features).toHaveLength(1)
    expect(result.features[0].key).toBe('T-1')
    expect(result.summary.totalFeatures).toBe(1)
    expect(storage._store['release-planning/health-cache-3.5-all.json']).toBeDefined()
  })

  it('uses phase-specific cache key when phase is provided', async function() {
    var storage = makeStorage(makeCandidatesCache([
      { issueKey: 'T-1', summary: 'F1', status: 'In Progress', components: '', fixVersion: '', deliveryOwner: 'Jane', tier: 1 }
    ]))
    await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn(), 'EA2')
    expect(storage._store['release-planning/health-cache-3.5-EA2.json']).toBeDefined()
  })

  it('aggregates risk counts correctly', async function() {
    var storage = makeStorage(makeCandidatesCache([
      { issueKey: 'T-1', summary: 'F1', status: 'In Progress', components: '', fixVersion: '', deliveryOwner: 'Jane', tier: 1 },
      { issueKey: 'T-2', summary: 'F2', status: 'New', components: '', fixVersion: '', deliveryOwner: 'Bob', tier: 2 }
    ]))
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    expect(result.summary.totalFeatures).toBe(2)
    var total = result.summary.byRisk.green + result.summary.byRisk.yellow + result.summary.byRisk.red
    expect(total).toBe(2)
  })

  it('includes enrichmentStatus in result', async function() {
    var storage = makeStorage(makeCandidatesCache([
      { issueKey: 'T-1', summary: 'F1', status: 'In Progress', components: '', fixVersion: '', deliveryOwner: 'Jane', tier: 1 }
    ]))
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    expect(result.enrichmentStatus).toBeDefined()
    expect(typeof result.enrichmentStatus.jiraQueriesRun).toBe('number')
    expect(typeof result.enrichmentStatus.featuresEnriched).toBe('number')
    expect(Array.isArray(result.enrichmentStatus.warnings)).toBe(true)
  })

  it('returns null milestones when neither source is available', async function() {
    var storage = makeStorage(makeCandidatesCache([
      { issueKey: 'T-1', summary: 'F1', status: 'In Progress', components: '', fixVersion: '', deliveryOwner: 'Jane', tier: 1 }
    ]))
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    expect(result.milestones).toBeNull()
    expect(result.enrichmentStatus.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('Neither Product Pages nor Smartsheet')])
    )
  })

  it('loads milestones from Product Pages cache when available', async function() {
    var data = makeCandidatesCache([
      { issueKey: 'T-1', summary: 'F1', status: 'In Progress', components: '', fixVersion: '', deliveryOwner: 'Jane', tier: 1 }
    ])
    data['release-analysis/product-pages-releases-cache.json'] = {
      source: 'api',
      fetchedAt: '2026-04-26T00:00:00Z',
      releases: [
        { productName: 'rhoai', releaseNumber: 'rhoai-3.5.EA1', dueDate: '2026-05-15', codeFreezeDate: '2026-05-01' },
        { productName: 'rhoai', releaseNumber: 'rhoai-3.5.EA2', dueDate: '2026-07-01', codeFreezeDate: '2026-06-15' },
        { productName: 'rhoai', releaseNumber: 'rhoai-3.5', dueDate: '2026-08-15', codeFreezeDate: '2026-08-01' }
      ]
    }
    var storage = makeStorage(data)
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    expect(result.milestones).not.toBeNull()
    expect(result.milestones.ea1Freeze).toBe('2026-05-01')
    expect(result.milestones.gaTarget).toBe('2026-08-15')
  })

  it('produces correct cache structure', async function() {
    var storage = makeStorage(makeCandidatesCache([
      { issueKey: 'T-1', summary: 'F1', status: 'In Progress', components: '', fixVersion: '', deliveryOwner: 'Jane', tier: 1 }
    ]))
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    expect(result.version).toBe('3.5')
    expect(result.cachedAt).toBeDefined()
    expect(result.phase).toBe('all')
    expect(result.summary).toBeDefined()
    expect(result.summary.byRisk).toBeDefined()
    expect(typeof result.summary.dorCompletionRate).toBe('number')
    expect(result.features[0]).toHaveProperty('key')
    expect(result.features[0]).toHaveProperty('risk')
    expect(result.features[0]).toHaveProperty('dor')
  })

  it('includes planningFreezes in cache output when milestones are present', async function() {
    var data = makeCandidatesCache([
      { issueKey: 'T-1', summary: 'F1', status: 'In Progress', components: '', fixVersion: '', deliveryOwner: 'Jane', tier: 1 }
    ])
    data['release-analysis/product-pages-releases-cache.json'] = {
      source: 'api',
      fetchedAt: '2026-04-26T00:00:00Z',
      releases: [
        { productName: 'rhoai', releaseNumber: 'rhoai-3.5.EA1', dueDate: '2026-05-15', codeFreezeDate: '2026-05-01' },
        { productName: 'rhoai', releaseNumber: 'rhoai-3.5.EA2', dueDate: '2026-07-01', codeFreezeDate: '2026-06-15' },
        { productName: 'rhoai', releaseNumber: 'rhoai-3.5', dueDate: '2026-08-15', codeFreezeDate: '2026-08-01' }
      ]
    }
    var storage = makeStorage(data)
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    expect(result.planningFreezes).not.toBeNull()
    // Planning freeze = code freeze - 7 days
    expect(result.planningFreezes.ea1).toBe('2026-04-24')
    expect(result.planningFreezes.ea2).toBe('2026-06-08')
    expect(result.planningFreezes.ga).toBe('2026-07-25')
  })

  it('returns null planningFreezes when milestones are null', async function() {
    var storage = makeStorage(makeCandidatesCache([
      { issueKey: 'T-1', summary: 'F1', status: 'In Progress', components: '', fixVersion: '', deliveryOwner: 'Jane', tier: 1 }
    ]))
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    expect(result.planningFreezes).toBeNull()
  })

  it('attaches priorityScore and priorityBreakdown to health features', async function() {
    var storage = makeStorage(makeCandidatesCache([
      { issueKey: 'T-1', summary: 'F1', status: 'In Progress', priority: 'Major', components: '', fixVersion: '', deliveryOwner: 'Jane', tier: 1 },
      { issueKey: 'T-2', summary: 'F2', status: 'New', priority: 'Minor', components: '', fixVersion: '', deliveryOwner: 'Bob', tier: 3 }
    ]))
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    expect(result.features).toHaveLength(2)
    for (var i = 0; i < result.features.length; i++) {
      expect(result.features[i]).toHaveProperty('priorityScore')
      expect(result.features[i]).toHaveProperty('priorityBreakdown')
      expect(typeof result.features[i].priorityScore).toBe('number')
      expect(result.features[i].priorityBreakdown).toBeDefined()
      expect(result.features[i].priorityBreakdown).toHaveProperty('rice')
      expect(result.features[i].priorityBreakdown).toHaveProperty('bigRock')
      expect(result.features[i].priorityBreakdown).toHaveProperty('priority')
      expect(result.features[i].priorityBreakdown).toHaveProperty('complexity')
    }
    // Tier 1 Major should score higher than Tier 3 Minor
    expect(result.features[0].priorityScore).toBeGreaterThan(result.features[1].priorityScore)
  })

  it('includes storyPoints on health features (null without enrichment)', async function() {
    var storage = makeStorage(makeCandidatesCache([
      { issueKey: 'T-1', summary: 'F1', status: 'In Progress', components: '', fixVersion: '', deliveryOwner: 'Jane', tier: 1 }
    ]))
    var result = await runHealthPipeline('3.5', storage.readFromStorage, storage.writeToStorage, vi.fn(), vi.fn())
    expect(result.features[0]).toHaveProperty('storyPoints')
    expect(result.features[0].storyPoints).toBeNull()
  })
})
