<script setup>
import { ref, computed } from 'vue'
import { ChevronUpIcon, ChevronDownIcon, SearchIcon, TrendingUpIcon, TrendingDownIcon } from 'lucide-vue-next'
import { formatRelativeTime } from '../composables/useDisconnectedReadiness.js'

const props = defineProps({
  repos: { type: Array, default: () => [] }
})

const emit = defineEmits(['select-repo'])

const searchQuery = ref('')
const scoreFilter = ref('')
const sortBy = ref('repo')
const sortDir = ref('asc')

const scoreOptions = [
  { value: '', label: 'All scores' },
  { value: 'READY', label: 'Ready' },
  { value: 'NOT READY', label: 'Not ready' }
]

const TREND_ORDER = { up: 0, stable: 1, new: 2, down: 3 }

function toggleSort(field) {
  if (sortBy.value === field) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = field
    sortDir.value = 'asc'
  }
}

const filteredRepos = computed(() => {
  let list = props.repos
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(r => r.repo.toLowerCase().includes(q))
  }
  if (scoreFilter.value) {
    list = list.filter(r => r.score === scoreFilter.value)
  }

  const dir = sortDir.value === 'desc' ? -1 : 1
  list = [...list].sort((a, b) => {
    if (sortBy.value === 'trend') {
      const aOrder = TREND_ORDER[a.trend?.direction] ?? 3
      const bOrder = TREND_ORDER[b.trend?.direction] ?? 3
      return (aOrder - bOrder) * dir
    }
    const aVal = a[sortBy.value]
    const bVal = b[sortBy.value]
    if (aVal == null && bVal == null) return 0
    if (aVal == null) return 1
    if (bVal == null) return -1
    if (typeof aVal === 'number' && typeof bVal === 'number') return (aVal - bVal) * dir
    return String(aVal).localeCompare(String(bVal)) * dir
  })
  return list
})


</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
    <div class="flex flex-wrap gap-3 items-center px-4 py-3 border-b border-gray-200 dark:border-gray-700">
      <div class="relative">
        <SearchIcon :size="14" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search repos..."
          class="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md pl-8 pr-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 w-56"
        />
      </div>
      <select
        v-model="scoreFilter"
        class="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
      >
        <option v-for="opt in scoreOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
      <span class="ml-auto text-xs text-gray-400 dark:text-gray-500">{{ filteredRepos.length }} of {{ repos.length }} repos</span>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-200 dark:border-gray-700">
            <th class="px-4 py-2.5 text-left text-gray-500 dark:text-gray-400 font-medium cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 select-none" @click="toggleSort('repo')">
              <span class="inline-flex items-center gap-1">Repository
                <component :is="sortBy === 'repo' && sortDir === 'desc' ? ChevronDownIcon : ChevronUpIcon" v-if="sortBy === 'repo'" :size="12" />
              </span>
            </th>
            <th class="px-3 py-2.5 text-left text-gray-500 dark:text-gray-400 font-medium cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 select-none" @click="toggleSort('score')">
              <span class="inline-flex items-center gap-1">Score
                <component :is="sortBy === 'score' && sortDir === 'desc' ? ChevronDownIcon : ChevronUpIcon" v-if="sortBy === 'score'" :size="12" />
              </span>
            </th>
            <th class="px-3 py-2.5 text-center text-gray-500 dark:text-gray-400 font-medium cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 select-none" @click="toggleSort('blockerCount')">
              <span class="inline-flex items-center gap-1">Blockers
                <component :is="sortBy === 'blockerCount' && sortDir === 'desc' ? ChevronDownIcon : ChevronUpIcon" v-if="sortBy === 'blockerCount'" :size="12" />
              </span>
            </th>
            <th class="px-3 py-2.5 text-center text-gray-500 dark:text-gray-400 font-medium cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 select-none" @click="toggleSort('trend')">
              <span class="inline-flex items-center gap-1">Trend
                <component :is="sortBy === 'trend' && sortDir === 'desc' ? ChevronDownIcon : ChevronUpIcon" v-if="sortBy === 'trend'" :size="12" />
              </span>
            </th>
            <th class="px-3 py-2.5 text-center text-gray-500 dark:text-gray-400 font-medium">Rules</th>
            <th class="px-3 py-2.5 text-right text-gray-500 dark:text-gray-400 font-medium cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 select-none" @click="toggleSort('lastScanDate')">
              <span class="inline-flex items-center gap-1">Scanned
                <component :is="sortBy === 'lastScanDate' && sortDir === 'desc' ? ChevronDownIcon : ChevronUpIcon" v-if="sortBy === 'lastScanDate'" :size="12" />
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="repo in filteredRepos" :key="repo.storageKey"
            class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
            @click="emit('select-repo', repo.storageKey)"
          >
            <td class="px-4 py-2.5">
              <span class="text-gray-900 dark:text-gray-100 font-medium">{{ repo.repo }}</span>
            </td>
            <td class="px-3 py-2.5">
              <span class="inline-block px-2 py-0.5 rounded border text-xs font-medium"
                :class="{
                  'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-green-300 dark:border-green-500/30': repo.score === 'READY',
                  'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-red-300 dark:border-red-500/30': repo.score === 'NOT READY'
                }">{{ repo.score }}</span>
            </td>
            <td class="px-3 py-2.5 text-center">
              <span :class="repo.blockerCount > 0 ? 'font-semibold text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'">{{ repo.blockerCount }}</span>
            </td>
            <td class="px-3 py-2.5 text-center">
              <span v-if="repo.trend?.direction === 'up'"
                class="inline-flex items-center gap-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                <TrendingUpIcon :size="12" />
                {{ repo.trend.blockerDelta }}
              </span>
              <span v-else-if="repo.trend?.direction === 'down'"
                class="inline-flex items-center gap-0.5 text-xs font-medium text-red-600 dark:text-red-400">
                <TrendingDownIcon :size="12" />
                +{{ repo.trend.blockerDelta }}
              </span>
              <span v-else class="text-xs text-gray-400 dark:text-gray-500">—</span>
            </td>
            <td class="px-3 py-2.5 text-center text-gray-700 dark:text-gray-300">
              <span :class="repo.rulesPassedCount === repo.ruleCount ? 'text-green-600 dark:text-green-400' : ''">{{ repo.rulesPassedCount }}/{{ repo.ruleCount }}</span>
            </td>
            <td class="px-3 py-2.5 text-right text-gray-500 dark:text-gray-400 text-xs" :title="repo.lastScanDate">{{ formatRelativeTime(repo.lastScanDate) }}</td>
          </tr>
          <tr v-if="filteredRepos.length === 0">
            <td colspan="6" class="px-4 py-8 text-center text-gray-400 dark:text-gray-500">No repos match your filters.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
