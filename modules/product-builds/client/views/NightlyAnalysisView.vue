<script setup>
import { computed, ref, onMounted } from 'vue'
import { useNightlyPipelines } from '../composables/useNightlyPipelines.js'

const STAGE_ORDER = ['bootstrap-and-onboard', 'build-wheels', 'publish-wheels', 'release-tarball']
const STAGE_LABELS = {
  'bootstrap-and-onboard': 'Bootstrap',
  'build-wheels': 'Build',
  'publish-wheels': 'Publish',
  'release-tarball': 'Tarball',
}

const SCHEDULE_FALLBACK = {
  description: 'Nightly Builds for Automated Updates',
  time: 'Daily at 8:00 PM ET',
  target: 'main',
}

const THEMES = {
  success: {
    banner: 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800/40',
    iconBg: 'bg-green-100 dark:bg-green-900/30',
    icon: 'text-green-600 dark:text-green-400',
    title: 'text-green-800 dark:text-green-300',
    subtitle: 'text-green-700 dark:text-green-400',
    info: 'text-green-600 dark:text-green-400/80',
    link: 'text-green-700 dark:text-green-400 border-green-300 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900/30',
    tile: 'bg-green-50 dark:bg-green-950/40 hover:bg-green-100 dark:hover:bg-green-900/50',
    tileSelected: 'border-green-500 dark:border-green-400 shadow-sm shadow-green-200 dark:shadow-green-900/40',
    tileLabel: 'text-green-500 dark:text-green-500',
    tileDay: 'text-green-700 dark:text-green-300',
    label: 'PASSING',
  },
  failed: {
    banner: 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/40',
    iconBg: 'bg-red-100 dark:bg-red-900/30',
    icon: 'text-red-600 dark:text-red-400',
    title: 'text-red-800 dark:text-red-300',
    subtitle: 'text-red-700 dark:text-red-400',
    info: 'text-red-600 dark:text-red-400/80',
    link: 'text-red-700 dark:text-red-400 border-red-300 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-900/30',
    tile: 'bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50',
    tileSelected: 'border-red-500 dark:border-red-400 shadow-sm shadow-red-200 dark:shadow-red-900/40',
    tileLabel: 'text-red-400 dark:text-red-500',
    tileDay: 'text-red-700 dark:text-red-300',
    label: 'FAILING',
  },
  _default: {
    banner: 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/40',
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    icon: 'text-blue-600 dark:text-blue-400',
    title: 'text-blue-800 dark:text-blue-300',
    subtitle: 'text-blue-700 dark:text-blue-400',
    info: 'text-blue-600 dark:text-blue-400/80',
    link: 'text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30',
    tile: 'bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50',
    tileSelected: 'border-blue-500 dark:border-blue-400 shadow-sm shadow-blue-200 dark:shadow-blue-900/40',
    tileLabel: 'text-blue-400 dark:text-blue-500',
    tileDay: 'text-blue-700 dark:text-blue-300',
    label: null,
  },
}

const STATUS_BADGE = {
  success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  running: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  canceled: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  _default: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
}

const JOB_CELL = {
  success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:ring-green-400',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:ring-red-400',
  _default: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 hover:ring-gray-400',
}

function theme(status) { return THEMES[status] || THEMES._default }
function badgeClass(status) { return STATUS_BADGE[status] || STATUS_BADGE._default }
function jobCellClass(status) { return JOB_CELL[status] || JOB_CELL._default }
function jobLabel(status) { return status === 'success' ? 'Pass' : status === 'failed' ? 'Fail' : status }

const {
  pipelines, schedule, jobs, selectedPipelineId, loading, jobsLoading, error,
  packages, packagesLoading,
  loadPipelines, loadPipelineJobs, loadCollectionPackages,
  latestPipeline, successRate, currentStreak, lastSuccess,
} = useNightlyPipelines()

const heroStatus = computed(() => {
  if (selectedPipelineId.value === latestPipeline.value?.id && jobs.value?.status) {
    return jobs.value.status
  }
  return latestPipeline.value?.status
})

const heroTheme = computed(() => theme(heroStatus.value))

const scheduleInfo = computed(() => {
  const s = schedule.value
  if (!s?.description) return SCHEDULE_FALLBACK
  return {
    description: s.description.replace(/\s*\[.*\]$/, ''),
    time: s.cron ? `${s.cron} ${s.cron_timezone || 'UTC'}` : SCHEDULE_FALLBACK.time,
    target: s.ref || SCHEDULE_FALLBACK.target,
  }
})

const selectedPipeline = computed(() =>
  pipelines.value.find(p => p.id === jobs.value?.pipeline_id) || null
)

const chartView = ref('chart')
const timelinePipelines = computed(() => [...pipelines.value].reverse())

const chartLayout = computed(() => {
  const pts = timelinePipelines.value
  if (!pts.length) return null
  const pad = { left: 44, right: 16, top: 16, bottom: 32 }
  const w = Math.max(pts.length * 56, 300)
  const h = 100
  const yPass = pad.top + 14
  const yFail = h - pad.bottom - 14
  const plotW = w - pad.left - pad.right
  const points = pts.map((p, i) => {
    const x = pad.left + (pts.length === 1 ? plotW / 2 : (i / (pts.length - 1)) * plotW)
    const y = p.status === 'success' ? yPass : yFail
    const { day, month } = dateParts(p.created_at)
    return { id: p.id, status: p.status, x, y, day, month, label: `${month} ${day}` }
  })
  return { w, h, yPass, yFail, yMid: (yPass + yFail) / 2, padLeft: pad.left, points }
})

const sortedCollections = computed(() => {
  if (!jobs.value?.collections) return []
  return Object.entries(jobs.value.collections)
    .sort(([, a], [, b]) => {
      if (a.status === 'failed' && b.status !== 'failed') return -1
      if (a.status !== 'failed' && b.status === 'failed') return 1
      return 0
    })
    .map(([name, data]) => {
      let jobCount = 0, failCount = 0
      const variantEntries = Object.entries(data.variants)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([variant, archs]) => ({
          variant,
          archs: Object.entries(archs)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([arch, stages]) => {
              const stageJobs = Object.values(stages)
              jobCount += stageJobs.length
              failCount += stageJobs.filter(j => j.status === 'failed').length
              return { arch, stages }
            }),
        }))
      return { name, ...data, variantEntries, jobCount, failCount }
    })
})

function selectPipeline(p) {
  if (selectedPipelineId.value === p.id) return
  loadPipelineJobs(p.id)
}

function onCollectionToggle(event, collectionName) {
  if (event.target.open && !packages.value[collectionName]) {
    loadCollectionPackages(selectedPipelineId.value, collectionName)
  }
}

function formatTeamName(source) {
  return source.replace(/^team-/, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDateFull(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatDuration(sec) {
  if (!sec) return ''
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function dateParts(iso) {
  if (!iso) return {}
  const d = new Date(iso)
  return {
    dow: d.toLocaleDateString('en-US', { weekday: 'short' }),
    month: d.toLocaleDateString('en-US', { month: 'short' }),
    day: d.getDate(),
  }
}

function jobTitle(job) {
  const parts = [job.status]
  if (job.duration) parts.push(formatDuration(job.duration))
  return parts.join(' · ')
}

onMounted(async () => {
  await loadPipelines()
  if (latestPipeline.value) {
    loadPipelineJobs(latestPipeline.value.id)
  }
})
</script>

<template>
  <div>
    <!-- Error -->
    <div v-if="error" class="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
      {{ error }}
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-24">
      <svg class="animate-spin h-10 w-10 text-gray-400 mx-auto" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <div class="mt-4 text-gray-500 dark:text-gray-400">Loading nightly pipeline data...</div>
    </div>

    <template v-else-if="pipelines.length > 0">
      <!-- ===== TIER 1: Hero Status Banner ===== -->
      <div v-if="latestPipeline" :class="heroTheme.banner" class="mb-6 p-5 rounded-lg border flex items-center gap-4">
        <div :class="heroTheme.iconBg" class="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center">
          <svg v-if="heroStatus === 'success'" :class="heroTheme.icon" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
          </svg>
          <svg v-else-if="heroStatus === 'failed'" :class="heroTheme.icon" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
          <svg v-else :class="heroTheme.icon" class="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>

        <div class="flex-1 min-w-0">
          <div :class="heroTheme.title" class="text-lg font-bold">{{ scheduleInfo.description }}</div>
          <div :class="heroTheme.subtitle" class="text-sm font-semibold mt-1">
            {{ theme(heroStatus).label || heroStatus.toUpperCase() }}
          </div>
          <div :class="heroTheme.info" class="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs">
            <span>{{ formatDateFull(latestPipeline.created_at) }}</span>
            <span v-if="currentStreak.count > 1">
              {{ currentStreak.count }} {{ currentStreak.status === 'success' ? 'passing' : 'failing' }} in a row
            </span>
          </div>
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
            <span class="flex items-center gap-1">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {{ scheduleInfo.time }}
            </span>
            <span class="flex items-center gap-1">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
              Target: {{ scheduleInfo.target }}
            </span>
          </div>
        </div>

        <a :href="latestPipeline.web_url" target="_blank" rel="noopener noreferrer"
          :class="heroTheme.link"
          class="flex-shrink-0 text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors"
        >View on GitLab &rarr;</a>
      </div>

      <!-- ===== TIER 2: Pipeline History ===== -->
      <div v-if="chartLayout" class="mb-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-3">
            <div class="text-sm font-semibold text-gray-700 dark:text-gray-300">Pipeline History</div>
            <div class="inline-flex rounded-md overflow-hidden border border-gray-300 dark:border-gray-500">
              <button
                :class="chartView === 'chart' ? 'bg-gray-700 dark:bg-gray-200 text-white dark:text-gray-900' : 'bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'"
                class="px-2.5 py-1 text-[11px] font-semibold transition-colors"
                @click="chartView = 'chart'"
              >Chart</button>
              <button
                :class="chartView === 'strip' ? 'bg-gray-700 dark:bg-gray-200 text-white dark:text-gray-900' : 'bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'"
                class="px-2.5 py-1 text-[11px] font-semibold border-l border-gray-300 dark:border-gray-500 transition-colors"
                @click="chartView = 'strip'"
              >Strip</button>
            </div>
          </div>
          <div class="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span>{{ successRate }}% pass rate</span>
            <span v-if="lastSuccess && latestPipeline?.status !== 'success'">
              Last success: {{ formatDate(lastSuccess.created_at) }}
            </span>
          </div>
        </div>

        <!-- Chart view -->
        <svg v-if="chartView === 'chart'" :viewBox="`0 0 ${chartLayout.w} ${chartLayout.h}`" class="w-full" preserveAspectRatio="xMidYMid meet">
          <line :x1="chartLayout.padLeft" :x2="chartLayout.w - 16"
            :y1="chartLayout.yMid" :y2="chartLayout.yMid"
            class="stroke-gray-200 dark:stroke-gray-700" stroke-width="1" />

          <text :x="chartLayout.padLeft - 8" :y="chartLayout.yPass + 1"
            text-anchor="end" dominant-baseline="middle"
            class="fill-green-600 dark:fill-green-400 text-[11px] font-medium" style="font-family: system-ui, sans-serif">Pass</text>
          <text :x="chartLayout.padLeft - 8" :y="chartLayout.yFail + 1"
            text-anchor="end" dominant-baseline="middle"
            class="fill-red-500 dark:fill-red-400 text-[11px] font-medium" style="font-family: system-ui, sans-serif">Fail</text>

          <template v-for="pt in chartLayout.points" :key="pt.id">
            <line :x1="pt.x" :x2="pt.x" :y1="chartLayout.yMid" :y2="pt.y"
              :class="pt.status === 'success' ? 'stroke-green-400 dark:stroke-green-600' : 'stroke-red-300 dark:stroke-red-700'"
              stroke-width="2" stroke-linecap="round" />

            <circle v-if="selectedPipelineId === pt.id"
              :cx="pt.x" :cy="pt.y" r="10"
              :class="pt.status === 'success' ? 'fill-green-100 dark:fill-green-900/40' : 'fill-red-100 dark:fill-red-900/40'" />

            <circle :cx="pt.x" :cy="pt.y" r="6"
              :class="pt.status === 'success' ? 'fill-green-500 dark:fill-green-400' : 'fill-red-500 dark:fill-red-400'"
              class="cursor-pointer transition-all"
              @click="selectPipeline(timelinePipelines[chartLayout.points.indexOf(pt)])" />

            <circle :cx="pt.x" :cy="pt.y" r="16" fill="transparent" class="cursor-pointer"
              @click="selectPipeline(timelinePipelines[chartLayout.points.indexOf(pt)])">
              <title>{{ pt.label }} — {{ pt.status === 'success' ? 'Passed' : 'Failed' }}</title>
            </circle>

            <text :x="pt.x" :y="chartLayout.h - 4"
              text-anchor="middle" dominant-baseline="auto"
              class="fill-gray-500 dark:fill-gray-400 text-[10px]" style="font-family: system-ui, sans-serif">{{ pt.label }}</text>
          </template>
        </svg>

        <!-- Strip view -->
        <div v-else class="flex gap-1.5">
          <div v-for="p in timelinePipelines" :key="p.id" class="flex-1 flex flex-col items-center gap-1">
            <button
              :class="[
                p.status === 'success' ? 'bg-green-500' : 'bg-red-500',
                selectedPipelineId === p.id ? 'ring-2 ring-offset-2 dark:ring-offset-gray-800' : '',
                selectedPipelineId === p.id && p.status === 'success' ? 'ring-green-400' : '',
                selectedPipelineId === p.id && p.status !== 'success' ? 'ring-red-400' : '',
              ]"
              class="w-full h-10 rounded cursor-pointer transition-all hover:opacity-80"
              :title="`${dateParts(p.created_at).month} ${dateParts(p.created_at).day} — ${p.status === 'success' ? 'Passed' : 'Failed'}`"
              @click="selectPipeline(p)"
            ></button>
            <span class="text-[9px] text-gray-500 dark:text-gray-400 leading-tight">
              {{ dateParts(p.created_at).month }} {{ dateParts(p.created_at).day }}
            </span>
          </div>
        </div>
      </div>

      <!-- ===== TIER 3: Pipeline Detail ===== -->
      <!-- Jobs loading -->
      <div v-if="jobsLoading" class="text-center py-12">
        <svg class="animate-spin h-8 w-8 text-gray-400 mx-auto" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <div class="mt-2 text-gray-500 dark:text-gray-400 text-sm">Loading job details...</div>
      </div>

      <template v-else-if="jobs && selectedPipeline">
        <!-- Pipeline Stats Hero -->
        <div class="mb-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div class="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3 flex-wrap">
            <span class="inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold" :class="badgeClass(jobs.status)">
              {{ jobs.status }}
            </span>
            <span class="text-sm font-semibold text-gray-900 dark:text-white">
              {{ formatDateFull(selectedPipeline.created_at) }}
            </span>
            <span class="text-xs text-gray-400 dark:text-gray-500">Pipeline #{{ jobs.pipeline_id }}</span>
            <a :href="selectedPipeline.web_url" target="_blank" rel="noopener noreferrer"
              class="text-sm text-blue-600 dark:text-blue-400 hover:underline ml-auto">
              View on GitLab &rarr;
            </a>
          </div>
          <div class="grid grid-cols-4 divide-x divide-gray-200 dark:divide-gray-700">
            <div class="px-5 py-4 text-center">
              <div class="text-2xl font-semibold text-gray-900 dark:text-white">{{ jobs.summary.total }}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">Total Jobs</div>
            </div>
            <div class="px-5 py-4 text-center">
              <div class="text-2xl font-semibold text-green-600 dark:text-green-400">{{ jobs.summary.success }}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">Passed</div>
            </div>
            <div class="px-5 py-4 text-center">
              <div class="text-2xl font-semibold" :class="jobs.summary.failed > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'">{{ jobs.summary.failed }}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">Failed</div>
            </div>
            <div class="px-5 py-4 text-center">
              <div class="text-2xl font-semibold text-gray-400 dark:text-gray-500">{{ jobs.summary.skipped }}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">Skipped</div>
            </div>
          </div>
          <div v-if="sortedCollections.length" class="px-5 py-3 border-t border-gray-200 dark:border-gray-700">
            <div class="flex items-center gap-3 mb-2">
              <span class="text-xs font-medium text-gray-500 dark:text-gray-400">Collections</span>
              <span class="text-xs text-gray-400 dark:text-gray-500">
                {{ sortedCollections.filter(c => c.status === 'success').length }} passed,
                {{ sortedCollections.filter(c => c.status !== 'success').length }} failed
              </span>
            </div>
            <div class="flex gap-0.5 h-3 rounded-full overflow-hidden">
              <div v-for="col in sortedCollections" :key="col.name"
                class="flex-1 first:rounded-l-full last:rounded-r-full"
                :class="col.status === 'success' ? 'bg-green-500' : 'bg-red-500'"
                :title="`${col.name} — ${col.status}`"
              ></div>
            </div>
          </div>
        </div>

        <!-- Failed Jobs Overview -->
        <details v-if="jobs.failed_jobs.length > 0" class="mb-4 rounded-xl border border-red-200 dark:border-red-800/50 shadow-sm overflow-hidden group/failed">
          <summary class="px-4 py-3 bg-red-50 dark:bg-red-900/10 cursor-pointer flex items-center gap-3 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors list-none [&::-webkit-details-marker]:hidden">
            <svg class="w-3.5 h-3.5 text-red-400 transition-transform group-open/failed:rotate-90 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
            <svg class="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span class="text-sm font-semibold text-red-800 dark:text-red-300">Overview of Failed Jobs</span>
            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
              {{ jobs.failed_jobs.length }}
            </span>
          </summary>
          <div class="border-t border-red-200 dark:border-red-800/50">
            <table class="w-full text-sm">
              <thead>
                <tr class="bg-red-50/50 dark:bg-red-900/5 border-b border-red-100 dark:border-red-900/20">
                  <th class="text-left py-2 px-4 font-medium text-red-700 dark:text-red-400">Job Name</th>
                  <th class="text-left py-2 px-4 font-medium text-red-700 dark:text-red-400">Collection</th>
                  <th class="text-left py-2 px-4 font-medium text-red-700 dark:text-red-400">Variant</th>
                  <th class="text-left py-2 px-4 font-medium text-red-700 dark:text-red-400">Arch</th>
                  <th class="text-left py-2 px-4 font-medium text-red-700 dark:text-red-400">Stage</th>
                  <th class="text-left py-2 px-4 font-medium text-red-700 dark:text-red-400">Reason</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-red-100 dark:divide-red-900/20">
                <tr v-for="fj in jobs.failed_jobs" :key="fj.id" class="bg-white dark:bg-gray-800 hover:bg-red-50/50 dark:hover:bg-red-900/5 transition-colors">
                  <td class="py-2 px-4">
                    <a :href="fj.web_url" target="_blank" rel="noopener noreferrer"
                      class="text-sm font-medium text-red-700 dark:text-red-400 hover:underline">
                      {{ fj.name }}
                    </a>
                  </td>
                  <td class="py-2 px-4 text-gray-700 dark:text-gray-300">{{ fj.collection }}</td>
                  <td class="py-2 px-4 text-gray-700 dark:text-gray-300">{{ fj.variant }}</td>
                  <td class="py-2 px-4 text-gray-600 dark:text-gray-400">{{ fj.arch }}</td>
                  <td class="py-2 px-4 text-gray-600 dark:text-gray-400">{{ STAGE_LABELS[fj.stage] || fj.stage }}</td>
                  <td class="py-2 px-4 text-gray-400 dark:text-gray-500 text-xs">{{ fj.failure_reason || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </details>

        <!-- Collection Grid -->
        <div class="space-y-3">
          <details v-for="col in sortedCollections" :key="col.name"
            class="rounded-xl border shadow-sm overflow-hidden group/col"
            :class="col.status === 'failed' ? 'border-red-200 dark:border-red-800/50' : 'border-gray-200 dark:border-gray-700'"
            @toggle="onCollectionToggle($event, col.name)"
          >
            <summary
              class="px-4 py-3 flex items-center gap-3 cursor-pointer bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors list-none [&::-webkit-details-marker]:hidden"
            >
              <svg class="w-3.5 h-3.5 text-gray-400 transition-transform group-open/col:rotate-90 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>

              <span class="w-2.5 h-2.5 rounded-full flex-shrink-0"
                :class="col.status === 'success' ? 'bg-green-500' : col.status === 'failed' ? 'bg-red-500' : 'bg-gray-400'"
              ></span>

              <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ col.name }}</span>
              <span class="text-xs text-gray-500 dark:text-gray-400">{{ col.jobCount }} jobs</span>

              <div class="flex items-center gap-2 ml-auto">
                <span v-if="col.failCount > 0" class="text-xs text-red-600 dark:text-red-400 font-medium">{{ col.failCount }} failed</span>
                <div class="w-10 h-1.5 rounded-full overflow-hidden bg-green-500 dark:bg-green-500 flex"
                  :title="`${col.jobCount - col.failCount} passed, ${col.failCount} failed`">
                  <div v-if="col.failCount > 0"
                    class="h-full bg-red-500 dark:bg-red-500 rounded-l-full"
                    :style="{ width: (col.failCount / col.jobCount * 100) + '%' }"
                  ></div>
                </div>
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium" :class="badgeClass(col.status)">
                  {{ col.status }}
                </span>
              </div>
            </summary>

            <div class="bg-white dark:bg-gray-800">
              <!-- Packages Section -->
              <details open class="group/pkgs">
                <summary class="px-4 py-2.5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 cursor-pointer flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors list-none [&::-webkit-details-marker]:hidden">
                  <svg class="w-3 h-3 text-gray-400 transition-transform group-open/pkgs:rotate-90 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                  <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  <span class="text-xs font-medium text-gray-600 dark:text-gray-400">Packages</span>
                  <span v-if="packages[col.name]?.totalCount" class="text-xs text-gray-400 dark:text-gray-500">
                    {{ packages[col.name].totalCount }} packages
                  </span>
                  <span v-if="packages[col.name]?.variant" class="text-xs text-gray-400 dark:text-gray-500 ml-auto">
                    {{ packages[col.name].variant }}
                  </span>
                </summary>

                <div class="px-4 py-3 border-t border-gray-100 dark:border-gray-700/50">
                  <div v-if="packagesLoading.has(col.name)" class="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 py-2">
                    <svg class="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Loading packages...
                  </div>

                  <div v-else-if="packages[col.name]?.error" class="text-xs text-red-500 dark:text-red-400 py-1">
                    Failed to load packages: {{ packages[col.name].error }}
                  </div>

                  <div v-else-if="packages[col.name]?.groups" class="space-y-3">
                    <div v-for="group in packages[col.name].groups" :key="group.source">
                      <div class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">{{ formatTeamName(group.source) }}</div>
                      <div class="flex flex-wrap gap-1.5">
                        <span v-for="pkg in group.packages" :key="pkg"
                          class="inline-block px-2 py-0.5 rounded-md text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                        >{{ pkg }}</span>
                      </div>
                    </div>
                  </div>

                  <div v-else class="text-xs text-gray-400 dark:text-gray-500 py-1">
                    Package data not available
                  </div>
                </div>
              </details>

              <!-- Jobs Matrix Section -->
              <details open class="group/jobs">
                <summary class="px-4 py-2.5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 cursor-pointer flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors list-none [&::-webkit-details-marker]:hidden">
                  <svg class="w-3 h-3 text-gray-400 transition-transform group-open/jobs:rotate-90 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                  <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  <span class="text-xs font-medium text-gray-600 dark:text-gray-400">Jobs Matrix</span>
                </summary>

                <div class="border-t border-gray-100 dark:border-gray-700/50">
                  <table class="w-full text-sm">
                    <thead>
                      <tr class="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                        <th class="text-left py-2 px-4 font-medium text-gray-600 dark:text-gray-400 w-28">Variant</th>
                        <th class="text-left py-2 px-4 font-medium text-gray-600 dark:text-gray-400 w-24">Arch</th>
                        <th v-for="stage in STAGE_ORDER" :key="stage" class="text-center py-2 px-2 font-medium text-gray-600 dark:text-gray-400">
                          {{ STAGE_LABELS[stage] }}
                        </th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100 dark:divide-gray-700/50">
                      <template v-for="ve in col.variantEntries" :key="ve.variant">
                        <tr v-for="(ae, ai) in ve.archs" :key="`${ve.variant}-${ae.arch}`"
                          class="hover:bg-gray-50 dark:hover:bg-gray-750/50 transition-colors"
                        >
                          <td v-if="ai === 0" :rowspan="ve.archs.length" class="py-2 px-4 text-gray-900 dark:text-gray-200 font-medium align-top border-r border-gray-100 dark:border-gray-700/50">
                            {{ ve.variant }}
                          </td>
                          <td class="py-2 px-4 text-gray-600 dark:text-gray-400">{{ ae.arch }}</td>
                          <td v-for="stage in STAGE_ORDER" :key="stage" class="py-2 px-2 text-center">
                            <template v-if="ae.stages[stage]">
                              <a :href="ae.stages[stage].web_url" target="_blank" rel="noopener noreferrer"
                                class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors hover:ring-1 hover:ring-offset-1 dark:hover:ring-offset-gray-800"
                                :class="jobCellClass(ae.stages[stage].status)"
                                :title="jobTitle(ae.stages[stage])"
                              >
                                <svg v-if="ae.stages[stage].status === 'success'" class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                                </svg>
                                <svg v-else-if="ae.stages[stage].status === 'failed'" class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                <span v-else-if="ae.stages[stage].status === 'skipped'" class="w-3 text-center">-</span>
                                <span v-else class="w-3 text-center">?</span>
                                {{ jobLabel(ae.stages[stage].status) }}
                              </a>
                            </template>
                            <span v-else class="text-gray-300 dark:text-gray-600">&mdash;</span>
                          </td>
                        </tr>
                      </template>
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          </details>
        </div>

        <!-- Special Jobs -->
        <div v-if="jobs.special_jobs.length > 0" class="mt-4 text-xs text-gray-500 dark:text-gray-400">
          <span class="font-medium">Utility jobs:</span>
          <span v-for="(sj, i) in jobs.special_jobs" :key="sj.name">
            {{ i > 0 ? ', ' : ' ' }}
            <a :href="sj.web_url" target="_blank" rel="noopener noreferrer" class="hover:underline">{{ sj.name }}</a>
            (<span :class="sj.status === 'success' ? 'text-green-600 dark:text-green-400' : sj.status === 'failed' ? 'text-red-600 dark:text-red-400' : ''">{{ sj.status }}</span>)
          </span>
        </div>
      </template>
    </template>

    <!-- Empty state -->
    <div v-else-if="!loading" class="text-center py-12 text-gray-500 dark:text-gray-400">
      No nightly pipeline data available.
    </div>
  </div>
</template>
