import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useHealthAggregation } from '../../client/composables/useHealthAggregation'

function makeHealthData(features) {
  return { features: features, summary: { total: features.length } }
}

function makeFeature(key, rfe, bigRock) {
  return { issueKey: key, rfe: rfe || null, bigRock: bigRock || null }
}

function makeHealthFeature(key, level, flags, override) {
  var result = {
    key: key,
    risk: {
      level: level,
      score: flags ? flags.length : 0,
      flags: flags || []
    },
    dor: { gate: 'dor', passed: true, blockers: [], warnings: [] },
    dod: { gate: 'dod', passed: level === 'green', checks: [] },
    planningStatus: level === 'green' ? 'ready-for-execution' : 'in-planning'
  }
  if (override) {
    result.risk.override = override
  }
  return result
}

describe('useHealthAggregation', function() {
  describe('healthByKey', function() {
    it('maps health features by key', function() {
      var hd = ref(makeHealthData([
        makeHealthFeature('FEAT-1', 'green', []),
        makeHealthFeature('FEAT-2', 'red', [{ category: 'BLOCKED' }])
      ]))
      var features = ref([])
      var rfes = ref([])
      var bigRocks = ref([])

      var result = useHealthAggregation(hd, features, rfes, bigRocks)
      expect(Object.keys(result.healthByKey.value)).toEqual(['FEAT-1', 'FEAT-2'])
      expect(result.healthByKey.value['FEAT-1'].risk.level).toBe('green')
      expect(result.healthByKey.value['FEAT-2'].risk.level).toBe('red')
    })

    it('returns empty object when healthData is null', function() {
      var result = useHealthAggregation(ref(null), ref([]), ref([]), ref([]))
      expect(result.healthByKey.value).toEqual({})
    })

    it('returns empty object when healthData has no features', function() {
      var result = useHealthAggregation(ref({}), ref([]), ref([]), ref([]))
      expect(result.healthByKey.value).toEqual({})
    })
  })

  describe('healthSummary', function() {
    it('returns summary from health data', function() {
      var hd = ref({ features: [], summary: { total: 5, byRisk: { red: 1 } } })
      var result = useHealthAggregation(hd, ref([]), ref([]), ref([]))
      expect(result.healthSummary.value).toEqual({ total: 5, byRisk: { red: 1 } })
    })

    it('returns null when healthData is null', function() {
      var result = useHealthAggregation(ref(null), ref([]), ref([]), ref([]))
      expect(result.healthSummary.value).toBe(null)
    })
  })

  describe('rfeKeyToHealth', function() {
    it('maps RFE keys to worst feature health', function() {
      var hd = ref(makeHealthData([
        makeHealthFeature('FEAT-1', 'green', []),
        makeHealthFeature('FEAT-2', 'red', [{ category: 'BLOCKED' }])
      ]))
      var features = ref([
        makeFeature('FEAT-1', 'RFE-100', null),
        makeFeature('FEAT-2', 'RFE-100', null)
      ])

      var result = useHealthAggregation(hd, features, ref([]), ref([]))
      expect(result.rfeKeyToHealth.value['RFE-100'].risk.level).toBe('red')
    })

    it('respects risk overrides (M5 fix)', function() {
      var hd = ref(makeHealthData([
        makeHealthFeature('FEAT-1', 'red', [{ category: 'BLOCKED' }], { riskOverride: 'green', reason: 'PM override' })
      ]))
      var features = ref([
        makeFeature('FEAT-1', 'RFE-100', null)
      ])

      var result = useHealthAggregation(hd, features, ref([]), ref([]))
      // With override, the effective level should be green, not red
      expect(result.rfeKeyToHealth.value['RFE-100'].risk.level).toBe('green')
    })

    it('picks worst override-adjusted level across features for same RFE', function() {
      var hd = ref(makeHealthData([
        makeHealthFeature('FEAT-1', 'red', [], { riskOverride: 'green', reason: 'OK' }),
        makeHealthFeature('FEAT-2', 'yellow', [])
      ]))
      var features = ref([
        makeFeature('FEAT-1', 'RFE-100', null),
        makeFeature('FEAT-2', 'RFE-100', null)
      ])

      var result = useHealthAggregation(hd, features, ref([]), ref([]))
      // FEAT-1 is green (overridden), FEAT-2 is yellow (no override) -- worst is yellow
      expect(result.rfeKeyToHealth.value['RFE-100'].risk.level).toBe('yellow')
    })

    it('skips features without rfe', function() {
      var hd = ref(makeHealthData([
        makeHealthFeature('FEAT-1', 'red', [])
      ]))
      var features = ref([
        makeFeature('FEAT-1', null, null)
      ])

      var result = useHealthAggregation(hd, features, ref([]), ref([]))
      expect(Object.keys(result.rfeKeyToHealth.value)).toEqual([])
    })

    it('returns empty when no health data', function() {
      var features = ref([makeFeature('FEAT-1', 'RFE-100', null)])
      var result = useHealthAggregation(ref(null), features, ref([]), ref([]))
      expect(result.rfeKeyToHealth.value).toEqual({})
    })
  })

  describe('rockHealth', function() {
    it('aggregates worst health per big rock', function() {
      var hd = ref(makeHealthData([
        makeHealthFeature('FEAT-1', 'green', []),
        makeHealthFeature('FEAT-2', 'yellow', [{ category: 'EA1_MISS' }]),
        makeHealthFeature('FEAT-3', 'red', [{ category: 'BLOCKED' }, { category: 'MILESTONE_MISS' }])
      ]))
      var features = ref([
        makeFeature('FEAT-1', null, 'Rock A'),
        makeFeature('FEAT-2', null, 'Rock A'),
        makeFeature('FEAT-3', null, 'Rock B')
      ])

      var result = useHealthAggregation(hd, features, ref([]), ref([]))
      expect(result.rockHealth.value['Rock A'].worstLevel).toBe('yellow')
      expect(result.rockHealth.value['Rock A'].featureCount).toBe(2)
      expect(result.rockHealth.value['Rock B'].worstLevel).toBe('red')
      expect(result.rockHealth.value['Rock B'].featureCount).toBe(1)
    })

    it('respects risk overrides for rock health', function() {
      var hd = ref(makeHealthData([
        makeHealthFeature('FEAT-1', 'red', [{ category: 'BLOCKED' }], { riskOverride: 'green', reason: 'OK' })
      ]))
      var features = ref([
        makeFeature('FEAT-1', null, 'Rock A')
      ])

      var result = useHealthAggregation(hd, features, ref([]), ref([]))
      expect(result.rockHealth.value['Rock A'].worstLevel).toBe('green')
    })

    it('skips features without bigRock', function() {
      var hd = ref(makeHealthData([
        makeHealthFeature('FEAT-1', 'red', [])
      ]))
      var features = ref([
        makeFeature('FEAT-1', null, null)
      ])

      var result = useHealthAggregation(hd, features, ref([]), ref([]))
      expect(Object.keys(result.rockHealth.value)).toEqual([])
    })

    it('returns empty when no health data', function() {
      var result = useHealthAggregation(ref(null), ref([]), ref([]), ref([]))
      expect(result.rockHealth.value).toEqual({})
    })
  })

  describe('rockFeatures', function() {
    it('groups features by big rock with health detail', function() {
      var hd = ref(makeHealthData([
        makeHealthFeature('FEAT-1', 'green', []),
        makeHealthFeature('FEAT-2', 'red', [{ category: 'BLOCKED' }])
      ]))
      var features = ref([
        makeFeature('FEAT-1', null, 'Rock A'),
        makeFeature('FEAT-2', null, 'Rock A')
      ])

      var result = useHealthAggregation(hd, features, ref([]), ref([]))
      var rf = result.rockFeatures.value['Rock A']
      expect(rf).toHaveLength(2)
      expect(rf[0]).toEqual({
        key: 'FEAT-1',
        level: 'green',
        flagCount: 0,
        flagCategories: []
      })
      expect(rf[1]).toEqual({
        key: 'FEAT-2',
        level: 'red',
        flagCount: 1,
        flagCategories: ['BLOCKED']
      })
    })

    it('defaults to green when feature has no health data', function() {
      var hd = ref(makeHealthData([]))
      var features = ref([
        makeFeature('FEAT-1', null, 'Rock A')
      ])

      // healthByKey will be empty, so rockFeatures should also be empty
      var result = useHealthAggregation(hd, features, ref([]), ref([]))
      expect(result.rockFeatures.value).toEqual({})
    })

    it('uses overridden level in feature detail', function() {
      var hd = ref(makeHealthData([
        makeHealthFeature('FEAT-1', 'red', [{ category: 'BLOCKED' }], { riskOverride: 'yellow', reason: 'OK' })
      ]))
      var features = ref([
        makeFeature('FEAT-1', null, 'Rock A')
      ])

      var result = useHealthAggregation(hd, features, ref([]), ref([]))
      expect(result.rockFeatures.value['Rock A'][0].level).toBe('yellow')
    })
  })

  describe('reactivity', function() {
    it('updates when healthData changes', function() {
      var hd = ref(null)
      var features = ref([makeFeature('FEAT-1', 'RFE-100', 'Rock A')])

      var result = useHealthAggregation(hd, features, ref([]), ref([]))
      expect(result.healthByKey.value).toEqual({})

      hd.value = makeHealthData([makeHealthFeature('FEAT-1', 'red', [])])
      expect(result.healthByKey.value['FEAT-1'].risk.level).toBe('red')
      expect(result.rockHealth.value['Rock A'].worstLevel).toBe('red')
    })

    it('updates when features change', function() {
      var hd = ref(makeHealthData([
        makeHealthFeature('FEAT-1', 'red', []),
        makeHealthFeature('FEAT-2', 'green', [])
      ]))
      var features = ref([makeFeature('FEAT-1', null, 'Rock A')])

      var result = useHealthAggregation(hd, features, ref([]), ref([]))
      expect(result.rockHealth.value['Rock A'].featureCount).toBe(1)

      features.value = [
        makeFeature('FEAT-1', null, 'Rock A'),
        makeFeature('FEAT-2', null, 'Rock A')
      ]
      expect(result.rockHealth.value['Rock A'].featureCount).toBe(2)
    })
  })
})
