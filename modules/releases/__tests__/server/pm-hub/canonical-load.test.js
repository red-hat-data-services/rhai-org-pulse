/**
 * Unit tests for PM Hub canonical Component Release Load grouping.
 */
import { describe, it, expect } from 'vitest'

const {
  canonicalToLoadRow,
  buildComponentReleaseLoadGroups,
  featureMatchesComponents
} = require('../../../server/pm-hub/canonical-load')

function feature(overrides) {
  return Object.assign({
    key: 'RHAISTRAT-1',
    title: 'Test',
    status: 'In Progress',
    components: ['Dashboard'],
    targetVersions: ['rhoai-3.6'],
    fixVersions: ['rhoai-3.6'],
    fixVersion: 'rhoai-3.6',
    fpdor: { items: [], allApplicablePassed: true },
    isAiFirst: false,
    confidence: 'ready',
    isBlocked: false,
    blockedBy: [],
    labels: []
  }, overrides)
}

describe('canonical-load', function() {
  it('maps canonical feature to load row', function() {
    var row = canonicalToLoadRow(feature({
      deliveryOwner: 'Alice',
      pmOwner: 'Bob',
      colorStatus: 'Green',
      bigRock: 'Outcome A',
      team: 'Platform',
      effectivePriorityScore: 72,
      priorityScoreBreakdown: { rice: 10 }
    }))
    expect(row.key).toBe('RHAISTRAT-1')
    expect(row.summary).toBe('Test')
    expect(row.assignee).toBe('Alice')
    expect(row.pmOwner).toBe('Bob')
    expect(row.colorStatus).toBe('Green')
    expect(row.fixVersions).toEqual(['rhoai-3.6'])
    expect(row.fpdor).toBeTruthy()
    expect(row.bigRock).toBe('Outcome A')
    expect(row.team).toBe('Platform')
    expect(row.effectivePriorityScore).toBe(72)
    expect(row.priorityScoreBreakdown).toEqual({ rice: 10 })
  })

  it('filters by component', function() {
    expect(featureMatchesComponents(feature(), ['Dashboard'])).toBe(true)
    expect(featureMatchesComponents(feature(), ['Other'])).toBe(false)
  })

  it('groups requested and committed under matching version', function() {
    var built = buildComponentReleaseLoadGroups([
      feature({ key: 'A-1' }),
      feature({
        key: 'A-2',
        targetVersions: ['rhoai-3.6'],
        fixVersions: [],
        fixVersion: null
      })
    ], {
      components: ['Dashboard'],
      versions: ['rhoai-3.6'],
      releaseDates: {}
    })
    expect(built.groups.length).toBe(1)
    expect(built.groups[0].version).toBe('rhoai-3.6')
    var comp = built.groups[0].components[0]
    expect(comp.requestedCount).toBe(2)
    expect(comp.committedCount).toBe(1)
    expect(comp.committedFeatures[0].alignmentCategory).toBe('aligned_on_time')
    expect(comp.requestedFeatures.find(function(f) { return f.key === 'A-2' }).alignmentCategory).toBe('tv_only')
  })

  it('marks early delivery as aligned_on_time for TV release', function() {
    var built = buildComponentReleaseLoadGroups([
      feature({
        key: 'EARLY-1',
        targetVersions: ['rhoai-3.6'],
        fixVersions: ['rhoai-3.5'],
        fixVersion: 'rhoai-3.5'
      })
    ], {
      components: ['Dashboard'],
      versions: ['rhoai-3.6', 'rhoai-3.5'],
      releaseDates: {}
    })
    var tvGroup = built.groups.find(function(g) { return g.version === 'rhoai-3.6' })
    expect(tvGroup).toBeTruthy()
    var row = tvGroup.components[0].requestedFeatures[0]
    expect(row.alignmentCategory).toBe('aligned_on_time')
    expect(row.pmDoAligned).toBe(true)
  })

  it('counts FV-only (no TV) as committed when Fix Version is in scope', function() {
    var built = buildComponentReleaseLoadGroups([
      feature({
        key: 'FV-ONLY-1',
        targetVersions: [],
        fixVersions: ['rhoai-3.6'],
        fixVersion: 'rhoai-3.6'
      })
    ], {
      components: ['Dashboard'],
      versions: ['rhoai-3.6'],
      releaseDates: {}
    })
    var comp = built.groups[0].components[0]
    expect(comp.requestedCount).toBe(0)
    expect(comp.committedCount).toBe(1)
    expect(comp.committedFeatures[0].key).toBe('FV-ONLY-1')
  })

  it('stamps planningFrozen from Fix Version freeze dates', function() {
    var built = buildComponentReleaseLoadGroups([
      feature({
        key: 'A-1',
        targetVersions: ['rhoai-3.5'],
        fixVersions: ['rhoai-3.5'],
        fixVersion: 'rhoai-3.5'
      }),
      feature({
        key: 'B-1',
        targetVersions: ['rhoai-3.6'],
        fixVersions: ['rhoai-3.6'],
        fixVersion: 'rhoai-3.6'
      })
    ], {
      components: ['Dashboard'],
      versions: ['rhoai-3.5', 'rhoai-3.6'],
      releaseDates: {
        'rhoai-3.5': { planningFreezeDate: '2026-06-01' },
        'rhoai-3.6': { planningFreezeDate: '2026-09-01' }
      }
    })
    var g35 = built.groups.find(function(g) { return g.version === 'rhoai-3.5' })
    var g36 = built.groups.find(function(g) { return g.version === 'rhoai-3.6' })
    expect(g35).toBeTruthy()
    expect(g36).toBeTruthy()
    expect(g35.planningFrozen).toBe(true)
    expect(g36.planningFrozen).toBe(false)
  })

  it('classifies later Fix Version as after_requested until committed freeze', function() {
    var built = buildComponentReleaseLoadGroups([
      feature({
        key: 'SLIP-1',
        targetVersions: ['rhoai-3.5'],
        fixVersions: ['rhoai-3.6'],
        fixVersion: 'rhoai-3.6'
      })
    ], {
      components: ['Dashboard'],
      versions: ['rhoai-3.5'],
      releaseDates: {
        'rhoai-3.5': { planningFreezeDate: '2026-06-01' }
      }
    })
    var row = built.groups[0].components[0].requestedFeatures[0]
    expect(row.alignmentCategory).toBe('after_requested')
    expect(row.pmDoAligned).toBe(false)
  })
})
