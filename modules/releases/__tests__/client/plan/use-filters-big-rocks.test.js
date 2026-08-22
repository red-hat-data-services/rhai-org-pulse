import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useFilters } from '../../../client/plan/composables/useFilters'

var sampleBigRocks = [
  { name: 'MaaS', pillar: 'Inference', owner: 'Pat Johnson', architect: 'Alex', notes: '', fullName: 'Model as a Service', featureCount: 3, rfeCount: 1 },
  { name: 'Gen AI Studio', pillar: 'Agents', owner: 'Morgan Lee', architect: 'Sam', notes: 'Priority', fullName: '', featureCount: 2, rfeCount: 0 },
  { name: 'Eval Hub', pillar: 'Inference', owner: 'Taylor', architect: '', notes: '', fullName: 'Evaluation Hub', featureCount: 1, rfeCount: 0 },
  { name: 'Empty Rock', pillar: 'Inference', owner: 'Pat', architect: '', notes: 'wiring', fullName: '', featureCount: 0, rfeCount: 0 }
]

describe('filteredBigRocks', function() {
  it('returns all rocks including empty ones', function() {
    var features = ref([])
    var rfes = ref([])
    var bigRocks = ref(sampleBigRocks)
    var result = useFilters(features, rfes, bigRocks)
    expect(result.filteredBigRocks.value).toHaveLength(4)
    expect(result.filteredBigRocks.value.map(function(r) { return r.name })).toEqual([
      'MaaS', 'Gen AI Studio', 'Eval Hub', 'Empty Rock'
    ])
  })

  it('returns rocks regardless of feature/rfe counts', function() {
    var features = ref([])
    var rfes = ref([])
    var bigRocks = ref([
      { name: 'No Counts', pillar: 'Agents' },
      { name: 'Has Work', pillar: 'Agents', featureCount: 1, rfeCount: 0 }
    ])
    var result = useFilters(features, rfes, bigRocks)
    expect(result.filteredBigRocks.value).toHaveLength(2)
    expect(result.filteredBigRocks.value.map(function(r) { return r.name })).toEqual(['No Counts', 'Has Work'])
  })

  it('filters by pillar including empty rocks', function() {
    var features = ref([])
    var rfes = ref([])
    var bigRocks = ref(sampleBigRocks)
    var result = useFilters(features, rfes, bigRocks)

    result.selectedPillar.value = 'Inference'
    expect(result.filteredBigRocks.value).toHaveLength(3)
    expect(result.filteredBigRocks.value.map(function(r) { return r.name })).toEqual(['MaaS', 'Eval Hub', 'Empty Rock'])
  })

  it('filters by search query (name)', function() {
    var features = ref([])
    var rfes = ref([])
    var bigRocks = ref(sampleBigRocks)
    var result = useFilters(features, rfes, bigRocks)

    result.searchQuery.value = 'maas'
    expect(result.filteredBigRocks.value).toHaveLength(1)
    expect(result.filteredBigRocks.value[0].name).toBe('MaaS')
  })

  it('filters by search query (owner)', function() {
    var features = ref([])
    var rfes = ref([])
    var bigRocks = ref(sampleBigRocks)
    var result = useFilters(features, rfes, bigRocks)

    result.searchQuery.value = 'morgan'
    expect(result.filteredBigRocks.value).toHaveLength(1)
    expect(result.filteredBigRocks.value[0].name).toBe('Gen AI Studio')
  })

  it('filters by search query (fullName)', function() {
    var features = ref([])
    var rfes = ref([])
    var bigRocks = ref(sampleBigRocks)
    var result = useFilters(features, rfes, bigRocks)

    result.searchQuery.value = 'evaluation'
    expect(result.filteredBigRocks.value).toHaveLength(1)
    expect(result.filteredBigRocks.value[0].name).toBe('Eval Hub')
  })

  it('filters by search query (notes)', function() {
    var features = ref([])
    var rfes = ref([])
    var bigRocks = ref(sampleBigRocks)
    var result = useFilters(features, rfes, bigRocks)

    result.searchQuery.value = 'priority'
    expect(result.filteredBigRocks.value).toHaveLength(1)
    expect(result.filteredBigRocks.value[0].name).toBe('Gen AI Studio')
  })

  it('combines pillar and search filters', function() {
    var features = ref([])
    var rfes = ref([])
    var bigRocks = ref(sampleBigRocks)
    var result = useFilters(features, rfes, bigRocks)

    result.selectedPillar.value = 'Inference'
    result.searchQuery.value = 'eval'
    expect(result.filteredBigRocks.value).toHaveLength(1)
    expect(result.filteredBigRocks.value[0].name).toBe('Eval Hub')
  })

  it('returns empty when pillar matches nothing', function() {
    var features = ref([])
    var rfes = ref([])
    var bigRocks = ref(sampleBigRocks)
    var result = useFilters(features, rfes, bigRocks)

    result.selectedPillar.value = 'NonExistent'
    expect(result.filteredBigRocks.value).toHaveLength(0)
  })

  it('returns empty when bigRocks is null', function() {
    var features = ref([])
    var rfes = ref([])
    var bigRocks = ref(null)
    var result = useFilters(features, rfes, bigRocks)
    expect(result.filteredBigRocks.value).toEqual([])
  })

  it('clearFilters resets pillar', function() {
    var features = ref([])
    var rfes = ref([])
    var bigRocks = ref(sampleBigRocks)
    var result = useFilters(features, rfes, bigRocks)

    result.selectedPillar.value = 'Inference'
    expect(result.filteredBigRocks.value).toHaveLength(3)

    result.clearFilters()
    expect(result.filteredBigRocks.value).toHaveLength(4)
  })
})
