<script setup>
import { computed, onMounted } from 'vue'
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

const heroTheme = computed(() => theme(latestPipeline.value?.status))

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

const timelinePipelines = computed(() => [...pipelines.value].reverse())

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

onMounted(() => loadPipelines())
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
          <svg v-if="latestPipeline.status === 'success'" :class="heroTheme.icon" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
          </svg>
          <svg v-else-if="latestPipeline.status === 'failed'" :class="heroTheme.icon" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            {{ theme(latestPipeline.status).label || latestPipeline.status.toUpperCase() }}
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

      <!-- ===== TIER 2: Pipeline Timeline ===== -->
      <div class="mb-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div class="flex items-center justify-between mb-4">
          <div class="text-sm font-semibold text-gray-700 dark:text-gray-300">Pipeline History</div>
          <div class="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span>{{ successRate }}% pass rate</span>
            <span v-if="lastSuccess && latestPipeline?.status !== 'success'">
              Last success: {{ formatDate(lastSuccess.created_at) }}
            </span>
          </div>
        </div>

        <div class="flex gap-1.5 overflow-x-auto pb-1">
          <button
            v-for="p in timelinePipelines" :key="p.id"
            :class="[theme(p.status).tile, selectedPipelineId === p.id ? theme(p.status).tileSelected : 'border-transparent']"
            class="flex-shrink-0 w-16 rounded-lg pt-1.5 pb-2 text-center cursor-pointer transition-all border-2"
            @click="selectPipeline(p)"
          >
            <div :class="theme(p.status).tileLabel" class="text-[10px] leading-tight font-medium">{{ dateParts(p.created_at).dow }}</div>
            <div :class="theme(p.status).tileDay" class="text-xl font-bold leading-tight mt-0.5">{{ dateParts(p.created_at).day }}</div>
            <div :class="theme(p.status).tileLabel" class="text-[10px] leading-tight">{{ dateParts(p.created_at).month }}</div>
            <div class="mt-1">
              <svg v-if="p.status === 'success'" :class="theme(p.status).icon" class="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
              </svg>
              <svg v-else-if="p.status === 'failed'" :class="theme(p.status).icon" class="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <svg v-else class="w-4 h-4 mx-auto animate-spin" :class="theme(p.status).icon" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          </button>
        </div>
      </div>

      <!-- ===== TIER 3: Pipeline Detail ===== -->
      <!-- Prompt to select -->
      <div v-if="!selectedPipelineId && !jobsLoading && !jobs" class="text-center py-10 bg-gray-50 dark:bg-gray-800/50 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
        <svg class="w-8 h-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
        </svg>
        <div class="text-sm font-medium text-gray-600 dark:text-gray-400">Click a pipeline above to view job details</div>
        <div class="text-xs text-gray-400 dark:text-gray-500 mt-1">Each tile represents one nightly pipeline run</div>
      </div>

      <!-- Jobs loading -->
      <div v-if="jobsLoading" class="text-center py-12">
        <svg class="animate-spin h-8 w-8 text-gray-400 mx-auto" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <div class="mt-2 text-gray-500 dark:text-gray-400 text-sm">Loading job details...</div>
      </div>

      <template v-else-if="jobs && selectedPipeline">
        <!-- Pipeline header -->
        <div class="mb-4 p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div class="flex items-center gap-3 flex-wrap">
            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium" :class="badgeClass(selectedPipeline.status)">
              {{ selectedPipeline.status }}
            </span>
            <span class="text-sm font-semibold text-gray-900 dark:text-white">
              {{ formatDateFull(selectedPipeline.created_at) }}
            </span>
            <span class="text-xs text-gray-400 dark:text-gray-500">Pipeline #{{ jobs.pipeline_id }}</span>
            <span class="text-sm text-gray-500 dark:text-gray-400 ml-auto">
              {{ jobs.summary.total }} jobs &middot; {{ jobs.summary.success }} passed &middot; {{ jobs.summary.failed }} failed &middot; {{ jobs.summary.skipped }} skipped
            </span>
            <a :href="selectedPipeline.web_url" target="_blank" rel="noopener noreferrer"
              class="text-sm text-blue-600 dark:text-blue-400 hover:underline">
              View on GitLab &rarr;
            </a>
          </div>
        </div>

        <!-- Failed Jobs Alert -->
        <div v-if="jobs.failed_jobs.length > 0" class="mb-4 border border-red-200 dark:border-red-800/50 rounded-lg overflow-hidden">
          <div class="px-4 py-3 bg-red-50 dark:bg-red-900/10 border-b border-red-200 dark:border-red-800/50">
            <span class="text-sm font-semibold text-red-800 dark:text-red-300">
              {{ jobs.failed_jobs.length }} Failed Job{{ jobs.failed_jobs.length !== 1 ? 's' : '' }}
            </span>
          </div>
          <div class="divide-y divide-red-100 dark:divide-red-900/20">
            <div v-for="fj in jobs.failed_jobs" :key="fj.id" class="px-4 py-2.5 flex items-center gap-3 bg-white dark:bg-gray-800">
              <svg class="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div class="flex-1 min-w-0">
                <a :href="fj.web_url" target="_blank" rel="noopener noreferrer"
                  class="text-sm font-medium text-red-700 dark:text-red-400 hover:underline">
                  {{ fj.name }}
                </a>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {{ fj.collection }} &middot; {{ fj.variant }} &middot; {{ fj.arch }} &middot; {{ STAGE_LABELS[fj.stage] || fj.stage }}
                </div>
              </div>
              <span v-if="fj.failure_reason" class="text-xs text-gray-400 dark:text-gray-500">{{ fj.failure_reason }}</span>
            </div>
          </div>
        </div>

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
              <span v-if="col.failCount > 0" class="text-xs text-red-600 dark:text-red-400 font-medium">{{ col.failCount }} failed</span>
              <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ml-auto" :class="badgeClass(col.status)">
                {{ col.status }}
              </span>
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
