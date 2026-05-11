import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useReleaseDistribution } from '../../client/composables/useReleaseDistribution'

describe('useReleaseDistribution', function() {
  it('buckets features by fixVersion release', function() {
    var features = ref([
      { fixVersion: 'rhoai-3.5.EA1' },
      { fixVersion: 'rhoai-3.5.EA1' },
      { fixVersion: 'rhoai-3.5.EA1' },
      { fixVersion: 'rhoai-3.5.EA2' },
      { fixVersion: 'RHAIIS-3.4 EA-2' },
      { fixVersion: 'RHAII-3.4 GA' },
      { fixVersion: 'rhoai-3.5.GA' },
      { fixVersion: 'rhoai-3.5.GA' },
      { fixVersion: 'rhoai-3.5.GA' },
      { fixVersion: '' }
    ])
    var result = useReleaseDistribution(features)
    var dist = result.releaseDistribution.value
    expect(dist).toEqual([
      { label: 'EA1', count: 3, pct: 30, barColor: 'bg-blue-500' },
      { label: 'EA2', count: 2, pct: 20, barColor: 'bg-amber-500' },
      { label: 'GA', count: 4, pct: 40, barColor: 'bg-emerald-500' },
      { label: '--', count: 1, pct: 10, barColor: 'bg-gray-400' }
    ])
  })

  it('includes all release buckets even with zero count', function() {
    var features = ref([
      { fixVersion: 'rhoai-3.5.GA' },
      { fixVersion: 'rhoai-3.5.GA' }
    ])
    var result = useReleaseDistribution(features)
    var labels = result.releaseDistribution.value.map(function(r) { return r.label })
    expect(labels).toEqual(['EA1', 'EA2', 'GA', '--'])
    var ga = result.releaseDistribution.value.find(function(r) { return r.label === 'GA' })
    expect(ga.count).toBe(2)
    var ea1 = result.releaseDistribution.value.find(function(r) { return r.label === 'EA1' })
    expect(ea1.count).toBe(0)
  })

  it('returns null when features is empty', function() {
    var result = useReleaseDistribution(ref([]))
    expect(result.releaseDistribution.value).toBe(null)
  })

  it('handles various fixVersion formats', function() {
    var features = ref([
      { fixVersion: 'rhoai-3.5.EA1' },        // dot separator
      { fixVersion: 'rhoai-3.5-EA1' },         // dash separator
      { fixVersion: 'RHAIIS-3.4EA1' },          // no separator
      { fixVersion: 'RHAIIS-3.4 EA-2' }         // space + dash
    ])
    var result = useReleaseDistribution(features)
    var dist = result.releaseDistribution.value
    expect(dist).toHaveLength(4)
    expect(dist[0]).toEqual({ label: 'EA1', count: 3, pct: 75, barColor: 'bg-blue-500' })
    expect(dist[1]).toEqual({ label: 'EA2', count: 1, pct: 25, barColor: 'bg-amber-500' })
    expect(dist[2]).toEqual({ label: 'GA', count: 0, pct: 0, barColor: 'bg-emerald-500' })
    expect(dist[3]).toEqual({ label: '--', count: 0, pct: 0, barColor: 'bg-gray-400' })
  })

  it('features with base version only go to None bucket', function() {
    var features = ref([
      { fixVersion: 'rhoai-3.5' },
      { fixVersion: 'rhoai-3.5' },
      { fixVersion: 'rhoai-3.5.EA1' }
    ])
    var result = useReleaseDistribution(features)
    var dist = result.releaseDistribution.value
    expect(dist).toEqual([
      { label: 'EA1', count: 1, pct: 33, barColor: 'bg-blue-500' },
      { label: 'EA2', count: 0, pct: 0, barColor: 'bg-amber-500' },
      { label: 'GA', count: 0, pct: 0, barColor: 'bg-emerald-500' },
      { label: '--', count: 2, pct: 67, barColor: 'bg-gray-400' }
    ])
  })
})
