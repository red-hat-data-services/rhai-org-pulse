<script setup>
import { computed } from 'vue'

const props = defineProps({
  metrics: { type: Object, required: true }
})

const EVENT_CONFIG = {
  build:      { color: '#009596', icon: '🔨', label: 'Built' },
  branch:     { color: '#6753ac', icon: '🌿', label: 'Branch cut' },
  stage:      { color: '#f0ab00', icon: '📦', label: 'Stage' },
  announced:  { color: '#0066cc', icon: '📣', label: 'Ready' },
  production: { color: '#3e8635', icon: '🚀', label: 'Production' },
  published:  { color: '#6753ac', icon: '🏁', label: 'Published' },
}

function configFor(type) {
  return EVENT_CONFIG[type] || EVENT_CONFIG.build
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function formatDuration(startIso, endIso) {
  if (!startIso || !endIso) return null
  const ms = new Date(endIso) - new Date(startIso)
  if (ms <= 0) return null
  if (ms < 3_600_000) return '< 1h'
  const d = Math.floor(ms / 86_400_000)
  const h = Math.floor((ms % 86_400_000) / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function minTs(a, b) {
  if (!a) return b
  if (!b) return a
  return new Date(a) <= new Date(b) ? a : b
}

function maxTs(a, b) {
  if (!a) return b
  if (!b) return a
  return new Date(a) >= new Date(b) ? a : b
}

// Use pre-built timeline_events when available; fall back to building from raw timeline fields.
// This ensures the component works for all product types regardless of whether Konflux data exists.
const events = computed(() => {
  const te = props.metrics?.timeline_events
  if (te && te.length > 0) return te

  const tl = props.metrics?.timeline
  if (!tl) return []

  const milestones = []
  if (tl.first_build) milestones.push({ type: 'build', timestamp: tl.first_build, label: 'Built' })
  const stageTs = tl.first_registry_stage || tl.first_stage_release
  if (stageTs) milestones.push({ type: 'stage', timestamp: stageTs, label: 'Stage' })
  if (tl.announced_at) milestones.push({ type: 'announced', timestamp: tl.announced_at, label: 'Ready' })
  const firstProdTs = minTs(tl.first_registry_production, tl.first_production_release)
  const lastProdTs = maxTs(tl.last_registry_production, tl.last_production_release)
  if (firstProdTs) {
    const prod = { type: 'production', timestamp: firstProdTs, label: 'Production' }
    if (lastProdTs && lastProdTs !== firstProdTs) prod.lastTimestamp = lastProdTs
    milestones.push(prod)
  }
  if (tl.published_at) milestones.push({ type: 'published', timestamp: tl.published_at, label: 'Published' })
  milestones.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
  return milestones
})

const totalDuration = computed(() => {
  if (events.value.length < 2) return null
  return formatDuration(events.value[0].timestamp, events.value.at(-1).timestamp)
})

const daysToProduction = computed(() => props.metrics?.timeline?.days_to_production ?? null)

const counts = computed(() => props.metrics?.counts || null)

function durationBetween(i) {
  return formatDuration(events.value[i].timestamp, events.value[i + 1].timestamp)
}
</script>

<template>
  <div v-if="!events.length" class="text-sm text-gray-500 dark:text-gray-400">
    No timeline data available.
  </div>
  <div v-else class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 space-y-5">
    <!-- Summary row -->
    <div class="flex flex-wrap items-center justify-center gap-3 text-sm">
      <span v-if="totalDuration" class="text-gray-700 dark:text-gray-300">
        Total time: <span class="font-bold text-blue-600 dark:text-blue-400">{{ totalDuration }}</span>
      </span>
      <span
        v-if="daysToProduction !== null"
        class="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 text-xs font-semibold px-3 py-1 rounded-full"
      >{{ daysToProduction }}d to production</span>
    </div>

    <!-- Horizontal milestone timeline -->
    <div class="flex items-start overflow-x-auto pb-1">
      <template v-for="(event, i) in events" :key="i">
        <!-- Milestone node -->
        <div class="flex flex-col items-center text-center flex-none px-1" style="min-width: 80px">
          <div
            class="w-12 h-12 rounded-full flex items-center justify-center text-2xl border-2 border-white dark:border-gray-800 shadow-md"
            :style="{ backgroundColor: configFor(event.type).color }"
          >{{ configFor(event.type).icon }}</div>
          <div
            class="mt-2 text-xs font-semibold leading-tight"
            :style="{ color: configFor(event.type).color }"
          >{{ event.label || configFor(event.type).label }}</div>
          <!-- Production can have first+last timestamps when multiple artifacts released at different times -->
          <div v-if="event.lastTimestamp" class="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500 leading-tight">
            <span class="font-medium text-gray-500 dark:text-gray-400">First:</span> {{ formatDate(event.timestamp) }}<br>
            <span class="font-medium text-gray-500 dark:text-gray-400">Last:</span> {{ formatDate(event.lastTimestamp) }}
          </div>
          <div v-else class="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500 leading-tight">
            {{ formatDate(event.timestamp) }}
          </div>
        </div>

        <!-- Connector with duration pill between milestones -->
        <div
          v-if="i < events.length - 1"
          class="relative flex items-center flex-1 min-w-[40px]"
          style="margin-top: 22px"
        >
          <div class="h-0.5 w-full bg-gray-200 dark:bg-gray-600"></div>
          <div
            v-if="durationBetween(i)"
            class="absolute left-1/2 -translate-x-1/2 -top-3.5 z-10 bg-blue-600 text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full shadow-sm whitespace-nowrap"
          >{{ durationBetween(i) }}</div>
        </div>
      </template>
    </div>

    <!-- Counts summary -->
    <div
      v-if="counts && (counts.total_snapshots > 0 || counts.total_releases > 0)"
      class="flex flex-wrap gap-4 pt-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400"
    >
      <span v-if="counts.build_iterations">
        <span class="font-semibold text-gray-700 dark:text-gray-300">{{ counts.build_iterations }}</span> build iterations
      </span>
      <span v-if="counts.stage_releases">
        <span class="font-semibold text-gray-700 dark:text-gray-300">{{ counts.stage_releases }}</span> stage releases
      </span>
      <span v-if="counts.production_releases">
        <span class="font-semibold text-gray-700 dark:text-gray-300">{{ counts.production_releases }}</span> production releases
      </span>
    </div>
  </div>
</template>
