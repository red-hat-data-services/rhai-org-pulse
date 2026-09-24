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
            @click="toggleTimeline"
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
              data-testid="timeline-release-filter"
              :data-release="release.name"
              class="release-filter-pill rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all"
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
            >Clear selection</button>
          </span>
        </div>

        <div v-if="!timelineCollapsed" class="flex items-center justify-between gap-4 border-b border-gray-200 bg-white px-4 py-2 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
          <span v-if="selectedReleases.size"><strong class="font-semibold text-gray-700 dark:text-gray-200">{{ visibleMilestoneCount }}</strong> milestones across {{ visibleReleaseCount }} releases</span>
          <span v-else class="font-semibold text-gray-600 dark:text-gray-300">No releases selected</span>
          <span class="flex items-center gap-3">
            <button
              v-if="visibleMilestoneCount"
              type="button"
              data-testid="focus-timeline-date"
              class="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 font-semibold text-red-700 transition-colors hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-900/50"
              @click="scrollToCursor()"
            >
              <LocateFixed class="h-3.5 w-3.5" />
              {{ focusDateButtonLabel }}
              <span v-if="selectedDateEventCount" class="rounded-full bg-red-600 px-1.5 text-[10px] leading-4 text-white dark:bg-red-500">{{ selectedDateEventCount }}</span>
            </button>
            <span class="inline-flex items-center gap-1.5"><i class="h-2.5 w-2.5 rotate-45 rounded-[2px] bg-gray-500" /> Milestone</span>
            <span class="inline-flex items-center gap-1.5"><i class="h-2.5 w-7 rounded-full bg-gray-300 dark:bg-gray-600" /> Duration</span>
          </span>
        </div>

        <div v-if="!timelineCollapsed" ref="timelineViewport" data-testid="aipcc-timeline-viewport" class="max-h-[620px] overflow-auto milestone-scrollbar">
          <div v-if="!selectedReleases.size" data-testid="timeline-empty-selection" class="flex h-48 w-full flex-col items-center justify-center gap-2 border-b border-gray-200 bg-white px-6 text-center dark:border-gray-700 dark:bg-gray-900">
            <strong class="text-base font-bold text-gray-800 dark:text-gray-100">Click on a release to view schedule</strong>
            <span class="text-xs text-gray-500 dark:text-gray-400">Select one or more release pills above to compare their milestones.</span>
          </div>
          <div
            v-else
            ref="timelineSurface"
            class="relative min-h-24 select-none bg-white dark:bg-gray-900"
            :style="{ width: `${timelineWidth + labelWidth}px` }"
            @pointermove="moveCursor"
            @pointerup="stopCursorDrag"
            @pointercancel="stopCursorDrag"
          >
            <div class="sticky top-0 z-[90] h-14 border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-800/95">
              <div class="sticky left-0 z-[95] flex h-14 w-[180px] items-center border-r border-gray-200 bg-gray-50 px-3 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                Release
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
              class="pointer-events-none absolute inset-y-0 z-[100] w-5"
              :style="{ left: `${labelWidth + cursorDay * pxPerDay - 10}px` }"
              :aria-label="`Selected date: ${formatMarkerDate(cursorDate)}`"
            >
              <span class="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-red-600 dark:bg-red-400" />
              <span
                class="pointer-events-auto sticky top-2 left-1/2 block w-max -translate-x-1/2 cursor-ew-resize touch-none whitespace-nowrap rounded-md border-2 border-white bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow-lg dark:border-gray-900 dark:bg-red-500"
                title="Drag to select a date"
                @pointerdown="startCursorDrag"
              >
                {{ formatMarkerDate(cursorDate) }}
              </span>
            </div>

            <div
              data-testid="aipcc-overlap-timeline"
              class="relative border-b border-gray-200 dark:border-gray-700"
            >
              <div
                v-for="row in timelineEventRows"
                :key="row.id"
                data-testid="timeline-event-row"
                :data-release="row.release"
                :data-target-date="row.targetDate"
                :data-selected-date="row.targetDate === selectedDateIso"
                class="timeline-event-row relative h-8 border-b border-gray-100 last:border-b-0 dark:border-gray-800"
                :class="{ 'timeline-event-row--selected': row.targetDate === selectedDateIso }"
              >
                <div class="sticky left-0 z-[80] flex h-full w-[180px] items-center gap-2 border-r border-gray-200 bg-white px-3 dark:border-gray-700 dark:bg-gray-800">
                  <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: row.color }" />
                  <span v-if="row.showReleaseLabel" data-testid="timeline-release-label" class="release-color-text truncate text-[11px] font-semibold" :style="{ '--release-color': row.color }">{{ row.release }}</span>
                </div>

                <div class="absolute right-0 top-1/2 h-px bg-gray-200 dark:bg-gray-700" :style="{ left: `${labelWidth}px` }" />

                <div
                  v-if="row.start < row.end"
                  class="timeline-range absolute z-[5] h-2 rounded-full border"
                  :style="eventRangeStyle(row)"
                />

                <button
                  type="button"
                  data-testid="timeline-date-event"
                  :data-event-count="row.dateGroup.events.length"
                  :data-multi-release="row.dateGroup.colors.length > 1"
                  class="absolute z-[70] h-5 w-5 -translate-x-1/2 rounded-full border-2 border-white shadow-md outline-none transition-transform hover:z-[80] hover:scale-125 focus-visible:z-[80] focus-visible:scale-125 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:border-gray-900"
                  :style="eventPointStyle(row)"
                  :aria-label="`${row.name}, ${formatMarkerDate(parseDate(row.targetDate))}. ${row.dateGroup.events.length} milestone${row.dateGroup.events.length === 1 ? '' : 's'} on this date`"
                  @pointerenter="showTimelineTooltip($event, row.dateGroup)"
                  @pointerleave="hideTimelineTooltip"
                  @focus="showTimelineTooltip($event, row.dateGroup)"
                  @blur="hideTimelineTooltip"
                >
                  <span
                    v-if="row.dateIndex === 0 && row.dateGroup.events.length > 1"
                    class="pointer-events-none absolute -right-2.5 -top-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gray-900 px-1 text-[9px] font-bold leading-none text-white dark:bg-gray-100 dark:text-gray-900"
                  >{{ row.dateGroup.events.length }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>

  <Teleport to="body">
    <div
      v-if="activeTimelineDate"
      role="tooltip"
      data-testid="timeline-date-tooltip"
      class="pointer-events-none fixed z-[200] rounded-lg border border-gray-200 bg-white p-3 text-left normal-case shadow-xl dark:border-gray-600 dark:bg-gray-800"
      :style="timelineTooltipStyle"
    >
      <span class="block border-b border-gray-100 pb-2 text-xs font-bold text-gray-900 dark:border-gray-700 dark:text-gray-100">{{ formatMarkerDate(parseDate(activeTimelineDate.date)) }}</span>
      <span v-for="event in activeTimelineDate.events" :key="event.id" data-testid="timeline-tooltip-event" class="mt-2 flex items-start gap-2 first:mt-0">
        <i class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: event.color }" />
        <span class="min-w-0">
          <span class="release-color-text block text-[10px] font-bold uppercase tracking-wide" :style="{ '--release-color': event.color }">{{ event.release }}</span>
          <span class="block text-xs font-semibold leading-4 text-gray-800 dark:text-gray-100">{{ event.name }}</span>
          <span class="block text-[10px] font-medium leading-4 text-gray-500 dark:text-gray-400">{{ event.phase }} · {{ eventDateDetail(event) }}</span>
        </span>
      </span>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { ArrowLeft, ChevronDown, ExternalLink, LocateFixed, RefreshCw } from 'lucide-vue-next'
import { apiRequest } from '@shared/client/services/api.js'
import { useAuth } from '@shared/client/composables/useAuth'

const API_PATH = '/modules/releases/aipcc-milestones'
const DAY_MS = 24 * 60 * 60 * 1000
const labelWidth = 180
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
const activeTimelineDate = ref(null)
const timelineTooltipStyle = ref({})
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
const isReleaseSelected = name => selectedReleases.value.has(name)
const isReleaseIncluded = name => !selectedReleases.value.size || selectedReleases.value.has(name)

const upcomingMilestones = computed(() => allMilestones.value
  .filter(item => isReleaseIncluded(item.release))
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
const selectedDateIso = computed(() => isoDate(cursorDate.value))
const visibleReleaseNames = computed(() => releases.value.filter(release => isReleaseSelected(release.name)).map(release => release.name))
const visibleReleaseCount = computed(() => visibleReleaseNames.value.length)
const visibleMilestones = computed(() => allMilestones.value.filter(item => isReleaseSelected(item.release)))
const visibleMilestoneCount = computed(() => visibleMilestones.value.length)
const selectedDateEventCount = computed(() => visibleMilestones.value.filter(item => item.targetDate === selectedDateIso.value).length)
const focusDateButtonLabel = computed(() => {
  if (selectedDateIso.value === isoDate(today) && selectedDateEventCount.value) return "Show today's events"
  if (selectedDateEventCount.value) return `Show ${formatShortDate(cursorDate.value)} events`
  return `Jump near ${formatShortDate(cursorDate.value)}`
})

const timelineDateGroups = computed(() => {
  const groups = new Map()
  for (const event of visibleMilestones.value) {
    if (!groups.has(event.targetDate)) groups.set(event.targetDate, [])
    groups.get(event.targetDate).push(event)
  }
  return [...groups.entries()]
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, events]) => ({
      date,
      events: events.sort((a, b) => a.release.localeCompare(b.release) || a.name.localeCompare(b.name)),
      colors: [...new Set(events.map(event => event.color))],
      offset: dayOffset(parseDate(date), timelineConfig.value.start)
    }))
})

const timelineEventRows = computed(() => {
  const groups = new Map(timelineDateGroups.value.map(group => [group.date, group]))
  const dateIndexes = new Map()
  const labeledReleases = new Set()
  return [...visibleMilestones.value]
    .sort((a, b) => a.targetDate.localeCompare(b.targetDate) || a.release.localeCompare(b.release) || a.name.localeCompare(b.name))
    .map(event => {
      const dateIndex = dateIndexes.get(event.targetDate) || 0
      dateIndexes.set(event.targetDate, dateIndex + 1)
      const showReleaseLabel = !labeledReleases.has(event.release)
      labeledReleases.add(event.release)
      return {
        ...event,
        start: dayOffset(parseDate(event.startDate || event.targetDate), timelineConfig.value.start),
        end: dayOffset(parseDate(event.targetDate), timelineConfig.value.start),
        dateGroup: groups.get(event.targetDate),
        dateIndex,
        showReleaseLabel
      }
    })
})

function toggleRelease(name) {
  const next = new Set(selectedReleases.value)
  if (next.has(name)) next.delete(name)
  else next.add(name)
  selectedReleases.value = next
  scrollToCursor('auto')
}

function toggleTimeline() {
  timelineCollapsed.value = !timelineCollapsed.value
  if (!timelineCollapsed.value) scrollToCursor('auto')
}

function chipStyle(item) {
  return { '--release-color': item.color }
}

function urgencyClasses(days) {
  if (days === 0) return 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
  if (days <= 3) return 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
  if (days <= 7) return 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
  return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
}

function releasePillClass(name) {
  return selectedReleases.value.has(name)
    ? 'release-filter-pill--selected shadow-sm ring-1 ring-current ring-offset-1 dark:ring-offset-gray-900'
    : 'opacity-60 hover:opacity-100'
}

function releasePillStyle(release) {
  const index = releases.value.findIndex(item => item.name === release.name)
  const color = RELEASE_COLORS[index % RELEASE_COLORS.length]
  return { '--release-color': color }
}

function monthStyle(month) {
  return { left: `${labelWidth + month.offset * pxPerDay.value}px`, width: `${month.days * pxPerDay.value}px` }
}

function isActiveAtCursor(item) {
  return cursorDay.value >= item.start && cursorDay.value <= item.end
}

function eventRangeStyle(item) {
  const active = isActiveAtCursor(item)
  return {
    left: `${labelWidth + item.start * pxPerDay.value}px`,
    top: '12px',
    width: `${Math.max((item.end - item.start) * pxPerDay.value, 8)}px`,
    borderColor: item.color,
    backgroundColor: `${item.color}${active ? 'b8' : '70'}`,
    boxShadow: active ? `0 0 0 2px ${item.color}45` : 'none'
  }
}

function dateGroupBackground(group) {
  const slice = 360 / group.colors.length
  return group.colors.length === 1
    ? group.colors[0]
    : `conic-gradient(${group.colors.map((color, index) => `${color} ${index * slice}deg ${(index + 1) * slice}deg`).join(', ')})`
}

function eventPointStyle(row) {
  return {
    left: `${labelWidth + row.end * pxPerDay.value}px`,
    top: '6px',
    background: dateGroupBackground(row.dateGroup)
  }
}

function showTimelineTooltip(event, group) {
  const dotBounds = event.currentTarget.getBoundingClientRect()
  const viewportBounds = timelineViewport.value?.getBoundingClientRect() || { left: 0, right: window.innerWidth }
  const width = Math.min(384, Math.max(280, viewportBounds.right - viewportBounds.left - 24))
  const estimatedHeight = 46 + group.events.length * 52
  const minLeft = Math.max(12, viewportBounds.left + 8)
  const maxLeft = Math.min(window.innerWidth - width - 12, viewportBounds.right - width - 8)
  const left = Math.max(minLeft, Math.min(dotBounds.left + dotBounds.width / 2 - width / 2, maxLeft))
  const top = dotBounds.top - estimatedHeight - 14 >= 12
    ? dotBounds.top - estimatedHeight - 14
    : dotBounds.bottom + 14
  activeTimelineDate.value = group
  timelineTooltipStyle.value = { left: `${left}px`, top: `${top}px`, width: `${width}px` }
}

function hideTimelineTooltip() {
  activeTimelineDate.value = null
}

function eventDateDetail(event) {
  return event.startDate
    ? `${formatShortDate(event.startDate)} – ${formatShortDate(event.targetDate)}`
    : formatShortDate(event.targetDate)
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
    const selectedDate = isoDate(cursorDate.value)
    const matchingIndex = timelineEventRows.value.findIndex(row => row.targetDate >= selectedDate)
    const rowIndex = matchingIndex === -1 ? Math.max(0, timelineEventRows.value.length - 1) : matchingIndex
    timelineViewport.value.scrollTo?.({
      left: Math.max(0, labelWidth + cursorDay.value * pxPerDay.value - timelineViewport.value.clientWidth / 3),
      top: Math.max(0, 56 + (rowIndex - 2) * 32),
      behavior
    })
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
  color: var(--release-color);
  background: color-mix(in srgb, var(--release-color) 9%, transparent);
  border-color: color-mix(in srgb, var(--release-color) 30%, transparent);
}

.release-filter-pill {
  color: var(--release-color);
  background: transparent;
  border-color: color-mix(in srgb, var(--release-color) 40%, transparent);
}

.release-filter-pill--selected {
  background: color-mix(in srgb, var(--release-color) 9%, transparent);
}

.release-color-text {
  color: var(--release-color);
}

.milestone-scrollbar {
  scrollbar-color: rgb(156 163 175) transparent;
  scrollbar-width: thin;
}

.timeline-event-row:nth-child(even) {
  background: rgb(249 250 251 / 0.7);
}

.timeline-event-row:nth-child(even) > div:first-child {
  background: rgb(249 250 251);
}

.timeline-event-row.timeline-event-row--selected {
  background: rgb(254 242 242 / 0.9);
}

.timeline-event-row.timeline-event-row--selected > div:first-child {
  background: rgb(254 242 242);
}

.timeline-range {
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.06);
}

.dark .dashboard-card {
  border-color: rgb(55 65 81 / 0.7);
  background: rgb(31 41 55);
}

.dark .section-heading {
  background: rgb(17 24 39 / 0.45);
  border-color: rgb(55 65 81 / 0.7);
}

.dark .count-badge {
  background: rgb(30 58 138 / 0.35);
  color: rgb(147 197 253);
}

.dark .release-chip,
.dark .release-filter-pill,
.dark .release-color-text {
  color: color-mix(in srgb, var(--release-color) 62%, white);
}

.dark .release-chip {
  background: color-mix(in srgb, var(--release-color) 15%, rgb(17 24 39));
  border-color: color-mix(in srgb, var(--release-color) 45%, rgb(75 85 99));
}

.dark .release-filter-pill {
  border-color: color-mix(in srgb, var(--release-color) 65%, rgb(75 85 99));
}

.dark .release-filter-pill--selected {
  background: color-mix(in srgb, var(--release-color) 18%, rgb(17 24 39));
}

.dark .timeline-event-row:nth-child(even) {
  background: rgb(17 24 39 / 0.45);
}

.dark .timeline-event-row:nth-child(even) > div:first-child {
  background: rgb(17 24 39);
}

.dark .timeline-event-row.timeline-event-row--selected {
  background: rgb(127 29 29 / 0.18);
}

.dark .timeline-event-row.timeline-event-row--selected > div:first-child {
  background: rgb(69 10 10);
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
