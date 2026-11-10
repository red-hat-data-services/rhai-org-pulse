import { describe, it, expect } from 'vitest'
import {
  schedule,
  detectEvt,
  computeFPDoRRisk,
  computeWeightedFPDoR,
  classifyFeature,
  filterFeatures,
  aggregateBigRockStats,
  mapApiFeatureToRow,
  sortFeatures,
  assignNoTier,
  applyPlacementGrouping,
  aggregateRoadmapGrid,
  roadmapCellColor,
  computeDeliveryConfidenceSummary,
  computeWorkMix,
  bigRockStatusLabel,
  computeComponentCapacityUsage,
  computeTeamCapacityUsage,
  computeExclusionBreakdown,
  computeFpdorFieldBreakdown
} from '../../../../client/plan/ai-planner/core.js'

function baseRow(overrides) {
  return Object.assign({
    Key: 'RHAISTRAT-9001',
    Title: 'Test feature',
    Components: 'AI Hub',
    Team: 'RHOAI AI Hub',
    'Target Versions': '3.6 EA1 RHOAI RELEASE',
    'Fix Version': '',
    FPDoR: '17/17',
    'Failed FPDoR Items': '',
    Confidence: 'committed',
    Priority: 'Major',
    Score: '30',
    Outcome: 'AI Hub',
    PM: 'Jane PM',
    Assignee: 'Someone',
    'Release Type': 'GA',
    'Product Documentation Required': 'yes'
  }, overrides)
}

describe('detectEvt', () => {
  it('maps ea1/ea2 markers', () => {
    expect(detectEvt('3.6 ea1 rhoai release')).toBe('EA1')
    expect(detectEvt('3.6 ea2 rhoai release')).toBe('EA2')
  })

  it('treats a bare "ea" as EA1 (3.7+ single-EA cycles)', () => {
    expect(detectEvt('3.7 ea rhoai release')).toBe('EA1')
  })

  it('does not match "ea" inside "release" (word-boundary fix)', () => {
    expect(detectEvt('3.7 release')).toBe(null)
  })

  it('maps GA markers', () => {
    expect(detectEvt('3.6 ga release')).toBe('GA')
    expect(detectEvt('rhoai-3.6')).toBe(null)
  })
})

describe('computeWeightedFPDoR', () => {
  it('sums tiered weights and floors at 0', () => {
    expect(computeWeightedFPDoR([])).toBe(100)
    expect(computeWeightedFPDoR(['Priority', 'UXD'])).toBe(100 - 10 - 2)
    expect(computeWeightedFPDoR(['Components', 'Child epics', 'Target Version', 'Delivery Owner'])).toBe(0)
  })

  it('falls back to a penalty of 3 for unrecognized item names', () => {
    expect(computeWeightedFPDoR(['Some Unknown Item'])).toBe(97)
  })
})

describe('computeFPDoRRisk', () => {
  it('short-circuits to LOW when Org Pulse reports no failed items', () => {
    const risk = computeFPDoRRisk(baseRow({ FPDoR: '17/17', 'Failed FPDoR Items': '' }))
    expect(risk).toEqual({ riskLevel: 'LOW', ready: true, critFails: [], highFails: [], medFails: [], softFails: [] })
  })

  it('coerces a {displayName} PM object instead of throwing (Jira field-shape gotcha)', () => {
    const row = baseRow({ FPDoR: '9/17', 'Failed FPDoR Items': 'Priority', PM: { displayName: 'Jane PM' } })
    expect(() => computeFPDoRRisk(row)).not.toThrow()
    expect(computeFPDoRRisk(row).critFails).not.toContain('PM')
  })

  it('flags HIGH risk when a critical field is missing', () => {
    const row = baseRow({ FPDoR: '9/17', 'Failed FPDoR Items': 'Priority', Components: '' })
    const risk = computeFPDoRRisk(row)
    expect(risk.riskLevel).toBe('HIGH')
    expect(risk.critFails).toContain('Components')
  })
})

describe('classifyFeature', () => {
  it('classifies bug/tech-debt labels as bugs', () => {
    expect(classifyFeature(baseRow({ Labels: 'tech-debt' }))).toBe('bugs')
  })

  it('classifies spike/research labels as research', () => {
    expect(classifyFeature(baseRow({ Labels: 'spike' }))).toBe('research')
  })

  it('defaults to features', () => {
    expect(classifyFeature(baseRow({ Labels: '' }))).toBe('features')
  })
})

describe('schedule', () => {
  it('hard-gates a feature with no components to No', () => {
    const [row] = schedule([baseRow({ Components: '' })])
    expect(row._place).toBe('No')
    expect(row._reason).toMatch(/No components assigned/)
  })

  it('hard-gates a feature with no Target Version to No', () => {
    const [row] = schedule([baseRow({ 'Target Versions': '' })])
    expect(row._place).toBe('No')
    expect(row._reason).toMatch(/No Target Version set/)
  })

  it('places a high-readiness, committed EA1-targeted feature into EA1', () => {
    const [row] = schedule([baseRow()])
    expect(row._place).toBe('EA1')
    expect(row._conf).toBeGreaterThan(0)
    expect(row._wFPDoR).toBe(100)
  })

  it('cascades a moderate-readiness EA1 target down to EA2', () => {
    const [row] = schedule([baseRow({
      FPDoR: '11/17',
      'Failed FPDoR Items': 'Docs impact;Cross-team deps;UXD'
    })])
    expect(row._place).toBe('EA2')
    expect(row._reason).toMatch(/Readiness gap/)
  })
})

describe('filterFeatures', () => {
  it('matches the pm filter against the live Jira PM field (not a component-ownership proxy)', () => {
    const rows = [baseRow({ PM: 'Jane PM' }), baseRow({ Key: 'RHAISTRAT-9002', PM: 'Other PM' })]
    const scheduled = schedule(rows)
    expect(filterFeatures(scheduled, { pm: 'Jane PM' }).map(r => r.Key)).toEqual(['RHAISTRAT-9001'])
  })

  it('treats place "EA1+EA2" as matching either phase', () => {
    const scheduled = schedule([
      baseRow({ Key: 'A', 'Target Versions': '3.6 EA1 RHOAI RELEASE' }),
      baseRow({ Key: 'B', 'Target Versions': '3.6 ga release', FPDoR: '17/17' })
    ])
    const ea1Row = scheduled.find(r => r.Key === 'A')
    expect(filterFeatures(scheduled, { place: 'EA1+EA2' })).toContain(ea1Row)
  })

  it('returns all rows when no filters are set', () => {
    const scheduled = schedule([baseRow()])
    expect(filterFeatures(scheduled, {})).toHaveLength(1)
  })
})

describe('aggregateBigRockStats', () => {
  it('rolls up per-outcome totals, in-plan counts, and average confidence', () => {
    const rows = [
      { _bigRocks: ['Upgrade Support'], _place: 'EA1', _conf: 80 },
      { _bigRocks: ['Upgrade Support'], _place: 'No', _conf: 0 },
      { _bigRocks: ['MaaS'], _place: 'GA', _conf: 60 }
    ]
    const { stats, coveredOutcomes, gappedOutcomes } = aggregateBigRockStats(rows)
    expect(stats['Upgrade Support']).toEqual({ inPlan: 1, total: 2, confSum: 80, avgConf: 80 })
    expect(stats['MaaS']).toEqual({ inPlan: 1, total: 1, confSum: 60, avgConf: 60 })
    expect(coveredOutcomes).toBeGreaterThanOrEqual(2)
    expect(gappedOutcomes).toBeGreaterThanOrEqual(0)
  })

  it('reports a gapped outcome when every matching feature is out of plan', () => {
    const rows = [{ _bigRocks: ['GPUaaS'], _place: 'No', _conf: 0 }]
    const { stats } = aggregateBigRockStats(rows)
    expect(stats['GPUaaS']).toEqual({ inPlan: 0, total: 1, confSum: 0, avgConf: 0 })
  })
})

describe('mapApiFeatureToRow', () => {
  it('maps the GET /planning/ai-planner feature shape to schedule()-ready row fields', () => {
    const apiFeature = {
      Key: 'RHAISTRAT-500',
      Summary: 'Example feature',
      Components: ['AI Hub', 'AI Core Platform'],
      Team: 'RHOAI AI Hub',
      Priority: 'Major',
      Outcome: 'RHAISTRAT-1339',
      PlannedFor: '3.6 EA1 RHOAI RELEASE',
      Score: 42,
      FPDoR: '17/17',
      'Failed FPDoR Items': '',
      Confidence: 'committed',
      Labels: 'rp-qg1-pass',
      'Fix Version': '',
      'Release Type': 'GA',
      PM: 'Jane PM',
      DeliveryOwner: 'Someone',
      OutcomeNumber: 3
    }
    const row = mapApiFeatureToRow(apiFeature)
    expect(row['Key']).toBe('RHAISTRAT-500')
    expect(row['Title']).toBe('Example feature')
    expect(row['Components']).toBe('AI Hub; AI Core Platform')
    expect(row['Target Versions']).toBe('3.6 EA1 RHOAI RELEASE')
    expect(row['RICE']).toBe(42)
    expect(row['PM']).toBe('Jane PM')
    expect(row['Assignee']).toBe('Someone')
    expect(row['OutcomeNumber']).toBe(3)
  })

  it('defaults OutcomeNumber to an em-dash and schedules cleanly when fields are missing', () => {
    const row = mapApiFeatureToRow({ Key: 'RHAISTRAT-501' })
    expect(row['OutcomeNumber']).toBe('—')
    expect(row['Components']).toBe('')
    const [scheduled] = schedule([row])
    expect(scheduled._place).toBe('No')
  })
})

describe('sortFeatures', () => {
  it('sorts numerically by FPDoR passed count', () => {
    const rows = [{ Key: 'A', FPDoR: '5/17' }, { Key: 'B', FPDoR: '12/17' }, { Key: 'C', FPDoR: '0/17' }]
    expect(sortFeatures(rows, 'FPDoR', true).map(r => r.Key)).toEqual(['C', 'A', 'B'])
    expect(sortFeatures(rows, 'FPDoR', false).map(r => r.Key)).toEqual(['B', 'A', 'C'])
  })

  it('sends em-dash OutcomeNumber rows to the end regardless of direction', () => {
    const rows = [{ Key: 'A', OutcomeNumber: '—' }, { Key: 'B', OutcomeNumber: 2 }, { Key: 'C', OutcomeNumber: 1 }]
    expect(sortFeatures(rows, 'OutcomeNumber', true).map(r => r.Key)).toEqual(['C', 'B', 'A'])
  })

  it('does not mutate the input array', () => {
    const rows = [{ Key: 'B' }, { Key: 'A' }]
    sortFeatures(rows, 'Key', true)
    expect(rows.map(r => r.Key)).toEqual(['B', 'A'])
  })
})

describe('assignNoTier', () => {
  it('tiers "No" rows by how much analysis is possible, and skips placed rows', () => {
    const rows = [
      { _place: 'No', _tv: '', _wFPDoR: 0, Components: '' },
      { _place: 'No', _tv: '3.6', _wFPDoR: 60, Components: 'AI Hub' },
      { _place: 'No', _tv: '3.6', _wFPDoR: 30, Components: 'AI Hub' },
      { _place: 'EA1', _wFPDoR: 90 }
    ]
    assignNoTier(rows)
    expect(rows[0]._noTier).toBe(3)
    expect(rows[1]._noTier).toBe(2)
    expect(rows[2]._noTier).toBe(1)
    expect(rows[3]._noTier).toBeUndefined()
  })
})

describe('applyPlacementGrouping', () => {
  it('groups EA1 before EA2 before GA before No, then by confidence descending', () => {
    const rows = [
      { Key: 'ga-low', _place: 'GA', _conf: 40 },
      { Key: 'ea1', _place: 'EA1', _conf: 50 },
      { Key: 'no', _place: 'No', _conf: 0, _noTier: 1 },
      { Key: 'ga-high', _place: 'GA', _conf: 90 },
      { Key: 'ea2', _place: 'EA2', _conf: 60 }
    ]
    const grouped = applyPlacementGrouping(rows, 'Score')
    expect(grouped.map(r => r.Key)).toEqual(['ea1', 'ea2', 'ga-high', 'ga-low', 'no'])
  })

  it('is a no-op when sorting by OutcomeNumber, to preserve that order', () => {
    const rows = [{ Key: 'A', _place: 'No' }, { Key: 'B', _place: 'EA1' }]
    expect(applyPlacementGrouping(rows, 'OutcomeNumber')).toBe(rows)
  })

  it('breaks ties among "No" rows by _noTier', () => {
    const rows = [
      { Key: 'tier3', _place: 'No', _conf: 0, _noTier: 3 },
      { Key: 'tier1', _place: 'No', _conf: 0, _noTier: 1 },
      { Key: 'tier2', _place: 'No', _conf: 0, _noTier: 2 }
    ]
    expect(applyPlacementGrouping(rows, 'Score').map(r => r.Key)).toEqual(['tier1', 'tier2', 'tier3'])
  })
})

describe('aggregateRoadmapGrid', () => {
  const outcomes = [{ key: 'Upgrade Support', title: 'Upgrade Support' }, { key: 'MaaS', title: 'MaaS' }]

  it('buckets features by outcome and placement, carrying feature detail for drilldown', () => {
    const rows = [
      { Key: 'A', Title: 'Feature A', Outcome: 'Upgrade Support', _place: 'EA1', _conf: 80 },
      { Key: 'B', Title: 'Feature B', Outcome: 'Upgrade Support', _place: 'EA1', _conf: 60 },
      { Key: 'C', Title: 'Feature C', Outcome: 'Upgrade Support', _place: 'No', _conf: 0 }
    ]
    const grid = aggregateRoadmapGrid(rows, outcomes)
    expect(grid).toHaveLength(1)
    expect(grid[0].name).toBe('Upgrade Support')
    expect(grid[0].phases.EA1.c).toBe(2)
    expect(grid[0].phases.EA1.s).toBe(140)
    expect(grid[0].phases.EA1.feats.map(f => f.key)).toEqual(['A', 'B'])
    expect(grid[0].phases.No.c).toBe(1)
    expect(grid[0].total).toBe(3)
  })

  it('falls back to _bigRocks[0] when Outcome is empty, and omits outcomes with zero features', () => {
    const rows = [{ Key: 'D', Title: 'Feature D', Outcome: '', _bigRocks: ['MaaS'], _place: 'GA', _conf: 90 }]
    const grid = aggregateRoadmapGrid(rows, outcomes)
    expect(grid.map(g => g.name)).toEqual(['MaaS'])
    expect(grid[0].phases.GA.c).toBe(1)
  })

  it('defaults to a BIG_ROCKS-derived outcome list when none is passed', () => {
    const rows = [{ Key: 'E', Title: 'Feature E', Outcome: 'Upgrade Support', _place: 'EA1', _conf: 50 }]
    const grid = aggregateRoadmapGrid(rows)
    expect(grid.find(g => g.name === 'Upgrade Support')).toBeTruthy()
  })

  it('ignores features with no resolvable outcome', () => {
    const rows = [{ Key: 'F', Title: 'Feature F', Outcome: '', _place: 'EA1', _conf: 50 }]
    expect(aggregateRoadmapGrid(rows, outcomes)).toEqual([])
  })
})

describe('roadmapCellColor', () => {
  it('bands by average confidence, and greys out empty cells', () => {
    expect(roadmapCellColor(0, 0)).toBe('#fafafa')
    expect(roadmapCellColor(3, 70)).toBe('#e8f5e9')
    expect(roadmapCellColor(3, 55)).toBe('#fff8e1')
    expect(roadmapCellColor(3, 20)).toBe('#ffebee')
  })
})

describe('computeDeliveryConfidenceSummary', () => {
  it('averages confidence across in-plan rows only, and bands the label', () => {
    const rows = [
      { _place: 'EA1', _conf: 90 },
      { _place: 'GA', _conf: 50 },
      { _place: 'No', _conf: 0 }
    ]
    const summary = computeDeliveryConfidenceSummary(rows)
    expect(summary).toEqual({ total: 3, totalInPlan: 2, avgConf: 70, confLabel: 'On Track' })
  })

  it('reports 0% / Critical when nothing is in plan', () => {
    expect(computeDeliveryConfidenceSummary([{ _place: 'No', _conf: 0 }])).toEqual({
      total: 1, totalInPlan: 0, avgConf: 0, confLabel: 'Critical'
    })
  })
})

describe('computeWorkMix', () => {
  it('classifies in-plan rows and measures each bucket against its target share', () => {
    const rows = [
      { _place: 'EA1', Title: 'Feature', Labels: '' },
      { _place: 'EA1', Title: 'Fix a bug', Labels: 'bug' },
      { _place: 'No', Title: 'Spike', Labels: 'spike' } // excluded -- not in plan
    ]
    const mix = computeWorkMix(rows)
    const features = mix.find(m => m.key === 'features')
    const bugs = mix.find(m => m.key === 'bugs')
    const research = mix.find(m => m.key === 'research')
    expect(features.count).toBe(1)
    expect(bugs.count).toBe(1)
    expect(research.count).toBe(0)
    expect(features.pct).toBe(50)
    expect(bugs.target).toBe(40)
    expect(research.onTarget).toBe(false)
  })
})

describe('bigRockStatusLabel', () => {
  it('labels by the Aha! OKR confidence thresholds, with a distinct label for empty outcomes', () => {
    expect(bigRockStatusLabel(0, 0)).toBe('No features in plan')
    expect(bigRockStatusLabel(3, 70)).toBe('Confident')
    expect(bigRockStatusLabel(3, 50)).toBe('Lagging')
    expect(bigRockStatusLabel(3, 10)).toBe('At Risk')
  })
})

describe('computeComponentCapacityUsage', () => {
  it('counts in-plan usage per component and flags rows over their CAP ceiling', () => {
    // CAP['AI Hub'] = { EA1: 1, EA2: 2, GA: 1 }
    const rows = [
      { _place: 'EA1', Components: 'AI Hub' },
      { _place: 'EA1', Components: 'AI Hub' },
      { _place: 'No', Components: 'AI Hub' } // excluded -- not in plan
    ]
    const usage = computeComponentCapacityUsage(rows).find(u => u.component === 'AI Hub')
    expect(usage.used).toEqual({ EA1: 2, EA2: 0, GA: 0 })
    expect(usage.cap).toEqual({ EA1: 1, EA2: 2, GA: 1 })
    expect(usage.over).toBe(true)
  })

  it('defaults unlisted components to a cap of 1/1/1', () => {
    const usage = computeComponentCapacityUsage([{ _place: 'GA', Components: 'Totally Unknown Thing' }])
      .find(u => u.component === 'Totally Unknown Thing')
    expect(usage.cap).toEqual({ EA1: 1, EA2: 1, GA: 1 })
    expect(usage.over).toBe(false)
  })
})

describe('computeTeamCapacityUsage', () => {
  it('sorts bottleneck teams (Dashboard/Docs) first, then alphabetically', () => {
    const rows = [
      { _place: 'GA', Team: 'Zebra Team' },
      { _place: 'GA', Team: 'Documentation' },
      { _place: 'GA', Team: 'Alpha Team' }
    ]
    const usage = computeTeamCapacityUsage(rows)
    expect(usage.map(u => u.team)).toEqual(['Documentation', 'Alpha Team', 'Zebra Team'])
    expect(usage[0].isBottleneck).toBe(true)
    expect(usage[0].isDoc).toBe(true)
  })

  it('excludes "No"-placed rows and rows with no team', () => {
    const rows = [{ _place: 'No', Team: 'Alpha Team' }, { _place: 'GA', Team: '' }]
    expect(computeTeamCapacityUsage(rows)).toEqual([])
  })
})

describe('computeExclusionBreakdown', () => {
  it('groups "No" rows by reason, first-match-wins, sorted by group size descending', () => {
    const rows = [
      { _place: 'No', _reason: 'No Target Version set' },
      { _place: 'No', _reason: 'No components assigned' },
      { _place: 'No', _reason: 'Mandatory FPDoR field missing: PM' },
      { _place: 'No', _reason: 'Something else entirely' },
      { _place: 'EA1', _reason: '' } // excluded -- not "No"
    ]
    const groups = computeExclusionBreakdown(rows)
    expect(groups[0].key).toBe('No Target Version')
    expect(groups[0].rows).toHaveLength(2)
    expect(groups.find(g => g.key === 'other').rows).toHaveLength(1)
  })
})

describe('computeFpdorFieldBreakdown', () => {
  it('extracts the missing field name and ranks by frequency', () => {
    const rows = [
      { _place: 'No', _reason: 'Mandatory FPDoR field missing: PM · extra' },
      { _place: 'No', _reason: 'Mandatory FPDoR field missing: PM' },
      { _place: 'No', _reason: 'Mandatory FPDoR field missing: Release Type' }
    ]
    const breakdown = computeFpdorFieldBreakdown(rows)
    expect(breakdown[0]).toEqual({ field: 'PM', count: 2, pct: 100 })
    expect(breakdown[1]).toEqual({ field: 'Release Type', count: 1, pct: 50 })
  })

  it('returns an empty list when nothing is blocked by a mandatory field', () => {
    expect(computeFpdorFieldBreakdown([{ _place: 'No', _reason: 'Readiness too low' }])).toEqual([])
  })
})
