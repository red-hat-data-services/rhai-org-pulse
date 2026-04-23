<script setup>
import { ref, onMounted, onBeforeUnmount, inject, computed } from 'vue'
import { useFeatureTraffic, useVersions } from '../composables/useFeatureTraffic'
import StatusBadge from '../components/StatusBadge.vue'

const nav = inject('moduleNav')
const { features, fetchedAt, loading, error, loadFeatures } = useFeatureTraffic()
const { versions, loadVersions } = useVersions()

const selectedVersions = ref([])
const selectedSignals = ref([])
const searchQuery = ref('')
const viewMode = ref('signals') // 'signals' or 'list'

// Dropdown open state
const versionDropdownOpen = ref(false)
const signalDropdownOpen = ref(false)

function toggleVersion(v) {
  const idx = selectedVersions.value.indexOf(v)
  if (idx >= 0) selectedVersions.value.splice(idx, 1)
  else selectedVersions.value.push(v)
}

function toggleSignal(s) {
  const idx = selectedSignals.value.indexOf(s)
  if (idx >= 0) selectedSignals.value.splice(idx, 1)
  else selectedSignals.value.push(s)
}

const versionFilterLabel = computed(() => {
  if (selectedVersions.value.length === 0) return 'All Versions'
  if (selectedVersions.value.length === 1) return selectedVersions.value[0]
  return selectedVersions.value.length + ' versions'
})

const signalFilterLabel = computed(() => {
  if (selectedSignals.value.length === 0) return 'All States'
  if (selectedSignals.value.length === 1) {
    const opt = signalFilterOptions.find(o => o.value === selectedSignals.value[0])
    return opt ? opt.label : selectedSignals.value[0]
  }
  return selectedSignals.value.length + ' states'
})

// Close dropdowns on outside click
function handleOutsideClick(e) {
  if (!e.target.closest('.multi-select-dropdown')) {
    versionDropdownOpen.value = false
    signalDropdownOpen.value = false
  }
}
onMounted(() => document.addEventListener('click', handleOutsideClick))
onBeforeUnmount(() => document.removeEventListener('click', handleOutsideClick))

const filteredFeatures = computed(() => {
  let list = features.value
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(f =>
      f.key.toLowerCase().includes(q) ||
      f.summary.toLowerCase().includes(q)
    )
  }
  if (selectedVersions.value.length > 0) {
    list = list.filter(f => f.fixVersions && f.fixVersions.some(v => selectedVersions.value.includes(v)))
  }
  return list
})

const summaryStats = computed(() => {
  const all = filteredFeatures.value
  const total = all.length
  const done = all.filter(f => f.statusCategory === 'Done').length
  const inProgress = all.filter(f => f.statusCategory === 'In Progress').length
  const todo = all.filter(f => f.statusCategory === 'To Do').length
  const blockers = all.reduce((s, f) => s + (f.blockerCount || 0), 0)
  const totalEpics = all.reduce((s, f) => s + (f.epicCount || 0), 0)
  const totalIssues = all.reduce((s, f) => s + (f.issueCount || 0), 0)
  const avgCompletion = total > 0
    ? Math.round(all.reduce((s, f) => s + (f.completionPct || 0), 0) / total)
    : 0

  return {
    total, done, inProgress, todo, blockers, totalEpics, totalIssues, avgCompletion,
    green: all.filter(f => f.health === 'GREEN').length,
    yellow: all.filter(f => f.health === 'YELLOW').length,
    red: all.filter(f => f.health === 'RED').length
  }
})

// Donut chart arc helper
function donutArc(cx, cy, r, startAngle, endAngle) {
  if (endAngle - startAngle >= 2 * Math.PI) {
    // Full circle — use two arcs
    return [
      `M ${cx + r} ${cy}`,
      `A ${r} ${r} 0 1 1 ${cx - r} ${cy}`,
      `A ${r} ${r} 0 1 1 ${cx + r} ${cy}`
    ].join(' ')
  }
  const x1 = cx + r * Math.cos(startAngle)
  const y1 = cy + r * Math.sin(startAngle)
  const x2 = cx + r * Math.cos(endAngle)
  const y2 = cy + r * Math.sin(endAngle)
  const large = endAngle - startAngle > Math.PI ? 1 : 0
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
}

function ageDays(isoDate) {
  if (!isoDate) return null
  const d = new Date(isoDate)
  const now = new Date()
  return Math.floor((now - d) / (1000 * 60 * 60 * 24))
}

function isStale(f) {
  if (f.statusCategory !== 'In Progress') return false
  const age = ageDays(f.lastUpdated)
  return age !== null && age > 7
}

function formatAge(days) {
  if (days === null) return ''
  if (days === 0) return 'today'
  if (days === 1) return '1d ago'
  if (days < 30) return days + 'd ago'
  if (days < 365) return Math.floor(days / 30) + 'mo ago'
  return Math.floor(days / 365) + 'y ago'
}

// Traffic signal groupings
const signalGroups = computed(() => {
  const all = filteredFeatures.value

  // Completion takes priority: 100% done features are complete regardless of
  // stale health data (the pipeline counts resolved Blocker-priority issues
  // in blockerCount, inflating RED health on finished features).
  const complete = all.filter(f => f.completionPct >= 100)
  const active = all.filter(f => f.completionPct < 100)

  const blocked = active.filter(f => f.health === 'RED' && f.blockerCount > 0)
  const redOther = active.filter(f => f.health === 'RED' && f.blockerCount === 0)
  const atRisk = active.filter(f => f.health === 'YELLOW' && f.completionPct > 0)
  const notStarted = active.filter(f => f.health === 'YELLOW' && f.completionPct === 0)
  const onTrack = active.filter(f => f.health === 'GREEN')

  return [
    {
      id: 'blocked',
      title: 'Blocked',
      subtitle: 'Active blockers preventing progress',
      features: blocked,
      borderClass: 'border-red-300 dark:border-red-500/40',
      bgClass: 'bg-red-50 dark:bg-red-500/5',
      headerBg: 'bg-red-100 dark:bg-red-500/10',
      textClass: 'text-red-700 dark:text-red-400',
      dotClass: 'bg-red-500'
    },
    {
      id: 'red-other',
      title: 'Needs Attention',
      subtitle: 'Red health — stale or at risk of stalling',
      features: redOther,
      borderClass: 'border-red-200 dark:border-red-500/30',
      bgClass: 'bg-red-50/50 dark:bg-red-500/5',
      headerBg: 'bg-red-50 dark:bg-red-500/10',
      textClass: 'text-red-600 dark:text-red-400',
      dotClass: 'bg-red-400'
    },
    {
      id: 'at-risk',
      title: 'At Risk',
      subtitle: 'In progress but behind schedule',
      features: atRisk,
      borderClass: 'border-yellow-300 dark:border-yellow-500/40',
      bgClass: 'bg-yellow-50 dark:bg-yellow-500/5',
      headerBg: 'bg-yellow-100 dark:bg-yellow-500/10',
      textClass: 'text-yellow-700 dark:text-yellow-400',
      dotClass: 'bg-yellow-500'
    },
    {
      id: 'not-started',
      title: 'Not Started',
      subtitle: 'No progress yet',
      features: notStarted,
      borderClass: 'border-yellow-200 dark:border-yellow-500/30',
      bgClass: 'bg-yellow-50/50 dark:bg-yellow-500/5',
      headerBg: 'bg-yellow-50 dark:bg-yellow-500/10',
      textClass: 'text-yellow-600 dark:text-yellow-400',
      dotClass: 'bg-yellow-400'
    },
    {
      id: 'on-track',
      title: 'On Track',
      subtitle: 'Healthy and making progress',
      features: onTrack,
      borderClass: 'border-green-300 dark:border-green-500/40',
      bgClass: 'bg-green-50 dark:bg-green-500/5',
      headerBg: 'bg-green-100 dark:bg-green-500/10',
      textClass: 'text-green-700 dark:text-green-400',
      dotClass: 'bg-green-500'
    },
    {
      id: 'complete',
      title: 'Complete',
      subtitle: 'Fully delivered',
      features: complete,
      borderClass: 'border-green-200 dark:border-green-500/30',
      bgClass: 'bg-green-50/50 dark:bg-green-500/5',
      headerBg: 'bg-green-50 dark:bg-green-500/10',
      textClass: 'text-green-600 dark:text-green-400',
      dotClass: 'bg-green-400'
    }
  ].filter(g => g.features.length > 0)
})

const signalFilterOptions = [
  { value: '', label: 'All States' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'red-other', label: 'Needs Attention' },
  { value: 'at-risk', label: 'At Risk' },
  { value: 'not-started', label: 'Not Started' },
  { value: 'on-track', label: 'On Track' },
  { value: 'complete', label: 'Complete' }
]

const visibleSignalGroups = computed(() => {
  if (selectedSignals.value.length === 0) return signalGroups.value
  return signalGroups.value.filter(g => selectedSignals.value.includes(g.id))
})

const priorityStyle = {
  'Blocker': 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',
  'Critical': 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400',
  'Major': 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
  'Normal': 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
  'Minor': 'bg-gray-100 dark:bg-gray-500/20 text-gray-600 dark:text-gray-400',
  'Undefined': 'bg-gray-100 dark:bg-gray-500/20 text-gray-500 dark:text-gray-500'
}

function handleSelect(key) {
  nav.navigateTo('feature-detail', { key })
}

function formatDate(iso) {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleString()
}

function progressBarColor(pct) {
  if (pct >= 70) return 'bg-green-500'
  if (pct >= 40) return 'bg-yellow-500'
  return 'bg-red-500'
}

onMounted(() => {
  loadFeatures()
  loadVersions()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">Feature Traffic Overview</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          RHAISTRAT feature delivery pipeline health
          <span v-if="fetchedAt" class="ml-2">
            &middot; Data from {{ formatDate(fetchedAt) }}
          </span>
        </p>
      </div>
      <!-- View toggle -->
      <div class="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
        <button
          @click="viewMode = 'signals'"
          class="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
          :class="viewMode === 'signals'
            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
        >Signals</button>
        <button
          @click="viewMode = 'list'"
          class="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
          :class="viewMode === 'list'
            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
        >List</button>
      </div>
    </div>

    <!-- Progress Summary -->
    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
      <div class="flex flex-col md:flex-row items-start md:items-center gap-6">
        <!-- Donut chart -->
        <div class="flex-shrink-0">
          <svg width="120" height="120" viewBox="0 0 120 120">
            <!-- Background ring -->
            <circle cx="60" cy="60" r="45" fill="none" stroke-width="14" class="stroke-gray-200 dark:stroke-gray-700" />
            <!-- Done arc (green) -->
            <path
              v-if="summaryStats.done > 0"
              :d="donutArc(60, 60, 45, -Math.PI / 2, -Math.PI / 2 + (summaryStats.done / Math.max(summaryStats.total, 1)) * 2 * Math.PI)"
              fill="none" stroke-width="14" stroke-linecap="round"
              class="stroke-green-500"
            />
            <!-- In Progress arc (blue) -->
            <path
              v-if="summaryStats.inProgress > 0"
              :d="donutArc(60, 60, 45,
                -Math.PI / 2 + (summaryStats.done / Math.max(summaryStats.total, 1)) * 2 * Math.PI,
                -Math.PI / 2 + ((summaryStats.done + summaryStats.inProgress) / Math.max(summaryStats.total, 1)) * 2 * Math.PI)"
              fill="none" stroke-width="14" stroke-linecap="round"
              class="stroke-blue-500"
            />
            <!-- Backlog arc (gray) — implicit from background -->
            <!-- Center text -->
            <text x="60" y="55" text-anchor="middle" class="fill-gray-900 dark:fill-gray-100 text-xl font-bold" font-size="22" font-weight="bold">{{ summaryStats.avgCompletion }}%</text>
            <text x="60" y="72" text-anchor="middle" class="fill-gray-500 dark:fill-gray-400" font-size="10">complete</text>
          </svg>
        </div>

        <!-- Stat cards -->
        <div class="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 w-full">
          <div class="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50">
            <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ summaryStats.total }}</div>
            <div class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 uppercase tracking-wide">Features</div>
          </div>
          <div class="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50">
            <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ summaryStats.totalEpics }}</div>
            <div class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 uppercase tracking-wide">Epics</div>
          </div>
          <div class="text-center p-3 rounded-lg bg-green-50 dark:bg-green-500/10">
            <div class="text-2xl font-bold text-green-600 dark:text-green-400">{{ summaryStats.done }}</div>
            <div class="text-[10px] text-green-600 dark:text-green-400 mt-0.5 uppercase tracking-wide">Done</div>
          </div>
          <div class="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-500/10">
            <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">{{ summaryStats.inProgress }}</div>
            <div class="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5 uppercase tracking-wide">Active</div>
          </div>
          <div class="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50">
            <div class="text-2xl font-bold text-gray-500 dark:text-gray-400">{{ summaryStats.todo }}</div>
            <div class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 uppercase tracking-wide">Backlog</div>
          </div>
          <div class="text-center p-3 rounded-lg" :class="summaryStats.blockers > 0 ? 'bg-red-50 dark:bg-red-500/10' : 'bg-gray-50 dark:bg-gray-900/50'">
            <div class="text-2xl font-bold" :class="summaryStats.blockers > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'">{{ summaryStats.blockers }}</div>
            <div class="text-[10px] mt-0.5 uppercase tracking-wide" :class="summaryStats.blockers > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'">Blockers</div>
          </div>
          <div class="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50">
            <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ summaryStats.totalIssues }}</div>
            <div class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 uppercase tracking-wide">Issues</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap gap-3 items-center">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search features..."
        class="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
      />

      <!-- Multi-select: Versions -->
      <div class="relative multi-select-dropdown">
        <button
          @click.stop="versionDropdownOpen = !versionDropdownOpen; signalDropdownOpen = false"
          class="bg-white dark:bg-gray-800 border rounded-md px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none flex items-center gap-1.5 min-w-[140px]"
          :class="selectedVersions.length > 0
            ? 'border-primary-500 ring-1 ring-primary-500'
            : 'border-gray-300 dark:border-gray-600'"
        >
          <span class="flex-1 text-left truncate">{{ versionFilterLabel }}</span>
          <svg class="w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform" :class="{ 'rotate-180': versionDropdownOpen }" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </button>
        <div
          v-if="versionDropdownOpen"
          class="absolute z-20 mt-1 w-56 max-h-60 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg py-1"
        >
          <label
            v-for="v in versions"
            :key="v"
            class="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-sm text-gray-900 dark:text-gray-100"
          >
            <input
              type="checkbox"
              :checked="selectedVersions.includes(v)"
              @change="toggleVersion(v)"
              class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
            />
            <span class="truncate">{{ v }}</span>
          </label>
          <div v-if="versions.length === 0" class="px-3 py-2 text-xs text-gray-400">No versions available</div>
        </div>
      </div>

      <!-- Multi-select: States -->
      <div class="relative multi-select-dropdown">
        <button
          @click.stop="signalDropdownOpen = !signalDropdownOpen; versionDropdownOpen = false"
          class="bg-white dark:bg-gray-800 border rounded-md px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none flex items-center gap-1.5 min-w-[130px]"
          :class="selectedSignals.length > 0
            ? 'border-primary-500 ring-1 ring-primary-500'
            : 'border-gray-300 dark:border-gray-600'"
        >
          <span class="flex-1 text-left truncate">{{ signalFilterLabel }}</span>
          <svg class="w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform" :class="{ 'rotate-180': signalDropdownOpen }" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </button>
        <div
          v-if="signalDropdownOpen"
          class="absolute z-20 mt-1 w-52 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg py-1"
        >
          <label
            v-for="opt in signalFilterOptions.filter(o => o.value)"
            :key="opt.value"
            class="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-sm text-gray-900 dark:text-gray-100"
          >
            <input
              type="checkbox"
              :checked="selectedSignals.includes(opt.value)"
              @change="toggleSignal(opt.value)"
              class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
            />
            <span>{{ opt.label }}</span>
          </label>
        </div>
      </div>

      <button
        v-if="selectedVersions.length > 0 || searchQuery || selectedSignals.length > 0"
        class="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        @click="selectedVersions = []; searchQuery = ''; selectedSignals = []"
      >
        Clear Filters
      </button>
    </div>

    <!-- Error -->
    <div v-if="error" class="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg p-4 text-red-700 dark:text-red-400 text-sm">
      {{ error }}
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-12 text-gray-500">
      Loading feature data...
    </div>

    <template v-else>
      <!-- ===================== SIGNALS VIEW ===================== -->
      <template v-if="viewMode === 'signals'">
        <div class="space-y-4">
          <div
            v-for="group in visibleSignalGroups"
            :key="group.id"
            class="rounded-lg border overflow-hidden"
            :class="[group.borderClass, group.bgClass]"
          >
            <!-- Signal card header -->
            <div class="px-4 py-3 flex items-center justify-between" :class="group.headerBg">
              <div class="flex items-center gap-2">
                <span class="w-3 h-3 rounded-full" :class="group.dotClass" />
                <h3 class="text-sm font-semibold" :class="group.textClass">{{ group.title }}</h3>
                <span class="text-xs font-medium px-1.5 py-0.5 rounded-full bg-white/60 dark:bg-gray-900/30" :class="group.textClass">{{ group.features.length }}</span>
              </div>
              <span class="text-xs text-gray-500 dark:text-gray-400">{{ group.subtitle }}</span>
            </div>

            <!-- Feature tiles -->
            <div class="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              <div
                v-for="f in group.features"
                :key="f.key"
                class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200/80 dark:border-gray-700/80 cursor-pointer hover:shadow-md dark:hover:border-gray-600 transition-all overflow-hidden"
                @click="handleSelect(f.key)"
              >
                <!-- Tile header -->
                <div class="px-4 pt-3 pb-2">
                  <div class="flex items-center justify-between gap-2 mb-1">
                    <div class="flex items-center gap-2">
                      <span class="text-primary-600 dark:text-blue-400 font-mono text-xs font-semibold">{{ f.key }}</span>
                      <StatusBadge :status="f.status" />
                      <span
                        v-if="f.priority && f.priority !== 'Undefined'"
                        class="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold"
                        :class="priorityStyle[f.priority] || priorityStyle['Undefined']"
                      >{{ f.priority }}</span>
                    </div>
                    <StatusBadge :health="f.health" />
                  </div>
                  <p class="text-sm text-gray-900 dark:text-gray-100 font-medium leading-snug">{{ f.summary }}</p>
                </div>

                <!-- Progress bar -->
                <div class="px-4 pb-2">
                  <div class="flex items-center gap-2">
                    <div class="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        class="h-full rounded-full transition-all"
                        :class="progressBarColor(f.completionPct)"
                        :style="{ width: f.completionPct + '%' }"
                      />
                    </div>
                    <span class="text-xs font-bold w-10 text-right" :class="{
                      'text-green-600 dark:text-green-400': f.completionPct >= 70,
                      'text-yellow-600 dark:text-yellow-400': f.completionPct >= 40 && f.completionPct < 70,
                      'text-red-600 dark:text-red-400': f.completionPct < 40
                    }">{{ f.completionPct }}%</span>
                  </div>
                </div>

                <!-- Counts breakdown -->
                <div class="px-4 pb-2 flex items-center gap-3 text-xs">
                  <span class="text-gray-500 dark:text-gray-400">
                    <span class="font-semibold text-gray-700 dark:text-gray-300">{{ f.epicCount }}</span> Epics
                  </span>
                  <span class="text-gray-300 dark:text-gray-600">|</span>
                  <span class="text-gray-500 dark:text-gray-400">
                    <span class="font-semibold text-gray-700 dark:text-gray-300">{{ f.issueCount }}</span> Issues
                  </span>
                  <span v-if="f.blockerCount > 0" class="text-gray-300 dark:text-gray-600">|</span>
                  <span v-if="f.blockerCount > 0" class="text-red-600 dark:text-red-400 font-semibold">
                    {{ f.blockerCount }} Blockers
                  </span>
                </div>

                <!-- Footer pills -->
                <div class="px-4 pb-3 flex flex-wrap items-center gap-1.5">
                  <!-- Assignee -->
                  <span
                    v-if="f.assignee"
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                  >
                    <svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><circle cx="10" cy="6" r="4"/><path d="M2 17c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                    {{ f.assignee }}
                  </span>
                  <span
                    v-else
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400"
                  >Unassigned</span>

                  <!-- Fix versions -->
                  <span
                    v-for="v in (f.fixVersions || [])"
                    :key="v"
                    class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400"
                  >{{ v }}</span>

                  <!-- Labels (show first 2) -->
                  <span
                    v-for="label in (f.labels || []).slice(0, 2)"
                    :key="label"
                    class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400"
                  >{{ label }}</span>
                  <span
                    v-if="(f.labels || []).length > 2"
                    class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                  >+{{ f.labels.length - 2 }}</span>

                  <!-- Age -->
                  <span
                    v-if="f.lastUpdated"
                    class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                  >{{ formatAge(ageDays(f.lastUpdated)) }}</span>

                  <!-- Stale warning -->
                  <span
                    v-if="isStale(f)"
                    class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400"
                  >
                    <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 15.75h.007v.008H12v-.008z"/></svg>
                    Stale
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="visibleSignalGroups.length === 0 && !loading" class="text-center py-12 text-gray-500">
          No features found matching the current filters.
        </div>
      </template>

      <!-- ===================== LIST VIEW ===================== -->
      <template v-if="viewMode === 'list'">
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-gray-200 dark:border-gray-700">
                  <th class="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">Key</th>
                  <th class="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">Summary</th>
                  <th class="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">Status</th>
                  <th class="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">Health</th>
                  <th class="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">Progress</th>
                  <th class="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">Epics</th>
                  <th class="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">Issues</th>
                  <th class="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">Blockers</th>
                  <th class="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">Version</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="f in filteredFeatures"
                  :key="f.key"
                  class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                  @click="handleSelect(f.key)"
                >
                  <td class="px-3 py-2">
                    <span class="text-primary-600 dark:text-blue-400 font-mono text-xs">{{ f.key }}</span>
                  </td>
                  <td class="px-3 py-2 text-gray-900 dark:text-gray-100 max-w-xs truncate">{{ f.summary }}</td>
                  <td class="px-3 py-2"><StatusBadge :status="f.status" /></td>
                  <td class="px-3 py-2"><StatusBadge :health="f.health">{{ f.health }}</StatusBadge></td>
                  <td class="px-3 py-2">
                    <div class="flex items-center gap-2">
                      <div class="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          class="h-full rounded-full transition-all"
                          :class="progressBarColor(f.completionPct)"
                          :style="{ width: f.completionPct + '%' }"
                        />
                      </div>
                      <span class="text-gray-500 dark:text-gray-400 text-xs">{{ f.completionPct }}%</span>
                    </div>
                  </td>
                  <td class="px-3 py-2 text-gray-700 dark:text-gray-300">{{ f.epicCount }}</td>
                  <td class="px-3 py-2 text-gray-700 dark:text-gray-300">{{ f.issueCount }}</td>
                  <td class="px-3 py-2">
                    <span v-if="f.blockerCount > 0" class="text-red-600 dark:text-red-400 font-medium">{{ f.blockerCount }}</span>
                    <span v-else class="text-gray-400 dark:text-gray-600">0</span>
                  </td>
                  <td class="px-3 py-2">
                    <span
                      v-for="v in (f.fixVersions || []).slice(0, 2)"
                      :key="v"
                      class="inline-block px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs mr-1"
                    >{{ v }}</span>
                  </td>
                </tr>
                <tr v-if="filteredFeatures.length === 0">
                  <td colspan="9" class="px-3 py-8 text-center text-gray-500">
                    No features found matching the current filters.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>
