/**
 * Filtered-view TV/FV Align roll-up helpers for PM Hub.
 */
import { describe, it, expect } from 'vitest'
import {
  uniqueFeaturesFromGroups,
  countAlignment,
  countAlignmentForGroups,
  buildAlignmentRollup,
  countDeliveredInVisibleVersions,
  afterRequestedSplit
} from '../../../client/plan/utils/alignment-rollup.js'

function feature(overrides) {
  return Object.assign({
    key: 'RHAISTRAT-1',
    alignmentCategory: 'aligned_on_time',
    pmDoAligned: true
  }, overrides)
}

function groupsFrom(versionFeatures) {
  return Object.keys(versionFeatures).map(function(version) {
    return {
      version: version,
      components: [{
        component: 'Dashboard',
        requestedFeatures: versionFeatures[version],
        committedFeatures: []
      }]
    }
  })
}

describe('uniqueFeaturesFromGroups', function() {
  it('counts each issue key once across components and buckets', function() {
    var groups = [{
      version: '3.6 EA2 RHOAI RELEASE',
      components: [{
        component: 'A',
        requestedFeatures: [feature({ key: 'RHAISTRAT-1' })],
        committedFeatures: [feature({ key: 'RHAISTRAT-1' })]
      }, {
        component: 'B',
        requestedFeatures: [feature({ key: 'RHAISTRAT-1' })],
        committedFeatures: []
      }]
    }]
    expect(uniqueFeaturesFromGroups(groups)).toHaveLength(1)
  })

  it('keeps the worse category when the same key appears in two versions', function() {
    var groups = groupsFrom({
      '3.6 EA2 RHOAI RELEASE': [feature({ key: 'RHAISTRAT-2', alignmentCategory: 'aligned_on_time' })],
      '3.6 EA2 RHAII RELEASE': [feature({ key: 'RHAISTRAT-2', alignmentCategory: 'tv_only' })]
    })
    var unique = uniqueFeaturesFromGroups(groups)
    expect(unique).toHaveLength(1)
    expect(unique[0].alignmentCategory).toBe('tv_only')
  })
})

describe('countAlignment', function() {
  it('computes Align % as Early or as requested plus green After requested', function() {
    var counts = countAlignment([
      feature({ key: 'A', alignmentCategory: 'aligned_on_time' }),
      feature({ key: 'B', alignmentCategory: 'aligned_late' }),
      feature({ key: 'C', alignmentCategory: 'tv_only' }),
      feature({ key: 'D', alignmentCategory: 'fv_only' }),
      feature({ key: 'E', alignmentCategory: 'misaligned' })
    ])
    expect(counts.total).toBe(5)
    expect(counts.aligned_on_time).toBe(1)
    expect(counts.aligned_late).toBe(1)
    expect(counts.after_requested).toBe(0)
    expect(counts.tv_only).toBe(1)
    expect(counts.fv_only).toBe(1)
    expect(counts.misaligned).toBe(1)
    expect(counts.alignment_pct).toBe(40)
  })

  it('does not count yellow After requested as aligned', function() {
    var counts = countAlignment([
      feature({ key: 'A', alignmentCategory: 'aligned_on_time' }),
      feature({ key: 'B', alignmentCategory: 'after_requested' })
    ])
    expect(counts.total).toBe(2)
    expect(counts.after_requested).toBe(1)
    expect(counts.alignment_pct).toBe(50)
  })
})

describe('afterRequestedSplit', function() {
  it('splits yellow and green After requested counts', function() {
    var split = afterRequestedSplit({
      after_requested: 7,
      aligned_late: 4
    })
    expect(split.yellow).toBe(7)
    expect(split.green).toBe(4)
    expect(split.total).toBe(11)
  })
})

describe('buildAlignmentRollup', function() {
  it('rolls unique keys to selected scope, then EA2, then product', function() {
    var groups = groupsFrom({
      '3.6 EA2 RHOAI RELEASE': [
        feature({ key: 'RHAISTRAT-1', alignmentCategory: 'aligned_on_time' }),
        feature({ key: 'RHAISTRAT-2', alignmentCategory: 'tv_only' })
      ],
      '3.6 EA2 RHAII RELEASE': [
        feature({ key: 'RHAISTRAT-1', alignmentCategory: 'aligned_late' }),
        feature({ key: 'RHAISTRAT-3', alignmentCategory: 'fv_only' })
      ]
    })
    var rollup = buildAlignmentRollup(groups)
    expect(rollup.scope.counts.total).toBe(3)
    expect(rollup.scope.counts.tv_only).toBe(1)
    expect(rollup.scope.counts.fv_only).toBe(1)
    expect(rollup.cycles[0].milestones[0].label).toBe('3.6 EA2 Release')
    expect(rollup.cycles[0].milestones[0].counts.total).toBe(3)
    expect(rollup.cycles[0].milestones[0].rows.map(function(r) { return r.label })).toEqual([
      'RHOAI',
      'RHAII'
    ])
    expect(rollup.cycles[0].milestones[0].rows[0].counts.total).toBe(2)
  })
})

describe('countDeliveredInVisibleVersions', function() {
  it('counts unique keys whose Fix Version is still in the filtered versions', function() {
    var issues = [
      { key: 'RHAISTRAT-10', fixVersions: ['3.6 EA2 RHOAI RELEASE'] },
      { key: 'RHAISTRAT-11', fixVersions: ['3.6 EA2 RHAII RELEASE'] },
      { key: 'RHAISTRAT-10', fixVersions: ['3.6 EA2 RHOAI RELEASE'] }
    ]
    expect(countDeliveredInVisibleVersions(issues, ['3.6 EA2 RHOAI RELEASE'])).toBe(1)
    expect(countDeliveredInVisibleVersions(issues, [
      '3.6 EA2 RHOAI RELEASE',
      '3.6 EA2 RHAII RELEASE'
    ])).toBe(2)
  })
})

describe('countAlignmentForGroups', function() {
  it('uses unfrozen groups only when any selected release is still open', function() {
    var groups = [
      {
        version: '3.6 EA1 RHOAI RELEASE',
        planningFrozen: true,
        components: [{
          component: 'Dashboard',
          requestedFeatures: [feature({ key: 'MOVED', alignmentCategory: 'after_requested' })],
          committedFeatures: []
        }]
      },
      {
        version: '3.6 EA2 RHOAI RELEASE',
        planningFrozen: false,
        components: [{
          component: 'Dashboard',
          requestedFeatures: [],
          committedFeatures: [feature({ key: 'MOVED', alignmentCategory: 'after_requested' })]
        }]
      }
    ]
    var counts = countAlignmentForGroups(groups)
    expect(counts.total).toBe(1)
    expect(counts.after_requested).toBe(1)
    expect(counts.alignment_pct).toBe(0)
  })

  it('discounts After requested leavers from a frozen requested release', function() {
    var groups = [{
      version: '3.6 EA1 RHOAI RELEASE',
      planningFrozen: true,
      components: [{
        component: 'Dashboard',
        requestedFeatures: [
          feature({ key: 'STAY', alignmentCategory: 'aligned_on_time' }),
          feature({ key: 'LEFT', alignmentCategory: 'after_requested' })
        ],
        committedFeatures: [feature({ key: 'STAY', alignmentCategory: 'aligned_on_time' })]
      }]
    }]
    var counts = countAlignmentForGroups(groups)
    expect(counts.total).toBe(1)
    expect(counts.aligned_on_time).toBe(1)
    expect(counts.after_requested).toBe(0)
    expect(counts.alignment_pct).toBe(100)
  })

  it('counts green After requested on a frozen committed release', function() {
    var groups = [{
      version: '3.6 EA2 RHOAI RELEASE',
      planningFrozen: true,
      components: [{
        component: 'Dashboard',
        requestedFeatures: [],
        committedFeatures: [feature({ key: 'ARRIVED', alignmentCategory: 'aligned_late' })]
      }]
    }]
    var counts = countAlignmentForGroups(groups)
    expect(counts.total).toBe(1)
    expect(counts.aligned_late).toBe(1)
    expect(counts.alignment_pct).toBe(100)
  })
})

describe('buildAlignmentRollup open-plan vs per-release', function() {
  it('scope follows open plan while frozen EA1 row discounts leavers', function() {
    var groups = [
      {
        version: '3.6 EA1 RHOAI RELEASE',
        planningFrozen: true,
        components: [{
          component: 'Dashboard',
          requestedFeatures: [
            feature({ key: 'STAY', alignmentCategory: 'aligned_on_time' }),
            feature({ key: 'MOVED', alignmentCategory: 'after_requested' })
          ],
          committedFeatures: [feature({ key: 'STAY', alignmentCategory: 'aligned_on_time' })]
        }]
      },
      {
        version: '3.6 EA2 RHOAI RELEASE',
        planningFrozen: false,
        components: [{
          component: 'Dashboard',
          requestedFeatures: [],
          committedFeatures: [
            feature({ key: 'MOVED', alignmentCategory: 'after_requested' }),
            feature({ key: 'NEW', alignmentCategory: 'aligned_on_time' })
          ]
        }]
      }
    ]
    var rollup = buildAlignmentRollup(groups)
    // Hub tile / selected scope: open plan only (EA2)
    expect(rollup.scope.counts.total).toBe(2)
    expect(rollup.scope.counts.after_requested).toBe(1)
    expect(rollup.scope.counts.aligned_on_time).toBe(1)
    expect(rollup.scope.counts.alignment_pct).toBe(50)

    var ea1 = rollup.cycles[0].milestones.find(function(ms) { return ms.key.indexOf('EA1') !== -1 })
    var ea2 = rollup.cycles[0].milestones.find(function(ms) { return ms.key.indexOf('EA2') !== -1 })
    expect(ea1).toBeTruthy()
    expect(ea2).toBeTruthy()
    // Frozen EA1 discounts the leaver
    expect(ea1.counts.total).toBe(1)
    expect(ea1.counts.aligned_on_time).toBe(1)
    expect(ea1.counts.after_requested).toBe(0)
    expect(ea1.counts.alignment_pct).toBe(100)
    // Open EA2 keeps yellow After requested out of Align %
    expect(ea2.counts.total).toBe(2)
    expect(ea2.counts.after_requested).toBe(1)
    expect(ea2.counts.alignment_pct).toBe(50)
  })
})
