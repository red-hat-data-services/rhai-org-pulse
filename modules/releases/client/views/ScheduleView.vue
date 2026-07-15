<template>
  <div class="max-w-5xl mx-auto py-6 px-4">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Release Schedule</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Milestone dates sourced from
          <a href="https://productpages.redhat.com" target="_blank" rel="noopener noreferrer" class="text-primary-600 dark:text-primary-400 hover:underline">Product Pages</a>
        </p>
      </div>
      <button
        @click="fetchRegistry"
        :disabled="loading"
        class="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
      >
        {{ loading ? 'Loading...' : 'Refresh' }}
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading && !releases.length" class="text-center py-12 text-sm text-gray-500 dark:text-gray-400">
      Loading schedule...
    </div>

    <!-- Error -->
    <div
      v-else-if="error"
      class="text-center py-16 bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-700/50"
    >
      <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">Failed to load schedule</h3>
      <p class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
      <button
        @click="fetchRegistry"
        class="mt-4 px-4 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
      >Try again</button>
    </div>

    <!-- Empty -->
    <div
      v-else-if="!allSortedReleases.length"
      class="text-center py-16 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
    >
      <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">No releases found</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400">
        Run a registry sync from Product Pages to populate release milestones.
      </p>
    </div>

    <template v-else>
      <!-- Next milestone banner -->
      <div
        v-if="globalNextMilestone"
        class="mb-5 rounded-lg border px-4 py-3 flex items-center justify-between"
        :class="globalNextMilestone.days <= 7
          ? 'border-blue-200 dark:border-blue-700/50 bg-blue-50/80 dark:bg-blue-900/20'
          : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'"
      >
        <div class="flex items-center gap-3">
          <span
            class="inline-flex h-2.5 w-2.5 rounded-full shrink-0"
            :class="globalNextMilestone.days <= 7
              ? 'bg-blue-500 animate-pulse'
              : 'bg-gray-400 dark:bg-gray-500'"
          ></span>
          <span class="text-sm text-gray-900 dark:text-gray-100">
            <span class="font-medium">{{ globalNextMilestone.releaseName }}</span>
            <span class="text-gray-500 dark:text-gray-400"> · {{ globalNextMilestone.label }}</span>
          </span>
        </div>
        <span
          class="text-sm font-semibold tabular-nums"
          :class="globalNextMilestone.days <= 7
            ? 'text-blue-600 dark:text-blue-400'
            : 'text-gray-600 dark:text-gray-300'"
        >
          {{ globalNextMilestone.days === 0 ? 'Today' : globalNextMilestone.days + 'd' }}
        </span>
      </div>

      <!-- Product filter -->
      <div v-if="products.length > 1" class="flex flex-wrap gap-2 mb-5">
        <button
          @click="selectedProduct = null"
          class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border"
          :class="!selectedProduct
            ? 'bg-primary-600 text-white border-primary-600'
            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-600'"
        >All</button>
        <button
          v-for="p in products"
          :key="p"
          @click="selectedProduct = p"
          class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border"
          :class="selectedProduct === p
            ? 'bg-primary-600 text-white border-primary-600'
            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-600'"
        >{{ p }}</button>
      </div>

      <!-- Releases table -->
      <div class="bg-white dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/50">
                <th class="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Release</th>
                <th class="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Plan Freeze</th>
                <th class="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Feature Freeze</th>
                <th class="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Code Freeze</th>
                <th class="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Release Date</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="r in allSortedReleases"
                :key="r.id"
                class="border-b border-gray-100 dark:border-gray-800 last:border-0 transition-colors"
                :class="isReleased(r) ? 'opacity-50' : nextMilestoneUrgencyRow(r)"
              >
                <td class="px-4 py-3">
                  <span class="font-semibold text-gray-900 dark:text-gray-100">{{ r.displayName || r.id }}</span>
                </td>
                <td class="px-4 py-3">
                  <MilestoneCell :date="r.milestones?.planningFreeze" :muted="isReleased(r)" />
                </td>
                <td class="px-4 py-3">
                  <MilestoneCell :date="r.milestones?.featureFreeze" :muted="isReleased(r)" />
                </td>
                <td class="px-4 py-3">
                  <MilestoneCell :date="r.milestones?.codeFreeze" :muted="isReleased(r)" />
                </td>
                <td class="px-4 py-3">
                  <MilestoneCell :date="r.milestones?.ga" :muted="isReleased(r)" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, h } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'

// ── Data ──

const releases = ref([])
const loading = ref(true)
const error = ref(null)
const selectedProduct = ref(null)

async function fetchRegistry() {
  loading.value = true
  error.value = null
  try {
    const data = await apiRequest('/modules/releases/registry')
    releases.value = (data.releases || []).filter(function (r) { return r.state === 'active' })
  } catch (e) {
    error.value = e.message || 'Failed to load schedule data'
    console.error('[schedule] Failed to fetch registry:', e)
  } finally {
    loading.value = false
  }
}

onMounted(fetchRegistry)

// ── Helpers ──

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
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getProduct(release) {
  if (release.productPagesShortname) return release.productPagesShortname
  const match = release.id.match(/^([a-z]+)-/)
  return match ? match[1] : release.id
}

function getGaDate(release) {
  return release.milestones?.ga || null
}

function nextMilestone(release) {
  const ms = release.milestones || {}
  const milestones = [
    { key: 'planningFreeze', label: 'Plan Freeze', date: ms.planningFreeze },
    { key: 'featureFreeze', label: 'Feature Freeze', date: ms.featureFreeze },
    { key: 'codeFreeze', label: 'Code Freeze', date: ms.codeFreeze },
    { key: 'ga', label: 'Release Date', date: ms.ga }
  ]
  for (let i = 0; i < milestones.length; i++) {
    const days = daysFromNow(milestones[i].date)
    if (days !== null && days >= 0) {
      return { label: milestones[i].label, type: milestones[i].key, days }
    }
  }
  return null
}

// ── Computed ──

const products = computed(() => {
  const set = {}
  for (let i = 0; i < releases.value.length; i++) {
    set[getProduct(releases.value[i])] = true
  }
  return Object.keys(set).sort()
})

const filteredReleases = computed(() => {
  if (!selectedProduct.value) return releases.value
  return releases.value.filter(r => getProduct(r) === selectedProduct.value)
})

const allSortedReleases = computed(() => {
  return filteredReleases.value.slice().sort((a, b) => {
    const da = parseDate(getGaDate(a))
    const db = parseDate(getGaDate(b))
    if (!da && !db) return 0
    if (!da) return 1
    if (!db) return -1
    return da.getTime() - db.getTime()
  })
})

const globalNextMilestone = computed(() => {
  let best = null
  for (let i = 0; i < allSortedReleases.value.length; i++) {
    const r = allSortedReleases.value[i]
    const nm = nextMilestone(r)
    if (nm && (best === null || nm.days < best.days)) {
      best = { releaseName: r.displayName || r.id, label: nm.label, type: nm.type, days: nm.days }
    }
  }
  return best
})

function isReleased(release) {
  const ga = getGaDate(release)
  if (!ga) return false
  const days = daysFromNow(ga)
  return days !== null && days < 0
}

function nextMilestoneUrgencyRow(release) {
  const nm = nextMilestone(release)
  if (!nm) return ''
  if (nm.days <= 7) return 'bg-blue-50/50 dark:bg-blue-900/10'
  return ''
}

// ── Inline sub-components ──

const MilestoneCell = {
  props: {
    date: { type: String, default: null },
    muted: { type: Boolean, default: false }
  },
  setup(props) {
    return () => {
      if (!props.date) {
        return h('span', { class: 'text-gray-300 dark:text-gray-600' }, '—')
      }
      const days = daysFromNow(props.date)
      const dateLabel = formatShort(props.date)

      const dateClass = props.muted
        ? 'text-gray-500 dark:text-gray-400'
        : 'text-gray-900 dark:text-gray-100'

      let countdownEl = null
      if (days !== null) {
        let countdownClass = 'text-[11px] tabular-nums '
        if (props.muted || days < 0) {
          countdownClass += 'text-gray-400 dark:text-gray-500'
        } else if (days === 0) {
          countdownClass += 'font-semibold text-blue-600 dark:text-blue-400'
        } else if (days <= 7) {
          countdownClass += 'font-medium text-blue-600 dark:text-blue-400'
        } else if (days <= 14) {
          countdownClass += 'text-blue-500 dark:text-blue-400'
        } else {
          countdownClass += 'text-gray-400 dark:text-gray-500'
        }

        let countdownText
        if (days < 0) countdownText = Math.abs(days) + 'd ago'
        else if (days === 0) countdownText = 'Today'
        else countdownText = days + 'd'

        countdownEl = h('span', { class: countdownClass }, countdownText)
      }

      return h('div', { class: 'flex flex-col' }, [
        h('span', { class: 'text-sm tabular-nums ' + dateClass }, dateLabel),
        countdownEl
      ])
    }
  }
}
</script>
