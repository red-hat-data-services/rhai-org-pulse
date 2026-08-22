<script setup>
import { ref, computed, onMounted } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'
import { useModuleLink } from '@shared/client/composables/useModuleLink.js'
import {
  daysFromNow, formatShort, getProduct, releasePhase
} from '../composables/useScheduleHelpers.js'

defineProps({
  size: { type: String, default: 'half' }
})

const { navigateTo } = useModuleLink()

const releases = ref([])
const loading = ref(true)
const error = ref(null)
const selectedFilter = ref('')

async function fetchRegistry() {
  loading.value = true
  error.value = null
  try {
    const data = await apiRequest('/modules/releases/registry')
    releases.value = (data.releases || []).filter(r => r.state === 'active')
  } catch (e) {
    error.value = e.message || 'Failed to load'
  } finally {
    loading.value = false
  }
}

onMounted(fetchRegistry)

// ── Computed ──

const filterOptions = computed(() => {
  const products = {}
  for (const r of releases.value) {
    products[getProduct(r)] = true
  }
  const keys = Object.keys(products).sort()
  if (keys.length <= 1) return []
  return keys.map(p => ({ value: 'product:' + p, label: p.toUpperCase() }))
})

const filteredReleases = computed(() => {
  if (!selectedFilter.value) return releases.value
  const [type, val] = selectedFilter.value.split(':')
  if (type === 'product') {
    return releases.value.filter(r => getProduct(r) === val)
  }
  return releases.value
})

const milestoneTypes = [
  { key: 'planningFreeze', label: 'Plan Freeze' },
  { key: 'featureFreeze', label: 'Feature Freeze' },
  { key: 'codeFreeze', label: 'Code Freeze' },
  { key: 'ga', label: 'Release' }
]

const upcomingMilestones = computed(() => {
  const items = []
  for (const r of filteredReleases.value) {
    const ms = r.milestones || {}
    for (const mt of milestoneTypes) {
      const days = daysFromNow(ms[mt.key])
      if (days !== null && days >= 0) {
        items.push({
          id: r.id + '-' + mt.key,
          releaseId: r.id,
          release: r.displayName || r.id,
          label: mt.label,
          date: ms[mt.key],
          days
        })
      }
    }
  }
  items.sort((a, b) => a.days - b.days)
  return items.slice(0, 5)
})

const heroMilestone = computed(() => upcomingMilestones.value[0] || null)

const heroRelease = computed(() => {
  if (!heroMilestone.value) return null
  return filteredReleases.value.find(r => r.id === heroMilestone.value.releaseId) || null
})

const heroPhase = computed(() => {
  if (!heroRelease.value) return null
  return releasePhase(heroRelease.value)
})

const remainingMilestones = computed(() => upcomingMilestones.value.slice(1))
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">Release Schedule</h3>
      <button
        @click="navigateTo('releases', 'schedule')"
        class="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
      >View all</button>
    </div>

    <!-- Release filter -->
    <div v-if="!loading && !error && filterOptions.length > 0" class="mb-3">
      <select
        v-model="selectedFilter"
        class="w-full text-xs rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500"
      >
        <option value="">All</option>
        <option v-for="opt in filterOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="space-y-3">
      <div class="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
      <div v-for="i in 3" :key="i" class="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="text-sm text-red-600 dark:text-red-400">
      <p>{{ error }}</p>
      <button @click="fetchRegistry" class="mt-2 text-primary-600 dark:text-primary-400 hover:underline text-xs font-medium">Retry</button>
    </div>

    <!-- Empty -->
    <div v-else-if="!heroMilestone" class="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
      No upcoming milestones
    </div>

    <!-- Content -->
    <template v-else>
      <!-- Hero card -->
      <div
        class="rounded-lg border px-4 py-3.5 mb-4"
        :class="heroMilestone.days <= 7
          ? 'border-blue-200 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/20'
          : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <div class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ heroMilestone.release }}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {{ heroMilestone.label }} · {{ formatShort(heroMilestone.date) }}
            </div>
            <!-- Mini stepper -->
            <div v-if="heroPhase" class="flex items-center gap-0 mt-2.5">
              <template v-for="(phase, i) in heroPhase.phases" :key="i">
                <div
                  v-if="i > 0"
                  class="h-px flex-1"
                  :class="i <= heroPhase.phaseIndex
                    ? 'bg-green-400 dark:bg-green-500'
                    : 'bg-gray-200 dark:bg-gray-700'"
                />
                <div
                  class="shrink-0 rounded-full"
                  :class="[
                    i < heroPhase.phaseIndex
                      ? 'w-1.5 h-1.5 bg-green-500 dark:bg-green-400'
                      : i === heroPhase.phaseIndex
                        ? 'w-2 h-2 bg-blue-500 dark:bg-blue-400 ring-2 ring-blue-200 dark:ring-blue-800'
                        : 'w-1.5 h-1.5 bg-gray-300 dark:bg-gray-600'
                  ]"
                  :title="phase.label"
                />
              </template>
            </div>
          </div>
          <div class="text-right shrink-0">
            <div
              class="text-3xl font-bold leading-none tabular-nums"
              :class="heroMilestone.days <= 7
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-900 dark:text-gray-100'"
            >{{ heroMilestone.days === 0 ? 'Today' : heroMilestone.days }}</div>
            <div
              v-if="heroMilestone.days !== 0"
              class="text-[10px] font-medium uppercase tracking-wider mt-0.5"
              :class="heroMilestone.days <= 7
                ? 'text-blue-400 dark:text-blue-500'
                : 'text-gray-400 dark:text-gray-500'"
            >days</div>
            <div v-if="heroMilestone.days <= 7" class="flex justify-end mt-1.5">
              <span class="inline-flex h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      <!-- Remaining milestones -->
      <div v-if="remainingMilestones.length" class="divide-y divide-gray-100 dark:divide-gray-700/50 -mx-5">
        <div
          v-for="m in remainingMilestones"
          :key="m.id"
          class="flex items-center justify-between px-5 py-2.5"
          :class="m.days <= 7 ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''"
        >
          <div class="min-w-0 flex-1">
            <div class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{{ m.release }}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">{{ m.label }} · {{ formatShort(m.date) }}</div>
          </div>
          <span
            class="text-xs font-medium tabular-nums ml-3 shrink-0 px-2 py-0.5 rounded-full"
            :class="m.days <= 14
              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'"
          >{{ m.days === 0 ? 'Today' : m.days + 'd' }}</span>
        </div>
      </div>
    </template>
  </div>
</template>
