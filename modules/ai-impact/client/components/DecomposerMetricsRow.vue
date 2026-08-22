<script setup>
import { computed } from 'vue'
import { getTrendClass } from '../utils/format-helpers.js'

const props = defineProps({
  aggregates: { type: Object, default: null },
  counts: { type: Object, default: null },
  // { windowed, current: {strategies, epics, passRate}, prior: {...}|null }
  volume: { type: Object, default: null }
})

const cur = computed(() => props.volume?.current || { strategies: 0, epics: 0, passRate: 0 })
const prior = computed(() => props.volume?.prior || null)
const windowed = computed(() => !!props.volume?.windowed)

function trend(current, previous) {
  if (previous == null) return 'stable'
  if (current > previous) return 'growing'
  if (current < previous) return 'declining'
  return 'stable'
}

// The three windowed volume tiles (respond to the "Showing" date filter)
const volumeTiles = computed(() => {
  const a = props.aggregates || {}
  const p = prior.value
  return [
    { label: 'Strategies Decomposed', value: cur.value.strategies, prev: p?.strategies,
      trend: trend(cur.value.strategies, p?.strategies), allHint: `${props.counts?.runs ?? 0} runs` },
    { label: 'Epics Generated', value: cur.value.epics, prev: p?.epics,
      trend: trend(cur.value.epics, p?.epics), allHint: `${a.avg_epics_per_strategy ?? 0} avg / strategy` },
    { label: 'Pass Rate', value: cur.value.passRate, suffix: '%', prev: p?.passRate, ppDelta: true,
      trend: trend(cur.value.passRate, p?.passRate), allHint: `${a.avg_score_normalized ?? 0}% avg score` }
  ]
})

// All-time aggregate tiles (not date-scoped)
const aggregateTiles = computed(() => {
  const a = props.aggregates || {}
  return [
    { label: 'Avg Critical Path', value: a.avg_critical_path ?? 0, hint: 'epics deep' },
    { label: 'Investigation Epics', value: a.investigation_epic_count ?? 0, hint: `${a.strats_with_investigations ?? 0} strategies` },
    { label: 'AI High-Implementability', value: a.implementability_distribution?.High ?? 0, hint: `of ${a.total_epics ?? 0} epics` },
    { label: 'Recovered', value: a.recovered_strategies ?? 0, hint: 'failed then passing', tone: 'good' },
    { label: 'Currently Failed', value: a.failed_strategies ?? 0, hint: (a.failed_ids || []).join(', ') || 'none', tone: (a.failed_strategies ?? 0) > 0 ? 'bad' : 'muted' }
  ]
})

function toneClass(tone) {
  if (tone === 'good') return 'text-green-600 dark:text-green-400'
  if (tone === 'bad') return 'text-red-600 dark:text-red-400'
  return 'dark:text-gray-100'
}
</script>

<template>
  <div v-if="aggregates" class="p-6 border-b border-gray-200 dark:border-gray-700">
    <div class="grid gap-6 grid-cols-2 lg:grid-cols-4">
      <!-- Windowed volume tiles with prev-period comparison -->
      <div v-for="t in volumeTiles" :key="t.label" class="space-y-1">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t.label }}</p>
        <div class="flex items-baseline gap-2">
          <span class="text-3xl font-bold dark:text-gray-100">{{ t.value }}{{ t.suffix || '' }}</span>
          <span v-if="windowed && t.prev != null" class="text-sm flex items-center gap-1" :class="getTrendClass(t.trend)">
            <svg v-if="t.trend === 'growing'" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <svg v-else-if="t.trend === 'declining'" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
            </svg>
            <svg v-else class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
            </svg>
            {{ t.prev }}{{ t.suffix || '' }} prev period
          </span>
        </div>
        <p class="text-xs text-gray-400 dark:text-gray-500 truncate" :title="t.allHint">
          <span v-if="!windowed">{{ t.allHint }}</span>
          <span v-else>vs previous period</span>
        </p>
      </div>

      <!-- All-time aggregate tiles -->
      <div v-for="t in aggregateTiles" :key="t.label" class="space-y-1">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t.label }}</p>
        <span class="text-3xl font-bold" :class="toneClass(t.tone)">{{ t.value }}</span>
        <p class="text-xs text-gray-400 dark:text-gray-500 truncate" :title="t.hint">{{ t.hint }}</p>
      </div>
    </div>
  </div>
</template>
