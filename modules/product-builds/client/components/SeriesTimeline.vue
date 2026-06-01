<script setup>
import { computed } from 'vue'
import { formatDate } from '../utils/formatting'

const props = defineProps({
  drops: { type: Array, required: true },
  metricsMap: { type: Object, required: true },
  productKey: { type: String, required: true }
})

const emit = defineEmits(['navigate-drop'])

const EVENT_STYLES = {
  build:      { color: '#009596', darkColor: '#14b8a6', icon: '🔨', label: 'Built',        labelClass: 'text-teal-600 dark:text-teal-400' },
  stage:      { color: '#f0ab00', darkColor: '#f59e0b', icon: '📦', label: 'Stage',        labelClass: 'text-amber-500 dark:text-amber-400' },
  announced:  { color: '#0066cc', darkColor: '#3b82f6', icon: '📣', label: 'Ready',        labelClass: 'text-blue-600 dark:text-blue-400' },
  production: { color: '#3e8635', darkColor: '#22c55e', icon: '🚀', label: 'Production',   labelClass: 'text-green-700 dark:text-green-400' },
  published:  { color: '#6753ac', darkColor: '#8b5cf6', icon: '🏁', label: 'Announcement', labelClass: 'text-purple-600 dark:text-purple-400' },
}

const isDark = computed(() => document.documentElement.classList.contains('dark'))

function circleColor(type) {
  const style = EVENT_STYLES[type]
  return isDark.value ? (style?.darkColor || style?.color) : style?.color
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

function fmtDuration(startIso, endIso) {
  if (!startIso || !endIso) return null
  const ms = new Date(endIso) - new Date(startIso)
  if (ms < 0) return null
  if (ms < 3_600_000) return '< 1h'
  const d = Math.floor(ms / 86_400_000)
  const h = Math.floor((ms % 86_400_000) / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

const GAP_THRESHOLD_MS = 60 * 24 * 60 * 60 * 1000

function extractMilestones(metrics) {
  const timeline = metrics?.timeline
  if (!timeline) return []
  const milestones = []
  if (timeline.first_build) milestones.push({ type: 'build', timestamp: timeline.first_build })
  const stageTs = timeline.first_registry_stage || timeline.first_stage_release
  if (stageTs) milestones.push({ type: 'stage', timestamp: stageTs })
  if (timeline.announced_at) milestones.push({ type: 'announced', timestamp: timeline.announced_at })
  const firstProdTs = minTs(timeline.first_registry_production, timeline.first_production_release)
  const lastProdTs = maxTs(timeline.last_registry_production, timeline.last_production_release)
  if (firstProdTs) {
    const prod = { type: 'production', timestamp: firstProdTs }
    if (lastProdTs && lastProdTs !== firstProdTs) prod.lastTimestamp = lastProdTs
    milestones.push(prod)
  }
  if (timeline.published_at) milestones.push({ type: 'published', timestamp: timeline.published_at })
  milestones.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
  return milestones
}

const dropEntries = computed(() => {
  return props.drops
    .map(drop => {
      const metrics = props.metricsMap[drop.key]
      if (!metrics) return null
      const milestones = extractMilestones(metrics)
      if (milestones.length === 0) return null
      const reachedProduction = metrics.timeline?.reached_production === true ||
        milestones.some(m => m.type === 'production')
      const reachedStage = milestones.some(m => m.type === 'stage')
      return { drop, milestones, firstTimestamp: milestones[0].timestamp, metrics, reachedProduction, reachedStage }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.firstTimestamp) - new Date(b.firstTimestamp))
})

const groupedEntries = computed(() => {
  const entries = dropEntries.value
  if (entries.length === 0) return []
  const groups = []
  let pendingBuild = []
  let pendingStage = []

  function hasLargeGap(pending, entry) {
    if (pending.length === 0) return false
    const last = pending[pending.length - 1]
    const lastTs = last.milestones[last.milestones.length - 1].timestamp
    const nextTs = entry.milestones[0].timestamp
    return new Date(nextTs) - new Date(lastTs) >= GAP_THRESHOLD_MS
  }

  function flush() {
    if (pendingBuild.length > 0) {
      groups.push({ type: 'compact', label: 'build only', entries: [...pendingBuild] })
      pendingBuild = []
    }
    if (pendingStage.length > 0) {
      groups.push({ type: 'compact', label: 'stage only', entries: [...pendingStage] })
      pendingStage = []
    }
  }

  for (const entry of entries) {
    if (entry.reachedProduction) {
      flush()
      groups.push({ type: 'full', entry })
    } else if (entry.reachedStage) {
      if (pendingBuild.length > 0) {
        groups.push({ type: 'compact', label: 'build only', entries: [...pendingBuild] })
        pendingBuild = []
      }
      if (hasLargeGap(pendingStage, entry)) flush()
      pendingStage.push(entry)
    } else {
      if (pendingStage.length > 0) {
        groups.push({ type: 'compact', label: 'stage only', entries: [...pendingStage] })
        pendingStage = []
      }
      if (hasLargeGap(pendingBuild, entry)) flush()
      pendingBuild.push(entry)
    }
  }
  flush()
  return groups
})

const gapsBetweenGroups = computed(() => {
  const gaps = new Set()
  const groups = groupedEntries.value
  for (let i = 0; i < groups.length - 1; i++) {
    const lastEntry = groups[i].type === 'full' ? groups[i].entry : groups[i].entries[groups[i].entries.length - 1]
    const nextEntry = groups[i + 1].type === 'full' ? groups[i + 1].entry : groups[i + 1].entries[0]
    const lastTs = lastEntry.milestones[lastEntry.milestones.length - 1].timestamp
    const nextTs = nextEntry.milestones[0].timestamp
    if (new Date(nextTs) - new Date(lastTs) >= GAP_THRESHOLD_MS) gaps.add(i)
  }
  return gaps
})

const seriesStats = computed(() => {
  const groups = groupedEntries.value
  const gaps = gapsBetweenGroups.value
  let lastGapIndex = -1
  for (const idx of gaps) { if (idx > lastGapIndex) lastGapIndex = idx }

  const relevant = lastGapIndex >= 0
    ? groups.slice(lastGapIndex + 1).flatMap(g => g.type === 'full' ? [g.entry] : g.entries)
    : dropEntries.value

  const prodMilestones = relevant.flatMap(e => e.milestones.filter(m => m.type === 'production'))
  const firstProd = prodMilestones.map(m => m.timestamp).sort((a, b) => new Date(a) - new Date(b))[0]
  const lastProd = prodMilestones.map(m => m.lastTimestamp || m.timestamp).sort((a, b) => new Date(b) - new Date(a))[0]
  const firstBuild = relevant.flatMap(e => e.milestones.filter(m => m.type === 'build'))
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))[0]?.timestamp || null

  return {
    firstToProd: firstProd && firstBuild ? fmtDuration(firstBuild, firstProd) : null,
    fullyReleased: lastProd && firstBuild ? fmtDuration(firstBuild, lastProd) : null,
  }
})

function durationToNextGroup(gi) {
  const groups = groupedEntries.value
  const lastEntry = groups[gi].type === 'full' ? groups[gi].entry : groups[gi].entries[groups[gi].entries.length - 1]
  const nextGroup = groups[gi + 1]
  if (!nextGroup) return null
  const nextEntry = nextGroup.type === 'full' ? nextGroup.entry : nextGroup.entries[0]
  return fmtDuration(lastEntry.milestones[lastEntry.milestones.length - 1].timestamp, nextEntry.milestones[0].timestamp)
}

function milestoneDuration(entry, mi) {
  if (mi >= entry.milestones.length - 1) return null
  return fmtDuration(entry.milestones[mi].timestamp, entry.milestones[mi + 1].timestamp)
}
</script>

<template>
  <div v-if="dropEntries.length === 0" class="text-sm text-gray-500 dark:text-gray-400">
    No release statistics available for this series.
  </div>
  <div v-else class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-6">
    <!-- Summary stats -->
    <div v-if="seriesStats.firstToProd" class="flex justify-center gap-6 flex-wrap text-sm text-gray-900 dark:text-gray-100">
      <span class="relative group cursor-help">
        First to production:
        <span class="font-bold text-teal-600 dark:text-teal-400">{{ seriesStats.firstToProd }}</span>
        <span class="ml-1 text-gray-400 dark:text-gray-500">ⓘ</span>
        <span class="absolute hidden group-hover:block bottom-full left-1/2 -translate-x-1/2 mb-1 px-3 py-1.5 rounded bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs whitespace-nowrap z-10">Time from the first build to the first artifact reaching production</span>
      </span>
      <span class="relative group cursor-help">
        Fully released:
        <span class="font-bold text-green-700 dark:text-green-400">{{ seriesStats.fullyReleased }}</span>
        <span class="ml-1 text-gray-400 dark:text-gray-500">ⓘ</span>
        <span class="absolute hidden group-hover:block bottom-full left-1/2 -translate-x-1/2 mb-1 px-3 py-1.5 rounded bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs whitespace-nowrap z-10">Time from the first build to the last artifact reaching production</span>
      </span>
    </div>

    <!-- Vertical timeline -->
    <div class="relative" style="padding-left: 28px">
      <!-- Vertical connecting line -->
      <div
        v-if="groupedEntries.length > 1"
        class="absolute rounded"
        style="left: 19px; top: 20px; bottom: 20px; width: 3px; background: linear-gradient(180deg, #009596, #3e8635); z-index: 0"
      ></div>

      <template v-for="(group, gi) in groupedEntries" :key="gi">
        <!-- Compact group (build-only or stage-only) -->
        <div v-if="group.type === 'compact'" class="flex items-start gap-4 relative">
          <!-- Drop icon -->
          <div
            class="w-10 h-10 rounded-full flex items-center justify-center text-xl border-[3px] border-white dark:border-gray-800 shrink-0 relative z-[1]"
            :style="{
              background: group.label === 'stage only'
                ? 'linear-gradient(135deg, #f0ab00, #c58b00)'
                : 'linear-gradient(135deg, #6a6e73, #4f5255)',
              boxShadow: group.label === 'stage only'
                ? '0 2px 8px rgba(240,171,0,0.3)'
                : '0 2px 8px rgba(0,0,0,0.15)'
            }"
          >💧</div>

          <!-- Compact drop list -->
          <div
            class="flex-1 min-w-0 py-2.5 px-5 rounded-lg border bg-gray-50 dark:bg-gray-700/40"
            :class="group.label === 'stage only'
              ? 'border-amber-200 dark:border-gray-600'
              : 'border-gray-200 dark:border-gray-600'"
          >
            <div
              class="text-xs font-semibold mb-1.5"
              :class="group.label === 'stage only' ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'"
            >{{ group.entries.length }} drop{{ group.entries.length > 1 ? 's' : '' }} ({{ group.label }})</div>
            <div v-for="entry in group.entries" :key="entry.drop.key" class="flex items-center gap-1.5 py-0.5 text-[13px]">
              <div
                class="w-2 h-2 rounded-full shrink-0"
                :style="{ backgroundColor: EVENT_STYLES[entry.milestones[entry.milestones.length - 1].type]?.color || '#6a6e73' }"
              ></div>
              <span
                class="text-primary-600 dark:text-blue-400 cursor-pointer hover:underline"
                @click="emit('navigate-drop', entry.drop.key)"
              >{{ entry.drop.name }}</span>
              <span class="text-gray-500 dark:text-gray-400 text-[11px]">{{ formatDate(entry.milestones[0].timestamp) }}</span>
            </div>
          </div>
        </div>

        <!-- Full entry (reached production) -->
        <div v-else class="flex items-start gap-4 relative">
          <!-- Drop icon -->
          <div
            class="w-10 h-10 rounded-full flex items-center justify-center text-xl border-[3px] border-white dark:border-gray-800 shrink-0 relative z-[1] cursor-pointer"
            style="background: linear-gradient(135deg, #0066cc, #004080); box-shadow: 0 2px 8px rgba(0,102,204,0.35)"
            @click="emit('navigate-drop', group.entry.drop.key)"
          >💧</div>

          <!-- Drop name + horizontal milestone timeline -->
          <div class="flex-1 min-w-0 py-3.5 px-5 rounded-lg bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-600">
            <!-- Drop header -->
            <div class="flex items-center gap-2.5 mb-2.5 flex-wrap">
              <span
                class="font-bold text-[15px] text-primary-600 dark:text-blue-400 cursor-pointer hover:underline"
                @click="emit('navigate-drop', group.entry.drop.key)"
              >{{ group.entry.drop.name }}</span>
              <span
                v-if="group.entry.metrics.timeline?.days_to_production != null"
                class="text-[11px] font-semibold px-2.5 py-0.5 rounded-full text-blue-600 bg-blue-50 dark:text-blue-300 dark:bg-blue-900/30"
              >{{ group.entry.metrics.timeline.days_to_production }}d to prod</span>
              <span
                v-if="group.entry.drop.git_branch"
                class="text-[11px] font-semibold px-2 py-0.5 rounded-full cursor-help text-purple-700 bg-purple-50 border border-purple-200 dark:text-purple-300 dark:bg-purple-900/20 dark:border-purple-700"
                :title="`Tag was cut from the '${group.entry.drop.git_branch}' branch`"
              >{{ group.entry.drop.git_branch }}</span>
            </div>

            <!-- Horizontal milestone sub-timeline -->
            <div class="flex items-center flex-wrap">
              <template v-for="(milestone, mi) in group.entry.milestones" :key="mi">
                <!-- Milestone node -->
                <div class="flex flex-col items-center" style="min-width: 70px">
                  <div
                    class="w-8 h-8 rounded-full flex items-center justify-center text-[15px] border-2 border-white dark:border-gray-700 shrink-0"
                    :style="{ backgroundColor: circleColor(milestone.type), boxShadow: `0 1px 4px ${circleColor(milestone.type)}44` }"
                  >{{ EVENT_STYLES[milestone.type]?.icon }}</div>
                  <div
                    class="text-[11px] font-semibold mt-1 text-center"
                    :class="EVENT_STYLES[milestone.type]?.labelClass"
                  >{{ EVENT_STYLES[milestone.type]?.label }}</div>
                  <div v-if="milestone.lastTimestamp" class="text-[10px] text-gray-500 dark:text-gray-400 text-center leading-snug">
                    <div><span class="font-semibold text-gray-400">First:</span> {{ formatDate(milestone.timestamp) }}</div>
                    <div><span class="font-semibold text-gray-400">Last:</span> {{ formatDate(milestone.lastTimestamp) }}</div>
                  </div>
                  <div v-else class="text-[10px] text-gray-500 dark:text-gray-400 text-center leading-tight">
                    {{ formatDate(milestone.timestamp) }}
                  </div>
                </div>

                <!-- Connector with duration -->
                <div
                  v-if="mi < group.entry.milestones.length - 1"
                  class="flex flex-col items-center px-1"
                  style="flex: 0 0 auto; min-width: 40px; max-width: 80px"
                >
                  <div class="w-full bg-gray-300 dark:bg-gray-600" style="height: 2px; margin-top: 16px"></div>
                  <span
                    v-if="milestoneDuration(group.entry, mi)"
                    class="text-[10px] text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap mt-0.5"
                  >{{ milestoneDuration(group.entry, mi) }}</span>
                </div>
              </template>
            </div>
          </div>
        </div>

        <!-- Duration gap between groups -->
        <template v-if="gi < groupedEntries.length - 1">
          <!-- Large gap (>60 days) -->
          <div v-if="gapsBetweenGroups.has(gi)" class="flex items-center justify-start relative" style="height: 80px">
            <div
              class="absolute"
              style="left: 18px; top: 0; bottom: 0; width: 5px; background-image: repeating-linear-gradient(180deg, #c9190b 0px, #c9190b 6px, transparent 6px, transparent 14px); z-index: 1"
            ></div>
            <div class="absolute z-[2]" style="left: -4px; top: 50%; transform: translateY(-50%)">
              <div
                class="text-white text-[11px] font-semibold whitespace-nowrap px-3 py-1 rounded-xl cursor-help"
                style="background-color: #c9190b; box-shadow: 0 1px 4px rgba(201,25,11,0.3); border: 2px dashed rgba(255,255,255,0.5)"
                title="A gap longer than 60 days was detected between consecutive builds. This usually indicates early dev/nightly builds that are unrelated to the actual release cycle. This gap is excluded from the series total time."
              >{{ durationToNextGroup(gi) }} gap</div>
            </div>
          </div>
          <!-- Normal gap -->
          <div v-else class="flex items-center justify-start relative" style="height: 56px">
            <div v-if="durationToNextGroup(gi)" class="absolute z-[2]" style="left: -4px; top: 50%; transform: translateY(-50%)">
              <div
                class="text-white text-[11px] font-semibold whitespace-nowrap px-2.5 py-0.5 rounded-xl"
                style="background-color: #0066cc; box-shadow: 0 1px 4px rgba(0,102,204,0.3)"
              >{{ durationToNextGroup(gi) }}</div>
            </div>
          </div>
        </template>
      </template>
    </div>
  </div>
</template>
