<script setup>
import { computed } from 'vue'

const props = defineProps({
  milestones: { type: Object, default: null },
  planningFreezes: { type: Object, default: null }
})

const MILESTONE_ORDER = [
  { key: 'ea1PlanFreeze', label: 'EA1 PF', color: 'bg-blue-300 dark:bg-blue-300', style: 'dashed' },
  { key: 'ea1Freeze', label: 'EA1 Code Freeze', color: 'bg-blue-500 dark:bg-blue-400' },
  { key: 'ea1Target', label: 'EA1 Release', color: 'bg-blue-600 dark:bg-blue-500' },
  { key: 'ea2PlanFreeze', label: 'EA2 PF', color: 'bg-amber-300 dark:bg-amber-300', style: 'dashed' },
  { key: 'ea2Freeze', label: 'EA2 Code Freeze', color: 'bg-amber-500 dark:bg-amber-400' },
  { key: 'ea2Target', label: 'EA2 Release', color: 'bg-amber-600 dark:bg-amber-500' },
  { key: 'gaPlanFreeze', label: 'GA PF', color: 'bg-green-300 dark:bg-green-300', style: 'dashed' },
  { key: 'gaFreeze', label: 'GA Code Freeze', color: 'bg-green-500 dark:bg-green-400' },
  { key: 'gaTarget', label: 'GA Release', color: 'bg-green-600 dark:bg-green-500' }
]

function parseDate(val) {
  if (!val) return null
  var d = new Date(val)
  return isNaN(d.getTime()) ? null : d
}

function formatShort(date) {
  if (!date) return ''
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const milestonePoints = computed(function() {
  if (!props.milestones) return []
  var pf = props.planningFreezes || {}
  var combined = Object.assign({}, props.milestones, {
    ea1PlanFreeze: pf.ea1 || null,
    ea2PlanFreeze: pf.ea2 || null,
    gaPlanFreeze: pf.ga || null
  })
  var points = []
  for (var i = 0; i < MILESTONE_ORDER.length; i++) {
    var m = MILESTONE_ORDER[i]
    var date = parseDate(combined[m.key])
    if (date) {
      points.push({
        key: m.key,
        label: m.label,
        color: m.color,
        style: m.style || null,
        date: date,
        dateStr: formatShort(date)
      })
    }
  }
  return points
})

const hasMilestones = computed(function() {
  return milestonePoints.value.length > 0
})

const timelineRange = computed(function() {
  if (!hasMilestones.value) return { start: 0, end: 1 }
  var dates = milestonePoints.value.map(function(p) { return p.date.getTime() })
  var min = Math.min.apply(null, dates)
  var max = Math.max.apply(null, dates)
  // Add 5% padding on each side
  var padding = (max - min) * 0.05 || 86400000
  return { start: min - padding, end: max + padding }
})

function positionPct(date) {
  var range = timelineRange.value
  var span = range.end - range.start
  if (span <= 0) return 50
  return ((date.getTime() - range.start) / span) * 100
}

const todayPosition = computed(function() {
  if (!hasMilestones.value) return null
  var now = new Date()
  var pct = positionPct(now)
  if (pct < 0 || pct > 100) return null
  return pct
})

const nextMilestone = computed(function() {
  if (!hasMilestones.value) return null
  var now = Date.now()
  for (var i = 0; i < milestonePoints.value.length; i++) {
    if (milestonePoints.value[i].date.getTime() > now) {
      var diff = milestonePoints.value[i].date.getTime() - now
      var days = Math.ceil(diff / 86400000)
      return {
        label: milestonePoints.value[i].label,
        days: days
      }
    }
  }
  return null
})

const STEM_HEIGHT = 28
const OVERLAP_THRESHOLD = 10
const CLOSE_DATE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000 // 7 days in ms

const staggeredPoints = computed(function() {
  var points = milestonePoints.value
  if (points.length === 0) return []

  var result = []
  for (var i = 0; i < points.length; i++) {
    var pct = positionPct(points[i].date)
    var above = true

    if (i > 0) {
      var prevPct = positionPct(points[i - 1].date)
      var dateDiffMs = Math.abs(points[i].date.getTime() - points[i - 1].date.getTime())

      // When adjacent markers are within 7 days or overlap in position,
      // stack labels vertically by alternating above/below
      if (Math.abs(pct - prevPct) < OVERLAP_THRESHOLD || dateDiffMs < CLOSE_DATE_THRESHOLD_MS) {
        above = !result[i - 1].above
      }
    }

    result.push(Object.assign({}, points[i], { pct: pct, above: above }))
  }
  return result
})
</script>

<template>
  <div v-if="hasMilestones" class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Release Timeline</h3>
      <span v-if="nextMilestone" class="text-xs text-gray-500 dark:text-gray-400">
        {{ nextMilestone.days }} day{{ nextMilestone.days !== 1 ? 's' : '' }} to {{ nextMilestone.label }}
      </span>
    </div>

    <!-- Desktop horizontal timeline -->
    <div class="hidden sm:block relative mx-4" style="height: 120px">
      <!-- Track line — centered vertically -->
      <div class="absolute left-0 right-0 h-0.5 bg-gray-300 dark:bg-gray-600" style="top: 50%"></div>

      <!-- Today marker -->
      <div
        v-if="todayPosition != null"
        class="absolute -translate-x-1/2 z-10"
        :style="{ left: todayPosition + '%', top: '10%', height: '80%' }"
      >
        <div class="w-px h-full bg-red-400/40 dark:bg-red-400/30 mx-auto"></div>
        <div class="text-[10px] font-medium text-red-600 dark:text-red-400 mt-0.5 whitespace-nowrap text-center -translate-x-1/4">Today</div>
      </div>

      <!-- Milestone points -->
      <template v-for="point in staggeredPoints" :key="point.key">
        <!-- Dot — always on the track -->
        <div
          class="absolute -translate-x-1/2 -translate-y-1/2 z-[5]"
          :style="{ left: point.pct + '%', top: '50%' }"
        >
          <div
            class="w-3 h-3 rounded-full border-2"
            :class="[point.color, point.style === 'dashed' ? 'border-dashed border-gray-500' : 'border-white dark:border-gray-800']"
          ></div>
        </div>

        <!-- Stem + label above -->
        <div
          v-if="point.above"
          class="absolute -translate-x-1/2 text-center flex flex-col items-center"
          :style="{ left: point.pct + '%', bottom: '50%' }"
        >
          <div class="text-[10px] text-gray-600 dark:text-gray-400 whitespace-nowrap">{{ point.label }}</div>
          <div class="text-[10px] font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">{{ point.dateStr }}</div>
          <div class="w-px bg-gray-300 dark:bg-gray-500 mt-0.5" :style="{ height: STEM_HEIGHT + 'px' }"></div>
        </div>

        <!-- Stem + label below -->
        <div
          v-else
          class="absolute -translate-x-1/2 text-center flex flex-col items-center"
          :style="{ left: point.pct + '%', top: '50%' }"
        >
          <div class="w-px bg-gray-300 dark:bg-gray-500 mb-0.5" :style="{ height: STEM_HEIGHT + 'px' }"></div>
          <div class="text-[10px] text-gray-600 dark:text-gray-400 whitespace-nowrap">{{ point.label }}</div>
          <div class="text-[10px] font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">{{ point.dateStr }}</div>
        </div>
      </template>
    </div>

    <!-- Mobile vertical timeline -->
    <div class="sm:hidden space-y-2">
      <div
        v-for="point in milestonePoints"
        :key="point.key"
        class="flex items-center gap-3"
      >
        <div
          class="w-2.5 h-2.5 rounded-full flex-shrink-0"
          :class="[point.color, point.style === 'dashed' ? 'border border-dashed border-gray-500' : '']"
        ></div>
        <div class="flex-1 flex justify-between items-center">
          <span class="text-xs text-gray-600 dark:text-gray-400">{{ point.label }}</span>
          <span class="text-xs font-medium text-gray-900 dark:text-gray-100">{{ point.dateStr }}</span>
        </div>
      </div>
      <div v-if="nextMilestone" class="text-xs text-center text-red-600 dark:text-red-400 pt-1 border-t border-gray-100 dark:border-gray-700">
        {{ nextMilestone.days }} day{{ nextMilestone.days !== 1 ? 's' : '' }} to {{ nextMilestone.label }}
      </div>
    </div>
  </div>

  <!-- No milestones fallback -->
  <div v-else class="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-center">
    <p class="text-xs text-gray-400 dark:text-gray-500">Milestone dates unavailable. Configure Smartsheet integration for timeline display.</p>
  </div>
</template>
