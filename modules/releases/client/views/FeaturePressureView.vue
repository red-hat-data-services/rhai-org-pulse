<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import ClickableCount from '../components/ClickableCount.vue'
import MonthlyFlowChart from '../components/MonthlyFlowChart.vue'
import PressureHeatmap from '../components/PressureHeatmap.vue'
import { useFeaturePressureData } from '../composables/useFeaturePressureData'
import { useComponentPressure } from '../composables/useComponentPressure'

// ---------------------------------------------------------------------------
// Composables
// ---------------------------------------------------------------------------

const {
  data, loading, error, refreshing, lookbackMonths,
  fetchData, triggerRefresh, cleanup,
} = useFeaturePressureData()

const searchQuery = ref('')
const sortField = ref('net')
const sortAsc = ref(false)

const { filteredComponents } = useComponentPressure(data, searchQuery, sortField, sortAsc)

// ---------------------------------------------------------------------------
// Lookback options
// ---------------------------------------------------------------------------

const lookbackOptions = [6, 12, 18, 24]

function changeLookback(months) {
  lookbackMonths.value = months
  triggerRefresh(months)
}

// ---------------------------------------------------------------------------
// Computed helpers
// ---------------------------------------------------------------------------

const summary = computed(() => data.value?.executive_summary || null)
const monthlyFlow = computed(() => data.value?.monthly_flow || [])
const rfePipeline = computed(() => data.value?.rfe_pipeline || null)
const backlogHalfLife = computed(() => data.value?.backlog_half_life || [])
const heatmap = computed(() => data.value?.heatmap || { months: [], components: [], matrix: [] })
const scorecard = computed(() => data.value?.scorecard || [])
const metadata = computed(() => data.value?.metadata || null)

const zeroComponents = computed(() =>
  backlogHalfLife.value.filter(c => c.months_to_clear === Infinity || c.months_to_clear === 'Infinity' || c.months_to_clear === null)
)
const activeComponents = computed(() =>
  backlogHalfLife.value.filter(c => c.months_to_clear !== Infinity && c.months_to_clear !== 'Infinity' && c.months_to_clear !== null)
)

/** Top 5 components by combined demand (feature net + RFE pending) */
const hotSpots = computed(() => {
  if (!scorecard.value.length) return []
  return scorecard.value
    .filter(s => s.risk_level === 'critical' || s.risk_level === 'high')
    .slice(0, 5)
})

function formatRatio(val) {
  if (val === Infinity || val === 'Infinity' || val === null) return 'INF'
  if (typeof val === 'number') return val.toFixed(2)
  return val
}

function formatMonths(val) {
  if (val === Infinity || val === 'Infinity' || val === null) return 'Never'
  if (typeof val === 'number') return val.toFixed(1) + ' mo'
  return val
}

function riskColor(level) {
  const colors = {
    critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  }
  return colors[level] || ''
}

function trendArrow(dir) {
  if (dir === 'worsening') return '\u2191'
  if (dir === 'improving') return '\u2193'
  return '\u2192'
}

function trendColor(dir) {
  if (dir === 'worsening') return 'text-red-600 dark:text-red-400'
  if (dir === 'improving') return 'text-green-600 dark:text-green-400'
  return 'text-gray-500 dark:text-gray-400'
}

function toggleSort(field) {
  if (sortField.value === field) {
    sortAsc.value = !sortAsc.value
  } else {
    sortField.value = field
    sortAsc.value = false
  }
}

function sortIcon(field) {
  if (sortField.value !== field) return ''
  return sortAsc.value ? '\u25B2' : '\u25BC'
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

onMounted(() => { fetchData() })
onBeforeUnmount(() => { cleanup() })
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 py-6 space-y-8">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Feature Pressure</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Where feature inflow exceeds capacity to burn down — RHAI-wide, by component.
        </p>
      </div>
      <div class="flex items-center gap-3">
        <!-- Lookback selector -->
        <select
          :value="lookbackMonths"
          @change="changeLookback(Number($event.target.value))"
          class="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
          :disabled="refreshing"
        >
          <option v-for="opt in lookbackOptions" :key="opt" :value="opt">{{ opt }} months</option>
        </select>
        <!-- Refresh button -->
        <button
          @click="triggerRefresh(lookbackMonths)"
          :disabled="refreshing"
          class="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded border transition-colors"
          :class="refreshing
            ? 'border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 cursor-not-allowed'
            : 'border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'"
        >
          <svg v-if="refreshing" class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          {{ refreshing ? 'Refreshing...' : 'Refresh from Jira' }}
        </button>
      </div>
    </div>

    <!-- Metadata -->
    <p v-if="metadata" class="text-xs text-gray-400 dark:text-gray-500 italic">
      Data fetched: {{ metadata.data_timestamp?.slice(0, 16).replace('T', ' ') }} UTC |
      {{ metadata.total_features?.toLocaleString() }} features,
      {{ metadata.total_rfes?.toLocaleString() }} RFEs |
      {{ lookbackMonths }}-month lookback
    </p>

    <!-- Loading / Error -->
    <div v-if="loading && !data" class="text-center py-12 text-gray-500 dark:text-gray-400">
      <svg class="animate-spin h-8 w-8 mx-auto mb-3 text-blue-500" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
      Loading feature pressure data from Jira...
    </div>

    <div v-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-4 text-sm text-red-700 dark:text-red-300">
      {{ error }}
    </div>

    <template v-if="data && summary">

      <!-- 1. Executive Summary — Features (RHAISTRAT) -->
      <section>
        <h2 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">Executive Summary</h2>

        <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Features (RHAISTRAT)</h3>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div class="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
            <div class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total</div>
            <div class="mt-1 text-2xl font-bold">
              <ClickableCount :count="summary.total_features" :jql="summary.total_features_jql" />
            </div>
          </div>
          <div class="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
            <div class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Open</div>
            <div class="mt-1 text-2xl font-bold">
              <ClickableCount :count="summary.open_features" :jql="summary.open_features_jql" color="red" />
            </div>
          </div>
          <div class="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
            <div class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Created ({{ lookbackMonths }}mo)</div>
            <div class="mt-1 text-2xl font-bold">
              <ClickableCount :count="summary.created_in_window" :jql="summary.created_in_window_jql" />
            </div>
          </div>
          <div class="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
            <div class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Resolved ({{ lookbackMonths }}mo)</div>
            <div class="mt-1 text-2xl font-bold">
              <ClickableCount :count="summary.resolved_in_window" :jql="summary.resolved_in_window_jql" color="green" />
            </div>
          </div>
          <div class="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
            <div class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Net ({{ lookbackMonths }}mo)</div>
            <div class="mt-1 text-2xl font-bold" :class="summary.net_in_window > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'">
              {{ summary.net_in_window > 0 ? '+' : '' }}{{ summary.net_in_window }}
            </div>
          </div>
        </div>

        <div class="mt-2 flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span>Burn rate: <strong class="text-gray-700 dark:text-gray-300">{{ summary.monthly_burn_rate }}/mo</strong></span>
          <span>Time to clear: <strong :class="{
            'text-green-600 dark:text-green-400': typeof summary.months_to_clear === 'number' && summary.months_to_clear < 6,
            'text-yellow-600 dark:text-yellow-400': typeof summary.months_to_clear === 'number' && summary.months_to_clear >= 6 && summary.months_to_clear < 12,
            'text-red-600 dark:text-red-400': summary.months_to_clear === 'Infinity' || summary.months_to_clear === null || (typeof summary.months_to_clear === 'number' && summary.months_to_clear >= 12),
          }">{{ formatMonths(summary.months_to_clear) }}</strong></span>
          <span>Backlog: <strong :class="{
            'text-red-600 dark:text-red-400': summary.backlog_trend === 'growing',
            'text-green-600 dark:text-green-400': summary.backlog_trend === 'burning down',
            'text-gray-600 dark:text-gray-400': summary.backlog_trend === 'stable',
          }">{{ summary.backlog_trend }}</strong></span>
        </div>

        <!-- Executive Summary — RFEs (RHAIRFE) -->
        <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mt-5 mb-2">Feature Requests (RHAIRFE)</h3>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <div class="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
            <div class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total RFEs</div>
            <div class="mt-1 text-2xl font-bold">
              <ClickableCount :count="summary.total_rfes" :jql="summary.total_rfes_jql" />
            </div>
          </div>
          <div class="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
            <div class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Pending</div>
            <div class="mt-1 text-2xl font-bold">
              <ClickableCount :count="summary.rfe_pending" :jql="summary.rfe_pending_jql" color="yellow" />
            </div>
          </div>
          <div class="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
            <div class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Accepted</div>
            <div class="mt-1 text-2xl font-bold">
              <ClickableCount :count="summary.rfe_accepted" :jql="summary.rfe_accepted_jql" color="green" />
            </div>
          </div>
          <div class="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
            <div class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Conversion Rate</div>
            <div class="mt-1 text-2xl font-bold text-gray-700 dark:text-gray-300">
              {{ summary.total_rfes > 0 ? Math.round(100 * summary.rfe_accepted / summary.total_rfes) : 0 }}%
            </div>
          </div>
        </div>

        <!-- Hot Spots -->
        <div v-if="hotSpots.length" class="mt-5">
          <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Hot Spots — Components Under Most Pressure</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            <div v-for="h in hotSpots" :key="h.component"
              class="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg border px-3 py-2"
              :class="h.risk_level === 'critical' ? 'border-red-300 dark:border-red-800' : 'border-orange-300 dark:border-orange-800'"
            >
              <div>
                <span class="text-sm font-medium text-gray-800 dark:text-gray-200">{{ h.component }}</span>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  +{{ h.net }} net features |
                  {{ h.rfe_pending }} RFEs pending |
                  <ClickableCount :count="h.open" :jql="h.open_jql" /> open
                </div>
              </div>
              <span class="inline-block px-2 py-0.5 rounded text-xs font-medium ml-2 shrink-0" :class="riskColor(h.risk_level)">
                {{ h.risk_level }}
              </span>
            </div>
          </div>
        </div>

        <!-- Trend summary -->
        <div class="mt-3 flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span>Component trends: <strong class="text-green-600 dark:text-green-400">{{ summary.trend_improving }}</strong> improving, <strong class="text-red-600 dark:text-red-400">{{ summary.trend_worsening }}</strong> worsening, {{ summary.trend_stable }} stable</span>
        </div>
      </section>

      <!-- 2. Monthly Flow Chart -->
      <section>
        <details open>
          <summary class="text-lg font-semibold text-gray-800 dark:text-gray-200 cursor-pointer">
            Monthly Inflow vs Burn
            <span class="text-sm font-normal text-gray-400 dark:text-gray-500 ml-2">
              {{ lookbackMonths }}-month window
            </span>
          </summary>
          <div class="mt-3 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
            <MonthlyFlowChart :monthly-flow="monthlyFlow" />
          </div>
        </details>
      </section>

      <!-- 3. Component Pressure Table (Features) -->
      <section>
        <details open>
          <summary class="text-lg font-semibold text-gray-800 dark:text-gray-200 cursor-pointer">
            Feature Pressure by Component
            <span class="text-sm font-normal text-gray-400 dark:text-gray-500 ml-2">({{ filteredComponents.length }} components)</span>
          </summary>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            RHAISTRAT Features created vs resolved in the lookback window. Ratio > 1 means inflow exceeds burn.
          </p>
          <div class="mt-3">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 mb-3">
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Filter components..."
                class="text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 w-full sm:w-64"
              />
            </div>
            <div class="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700">
              <table class="min-w-full text-sm">
                <thead>
                  <tr class="border-b dark:border-gray-700">
                    <th v-for="col in [
                      { key: 'component', label: 'Component' },
                      { key: 'created', label: 'Created' },
                      { key: 'resolved', label: 'Resolved' },
                      { key: 'net', label: 'Net' },
                      { key: 'open', label: 'Open' },
                      { key: 'pressure_ratio', label: 'Ratio' },
                    ]"
                      :key="col.key"
                      class="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 select-none whitespace-nowrap"
                      @click="toggleSort(col.key)"
                    >
                      {{ col.label }} {{ sortIcon(col.key) }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="comp in filteredComponents"
                    :key="comp.component"
                    class="border-b dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td class="px-3 py-2 font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">{{ comp.component }}</td>
                    <td class="px-3 py-2"><ClickableCount :count="comp.created" :jql="comp.created_jql" /></td>
                    <td class="px-3 py-2"><ClickableCount :count="comp.resolved" :jql="comp.resolved_jql" color="green" /></td>
                    <td class="px-3 py-2 font-semibold" :class="comp.net > 0 ? 'text-red-600 dark:text-red-400' : comp.net < 0 ? 'text-green-600 dark:text-green-400' : ''">
                      {{ comp.net > 0 ? '+' : '' }}{{ comp.net }}
                    </td>
                    <td class="px-3 py-2"><ClickableCount :count="comp.open" :jql="comp.open_jql" color="red" /></td>
                    <td class="px-3 py-2 font-mono text-xs">{{ formatRatio(comp.pressure_ratio) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </details>
      </section>

      <!-- 4. RFE Pipeline -->
      <section>
        <details>
          <summary class="text-lg font-semibold text-gray-800 dark:text-gray-200 cursor-pointer">
            RFE Pipeline (RHAIRFE)
            <span class="text-sm font-normal text-gray-400 dark:text-gray-500 ml-2">
              {{ rfePipeline?.status_breakdown?.total?.count || 0 }} total |
              {{ rfePipeline?.status_breakdown?.pending?.count || 0 }} pending
            </span>
          </summary>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Customer and field Feature Requests — pending review, accepted for planning, or other.
          </p>
          <div v-if="rfePipeline" class="mt-3 space-y-4">
            <div class="flex flex-wrap gap-4 text-sm">
              <div>Total: <ClickableCount :count="rfePipeline.status_breakdown.total.count" :jql="rfePipeline.status_breakdown.total.jql" /></div>
              <div>Accepted: <ClickableCount :count="rfePipeline.status_breakdown.accepted.count" :jql="rfePipeline.status_breakdown.accepted.jql" color="green" /></div>
              <div>Pending: <ClickableCount :count="rfePipeline.status_breakdown.pending.count" :jql="rfePipeline.status_breakdown.pending.jql" color="yellow" /></div>
              <div>Other: <span class="font-semibold">{{ rfePipeline.status_breakdown.other.count }}</span></div>
            </div>
            <div v-if="rfePipeline.per_component_pending.length" class="overflow-x-auto">
              <h3 class="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Pending RFEs by Component</h3>
              <table class="min-w-full text-sm">
                <thead>
                  <tr class="border-b dark:border-gray-700">
                    <th class="px-3 py-1 text-left text-gray-500 dark:text-gray-400">Component</th>
                    <th class="px-3 py-1 text-left text-gray-500 dark:text-gray-400">Pending RFEs</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="p in rfePipeline.per_component_pending" :key="p.component" class="border-b dark:border-gray-800">
                    <td class="px-3 py-1 text-gray-700 dark:text-gray-300">{{ p.component }}</td>
                    <td class="px-3 py-1"><ClickableCount :count="p.count" :jql="p.jql" color="yellow" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </details>
      </section>

      <!-- 5. Backlog Burn-Down Estimate -->
      <section>
        <details>
          <summary class="text-lg font-semibold text-gray-800 dark:text-gray-200 cursor-pointer">
            Backlog Burn-Down Estimate
            <span class="text-sm font-normal text-gray-400 dark:text-gray-500 ml-2">
              {{ zeroComponents.length }} stalled |
              {{ activeComponents.length }} active
            </span>
          </summary>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            At the current monthly resolution rate, how long to close every open feature per component.
            "Never" means zero features were resolved in the lookback window.
          </p>
          <div class="mt-3 space-y-4">
            <div v-if="zeroComponents.length">
              <h3 class="text-sm font-medium text-red-600 dark:text-red-400 mb-2">
                Stalled — Zero Resolution Rate ({{ zeroComponents.length }} components)
              </h3>
              <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
                These components have open features but resolved nothing in the {{ lookbackMonths }}-month window.
              </p>
              <div class="flex flex-wrap gap-2">
                <span v-for="c in zeroComponents" :key="c.component"
                  class="inline-flex items-center px-2 py-1 rounded text-xs bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                  {{ c.component }} (<ClickableCount :count="c.open" :jql="c.open_jql" /> open)
                </span>
              </div>
            </div>
            <div v-if="activeComponents.length">
              <h3 class="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Active — Estimated Time to Clear</h3>
              <table class="min-w-full text-sm">
                <thead>
                  <tr class="border-b dark:border-gray-700">
                    <th class="px-3 py-1 text-left text-gray-500">Component</th>
                    <th class="px-3 py-1 text-left text-gray-500">Open Features</th>
                    <th class="px-3 py-1 text-left text-gray-500">Resolved/Mo</th>
                    <th class="px-3 py-1 text-left text-gray-500">Est. Months to Clear</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in activeComponents" :key="c.component" class="border-b dark:border-gray-800">
                    <td class="px-3 py-1 text-gray-700 dark:text-gray-300">{{ c.component }}</td>
                    <td class="px-3 py-1"><ClickableCount :count="c.open" :jql="c.open_jql" /></td>
                    <td class="px-3 py-1">{{ typeof c.resolved_per_month === 'number' ? c.resolved_per_month.toFixed(1) : c.resolved_per_month }}</td>
                    <td class="px-3 py-1 font-semibold" :class="{
                      'text-red-600 dark:text-red-400': c.months_to_clear > 24,
                      'text-yellow-600 dark:text-yellow-400': c.months_to_clear > 12 && c.months_to_clear <= 24,
                      'text-green-600 dark:text-green-400': c.months_to_clear <= 12,
                    }">{{ formatMonths(c.months_to_clear) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </details>
      </section>

      <!-- 6. Heatmap -->
      <section>
        <details>
          <summary class="text-lg font-semibold text-gray-800 dark:text-gray-200 cursor-pointer">
            Pressure Heatmap
            <span class="text-sm font-normal text-gray-400 dark:text-gray-500 ml-2">
              component x month net flow
            </span>
          </summary>
          <div class="mt-3 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-3">
            <PressureHeatmap :heatmap="heatmap" />
            <p class="text-xs text-gray-400 dark:text-gray-500 mt-2">
              Red = more created than resolved (growing). Green = burning down.
            </p>
          </div>
        </details>
      </section>

      <!-- 7. Risk Scorecard -->
      <section>
        <details open>
          <summary class="text-lg font-semibold text-gray-800 dark:text-gray-200 cursor-pointer">
            Risk Scorecard
            <span v-if="scorecard.length" class="text-sm font-normal text-gray-400 dark:text-gray-500 ml-2">
              {{ scorecard.filter(s => s.risk_level === 'critical').length }} critical,
              {{ scorecard.filter(s => s.risk_level === 'high').length }} high
            </span>
          </summary>
          <div class="mt-3">
            <div class="bg-gray-50 dark:bg-gray-800/50 rounded border border-gray-200 dark:border-gray-700 p-3 mb-3 text-xs text-gray-600 dark:text-gray-400 space-y-1">
              <p><strong>What this measures:</strong> Which components are most at risk of becoming overwhelmed. Combines three signals — net feature inflow (are features piling up?), open backlog size (how deep is the hole?), and pending RFE demand (how much more is coming from customers?).</p>
              <p><strong>How to read it:</strong> <span class="text-red-600 dark:text-red-400 font-medium">Critical</span> = immediate leadership attention needed. <span class="text-orange-600 dark:text-orange-400 font-medium">High</span> = at risk without intervention. <span class="text-yellow-600 dark:text-yellow-400 font-medium">Medium</span> = manageable but watch. <span class="text-green-600 dark:text-green-400 font-medium">Low</span> = healthy.</p>
              <p class="italic">Score = (Net/5, cap 10) x 0.4 + (Open/10, cap 10) x 0.3 + (RFE Pending/5, cap 10) x 0.3</p>
            </div>
            <div class="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700">
              <table class="min-w-full text-sm">
                <thead>
                  <tr class="border-b dark:border-gray-700">
                    <th class="px-3 py-2 text-left text-gray-500 dark:text-gray-400">Component</th>
                    <th class="px-3 py-2 text-left text-gray-500 dark:text-gray-400">Risk</th>
                    <th class="px-3 py-2 text-left text-gray-500 dark:text-gray-400">Score</th>
                    <th class="px-3 py-2 text-left text-gray-500 dark:text-gray-400">Net Features</th>
                    <th class="px-3 py-2 text-left text-gray-500 dark:text-gray-400">Open Features</th>
                    <th class="px-3 py-2 text-left text-gray-500 dark:text-gray-400">Pending RFEs</th>
                    <th class="px-3 py-2 text-left text-gray-500 dark:text-gray-400">Burn-Down</th>
                    <th class="px-3 py-2 text-left text-gray-500 dark:text-gray-400">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="s in scorecard" :key="s.component" class="border-b dark:border-gray-800">
                    <td class="px-3 py-2 font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">{{ s.component }}</td>
                    <td class="px-3 py-2">
                      <span class="inline-block px-2 py-0.5 rounded text-xs font-medium" :class="riskColor(s.risk_level)">
                        {{ s.risk_level }}
                      </span>
                    </td>
                    <td class="px-3 py-2 font-mono">{{ s.risk_score }}</td>
                    <td class="px-3 py-2" :class="s.net > 0 ? 'text-red-600 dark:text-red-400' : ''">{{ s.net > 0 ? '+' : '' }}{{ s.net }}</td>
                    <td class="px-3 py-2"><ClickableCount :count="s.open" :jql="s.open_jql" /></td>
                    <td class="px-3 py-2">
                      <ClickableCount v-if="s.rfe_pending_jql" :count="s.rfe_pending" :jql="s.rfe_pending_jql" color="yellow" />
                      <span v-else class="text-gray-500">{{ s.rfe_pending }}</span>
                    </td>
                    <td class="px-3 py-2 font-mono text-xs">{{ formatMonths(s.backlog_months) }}</td>
                    <td class="px-3 py-2">
                      <span :class="trendColor(s.trend)">{{ trendArrow(s.trend) }} {{ s.trend }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </details>
      </section>

    </template>
  </div>
</template>
