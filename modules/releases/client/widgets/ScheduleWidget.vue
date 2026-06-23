<script setup>
import { ref, computed, onMounted } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'
import { useModuleLink } from '@shared/client/composables/useModuleLink.js'

defineProps({
  size: { type: String, default: 'half' }
})

const { navigateTo } = useModuleLink()

const releases = ref([])
const loading = ref(true)
const error = ref(null)
const selectedProduct = ref('')

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

function parseDate(val) {
  if (!val) return null
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d
}

function todayMidnight() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function daysFromNow(dateStr) {
  const d = parseDate(dateStr)
  if (!d) return null
  const today = todayMidnight()
  d.setHours(0, 0, 0, 0)
  return Math.ceil((d.getTime() - today.getTime()) / 86400000)
}

function formatShort(dateStr) {
  const d = parseDate(dateStr)
  if (!d) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getProduct(release) {
  if (release.productPagesShortname) return release.productPagesShortname
  const match = release.id.match(/^([a-z]+)-/i)
  return match ? match[1] : release.id
}

const products = computed(() => {
  const set = {}
  for (const r of releases.value) {
    set[getProduct(r)] = true
  }
  return Object.keys(set).sort()
})

const filteredReleases = computed(() => {
  if (!selectedProduct.value) return releases.value
  return releases.value.filter(r => getProduct(r) === selectedProduct.value)
})

const milestoneTypes = [
  { key: 'planningFreeze', label: 'Plan Freeze' },
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
          id: `${r.id}-${mt.key}`,
          release: r.displayName || r.id,
          label: mt.label,
          date: ms[mt.key],
          days
        })
      }
    }
  }
  items.sort((a, b) => a.days - b.days)
  return items.slice(0, 6)
})

function daysClass(days) {
  if (days === 0) return 'text-blue-600 dark:text-blue-400 font-semibold'
  if (days <= 7) return 'text-blue-600 dark:text-blue-400 font-medium'
  if (days <= 14) return 'text-blue-500 dark:text-blue-400'
  return 'text-gray-500 dark:text-gray-400'
}

function daysLabel(days) {
  if (days === 0) return 'Today'
  return days + 'd'
}

function rowHighlight(days) {
  if (days <= 7) return 'bg-blue-50/50 dark:bg-blue-900/10'
  return ''
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">Release Schedule</h3>
      <button
        @click="navigateTo('releases', 'schedule')"
        class="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
      >View all</button>
    </div>

    <!-- Product filter -->
    <div v-if="!loading && !error && products.length > 1" class="mb-3">
      <select
        v-model="selectedProduct"
        class="w-full text-xs rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500"
      >
        <option value="">All products</option>
        <option v-for="p in products" :key="p" :value="p">{{ p }}</option>
      </select>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 4" :key="i" class="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="text-sm text-red-600 dark:text-red-400">
      <p>{{ error }}</p>
      <button @click="fetchRegistry" class="mt-2 text-primary-600 dark:text-primary-400 hover:underline text-xs font-medium">Retry</button>
    </div>

    <!-- Empty -->
    <div v-else-if="!upcomingMilestones.length" class="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
      No upcoming milestones
    </div>

    <!-- Milestone list -->
    <div v-else class="divide-y divide-gray-100 dark:divide-gray-700/50 -mx-5">
      <div
        v-for="m in upcomingMilestones"
        :key="m.id"
        class="flex items-center justify-between px-5 py-2.5"
        :class="rowHighlight(m.days)"
      >
        <div class="min-w-0 flex-1">
          <div class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{{ m.release }}</div>
          <div class="text-xs text-gray-500 dark:text-gray-400">{{ m.label }} · {{ formatShort(m.date) }}</div>
        </div>
        <span class="text-sm tabular-nums ml-3 shrink-0" :class="daysClass(m.days)">
          {{ daysLabel(m.days) }}
        </span>
      </div>
    </div>
  </div>
</template>
