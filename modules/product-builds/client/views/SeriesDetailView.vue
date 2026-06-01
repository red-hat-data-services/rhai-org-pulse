<script setup>
import { ref, reactive, onMounted, inject, computed } from 'vue'
import { useDrops } from '../composables/useDrops'
import { apiRequest } from '@shared/client/services/api'
import { formatDate, envBadgeClass } from '../utils/formatting'
import SeriesTimeline from '../components/SeriesTimeline.vue'

const BASE = '/modules/product-builds'
const nav = inject('moduleNav')
const { drops, loading: dropsLoading, error: dropsError, loadDrops } = useDrops()

const seriesName = computed(() => nav.params.value.series || '')
const productKey = computed(() => nav.params.value.product || '')

const metricsMap = reactive({})
const metricsLoading = ref(false)

async function fetchAllMetrics() {
  if (drops.value.length === 0) return
  metricsLoading.value = true
  const results = {}
  await Promise.all(
    drops.value.map(async (drop) => {
      try {
        const data = await apiRequest(`${BASE}/drops/${encodeURIComponent(drop.key)}/metrics`)
        if (data) results[drop.key] = data
      } catch { /* skip */ }
    })
  )
  Object.assign(metricsMap, results)
  metricsLoading.value = false
}

async function load() {
  await loadDrops(productKey.value, { series: seriesName.value, limit: 1000, supported_only: false })
  fetchAllMetrics()
}

onMounted(load)

function navigateToDrop(dropKey) {
  nav.navigateTo('drop-detail', { key: dropKey, product: productKey.value })
}

const hasMetrics = computed(() => Object.keys(metricsMap).length > 0)
</script>

<template>
  <div class="space-y-6">
    <!-- Back button -->
    <button
      @click="nav.goBack()"
      class="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
    >&larr; Back</button>

    <!-- Title -->
    <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">Series: {{ seriesName }}</h1>

    <!-- Loading / Error -->
    <div v-if="dropsLoading && drops.length === 0" class="text-sm text-gray-500 dark:text-gray-400">Loading drops…</div>
    <div v-if="dropsError" class="text-sm text-red-600 dark:text-red-400">{{ dropsError }}</div>

    <template v-if="drops.length > 0">
      <!-- Drops table -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[35%]">Drop</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[10%]">Branch</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[25%]">Environment</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[30%]">Date</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
            <tr
              v-for="drop in drops"
              :key="drop.key"
              @click="navigateToDrop(drop.key)"
              class="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
            >
              <td class="px-4 py-3 text-sm font-medium text-primary-600 dark:text-blue-400">{{ drop.name }}</td>
              <td class="px-4 py-3 text-center">
                <span
                  v-if="drop.git_branch"
                  class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 dark:text-purple-300 dark:bg-purple-900/20 dark:border-purple-700"
                  :title="`Tag was cut from the '${drop.git_branch}' branch`"
                >{{ drop.git_branch }}</span>
              </td>
              <td class="px-4 py-3">
                <div class="flex gap-1">
                  <span
                    v-for="env in (drop.environments || [])"
                    :key="env"
                    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                    :class="envBadgeClass(env)"
                  >{{ env }}</span>
                </div>
              </td>
              <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{{ formatDate(drop.created_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Series Timeline -->
      <div>
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Series Timeline</h2>

        <div v-if="metricsLoading" class="text-sm text-gray-500 dark:text-gray-400">Loading timeline data…</div>
        <SeriesTimeline
          v-else-if="hasMetrics"
          :drops="drops"
          :metrics-map="metricsMap"
          :product-key="productKey"
          @navigate-drop="navigateToDrop"
        />
        <div v-else class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 text-center text-sm text-gray-500 dark:text-gray-400">
          No release statistics available for this series.
        </div>
      </div>
    </template>

    <div v-else-if="!dropsLoading && !dropsError" class="text-sm text-gray-500 dark:text-gray-400">
      No drops found for this series.
    </div>
  </div>
</template>
