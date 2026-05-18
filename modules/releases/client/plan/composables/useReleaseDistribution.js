import { computed } from 'vue'

/**
 * Extract release version (EA1, EA2, GA) from a fixVersion string.
 * Parses the raw Jira fixVersion value -- does NOT use the `phase` field.
 *
 * @param {string} fixVersionStr - Comma-separated fixVersion string (e.g., "rhoai-3.5.EA1")
 * @returns {string} 'EA1', 'EA2', 'GA', or ''
 */
function extractRelease(fixVersionStr) {
  if (!fixVersionStr) return ''
  var upper = fixVersionStr.toUpperCase().replace(/[^A-Z0-9,]/g, '')
  // Check GA first (most specific milestone)
  if (upper.indexOf('GA') !== -1) return 'GA'
  // EA2 before EA1 (EA1 is a substring of EA12, etc.)
  if (upper.indexOf('EA2') !== -1) return 'EA2'
  if (upper.indexOf('EA1') !== -1) return 'EA1'
  return ''
}

/** Tailwind background classes for the segmented bar, keyed by bucket. */
var BAR_COLORS = {
  EA1: 'bg-blue-500',
  EA2: 'bg-amber-500',
  GA: 'bg-emerald-500',
  None: 'bg-gray-400'
}

export function useReleaseDistribution(features) {
  var releaseDistribution = computed(function() {
    if (!features.value || features.value.length === 0) return null
    var total = features.value.length
    var buckets = { EA1: 0, EA2: 0, GA: 0, None: 0 }
    for (var i = 0; i < features.value.length; i++) {
      var release = extractRelease(features.value[i].fixVersion || '')
      if (release && buckets[release] !== undefined) {
        buckets[release]++
      } else {
        buckets.None++
      }
    }
    var result = []
    var keys = ['EA1', 'EA2', 'GA', 'None']
    for (var j = 0; j < keys.length; j++) {
      var k = keys[j]
      var count = buckets[k]
      result.push({
        label: k === 'None' ? '--' : k,
        count: count,
        pct: Math.round((count / total) * 100),
        barColor: BAR_COLORS[k]
      })
    }
    return result
  })

  return { releaseDistribution: releaseDistribution }
}
