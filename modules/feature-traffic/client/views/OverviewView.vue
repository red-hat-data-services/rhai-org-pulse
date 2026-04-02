<script setup>
import { ref, onMounted, inject, computed } from 'vue'
import { useFeatureTraffic, useVersions } from '../composables/useFeatureTraffic'
import FeatureTable from '../components/FeatureTable.vue'
import StatusBadge from '../components/StatusBadge.vue'

const nav = inject('moduleNav')
const { features, featureCount, fetchedAt, loading, error, loadFeatures } = useFeatureTraffic()
const { versions, loadVersions } = useVersions()

const statusFilter = ref('')
const versionFilter = ref('')
const healthFilter = ref('')
const searchQuery = ref('')

const filteredFeatures = computed(() => {
  if (!searchQuery.value) return features.value
  const q = searchQuery.value.toLowerCase()
  return features.value.filter(f =>
    f.key.toLowerCase().includes(q) ||
    f.summary.toLowerCase().includes(q)
  )
})

const summaryStats = computed(() => {
  const all = features.value
  return {
    total: all.length,
    green: all.filter(f => f.health === 'GREEN').length,
    yellow: all.filter(f => f.health === 'YELLOW').length,
    red: all.filter(f => f.health === 'RED').length,
    avgCompletion: all.length > 0
      ? Math.round(all.reduce((s, f) => s + (f.completionPct || 0), 0) / all.length)
      : 0
  }
})

function handleSelect(key) {
  nav.navigateTo('feature-detail', { key })
}

function handleSort({ sortBy, sortDir }) {
  loadFeatures({
    status: statusFilter.value,
    version: versionFilter.value,
    health: healthFilter.value,
    sortBy,
    sortDir
  })
}

function applyFilters() {
  loadFeatures({
    status: statusFilter.value,
    version: versionFilter.value,
    health: healthFilter.value
  })
}

function formatDate(iso) {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleString()
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
        <h1 class="text-xl font-bold text-white">Feature Traffic Overview</h1>
        <p class="text-sm text-gray-400 mt-1">
          RHAISTRAT feature delivery pipeline health
          <span v-if="fetchedAt" class="ml-2">
            &middot; Data from {{ formatDate(fetchedAt) }}
          </span>
        </p>
      </div>
    </div>

    <!-- Summary stats -->
    <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
      <div class="bg-surface rounded-lg p-4 border border-gray-700">
        <div class="text-2xl font-bold text-white">{{ summaryStats.total }}</div>
        <div class="text-xs text-gray-400 mt-1">Total Features</div>
      </div>
      <div class="bg-surface rounded-lg p-4 border border-gray-700 cursor-pointer hover:border-green-500/50" @click="healthFilter = 'GREEN'; applyFilters()">
        <div class="text-2xl font-bold text-green-400">{{ summaryStats.green }}</div>
        <div class="text-xs text-gray-400 mt-1">Healthy</div>
      </div>
      <div class="bg-surface rounded-lg p-4 border border-gray-700 cursor-pointer hover:border-yellow-500/50" @click="healthFilter = 'YELLOW'; applyFilters()">
        <div class="text-2xl font-bold text-yellow-400">{{ summaryStats.yellow }}</div>
        <div class="text-xs text-gray-400 mt-1">At Risk</div>
      </div>
      <div class="bg-surface rounded-lg p-4 border border-gray-700 cursor-pointer hover:border-red-500/50" @click="healthFilter = 'RED'; applyFilters()">
        <div class="text-2xl font-bold text-red-400">{{ summaryStats.red }}</div>
        <div class="text-xs text-gray-400 mt-1">Blocked</div>
      </div>
      <div class="bg-surface rounded-lg p-4 border border-gray-700">
        <div class="text-2xl font-bold" :class="{
          'text-green-400': summaryStats.avgCompletion >= 70,
          'text-yellow-400': summaryStats.avgCompletion >= 40 && summaryStats.avgCompletion < 70,
          'text-red-400': summaryStats.avgCompletion < 40
        }">{{ summaryStats.avgCompletion }}%</div>
        <div class="text-xs text-gray-400 mt-1">Avg Completion</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap gap-3 items-center">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search features..."
        class="bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
      />
      <select
        v-model="versionFilter"
        class="bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
        @change="applyFilters"
      >
        <option value="">All Versions</option>
        <option v-for="v in versions" :key="v" :value="v">{{ v }}</option>
      </select>
      <select
        v-model="healthFilter"
        class="bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
        @change="applyFilters"
      >
        <option value="">All Health</option>
        <option value="GREEN">Healthy</option>
        <option value="YELLOW">At Risk</option>
        <option value="RED">Blocked</option>
      </select>
      <button
        v-if="statusFilter || versionFilter || healthFilter || searchQuery"
        class="text-xs text-gray-400 hover:text-white"
        @click="statusFilter = ''; versionFilter = ''; healthFilter = ''; searchQuery = ''; applyFilters()"
      >
        Clear Filters
      </button>
    </div>

    <!-- Error -->
    <div v-if="error" class="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
      {{ error }}
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-12 text-gray-500">
      Loading feature data...
    </div>

    <!-- Feature table -->
    <div v-else class="bg-surface rounded-lg border border-gray-700">
      <FeatureTable
        :features="filteredFeatures"
        @select="handleSelect"
        @sort="handleSort"
      />
    </div>
  </div>
</template>
