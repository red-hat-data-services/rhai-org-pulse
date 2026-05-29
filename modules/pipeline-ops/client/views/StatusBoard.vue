<script setup>
import { ref, computed, onMounted, onUnmounted, inject } from 'vue'
import { AlertCircleIcon, FilterIcon, LayoutGridIcon, ListIcon, RefreshCwIcon, LoaderIcon, CheckCircleIcon } from 'lucide-vue-next'
import { useAuth } from '@shared/client/composables/useAuth'
import { apiRequest } from '@shared/client/services/api'
import { usePipelines } from '../composables/usePipelines.js'
import PipelineCard from '../components/PipelineCard.vue'

const moduleNav = inject('moduleNav')
const { isAdmin } = useAuth()
const canRefresh = computed(() => isAdmin.value || import.meta.env.DEV)
const { pipelines, loading, error, load } = usePipelines()

const filterOwner = ref('')
const filterPlatform = ref('')
const grouped = ref(true)

const refreshing = ref(false)
const refreshResult = ref(null)
let pollTimer = null

async function triggerRefresh() {
  refreshing.value = true
  refreshResult.value = null
  try {
    await apiRequest('/modules/pipeline-ops/refresh', { method: 'POST' })
    pollTimer = setInterval(pollRefreshStatus, 3000)
  } catch (err) {
    refreshing.value = false
    refreshResult.value = { error: err.message }
  }
}

async function pollRefreshStatus() {
  try {
    const status = await apiRequest('/modules/pipeline-ops/refresh/status')
    if (!status.running) {
      clearInterval(pollTimer)
      pollTimer = null
      refreshing.value = false
      refreshResult.value = status.lastResult
      load()
      setTimeout(() => { refreshResult.value = null }, 15000)
    }
  } catch {
    clearInterval(pollTimer)
    pollTimer = null
    refreshing.value = false
  }
}

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})

const owners = computed(() => {
  const set = new Set(pipelines.value.map(p => p.owner).filter(Boolean))
  return [...set].sort()
})

const platforms = computed(() => {
  const set = new Set(pipelines.value.map(p => p.repo?.platform).filter(Boolean))
  return [...set].sort()
})

const filtered = computed(() => {
  let list = pipelines.value
  if (filterOwner.value) {
    list = list.filter(p => p.owner === filterOwner.value)
  }
  if (filterPlatform.value) {
    list = list.filter(p => p.repo?.platform === filterPlatform.value)
  }

  return [...list].sort((a, b) => {
    const oa = a.order ?? 999
    const ob = b.order ?? 999
    if (oa !== ob) return oa - ob
    return (a.name || '').localeCompare(b.name || '')
  })
})

const groups = computed(() => {
  if (!grouped.value) return null
  const map = {}
  for (const p of filtered.value) {
    const g = p.group || 'Ungrouped'
    if (!map[g]) map[g] = []
    map[g].push(p)
  }
  return map
})

function openDetail(pipeline) {
  moduleNav.navigateTo('detail', { slug: pipeline.slug })
}

onMounted(load)
</script>

<template>
  <div>
    <div class="mb-4 flex items-start justify-between flex-wrap gap-3">
      <div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Pipeline Status Board</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Operational overview of AI-First pipeline infrastructure</p>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <div class="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <FilterIcon :size="12" />
        </div>

        <select
          v-model="filterOwner"
          class="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
        >
          <option value="">All owners</option>
          <option v-for="o in owners" :key="o" :value="o">{{ o }}</option>
        </select>

        <select
          v-model="filterPlatform"
          class="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
        >
          <option value="">All platforms</option>
          <option v-for="p in platforms" :key="p" :value="p">{{ p }}</option>
        </select>

        <button
          class="p-1.5 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          :class="grouped ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-300 dark:border-primary-600' : ''"
          title="Toggle grouping"
          @click="grouped = !grouped"
        >
          <component :is="grouped ? ListIcon : LayoutGridIcon" :size="14" class="text-gray-500 dark:text-gray-400" />
        </button>

        <button
          v-if="canRefresh"
          class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors"
          :class="refreshing
            ? 'border-primary-300 dark:border-primary-600 bg-primary-50 dark:bg-primary-900/30 text-primary-600 cursor-wait'
            : 'border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'"
          :disabled="refreshing"
          title="Collect latest run data from GitLab/GitHub"
          @click="triggerRefresh"
        >
          <component :is="refreshing ? LoaderIcon : RefreshCwIcon" :size="12" :class="refreshing ? 'animate-spin' : ''" />
          {{ refreshing ? 'Collecting...' : 'Refresh' }}
        </button>
      </div>
    </div>

    <!-- Refresh result banner -->
    <div v-if="refreshResult" class="mb-4 text-xs px-3 py-2 rounded-lg" :class="refreshResult.error
      ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
      : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'"
    >
      <div class="flex items-center gap-2">
        <component :is="refreshResult.error ? AlertCircleIcon : CheckCircleIcon" :size="14" class="flex-shrink-0" />
        <span v-if="refreshResult.error">Refresh failed: {{ refreshResult.error }}</span>
        <span v-else>
          Collected {{ refreshResult.collected || 0 }} pipelines<span v-if="refreshResult.skipped">, skipped {{ refreshResult.skipped }}</span><span v-if="refreshResult.errors">, {{ refreshResult.errors }} errors</span>
        </span>
      </div>
      <ul v-if="refreshResult.details?.length" class="mt-1.5 ml-5 space-y-0.5 text-gray-600 dark:text-gray-400">
        <li v-for="d in refreshResult.details" :key="d.slug" class="flex items-center gap-1.5">
          <span :class="d.status === 'ok' ? 'text-emerald-500' : d.status === 'skipped' ? 'text-amber-500' : 'text-red-500'">{{ d.status === 'ok' ? '+' : d.status === 'skipped' ? '-' : 'x' }}</span>
          <span class="font-medium">{{ d.slug }}</span>
          <span v-if="d.status === 'ok'">— {{ d.runsFound }} runs found</span>
          <span v-else>— {{ d.reason }}</span>
        </li>
      </ul>
    </div>

    <!-- Loading -->
    <div v-if="loading && pipelines.length === 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="i in 6" :key="i" class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 animate-pulse">
        <div class="flex items-center gap-2.5 mb-3">
          <div class="w-2.5 h-2.5 rounded-full bg-gray-200 dark:bg-gray-600" />
          <div class="h-4 bg-gray-200 dark:bg-gray-600 rounded w-40" />
        </div>
        <div class="space-y-2">
          <div class="h-3 bg-gray-100 dark:bg-gray-700 rounded w-32" />
          <div class="h-3 bg-gray-100 dark:bg-gray-700 rounded w-24" />
        </div>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
      <div class="w-12 h-12 mx-auto mb-3 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
        <AlertCircleIcon :size="24" class="text-red-500" />
      </div>
      <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Error loading pipelines</h3>
      <p class="text-sm text-red-700 dark:text-red-400">{{ error }}</p>
      <button class="mt-3 text-sm text-primary-600 hover:text-primary-700 font-medium" @click="load">Retry</button>
    </div>

    <!-- Empty -->
    <div v-else-if="filtered.length === 0" class="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center">
      <p class="text-gray-500 dark:text-gray-400">No pipelines found.</p>
    </div>

    <!-- Grouped -->
    <template v-else-if="groups">
      <div v-for="(items, groupName) in groups" :key="groupName" class="mb-6">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{{ groupName }}</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <PipelineCard
            v-for="p in items"
            :key="p.slug"
            :pipeline="p"
            @click="openDetail"
          />
        </div>
      </div>
    </template>

    <!-- Ungrouped (default) -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <PipelineCard
        v-for="p in filtered"
        :key="p.slug"
        :pipeline="p"
        @click="openDetail"
      />
    </div>
  </div>
</template>
