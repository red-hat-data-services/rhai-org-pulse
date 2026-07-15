<template>
  <div class="max-w-7xl mx-auto px-4 py-6">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">AI Catalyst Showcase</h1>
      <p class="mt-2 text-gray-600 dark:text-gray-400">
        Browse AI catalyst projects across strategy pillars. Filter by area, search by keyword, or explore by capability.
      </p>
    </div>

    <!-- Loading state -->
    <template v-if="loading">
      <ShowcaseSkeleton type="pillars" />
      <ShowcaseSkeleton type="cards" />
    </template>

    <!-- Error state -->
    <div v-else-if="error" class="text-center py-12">
      <component :is="AlertCircleIcon" :size="40" class="mx-auto text-red-400 mb-3" />
      <p class="text-gray-600 dark:text-gray-400">{{ error }}</p>
      <button
        class="mt-4 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg"
        @click="loadEntries"
      >
        Retry
      </button>
    </div>

    <!-- Content -->
    <template v-else>
      <!-- Pillar filter tiles -->
      <PillarFilterTiles
        :pillars="pillars"
        :selected-pillar="selectedPillar"
        :total-count="entries.length"
        @update:selected-pillar="selectedPillar = $event"
      />

      <!-- Filter bar -->
      <div class="flex flex-col sm:flex-row gap-3 mb-6">
        <div class="relative flex-1">
          <component
            :is="SearchIcon"
            :size="16"
            class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            v-model="searchInput"
            type="text"
            placeholder="Search projects..."
            class="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600
                   bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg
                   focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </div>
        <select
          v-model="selectedNeed"
          class="px-3 py-2 text-sm border border-gray-200 dark:border-gray-600
                 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg
                 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
        >
          <option value="">All customer needs</option>
          <option v-for="need in needOptions" :key="need" :value="need">{{ need }}</option>
        </select>
        <select
          v-model="selectedCapability"
          class="px-3 py-2 text-sm border border-gray-200 dark:border-gray-600
                 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg
                 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
        >
          <option value="">All capabilities</option>
          <option v-for="cap in capabilityOptions" :key="cap" :value="cap">{{ cap }}</option>
        </select>
      </div>

      <!-- Active filter summary -->
      <div v-if="hasActiveFilters" class="flex items-center gap-2 mb-4 text-sm text-gray-500 dark:text-gray-400">
        <span>{{ filteredEntries.length }} of {{ entries.length }} projects</span>
        <button
          class="text-primary-600 dark:text-primary-400 hover:underline"
          @click="clearFilters"
        >
          Clear filters
        </button>
      </div>

      <!-- Card grid -->
      <div v-if="filteredEntries.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <ShowcaseCard
          v-for="entry in filteredEntries"
          :key="entry.slug"
          :entry="entry"
          :pillar-title="pillarMap[entry.strategyPillarKey] || ''"
          :featured="entry.sortOrder === 1"
          @click="nav.navigateTo('showcase-detail', { slug: entry.slug })"
        />
      </div>

      <!-- Empty state -->
      <div v-else class="text-center py-12">
        <component :is="SearchIcon" :size="40" class="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
        <p class="text-gray-500 dark:text-gray-400">No projects match your filters.</p>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, inject, onUnmounted } from 'vue'
import { Search as SearchIcon, AlertCircle as AlertCircleIcon } from 'lucide-vue-next'
import { useShowcase } from '../composables/useShowcase.js'
import ShowcaseCard from '../components/ShowcaseCard.vue'
import PillarFilterTiles from '../components/PillarFilterTiles.vue'
import ShowcaseSkeleton from '../components/ShowcaseSkeleton.vue'

const nav = inject('moduleNav')
const { entries, pillars, loading, error, loadEntries } = useShowcase()

const selectedPillar = ref(null)
const searchInput = ref('')
const searchQuery = ref('')
const selectedNeed = ref('')
const selectedCapability = ref('')

let searchTimer = null
watch(searchInput, (val) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    searchQuery.value = val
  }, 300)
})
onUnmounted(() => clearTimeout(searchTimer))

const pillarMap = computed(() => {
  const map = {}
  for (const p of pillars.value) {
    map[p.pillarKey] = p.title
  }
  return map
})

const needOptions = computed(() => {
  const needs = new Set()
  for (const e of entries.value) {
    for (const tag of (e.customerNeedTags || [])) needs.add(tag)
  }
  return [...needs].sort()
})

const capabilityOptions = computed(() => {
  const caps = new Set()
  for (const e of entries.value) {
    for (const tag of (e.capabilityTags || [])) caps.add(tag)
  }
  return [...caps].sort()
})

const hasActiveFilters = computed(() => {
  return selectedPillar.value || searchQuery.value || selectedNeed.value || selectedCapability.value
})

const filteredEntries = computed(() => {
  return entries.value
    .filter(e => !selectedPillar.value || e.strategyPillarKey === selectedPillar.value)
    .filter(e => !selectedNeed.value || (e.customerNeedTags || []).includes(selectedNeed.value))
    .filter(e => !selectedCapability.value || (e.capabilityTags || []).includes(selectedCapability.value))
    .filter(e => {
      if (!searchQuery.value) return true
      const q = searchQuery.value.toLowerCase()
      return (e.title || '').toLowerCase().includes(q)
        || (e.shortSummary || '').toLowerCase().includes(q)
        || (e.customerProblem || '').toLowerCase().includes(q)
        || (e.solutionSummary || '').toLowerCase().includes(q)
        || (e.searchKeywords || []).some(k => k.toLowerCase().includes(q))
        || (e.capabilityTags || []).some(t => t.toLowerCase().includes(q))
        || (e.customerNeedTags || []).some(t => t.toLowerCase().includes(q))
    })
    .sort((a, b) => (a.sortOrder || 999) - (b.sortOrder || 999))
})

function clearFilters() {
  selectedPillar.value = null
  searchInput.value = ''
  searchQuery.value = ''
  selectedNeed.value = ''
  selectedCapability.value = ''
}
</script>
