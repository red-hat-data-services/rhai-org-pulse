import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useHealthAggregation } from '../../../client/plan/composables/useHealthAggregation'

function makeHealthData(features) {
  return { features: features, summary: { total: features.length } }
}

function makeFeature(key, rfe, bigRock, tier, phase) {
  return { issueKey: key, rfe: rfe || null, bigRock: bigRock || null, tier: tier || null, phase: phase || '' }
}

function makeHealthFeature(key, level, flags, override, extras) {
  var result = {
    key: key,
    summary: (extras && extras.summary) || 'Summary for ' + key,
    status: (extras && extras.status) || 'In Progress',
    deliveryOwner: (extras && extras.deliveryOwner) || 'Owner of ' + key,
    jiraUrl: (extras && extras.jiraUrl) || 'https://issues.redhat.com/browse/' + key,
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
      expect(result.rockHealth.value['Rock A'].dorPassedCount).toBe(2)
      expect(result.rockHealth.value['Rock A'].dodPassedCount).toBe(1)
      expect(result.rockHealth.value['Rock B'].worstLevel).toBe('red')
      expect(result.rockHealth.value['Rock B'].featureCount).toBe(1)
      expect(result.rockHealth.value['Rock B'].dorPassedCount).toBe(1)
      expect(result.rockHealth.value['Rock B'].dodPassedCount).toBe(0)
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

    it('splits merged bigRock names into separate entries', function() {
      var hd = ref(makeHealthData([
        makeHealthFeature('FEAT-1', 'yellow', [{ category: 'DOR_INCOMPLETE' }])
      ]))
      var features = ref([
        makeFeature('FEAT-1', null, 'Rock A, Rock B')
      ])

      var result = useHealthAggregation(hd, features, ref([]), ref([]))
      expect(result.rockHealth.value['Rock A']).toBeDefined()
      expect(result.rockHealth.value['Rock B']).toBeDefined()
      expect(result.rockHealth.value['Rock A, Rock B']).toBeUndefined()
      expect(result.rockHealth.value['Rock A'].worstLevel).toBe('yellow')
      expect(result.rockHealth.value['Rock B'].worstLevel).toBe('yellow')
      expect(result.rockHealth.value['Rock A'].featureCount).toBe(1)
      expect(result.rockHealth.value['Rock B'].featureCount).toBe(1)
    })

    it('worst-of aggregation works across split rocks', function() {
      var hd = ref(makeHealthData([
        makeHealthFeature('FEAT-1', 'red', [{ category: 'BLOCKED' }])
      ]))
      var features = ref([
        makeFeature('FEAT-1', null, 'Rock A, Rock B')
      ])

      var result = useHealthAggregation(hd, features, ref([]), ref([]))
      expect(result.rockHealth.value['Rock A'].worstLevel).toBe('red')
      expect(result.rockHealth.value['Rock B'].worstLevel).toBe('red')
    })

    it('empty bigRock string is skipped', function() {
      var hd = ref(makeHealthData([
        makeHealthFeature('FEAT-1', 'red', [])
      ]))
      var features = ref([
        makeFeature('FEAT-1', null, '')
      ])

      var result = useHealthAggregation(hd, features, ref([]), ref([]))
      expect(Object.keys(result.rockHealth.value)).toEqual([])
    })

    it('aggregates releaseTypes from feature phase values (DP/TP/GA only)', function() {
      var hd = ref(makeHealthData([
        makeHealthFeature('FEAT-1', 'green', []),
        makeHealthFeature('FEAT-2', 'green', []),
        makeHealthFeature('FEAT-3', 'green', [])
      ]))
      var features = ref([
        makeFeature('FEAT-1', null, 'Rock A', null, 'TP'),
        makeFeature('FEAT-2', null, 'Rock A', null, 'GA'),
        makeFeature('FEAT-3', null, 'Rock A', null, 'EA1')
      ])

      var result = useHealthAggregation(hd, features, ref([]), ref([]))
      // EA1 is excluded; TP and GA are included, sorted by maturity order
      expect(result.rockHealth.value['Rock A'].releaseTypes).toEqual(['TP', 'GA'])
    })

    it('returns empty releaseTypes when no features have qualifying phase', function() {
      var hd = ref(makeHealthData([
        makeHealthFeature('FEAT-1', 'green', [])
      ]))
      var features = ref([
        makeFeature('FEAT-1', null, 'Rock A', null, 'EA2')
      ])

      var result = useHealthAggregation(hd, features, ref([]), ref([]))
      expect(result.rockHealth.value['Rock A'].releaseTypes).toEqual([])
    })

    it('collects releaseTypes even for features without health data', function() {
      var hd = ref(makeHealthData([
        makeHealthFeature('FEAT-1', 'green', [])
        // FEAT-2 has no health entry
      ]))
      var features = ref([
        makeFeature('FEAT-1', null, 'Rock A', null, 'GA'),
        makeFeature('FEAT-2', null, 'Rock A', null, 'DP')
      ])

      var result = useHealthAggregation(hd, features, ref([]), ref([]))
      // Both DP and GA should be collected even though FEAT-2 has no health data
      expect(result.rockHealth.value['Rock A'].releaseTypes).toEqual(['DP', 'GA'])
    })
  })

  describe('rockFeatures', function() {
    it('groups features by big rock with health detail including enriched fields', function() {
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
      expect(rf[0].key).toBe('FEAT-1')
      expect(rf[0].level).toBe('green')
      expect(rf[0].flagCount).toBe(0)
      expect(rf[0].flagCategories).toEqual([])
      expect(rf[0].summary).toBe('Summary for FEAT-1')
      expect(rf[0].dorPassed).toBe(true)
      expect(rf[0].dodPassed).toBe(true)
      expect(rf[0].planningStatus).toBe('ready-for-execution')
      expect(rf[0].deliveryOwner).toBe('Owner of FEAT-1')
      expect(rf[0].jiraUrl).toBe('https://issues.redhat.com/browse/FEAT-1')
      expect(rf[0].override).toBe(null)
      expect(rf[0].status).toBe('In Progress')
      expect(rf[0].fixVersions).toBe('')
      expect(rf[0].targetRelease).toBe('')
      expect(rf[0].versionStatus).toBe('none')
      expect(rf[0].completionPct).toBe(0)
      expect(rf[0].planningChecks).toBe(null)

      expect(rf[1].key).toBe('FEAT-2')
      expect(rf[1].level).toBe('red')
      expect(rf[1].flagCount).toBe(1)
      expect(rf[1].flagCategories).toEqual(['BLOCKED'])
      expect(rf[1].summary).toBe('Summary for FEAT-2')
      expect(rf[1].dorPassed).toBe(true)
      expect(rf[1].dodPassed).toBe(false)
      expect(rf[1].planningStatus).toBe('in-planning')
      expect(rf[1].deliveryOwner).toBe('Owner of FEAT-2')
      expect(rf[1].jiraUrl).toBe('https://issues.redhat.com/browse/FEAT-2')
      expect(rf[1].override).toBe(null)
      expect(rf[1].status).toBe('In Progress')
      expect(rf[1].fixVersions).toBe('')
      expect(rf[1].targetRelease).toBe('')
      expect(rf[1].versionStatus).toBe('none')
      expect(rf[1].completionPct).toBe(0)
      expect(rf[1].planningChecks).toBe(null)
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
      expect(result.rockFeatures.value['Rock A'][0].override).toEqual({ riskOverride: 'yellow', reason: 'OK' })
    })

    it('null-guards enriched fields when feature has no health entry', function() {
      var hd = ref(makeHealthData([
        makeHealthFeature('FEAT-1', 'green', [])
      ]))
      var features = ref([
        makeFeature('FEAT-1', null, 'Rock A'),
        makeFeature('FEAT-UNKNOWN', null, 'Rock A')
      ])

      var result = useHealthAggregation(hd, features, ref([]), ref([]))
      var rf = result.rockFeatures.value['Rock A']
      expect(rf).toHaveLength(2)
      var unknown = rf[1]
      expect(unknown.key).toBe('FEAT-UNKNOWN')
      expect(unknown.level).toBe('green')
      expect(unknown.flagCount).toBe(0)
      expect(unknown.flagCategories).toEqual([])
      expect(unknown.summary).toBe('')
      expect(unknown.dorPassed).toBe(null)
      expect(unknown.dodPassed).toBe(null)
      expect(unknown.planningStatus).toBe('')
      expect(unknown.deliveryOwner).toBe('')
      expect(unknown.jiraUrl).toBe('')
      expect(unknown.override).toBe(null)
      expect(unknown.status).toBe('')
      expect(unknown.fixVersions).toBe('')
      expect(unknown.targetRelease).toBe('')
      expect(unknown.versionStatus).toBe('none')
      expect(unknown.completionPct).toBe(0)
      expect(unknown.planningChecks).toBe(null)
    })

    it('splits merged bigRock names into separate entries', function() {
      var hd = ref(makeHealthData([
        makeHealthFeature('FEAT-1', 'yellow', [{ category: 'DOR_INCOMPLETE' }])
      ]))
      var features = ref([
        makeFeature('FEAT-1', null, 'Rock A, Rock B')
      ])

      var result = useHealthAggregation(hd, features, ref([]), ref([]))
      expect(result.rockFeatures.value['Rock A']).toBeDefined()
      expect(result.rockFeatures.value['Rock B']).toBeDefined()
      expect(result.rockFeatures.value['Rock A, Rock B']).toBeUndefined()
      expect(result.rockFeatures.value['Rock A']).toHaveLength(1)
      expect(result.rockFeatures.value['Rock B']).toHaveLength(1)
      expect(result.rockFeatures.value['Rock A'][0].key).toBe('FEAT-1')
      expect(result.rockFeatures.value['Rock B'][0].key).toBe('FEAT-1')
      expect(result.rockFeatures.value['Rock A'][0].bigRock).toBe('Rock A, Rock B')
      expect(result.rockFeatures.value['Rock B'][0].bigRock).toBe('Rock A, Rock B')
    })

    it('includes bigRock field in rockFeatures projection', function() {
      var hd = ref(makeHealthData([
        makeHealthFeature('FEAT-1', 'green', [])
      ]))
      var features = ref([
        makeFeature('FEAT-1', null, 'Single Rock')
      ])

      var result = useHealthAggregation(hd, features, ref([]), ref([]))
      expect(result.rockFeatures.value['Single Rock'][0].bigRock).toBe('Single Rock')
    })

    it('includes releaseType from feature phase in rockFeatures projection', function() {
      var hd = ref(makeHealthData([
        makeHealthFeature('FEAT-1', 'green', []),
        makeHealthFeature('FEAT-2', 'green', [])
      ]))
      var features = ref([
        makeFeature('FEAT-1', null, 'Rock A', null, 'TP'),
        makeFeature('FEAT-2', null, 'Rock A', null, '')
      ])

      var result = useHealthAggregation(hd, features, ref([]), ref([]))
      var rf = result.rockFeatures.value['Rock A']
      expect(rf[0].releaseType).toBe('TP')
      expect(rf[1].releaseType).toBe('')
    })

    it('green count never exceeds total count (fraction consistency)', function() {
      var hd = ref(makeHealthData([
        makeHealthFeature('FEAT-1', 'green', []),
        makeHealthFeature('FEAT-2', 'yellow', [{ category: 'DOR' }]),
        makeHealthFeature('FEAT-3', 'red', [{ category: 'BLOCKED' }])
      ]))
      var features = ref([
        makeFeature('FEAT-1', null, 'Rock A'),
        makeFeature('FEAT-2', null, 'Rock A'),
        makeFeature('FEAT-3', null, 'Rock A')
      ])

      var result = useHealthAggregation(hd, features, ref([]), ref([]))
      var rf = result.rockFeatures.value['Rock A']
      var greenCount = rf.filter(function(f) { return f.level === 'green' }).length
      expect(greenCount).toBeLessThanOrEqual(rf.length)
      expect(greenCount).toBe(1)
      expect(rf.length).toBe(3)
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

  describe('tier1HealthSummary', function() {
    it('counts only Tier 1 health features', function() {
      var hd = ref(makeHealthData([
        makeHealthFeature('FEAT-1', 'green', []),
        makeHealthFeature('FEAT-2', 'yellow', [{ category: 'EA1_MISS' }]),
        makeHealthFeature('FEAT-3', 'red', [{ category: 'BLOCKED' }])
      ]))
      // Stamp tier on the health features directly
      hd.value.features[0].tier = 1
      hd.value.features[1].tier = 1
      hd.value.features[2].tier = 2  // Not Tier 1
      var features = ref([])

      var result = useHealthAggregation(hd, features, ref([]), ref([]))
      expect(result.tier1HealthSummary.value.byRisk).toEqual({ green: 1, yellow: 1, red: 0 })
    })

    it('respects risk overrides', function() {
      var hd = ref(makeHealthData([
        makeHealthFeature('FEAT-1', 'red', [{ category: 'BLOCKED' }], { riskOverride: 'green', reason: 'PM override' })
      ]))
      hd.value.features[0].tier = 1
      var features = ref([])

      var result = useHealthAggregation(hd, features, ref([]), ref([]))
      // Override changes red -> green
      expect(result.tier1HealthSummary.value.byRisk).toEqual({ green: 1, yellow: 0, red: 0 })
    })

    it('returns null when no health data', function() {
      var result = useHealthAggregation(ref(null), ref([]), ref([]), ref([]))
      expect(result.tier1HealthSummary.value).toBe(null)
    })
  })
})
