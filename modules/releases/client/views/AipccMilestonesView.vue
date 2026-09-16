<template>
  <div class="max-w-[1400px] mx-auto px-4 py-6 lg:px-8">
    <header class="flex flex-wrap items-start justify-between gap-4 mb-8">
      <div>
        <button
          type="button"
          class="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:underline dark:text-primary-400"
          @click="emit('show-schedule')"
        >
          <ArrowLeft class="h-4 w-4" />
          Release Schedule
        </button>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">AIPCC Release Milestones</h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">AIPCC release milestones and timeline</p>
        <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400 dark:text-gray-500">
          <a
            :href="sourceUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
          >
            <ExternalLink class="w-3.5 h-3.5" />
            AIPCC Milestones Spreadsheet
          </a>
          <span v-if="fetchedAt">Updated {{ formatTimestamp(fetchedAt) }}</span>
          <span v-if="cacheStatus === 'stale'" class="text-amber-600 dark:text-amber-400">Showing stored data</span>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button
          v-if="isAdmin"
          type="button"
          :disabled="refreshing"
          class="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
          @click="refreshData"
        >
          <RefreshCw class="w-4 h-4" :class="refreshing ? 'animate-spin' : ''" />
          {{ refreshing ? 'Refreshing' : 'Refresh data' }}
        </button>
        <input
          v-model="navDate"
          type="date"
          :min="timelineConfig.minDate"
          :max="timelineConfig.maxDate"
          class="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
          @keydown.enter="navigateToDate"
        />
        <button type="button" class="px-3 py-2 text-sm font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700" @click="navigateToDate">Go</button>
        <button type="button" class="px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700" @click="resetToToday">Today</button>
      </div>
    </header>

    <div v-if="loading" class="space-y-6 animate-pulse">
      <div class="grid grid-cols-1 lg:grid-cols-[240px_280px_minmax(0,1fr)] gap-4">
        <div v-for="item in 3" :key="item" class="h-60 rounded-xl bg-gray-100 dark:bg-gray-800" />
      </div>
      <div class="h-80 rounded-xl bg-gray-100 dark:bg-gray-800" />
    </div>

    <div v-else-if="error && !releases.length" class="rounded-xl border border-red-200 dark:border-red-800 bg-white dark:bg-gray-800 p-10 text-center">
      <p class="font-medium text-red-700 dark:text-red-300">Unable to load AIPCC milestones</p>
      <p class="mt-1 text-sm text-red-600 dark:text-red-400">{{ error }}</p>
      <button type="button" class="mt-4 text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline" @click="loadData">Try again</button>
    </div>

    <template v-else>
      <div v-if="error" class="mb-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
        {{ error }} Existing milestone data remains available.
      </div>

      <section class="summary-grid mb-8">
        <article class="dashboard-card h-60 p-5">
          <p class="eyebrow">Today</p>
          <p class="mt-3 text-4xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{{ today.getDate() }}</p>
          <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">{{ formatLongDate(today) }}</p>
        </article>

        <article class="dashboard-card h-60 flex flex-col overflow-hidden p-5">
          <p class="eyebrow">Next milestones</p>
          <p class="mt-3 text-4xl font-bold tabular-nums" :class="nextMilestoneTone">
            {{ nextMilestoneDays === null ? '—' : nextMilestoneDays === 0 ? 'Now' : `${nextMilestoneDays}d` }}
          </p>
          <p v-if="!nextMilestones.length" class="mt-2 text-sm font-medium text-gray-500 dark:text-gray-400">None scheduled</p>
          <div v-else class="mt-2 min-h-0 flex-1 overflow-y-auto milestone-scrollbar pr-1">
            <div
              v-for="milestone in nextMilestones"
              :key="milestone.id"
              class="border-t border-gray-100 py-2 first:border-t-0 first:pt-0 dark:border-gray-700"
            >
              <p class="truncate text-sm font-semibold text-gray-800 dark:text-gray-200">{{ milestone.name }}</p>
              <div class="mt-1 flex min-w-0 items-center gap-2">
                <span class="release-chip" :style="chipStyle(milestone)">{{ milestone.release }}</span>
                <span class="shrink-0 text-xs text-gray-400">{{ formatShortDate(milestone.targetDate) }}</span>
              </div>
            </div>
          </div>
        </article>

        <article class="dashboard-card h-60 flex flex-col overflow-hidden">
          <div class="section-heading shrink-0">
            <button
              type="button"
              class="flex min-w-0 items-center gap-2 text-left"
              :aria-expanded="!upcomingCollapsed"
              @click="upcomingCollapsed = !upcomingCollapsed"
            >
              <ChevronDown class="w-4 h-4 shrink-0 transition-transform" :class="upcomingCollapsed ? '-rotate-90' : ''" />
              <span class="font-semibold text-gray-900 dark:text-gray-100 truncate">Upcoming Milestones</span>
              <span class="count-badge">{{ upcomingMilestones.length }}</span>
            </button>
            <span class="flex shrink-0 items-center gap-2">
              <span class="hidden sm:inline text-xs font-normal text-gray-500 dark:text-gray-400">Show next</span>
              <select v-model.number="upcomingDays" class="rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-700 dark:text-gray-200">
                <option v-for="days in dayOptions" :key="days" :value="days">{{ days }} {{ days === 1 ? 'day' : 'days' }}</option>
              </select>
            </span>
          </div>

          <div v-if="!upcomingCollapsed" class="min-h-0 flex-1 overflow-y-auto milestone-scrollbar">
            <div v-if="!upcomingMilestones.length" class="h-full flex items-center justify-center px-6 text-center text-sm text-gray-400 dark:text-gray-500">
              No milestones in the next {{ upcomingDays }} {{ upcomingDays === 1 ? 'day' : 'days' }}
            </div>
            <div
              v-for="milestone in upcomingMilestones"
              :key="milestone.id"
              class="flex items-center gap-3 border-b border-gray-100 dark:border-gray-700/60 px-4 py-2.5 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
            >
              <span class="days-badge" :class="urgencyClasses(daysFromToday(milestone.targetDate))">
                {{ daysFromToday(milestone.targetDate) === 0 ? 'Today' : `${daysFromToday(milestone.targetDate)}d` }}
              </span>
              <span class="h-8 w-1 shrink-0 rounded-full" :style="{ backgroundColor: milestone.color }" />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium text-gray-800 dark:text-gray-200">{{ milestone.name }}</span>
                <span class="block truncate text-xs text-gray-400 dark:text-gray-500">{{ milestone.phase }}</span>
              </span>
              <span class="release-chip hidden md:inline-flex" :style="chipStyle(milestone)">{{ milestone.release }}</span>
              <span class="w-14 shrink-0 text-right text-xs tabular-nums text-gray-500 dark:text-gray-400">{{ formatShortDate(milestone.targetDate) }}</span>
            </div>
          </div>
        </article>
      </section>

      <section class="dashboard-card overflow-hidden">
        <div class="section-heading timeline-toolbar w-full">
          <button
            type="button"
            class="flex items-center gap-2 text-left"
            :aria-expanded="!timelineCollapsed"
            @click="timelineCollapsed = !timelineCollapsed"
          >
            <ChevronDown class="w-4 h-4 transition-transform" :class="timelineCollapsed ? '-rotate-90' : ''" />
            <span>
              <span class="block font-semibold text-gray-900 dark:text-gray-100">Timeline</span>
              <span class="block text-[11px] font-normal text-gray-400 dark:text-gray-500">Drag the red marker to explore the schedule</span>
            </span>
          </button>
          <span class="flex flex-wrap items-center justify-end gap-1.5">
            <span v-if="selectedReleases.size" class="mr-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
              {{ selectedReleases.size }} selected
            </span>
            <button
              v-for="release in releases"
              :key="release.name"
              type="button"
              class="rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all"
              :class="releasePillClass(release.name)"
              :style="releasePillStyle(release)"
              :aria-pressed="selectedReleases.has(release.name)"
              @click="toggleRelease(release.name)"
            >{{ release.name }}</button>
            <button
              v-if="selectedReleases.size"
              type="button"
              class="ml-1 text-[11px] font-semibold text-primary-600 hover:underline dark:text-primary-400"
              @click="selectedReleases = new Set()"
            >Show all</button>
          </span>
        </div>

        <div v-if="!timelineCollapsed" class="flex items-center justify-between gap-4 border-b border-gray-200 bg-white px-4 py-2 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
          <span><strong class="font-semibold text-gray-700 dark:text-gray-200">{{ visibleMilestoneCount }}</strong> milestones across {{ visibleReleaseGroups.length }} releases</span>
          <span class="flex items-center gap-4">
            <span class="inline-flex items-center gap-1.5"><i class="h-2.5 w-2.5 rotate-45 rounded-[2px] bg-gray-500" /> Milestone</span>
            <span class="inline-flex items-center gap-1.5"><i class="h-2.5 w-7 rounded-full bg-gray-300 dark:bg-gray-600" /> Duration</span>
          </span>
        </div>

        <div v-if="!timelineCollapsed" ref="timelineViewport" data-testid="aipcc-timeline-viewport" class="max-h-[620px] overflow-auto milestone-scrollbar">
          <div
            ref="timelineSurface"
            class="relative min-h-24 select-none bg-white dark:bg-gray-900"
            :style="{ width: `${timelineWidth + labelWidth}px` }"
            @pointermove="moveCursor"
            @pointerup="stopCursorDrag"
            @pointercancel="stopCursorDrag"
          >
            <div class="sticky top-0 z-40 h-14 border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-800/95">
              <div class="sticky left-0 z-50 flex h-14 w-[220px] items-center border-r border-gray-200 bg-gray-50 px-4 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                Release / workstream
              </div>
              <div
                v-for="month in timelineConfig.months"
                :key="month.key"
                class="absolute top-0 h-8 border-r border-gray-200 text-center text-xs font-bold leading-8 text-gray-700 dark:border-gray-700 dark:text-gray-200"
                :style="monthStyle(month)"
              >{{ month.label }}</div>
              <span
                v-for="week in timelineConfig.weekLines"
                :key="`label-${week}`"
                class="absolute bottom-0 h-6 text-[10px] font-medium leading-6 text-gray-400 dark:text-gray-500"
                :style="{ left: `${labelWidth + week * pxPerDay + 6}px` }"
              >{{ formatGridDate(addDays(timelineConfig.start, week)) }}</span>
            </div>

            <div class="absolute right-0 top-14 bottom-0 pointer-events-none" :style="{ left: `${labelWidth}px` }">
              <span
                v-for="week in timelineConfig.weekLines"
                :key="week"
                class="absolute inset-y-0 border-l border-dashed border-gray-200 dark:border-gray-700/70"
                :style="{ left: `${week * pxPerDay}px` }"
              />
            </div>

            <div
              v-if="todayOffset >= 0 && todayOffset <= timelineConfig.totalDays && cursorDay !== todayOffset"
              class="absolute top-14 bottom-0 z-10 border-l border-dashed border-red-400/50 pointer-events-none"
              :style="{ left: `${labelWidth + todayOffset * pxPerDay}px` }"
            />

            <div
              class="absolute inset-y-0 z-[60] w-5 cursor-ew-resize touch-none"
              :style="{ left: `${labelWidth + cursorDay * pxPerDay - 10}px` }"
              :aria-label="`Selected date: ${formatMarkerDate(cursorDate)}`"
              @pointerdown="startCursorDrag"
            >
              <span class="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-red-600 dark:bg-red-400" />
              <span class="absolute top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border-2 border-white bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow-lg dark:border-gray-900 dark:bg-red-500">
                {{ formatMarkerDate(cursorDate) }}
              </span>
              <span class="absolute top-8 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-white bg-red-600 shadow" />
            </div>

            <div
              v-for="release in visibleReleaseGroups"
              :key="release.name"
              class="timeline-release-row relative border-b border-gray-200 last:border-b-0 dark:border-gray-700"
              :style="{ height: `${release.height}px` }"
            >
              <div class="sticky left-0 z-20 flex h-full w-[220px] items-start gap-3 border-r border-gray-200 bg-white px-4 py-4 dark:border-gray-700 dark:bg-gray-800">
                <span class="mt-0.5 h-9 w-1 shrink-0 rounded-full" :style="{ backgroundColor: release.color }" />
                <span class="min-w-0">
                  <span class="block text-sm font-bold leading-5 text-gray-800 dark:text-gray-100">{{ release.name }}</span>
                  <span class="mt-1 block text-[11px] text-gray-400 dark:text-gray-500">{{ release.milestones.length }} milestones · {{ release.phases.length }} phases</span>
                </span>
              </div>

              <template v-for="milestone in release.milestones" :key="milestone.id">
                <div
                  v-if="milestone.isRange"
                  class="timeline-bar absolute z-[5] flex h-9 items-center overflow-hidden rounded-lg border px-3 text-xs font-bold text-white transition-all hover:z-30 hover:-translate-y-0.5 hover:shadow-lg"
                  :style="rangeStyle(milestone, release)"
                  :title="tooltipText(milestone)"
                >
                  <span class="mr-2 h-2 w-2 shrink-0 rounded-full" :style="{ backgroundColor: isActiveAtCursor(milestone) ? 'white' : release.color }" />
                  <span class="truncate">{{ milestone.name }}</span>
                </div>
                <div
                  v-else
                  class="group absolute z-[5] flex h-9 items-center hover:z-30"
                  :style="pointStyle(milestone)"
                  :title="tooltipText(milestone)"
                >
                  <span class="h-3.5 w-3.5 shrink-0 rotate-45 rounded-[3px] border-2 border-white shadow-md transition-transform group-hover:scale-125" :style="{ backgroundColor: release.color, boxShadow: `0 0 0 1px ${release.color}` }" />
                  <span class="ml-2 max-w-56 rounded-md bg-white px-2 py-1 text-[11px] font-bold text-gray-800 shadow-md ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-600">
                    <span class="block truncate">{{ milestone.name }}</span>
                    <span class="block text-[9px] font-medium text-gray-500 dark:text-gray-400">{{ formatShortDate(milestone.targetDate) }}</span>
                  </span>
                </div>
              </template>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { ArrowLeft, ChevronDown, ExternalLink, RefreshCw } from 'lucide-vue-next'
import { apiRequest } from '@shared/client/services/api.js'
import { useAuth } from '@shared/client/composables/useAuth'

const API_PATH = '/modules/releases/aipcc-milestones'
const DAY_MS = 24 * 60 * 60 * 1000
const labelWidth = 220
const RELEASE_COLORS = ['#2a78d6', '#1baf7a', '#eda100', '#008300', '#4a3aa7', '#e34948', '#e87ba4', '#eb6834']
const dayOptions = [1, 3, 7, 14, 21, 30, 60, 90]
const { isAdmin } = useAuth()
const emit = defineEmits(['show-schedule'])

const loading = ref(true)
const refreshing = ref(false)
const error = ref('')
const releases = ref([])
const fetchedAt = ref(null)
const cacheStatus = ref('')
const sourceUrl = ref('https://docs.google.com/spreadsheets/d/10OccyDM5P1UZX1ldaoPLVKbL4HKgh7cCY3Oiy_xKcX8/edit#gid=0')
const upcomingDays = ref(1)
const upcomingCollapsed = ref(false)
const timelineCollapsed = ref(false)
const selectedReleases = ref(new Set())
const cursorDay = ref(0)
const navDate = ref('')
const pxPerDay = ref(20)
const dragging = ref(false)
const timelineViewport = ref(null)
const timelineSurface = ref(null)
const today = startOfDay(new Date())
let resizeObserver = null

function startOfDay(date) {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

function parseDate(value) {
  return startOfDay(new Date(`${value}T00:00:00`))
}

function isoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function addDays(date, days) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function dayOffset(date, start) {
  return Math.round((startOfDay(date) - startOfDay(start)) / DAY_MS)
}

function daysFromToday(value) {
  return dayOffset(parseDate(value), today)
}

function formatShortDate(value) {
  const date = value instanceof Date ? value : parseDate(value)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatLongDate(value) {
  const date = value instanceof Date ? value : parseDate(value)
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

function formatGridDate(value) {
  const date = value instanceof Date ? value : parseDate(value)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatMarkerDate(value) {
  const date = value instanceof Date ? value : parseDate(value)
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTimestamp(value) {
  return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function flattenReleases(items) {
  return items.flatMap((release, releaseIndex) => {
    const color = RELEASE_COLORS[releaseIndex % RELEASE_COLORS.length]
    return release.phases.flatMap(phase => phase.milestones.map((milestone, milestoneIndex) => ({
      ...milestone,
      id: `${release.name}:${phase.name}:${milestone.name}:${milestone.targetDate}:${milestoneIndex}`,
      release: release.name,
      phase: phase.name,
      color
    })))
  })
}

const allMilestones = computed(() => flattenReleases(releases.value))
const isReleaseVisible = name => !selectedReleases.value.size || selectedReleases.value.has(name)

const upcomingMilestones = computed(() => allMilestones.value
  .filter(item => isReleaseVisible(item.release))
  .filter(item => {
    const days = daysFromToday(item.targetDate)
    return days >= 0 && days <= upcomingDays.value
  })
  .sort((a, b) => a.targetDate.localeCompare(b.targetDate)))

const nextMilestone = computed(() => allMilestones.value
  .filter(item => daysFromToday(item.targetDate) >= 0)
  .sort((a, b) => a.targetDate.localeCompare(b.targetDate))[0] || null)
const nextMilestones = computed(() => {
  if (!nextMilestone.value) return []
  return allMilestones.value
    .filter(item => item.targetDate === nextMilestone.value.targetDate)
    .sort((a, b) => a.release.localeCompare(b.release) || a.name.localeCompare(b.name))
})
const nextMilestoneDays = computed(() => nextMilestone.value ? daysFromToday(nextMilestone.value.targetDate) : null)
const nextMilestoneTone = computed(() => {
  if (nextMilestoneDays.value === 0) return 'text-red-600 dark:text-red-400'
  if (nextMilestoneDays.value !== null && nextMilestoneDays.value <= 3) return 'text-amber-600 dark:text-amber-400'
  return 'text-blue-600 dark:text-blue-400'
})

const timelineConfig = computed(() => {
  if (!allMilestones.value.length) return { start: today, end: today, totalDays: 1, months: [], weekLines: [], minDate: isoDate(today), maxDate: isoDate(today) }
  const dates = allMilestones.value.flatMap(item => [parseDate(item.startDate || item.targetDate), parseDate(item.targetDate)])
  const min = new Date(Math.min(...dates))
  const max = new Date(Math.max(...dates))
  const start = new Date(min.getFullYear(), min.getMonth(), 1)
  const end = new Date(max.getFullYear(), max.getMonth() + 1, 0)
  const totalDays = Math.max(1, dayOffset(end, start))
  const months = []
  const month = new Date(start)
  while (month <= end) {
    const next = new Date(month.getFullYear(), month.getMonth() + 1, 1)
    months.push({
      key: `${month.getFullYear()}-${month.getMonth()}`,
      label: month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      offset: dayOffset(month, start),
      days: Math.min(dayOffset(next, month), dayOffset(end, month) + 1)
    })
    month.setMonth(month.getMonth() + 1)
  }
  return {
    start, end, totalDays, months,
    weekLines: Array.from({ length: Math.ceil(totalDays / 7) }, (_, index) => index * 7),
    minDate: isoDate(start), maxDate: isoDate(end)
  }
})

const timelineWidth = computed(() => Math.max(1, timelineConfig.value.totalDays * pxPerDay.value))
const cursorDate = computed(() => addDays(timelineConfig.value.start, cursorDay.value))
const todayOffset = computed(() => dayOffset(today, timelineConfig.value.start))

function assignLanes(items) {
  return [...items].sort((a, b) => (a.startDate || a.targetDate).localeCompare(b.startDate || b.targetDate)).map((item, lane) => {
    const start = dayOffset(parseDate(item.startDate || item.targetDate), timelineConfig.value.start)
    const end = dayOffset(parseDate(item.targetDate), timelineConfig.value.start)
    const width = Math.max((end - start) * pxPerDay.value, 72)
    return { ...item, lane, start, end, width, isRange: end > start }
  })
}

const releaseGroups = computed(() => releases.value.map((release, index) => {
  const color = RELEASE_COLORS[index % RELEASE_COLORS.length]
  const milestones = assignLanes(flattenReleases([release]).map(item => ({ ...item, color })))
  const laneCount = milestones.reduce((max, item) => Math.max(max, item.lane + 1), 1)
  return { ...release, color, milestones, height: laneCount * 46 + 34 }
}))
const visibleReleaseGroups = computed(() => releaseGroups.value.filter(release => isReleaseVisible(release.name)))
const visibleMilestoneCount = computed(() => visibleReleaseGroups.value.reduce((total, release) => total + release.milestones.length, 0))

function toggleRelease(name) {
  const next = new Set(selectedReleases.value)
  if (next.has(name)) next.delete(name)
  else next.add(name)
  selectedReleases.value = next
}

function chipStyle(item) {
  return { color: item.color, backgroundColor: `${item.color}18`, borderColor: `${item.color}40` }
}

function urgencyClasses(days) {
  if (days === 0) return 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
  if (days <= 3) return 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
  if (days <= 7) return 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
  return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
}

function releasePillClass(name) {
  return selectedReleases.value.size && !selectedReleases.value.has(name) ? 'opacity-40 grayscale' : ''
}

function releasePillStyle(release) {
  const index = releases.value.findIndex(item => item.name === release.name)
  const color = RELEASE_COLORS[index % RELEASE_COLORS.length]
  return { color, backgroundColor: `${color}16`, borderColor: `${color}40` }
}

function monthStyle(month) {
  return { left: `${labelWidth + month.offset * pxPerDay.value}px`, width: `${month.days * pxPerDay.value}px` }
}

function isActiveAtCursor(item) {
  return cursorDay.value >= item.start && cursorDay.value <= item.end && item.isRange
}

function rangeStyle(item, release) {
  const active = isActiveAtCursor(item)
  return {
    left: `${labelWidth + item.start * pxPerDay.value}px`, top: `${16 + item.lane * 46}px`, width: `${item.width}px`,
    borderColor: release.color,
    backgroundColor: release.color,
    color: 'white',
    boxShadow: active ? `0 0 0 3px ${release.color}45, 0 4px 10px rgb(0 0 0 / 0.18)` : '0 2px 5px rgb(0 0 0 / 0.14)'
  }
}

function pointStyle(item) {
  return { left: `${labelWidth + item.end * pxPerDay.value - 7}px`, top: `${16 + item.lane * 46}px` }
}

function tooltipText(item) {
  const date = item.startDate ? `${formatShortDate(item.startDate)} – ${formatShortDate(item.targetDate)}` : formatShortDate(item.targetDate)
  return `${item.name}\n${item.phase} · ${item.release}\n${date}`
}

function navigateToDate() {
  if (!navDate.value) return
  cursorDay.value = Math.max(0, Math.min(timelineConfig.value.totalDays, dayOffset(parseDate(navDate.value), timelineConfig.value.start)))
  scrollToCursor()
}

function resetToToday() {
  cursorDay.value = Math.max(0, Math.min(timelineConfig.value.totalDays, todayOffset.value))
  navDate.value = isoDate(cursorDate.value)
  scrollToCursor()
}

function scrollToCursor(behavior = 'smooth') {
  nextTick(() => {
    if (!timelineViewport.value) return
    timelineViewport.value.scrollTo?.({ left: Math.max(0, labelWidth + cursorDay.value * pxPerDay.value - timelineViewport.value.clientWidth / 3), behavior })
  })
}

function startCursorDrag(event) {
  dragging.value = true
  event.currentTarget.setPointerCapture(event.pointerId)
}

function moveCursor(event) {
  if (!dragging.value || !timelineSurface.value) return
  const rect = timelineSurface.value.getBoundingClientRect()
  cursorDay.value = Math.max(0, Math.min(timelineConfig.value.totalDays, Math.round((event.clientX - rect.left - labelWidth) / pxPerDay.value)))
  navDate.value = isoDate(cursorDate.value)
}

function stopCursorDrag() {
  dragging.value = false
}

function applyData(data) {
  releases.value = data.releases || []
  fetchedAt.value = data.fetchedAt || null
  cacheStatus.value = data.cacheStatus || ''
  sourceUrl.value = data.source?.url || sourceUrl.value
  resetToToday()
}

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    applyData(await apiRequest(API_PATH))
  } catch (requestError) {
    error.value = requestError.message || 'Request failed'
  } finally {
    loading.value = false
  }
}

async function refreshData() {
  refreshing.value = true
  error.value = ''
  try {
    applyData(await apiRequest(`${API_PATH}/refresh`, { method: 'POST' }))
  } catch (requestError) {
    error.value = requestError.message || 'Refresh failed'
  } finally {
    refreshing.value = false
  }
}

onMounted(async () => {
  await loadData()
  await nextTick()
  scrollToCursor('auto')
  resizeObserver = new ResizeObserver(entries => {
    const width = entries[0]?.contentRect.width || 0
    const nextPxPerDay = Math.max(16, (width - labelWidth) / 45)
    if (width > labelWidth && nextPxPerDay !== pxPerDay.value) {
      pxPerDay.value = nextPxPerDay
      scrollToCursor('auto')
    }
  })
  if (timelineViewport.value) resizeObserver.observe(timelineViewport.value)
})

onBeforeUnmount(() => resizeObserver?.disconnect())
</script>

<style scoped>
.summary-grid {
  display: grid;
  grid-template-columns: 240px 280px minmax(0, 1fr);
  gap: 1rem;
}

.dashboard-card {
  border: 1px solid rgb(229 231 235);
  border-radius: 0.75rem;
  background: white;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.04);
}

.eyebrow {
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgb(107 114 128);
}

.section-heading {
  display: flex;
  min-height: 3.25rem;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  text-align: left;
  background: rgb(249 250 251);
  border-bottom: 1px solid rgb(243 244 246);
}

.count-badge {
  display: inline-flex;
  min-width: 1.5rem;
  height: 1.5rem;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  padding: 0 0.45rem;
  background: rgb(239 246 255);
  color: rgb(37 99 235);
  font-size: 0.75rem;
  font-weight: 700;
}

.days-badge {
  display: inline-flex;
  min-width: 3rem;
  justify-content: center;
  border-radius: 0.375rem;
  padding: 0.2rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.release-chip {
  display: inline-flex;
  max-width: 10rem;
  align-items: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border: 1px solid;
  border-radius: 9999px;
  padding: 0.15rem 0.55rem;
  font-size: 0.6875rem;
  font-weight: 600;
}

.milestone-scrollbar {
  scrollbar-color: rgb(156 163 175) transparent;
  scrollbar-width: thin;
}

.timeline-release-row:nth-child(even) {
  background: rgb(249 250 251 / 0.65);
}

.timeline-release-row:nth-child(even) > div:first-child {
  background: rgb(249 250 251);
}

.timeline-bar {
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.06);
}

:global(.dark) .dashboard-card {
  border-color: rgb(55 65 81 / 0.7);
  background: rgb(31 41 55);
}

:global(.dark) .section-heading {
  background: rgb(17 24 39 / 0.45);
  border-color: rgb(55 65 81 / 0.7);
}

:global(.dark) .count-badge {
  background: rgb(30 58 138 / 0.35);
  color: rgb(147 197 253);
}

:global(.dark) .timeline-release-row:nth-child(even) {
  background: rgb(17 24 39 / 0.45);
}

:global(.dark) .timeline-release-row:nth-child(even) > div:first-child {
  background: rgb(17 24 39);
}

@media (max-width: 1023px) {
  .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .summary-grid article:last-child { grid-column: 1 / -1; }
}

@media (max-width: 639px) {
  .summary-grid { grid-template-columns: 1fr; }
  .summary-grid article:last-child { grid-column: auto; }
  .timeline-toolbar { align-items: flex-start; flex-direction: column; }
}
</style>
