import { describe, it, expect } from 'vitest'
import {
  schedule,
  detectEvt,
  computeFPDoRRisk,
  computeWeightedFPDoR,
  classifyFeature,
  filterFeatures,
  aggregateBigRockStats
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
