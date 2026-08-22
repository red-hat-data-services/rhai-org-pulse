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
      <!-- Countdown cards -->
      <div v-if="upcomingMilestoneCards.length" class="flex gap-4 mb-6 flex-wrap">
        <div
          v-for="card in upcomingMilestoneCards"
          :key="card.releaseName + '-' + card.type"
          data-testid="milestone-countdown-card"
          class="flex-1 min-w-[140px] bg-white dark:bg-gray-800 border rounded-lg text-center py-5 px-4 transition-all hover:shadow-md"
          :class="card.days <= 7
            ? 'border-blue-300 dark:border-blue-600'
            : 'border-gray-200 dark:border-gray-700'"
        >
          <div
            class="text-[42px] font-bold leading-none tabular-nums"
            :class="card.days <= 7
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-gray-900 dark:text-gray-100'"
          >
            {{ card.days === 0 ? 'Today' : card.days }}
          </div>
          <div
            v-if="card.days !== 0"
            class="text-[11px] font-medium uppercase tracking-wider mt-1"
            :class="card.days <= 7
              ? 'text-blue-400 dark:text-blue-500'
              : 'text-gray-400 dark:text-gray-500'"
          >days</div>
          <div class="text-[13px] font-semibold text-gray-700 dark:text-gray-300 mt-2">
            {{ card.releaseName }}
          </div>
          <div class="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
            {{ card.label }} · {{ formatShort(card.date) }}
          </div>
          <div v-if="card.days <= 7" class="flex justify-center mt-2">
            <span class="inline-flex h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
          </div>
        </div>
      </div>

      <!-- Filters -->
      <div class="flex items-center justify-between mb-5 gap-4">
        <div class="flex flex-wrap gap-2">
          <!-- Product filter pills -->
          <template v-if="products.length > 1">
            <button
              @click="selectedProduct = null"
              class="px-3 py-1 rounded-full text-xs font-medium transition-colors border"
              :class="!selectedProduct
                ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900 dark:border-gray-100'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'"
            >All</button>
            <button
              v-for="p in products"
              :key="p"
              @click="selectedProduct = p"
              class="px-3 py-1 rounded-full text-xs font-medium transition-colors border"
              :class="selectedProduct === p
                ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900 dark:border-gray-100'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'"
            >{{ p }}</button>
          </template>
          <!-- Stream filter pills (single-product) -->
          <template v-else-if="streams.length > 1">
            <button
              @click="selectedStream = null"
              class="px-3 py-1 rounded-full text-xs font-medium transition-colors border"
              :class="!selectedStream
                ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900 dark:border-gray-100'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'"
            >All</button>
            <button
              v-for="s in streams"
              :key="s"
              @click="selectedStream = s"
              class="px-3 py-1 rounded-full text-xs font-medium transition-colors border"
              :class="selectedStream === s
                ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900 dark:border-gray-100'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'"
            >{{ s }}</button>
          </template>
        </div>
        <label class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 cursor-pointer select-none shrink-0">
          <input type="checkbox" v-model="hideReleased" class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500" />
          Hide released
        </label>
      </div>

      <div v-if="availableVersions.length > 1" class="flex flex-wrap gap-2 mb-5 -mt-3">
        <button
          v-for="v in availableVersions"
          :key="v"
          @click="toggleVersion(v)"
          class="px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors border"
          :class="selectedVersions.indexOf(v) !== -1
            ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900 dark:border-gray-100'
            : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'"
        >{{ v }}</button>
        <button
          v-if="selectedVersions.length > 0"
          @click="selectedVersions = []"
          class="px-2.5 py-0.5 rounded-full text-[11px] font-medium text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >Clear</button>
      </div>

      <!-- Release Timeline -->
      <ReleaseTimeline :releases="baseFilteredReleases" :hide-past="hideReleased" />

      <!-- Releases table -->
      <div class="bg-white dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/50">
                <th class="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Release</th>
                <th class="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Phase</th>
                <th class="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Plan Freeze</th>
                <th class="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Feature Freeze</th>
                <th class="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Code Freeze</th>
                <th class="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Release Date</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="row in groupedRows" :key="row.key">
                <tr v-if="row.type === 'header'" class="bg-gray-50/60 dark:bg-gray-800/30">
                  <td colspan="6" class="px-4 py-1.5 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    RHAI {{ row.stream }}
                  </td>
                </tr>
                <tr
                  v-else
                  class="border-b border-gray-100 dark:border-gray-800 last:border-0 transition-colors"
                  :class="isReleased(row.release) ? 'opacity-50' : nextMilestoneUrgencyRow(row.release)"
                >
                  <td class="px-4 py-3">
                    <span class="font-semibold text-gray-900 dark:text-gray-100">{{ row.release.displayName || row.release.id }}</span>
                  </td>
                  <td class="px-4 py-3">
                    <ReleaseStepper :release="row.release" :muted="isReleased(row.release)" />
                  </td>
                  <td class="px-4 py-3">
                    <MilestoneCell :date="row.release.milestones?.planningFreeze" :prev-date="null" :muted="isReleased(row.release)" />
                  </td>
                  <td class="px-4 py-3">
                    <MilestoneCell :date="row.release.milestones?.featureFreeze" :prev-date="row.release.milestones?.planningFreeze" :muted="isReleased(row.release)" />
                  </td>
                  <td class="px-4 py-3">
                    <MilestoneCell :date="row.release.milestones?.codeFreeze" :prev-date="row.release.milestones?.featureFreeze || row.release.milestones?.planningFreeze" :muted="isReleased(row.release)" />
                  </td>
                  <td class="px-4 py-3">
                    <MilestoneCell :date="row.release.milestones?.ga" :prev-date="row.release.milestones?.codeFreeze" :muted="isReleased(row.release)" />
                  </td>
                </tr>
              </template>
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
import {
  parseDate, daysFromNow, formatShort as formatShortBase,
  getProduct, getStream, releasePhase, milestoneProgress
} from '../composables/useScheduleHelpers.js'
import ReleaseTimeline from '../components/ReleaseTimeline.vue'
import { parseReleaseName } from '../composables/useReleaseFamily.js'

function formatShort(dateStr) {
  return formatShortBase(dateStr, { year: true })
}

// ── Data ──

const releases = ref([])
const loading = ref(true)
const error = ref(null)
const selectedProduct = ref(null)
const selectedStream = ref(null)
const hideReleased = ref(true)
const selectedVersions = ref([])

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

function getGaDate(release) {
  return release.milestones?.ga || null
}

function versionLabel(release) {
  var name = release.displayName || release.id
  var parsed = parseReleaseName(name)
  if (parsed) return parsed.major + '.' + parsed.minor + ' ' + parsed.milestone
  return null
}

function toggleVersion(v) {
  var idx = selectedVersions.value.indexOf(v)
  if (idx === -1) {
    selectedVersions.value = selectedVersions.value.concat(v)
  } else {
    selectedVersions.value = selectedVersions.value.filter(function (x) { return x !== v })
  }
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

const streams = computed(() => {
  const set = {}
  for (let i = 0; i < releases.value.length; i++) {
    const v = getStream(releases.value[i])
    if (v) set[v] = true
  }
  return Object.keys(set).sort()
})

const availableVersions = computed(() => {
  var seen = {}
  var list = []
  var base = releases.value
  if (selectedProduct.value) {
    base = base.filter(r => getProduct(r) === selectedProduct.value)
  }
  for (var i = 0; i < base.length; i++) {
    var v = versionLabel(base[i])
    if (v && !seen[v]) {
      seen[v] = true
      list.push(v)
    }
  }
  list.sort(function (a, b) {
    var ma = /^(\d+)\.(\d+)\s+(EA(\d+)|GA)$/.exec(a)
    var mb = /^(\d+)\.(\d+)\s+(EA(\d+)|GA)$/.exec(b)
    if (!ma && !mb) return a.localeCompare(b)
    if (!ma) return 1
    if (!mb) return -1
    var ca = parseInt(ma[1]) * 100 + parseInt(ma[2])
    var cb = parseInt(mb[1]) * 100 + parseInt(mb[2])
    if (ca !== cb) return cb - ca
    var oa = ma[3] === 'GA' ? 99 : parseInt(ma[4])
    var ob = mb[3] === 'GA' ? 99 : parseInt(mb[4])
    return ob - oa
  })
  return list
})

const baseFilteredReleases = computed(() => {
  let list = releases.value
  if (selectedProduct.value) {
    list = list.filter(r => getProduct(r) === selectedProduct.value)
  }
  if (selectedStream.value) {
    list = list.filter(r => getStream(r) === selectedStream.value)
  }
  if (selectedVersions.value.length > 0) {
    list = list.filter(r => {
      var v = versionLabel(r)
      return v && selectedVersions.value.indexOf(v) !== -1
    })
  }
  return list
})

const filteredReleases = computed(() => {
  let list = baseFilteredReleases.value
  if (hideReleased.value) {
    list = list.filter(r => !isReleased(r))
  }
  return list
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

const groupedRows = computed(() => {
  const rows = []
  let lastStream = null
  for (let i = 0; i < allSortedReleases.value.length; i++) {
    const r = allSortedReleases.value[i]
    const stream = getStream(r) || ''
    if (stream !== lastStream && !selectedStream.value) {
      rows.push({ type: 'header', stream, key: 'h-' + stream })
      lastStream = stream
    }
    rows.push({ type: 'release', release: r, key: r.id })
  }
  return rows
})

const MILESTONE_TYPES = [
  { key: 'planningFreeze', label: 'Plan Freeze' },
  { key: 'featureFreeze', label: 'Feature Freeze' },
  { key: 'codeFreeze', label: 'Code Freeze' },
  { key: 'ga', label: 'Release Date' }
]

const upcomingMilestoneCards = computed(() => {
  const candidates = []
  for (let i = 0; i < allSortedReleases.value.length; i++) {
    const r = allSortedReleases.value[i]
    const ms = r.milestones || {}
    for (let j = 0; j < MILESTONE_TYPES.length; j++) {
      const mt = MILESTONE_TYPES[j]
      const days = daysFromNow(ms[mt.key])
      if (days !== null && days >= 0) {
        candidates.push({
          releaseName: r.displayName || r.id,
          label: mt.label,
          type: mt.key,
          date: ms[mt.key],
          days
        })
      }
    }
  }
  candidates.sort((a, b) => a.days - b.days)
  return candidates.slice(0, 4)
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

const ReleaseStepper = {
  props: {
    release: { type: Object, required: true },
    muted: { type: Boolean, default: false }
  },
  setup(props) {
    return () => {
      const { phaseIndex, phases } = releasePhase(props.release)
      const nodes = []

      for (let i = 0; i < phases.length; i++) {
        if (i > 0) {
          const lineClass = props.muted
            ? 'bg-gray-200 dark:bg-gray-700'
            : i <= phaseIndex
              ? 'bg-green-400 dark:bg-green-500'
              : 'bg-gray-200 dark:bg-gray-700'
          nodes.push(h('div', { class: 'flex-1 h-0.5 ' + lineClass }))
        }

        let dotClass = 'w-2.5 h-2.5 rounded-full shrink-0 '
        if (props.muted) {
          dotClass += 'bg-gray-300 dark:bg-gray-600'
        } else if (i < phaseIndex) {
          dotClass += 'bg-green-500 dark:bg-green-400'
        } else if (i === phaseIndex) {
          dotClass += 'bg-blue-500 dark:bg-blue-400 ring-2 ring-blue-200 dark:ring-blue-800'
        } else {
          dotClass += 'bg-gray-200 dark:bg-gray-600 border border-gray-300 dark:border-gray-500'
        }

        nodes.push(h('div', { class: dotClass, title: phases[i].label }))
      }

      return h('div', { class: 'flex items-center gap-0 min-w-[120px]' }, nodes)
    }
  }
}

const MilestoneCell = {
  props: {
    date: { type: String, default: null },
    prevDate: { type: String, default: null },
    muted: { type: Boolean, default: false }
  },
  setup(props) {
    return () => {
      if (!props.date) {
        return h('span', { class: 'text-gray-300 dark:text-gray-600' }, '—')
      }
      const days = daysFromNow(props.date)
      const dateLabel = formatShort(props.date)

      let dateClass
      if (props.muted) {
        dateClass = 'text-gray-400 dark:text-gray-500'
      } else if (days !== null && days < 0) {
        dateClass = 'text-gray-500 dark:text-gray-400'
      } else if (days !== null && days <= 7) {
        dateClass = 'text-blue-700 dark:text-blue-300 font-semibold'
      } else {
        dateClass = 'text-gray-900 dark:text-gray-100'
      }

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

      let progressEl = null
      if (!props.muted && days !== null && days > 0 && props.prevDate) {
        const pct = milestoneProgress(props.date, props.prevDate)
        if (pct !== null) {
          progressEl = h('div', {
            class: 'h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mt-1'
          }, [
            h('div', {
              class: 'h-full rounded-full transition-all ' + (
                days <= 7
                  ? 'bg-blue-400 dark:bg-blue-500'
                  : 'bg-gray-400 dark:bg-gray-500'
              ),
              style: { width: pct + '%' }
            })
          ])
        }
      }

      return h('div', { class: 'flex flex-col' }, [
        h('span', { class: 'text-sm tabular-nums ' + dateClass }, dateLabel),
        countdownEl,
        progressEl
      ])
    }
  }
}
</script>
