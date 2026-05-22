<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { apiRequest } from '@shared/client'
import ClickableCount from '../components/ClickableCount.vue'
import FeatureTable from '../components/FeatureTable.vue'

const data = ref(null)
const loading = ref(true)
const error = ref(null)
const refreshing = ref(false)

const selectedRelease = ref('')

// Track timers for cleanup
let pipelinePollTimeout = null
let refreshPollInterval = null

const FEATURE_COLS = ['key', 'summary', 'status', 'color_status', 'product_manager', 'assignee', 'team', 'component']
const MISMATCHED_COLS = ['key', 'summary', 'status', 'target_version', 'fix_versions', 'product_manager', 'assignee', 'team', 'component']

const releaseComponentBreakdown = computed(() => {
  if (!releaseData.value || !data.value) return []

  // Get ALL components from server (including those with 0 features)
  const allComponentNames = data.value.metadata?.all_components || []

  const allFeatures = [
    ...releaseData.value.aligned.map(f => ({ ...f, category: 'aligned' })),
    ...releaseData.value.tv_only.map(f => ({ ...f, category: 'tv_only' })),
    ...releaseData.value.fv_only.map(f => ({ ...f, category: 'fv_only' })),
    ...releaseData.value.mismatched.map(f => ({ ...f, category: 'mismatched' })),
  ]

  const compMap = {}
  for (const feat of allFeatures) {
    const comps = feat.component ? feat.component.split(', ').map(c => c.trim()).filter(Boolean) : []
    for (const comp of comps) {
      if (!compMap[comp]) compMap[comp] = { component: comp, total: 0, aligned: 0, tv_only: 0, fv_only: 0, mismatched: 0, keys: new Set() }
      if (!compMap[comp].keys.has(feat.key)) {
        compMap[comp].keys.add(feat.key)
        compMap[comp].total++
        compMap[comp][feat.category]++
      }
    }
  }

  // Merge ALL components from Jira with computed counts
  const compList = allComponentNames.map(compName => {
    const computed = compMap[compName]
    if (computed) {
      return {
        component: compName,
        total: computed.total,
        aligned: computed.aligned,
        tv_only: computed.tv_only,
        fv_only: computed.fv_only,
        mismatched: computed.mismatched,
        alignment_pct: computed.total ? Math.round(1000 * computed.aligned / computed.total) / 10 : 0,
      }
    } else {
      return {
        component: compName,
        total: 0,
        aligned: 0,
        tv_only: 0,
        fv_only: 0,
        mismatched: 0,
        alignment_pct: 0,
      }
    }
  })

  return compList.sort((a, b) => b.total - a.total || a.component.localeCompare(b.component))
})

async function fetchData() {
  try {
    const result = await apiRequest('/modules/deep-analytics/tv-fv-delta')
    if (result._noCache) {
      // Pipeline running for the first time — poll
      refreshing.value = true
      pipelinePollTimeout = setTimeout(fetchData, 5000)
      return
    }
    data.value = result
    refreshing.value = !!result._refreshing
    if (result.metadata?.releases?.length && !selectedRelease.value) {
      selectedRelease.value = result.metadata.releases[0]
    }
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function triggerRefresh() {
  if (refreshing.value) return
  refreshing.value = true
  try {
    await apiRequest('/modules/deep-analytics/tv-fv-delta/refresh', { method: 'POST' })
    // Poll for completion
    if (refreshPollInterval) clearInterval(refreshPollInterval)
    refreshPollInterval = setInterval(async () => {
      try {
        const status = await apiRequest('/modules/deep-analytics/tv-fv-delta/refresh/status')
        if (!status.running) {
          clearInterval(refreshPollInterval)
          refreshPollInterval = null
          refreshing.value = false
          await fetchData()
        }
      } catch {
        clearInterval(refreshPollInterval)
        refreshPollInterval = null
        refreshing.value = false
      }
    }, 3000)
  } catch (e) {
    refreshing.value = false
    error.value = e.message
  }
}

onMounted(fetchData)

onBeforeUnmount(() => {
  if (pipelinePollTimeout) clearTimeout(pipelinePollTimeout)
  if (refreshPollInterval) clearInterval(refreshPollInterval)
})

const releaseData = computed(() => {
  if (!data.value || !selectedRelease.value) return null
  return data.value.releases[selectedRelease.value]
})

const releaseSummary = computed(() => {
  if (!data.value) return null
  return data.value.executive_summary.find(s => s.release === selectedRelease.value)
})
</script>

<template>
  <div class="max-w-7xl mx-auto p-6">
    <!-- Header -->
    <div class="mb-6 flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
          TV vs FV Delta
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Target Version (PM intent) vs Fix Version (engineering commitment)
        </p>
      </div>
      <button
        @click="triggerRefresh"
        :disabled="refreshing"
        class="px-3 py-1.5 text-xs font-medium rounded-md border transition-colors"
        :class="refreshing
          ? 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
          : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'"
      >
        {{ refreshing ? 'Refreshing...' : 'Refresh from Jira' }}
      </button>
    </div>

    <div v-if="loading" class="text-gray-500 dark:text-gray-400">Loading...</div>
    <div v-else-if="error" class="text-red-600 dark:text-red-400">{{ error }}</div>

    <template v-else-if="data">
      <!-- Metadata -->
      <div class="text-xs text-gray-400 dark:text-gray-500 mb-4">
        Data fetched: {{ new Date(data.metadata.data_timestamp).toLocaleString() }}
        &middot;
        Report generated: {{ new Date(data.metadata.generated_at).toLocaleString() }}
        &middot;
        <span class="italic">Counts reflect data at fetch time; live Jira may differ</span>
      </div>

      <!-- Executive Summary -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Executive Summary</h2>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="bg-gray-50 dark:bg-gray-800/50">
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Release</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Aligned</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">TV-Only</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">FV-Only</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Mismatched</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Alignment</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr
                v-for="row in data.executive_summary"
                :key="row.release"
                class="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                :class="{ 'bg-blue-50/50 dark:bg-blue-900/10': row.release === selectedRelease }"
                @click="selectedRelease = row.release"
              >
                <td class="px-4 py-2 font-mono text-xs font-medium text-gray-900 dark:text-gray-100">
                  {{ row.release }}
                </td>
                <td class="px-4 py-2 text-right">
                  <ClickableCount :count="row.total" :jql="row.total_jql" label="Total features" />
                </td>
                <td class="px-4 py-2 text-right">
                  <ClickableCount :count="row.aligned" :jql="row.aligned_jql" color="green" label="Aligned" />
                </td>
                <td class="px-4 py-2 text-right">
                  <ClickableCount :count="row.tv_only" :jql="row.tv_only_jql" color="yellow" label="TV-only" />
                </td>
                <td class="px-4 py-2 text-right">
                  <ClickableCount :count="row.fv_only" :jql="row.fv_only_jql" color="muted" label="FV-only" />
                </td>
                <td class="px-4 py-2 text-right">
                  <ClickableCount
                    :count="row.mismatched"
                    :jql="row.mismatched_jql"
                    color="red"
                    label="Mismatched"
                  />
                </td>
                <td class="px-4 py-2 text-right">
                  <span
                    class="font-semibold"
                    :class="{
                      'text-red-600 dark:text-red-400': row.alignment_pct < 50,
                      'text-yellow-600 dark:text-yellow-400': row.alignment_pct >= 50 && row.alignment_pct < 75,
                      'text-green-600 dark:text-green-400': row.alignment_pct >= 75,
                    }"
                  >
                    {{ row.alignment_pct }}%
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Release tabs -->
      <div class="flex gap-2 mb-6">
        <button
          v-for="rel in data.metadata.releases"
          :key="rel"
          class="px-3 py-1.5 text-sm rounded-md transition-colors"
          :class="rel === selectedRelease
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'"
          @click="selectedRelease = rel"
        >
          {{ rel }}
        </button>
      </div>

      <!-- Category lists for selected release -->
      <div v-if="releaseData">
        <!-- TV-Only -->
        <details class="group bg-white dark:bg-gray-800 rounded-lg border border-yellow-200 dark:border-yellow-800 overflow-hidden mb-4">
          <summary class="list-none px-4 py-3 cursor-pointer hover:bg-yellow-50 dark:hover:bg-yellow-900/10 flex items-center justify-between [&::-webkit-details-marker]:hidden">
            <span class="flex items-center gap-2">
              <span class="text-xs text-gray-400 group-open:rotate-90 transition-transform">&#9654;</span>
              <span class="text-sm font-semibold text-yellow-700 dark:text-yellow-400">
                TV-Only — PM targeted, no ENG commitment ({{ releaseData.tv_only.length }})
              </span>
            </span>
            <a
              v-if="releaseSummary"
              :href="releaseSummary.tv_only_jql"
              target="_blank"
              rel="noopener noreferrer"
              class="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              @click.stop
            >
              View in Jira &rarr;
            </a>
          </summary>
          <FeatureTable
            :features="releaseData.tv_only"
            :columns="FEATURE_COLS"
          />
        </details>

        <!-- FV-Only -->
        <details class="group bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden mb-4">
          <summary class="list-none px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 flex items-center justify-between [&::-webkit-details-marker]:hidden">
            <span class="flex items-center gap-2">
              <span class="text-xs text-gray-400 group-open:rotate-90 transition-transform">&#9654;</span>
              <span class="text-sm font-semibold text-gray-600 dark:text-gray-400">
                FV-Only — ENG committed, not PM-planned ({{ releaseData.fv_only.length }})
              </span>
            </span>
            <a
              v-if="releaseSummary"
              :href="releaseSummary.fv_only_jql"
              target="_blank"
              rel="noopener noreferrer"
              class="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              @click.stop
            >
              View in Jira &rarr;
            </a>
          </summary>
          <FeatureTable
            :features="releaseData.fv_only"
            :columns="FEATURE_COLS"
          />
        </details>

        <!-- Mismatched -->
        <details v-if="releaseData.mismatched.length" class="group bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-800 overflow-hidden mb-4">
          <summary class="list-none px-4 py-3 cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/10 flex items-center justify-between [&::-webkit-details-marker]:hidden">
            <span class="flex items-center gap-2">
              <span class="text-xs text-gray-400 group-open:rotate-90 transition-transform">&#9654;</span>
              <span class="text-sm font-semibold text-red-700 dark:text-red-400">
                Mismatched — TV and FV disagree ({{ releaseData.mismatched.length }})
              </span>
            </span>
            <a
              v-if="releaseSummary"
              :href="releaseSummary.mismatched_jql"
              target="_blank"
              rel="noopener noreferrer"
              class="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              @click.stop
            >
              View in Jira &rarr;
            </a>
          </summary>
          <FeatureTable
            :features="releaseData.mismatched"
            :columns="MISMATCHED_COLS"
          />
        </details>

        <!-- Aligned -->
        <details class="group bg-white dark:bg-gray-800 rounded-lg border border-green-200 dark:border-green-800 overflow-hidden mb-4">
          <summary class="list-none px-4 py-3 cursor-pointer hover:bg-green-50 dark:hover:bg-green-900/10 flex items-center justify-between [&::-webkit-details-marker]:hidden">
            <span class="flex items-center gap-2">
              <span class="text-xs text-gray-400 group-open:rotate-90 transition-transform">&#9654;</span>
              <span class="text-sm font-semibold text-green-700 dark:text-green-400">
                Aligned — TV == FV ({{ releaseData.aligned.length }})
              </span>
            </span>
            <a
              v-if="releaseSummary"
              :href="releaseSummary.aligned_jql"
              target="_blank"
              rel="noopener noreferrer"
              class="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              @click.stop
            >
              View in Jira &rarr;
            </a>
          </summary>
          <FeatureTable
            :features="releaseData.aligned"
            :columns="FEATURE_COLS"
          />
        </details>
      </div>

      <!-- Component Breakdown (per-release) -->
      <details v-if="releaseComponentBreakdown.length" class="group bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden mb-4">
        <summary class="list-none px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 flex items-center [&::-webkit-details-marker]:hidden">
          <span class="text-xs text-gray-400 group-open:rotate-90 transition-transform mr-2">&#9654;</span>
          <span class="text-sm font-semibold text-gray-700 dark:text-gray-300">Component Breakdown</span>
        </summary>
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="bg-gray-50 dark:bg-gray-800/50">
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Component</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Aligned</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">TV-Only</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Mismatched</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Alignment</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr
                v-for="comp in releaseComponentBreakdown"
                :key="comp.component"
                class="hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                <td class="px-4 py-2 text-gray-900 dark:text-gray-100">{{ comp.component }}</td>
                <td class="px-4 py-2 text-right text-gray-700 dark:text-gray-300">{{ comp.total }}</td>
                <td class="px-4 py-2 text-right text-green-600 dark:text-green-400">{{ comp.aligned }}</td>
                <td class="px-4 py-2 text-right text-yellow-600 dark:text-yellow-400">{{ comp.tv_only }}</td>
                <td class="px-4 py-2 text-right text-red-600 dark:text-red-400">{{ comp.mismatched }}</td>
                <td class="px-4 py-2 text-right">
                  <span
                    class="font-semibold"
                    :class="{
                      'text-red-600 dark:text-red-400': comp.alignment_pct < 50,
                      'text-yellow-600 dark:text-yellow-400': comp.alignment_pct >= 50 && comp.alignment_pct < 75,
                      'text-green-600 dark:text-green-400': comp.alignment_pct >= 75,
                    }"
                  >
                    {{ comp.alignment_pct }}%
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </template>
  </div>
</template>
