<script setup>
import StatusBadge from './StatusBadge.vue'
import TierSeparator from './TierSeparator.vue'
import { computed } from 'vue'

const props = defineProps({
  features: { type: Array, default: () => [] },
  bigRocks: { type: Array, default: () => [] },
  jiraBaseUrl: { type: String, default: '' },
  summary: { type: Object, default: null }
})

const PRIORITY_STYLES = {
  'Blocker': 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',
  'Critical': 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400',
  'Major': 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
  'Normal': 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
  'Minor': 'bg-gray-100 dark:bg-gray-500/20 text-gray-600 dark:text-gray-400'
}

const COL_COUNT = 12

const tierCounts = computed(() => {
  const counts = {}
  for (const f of props.features) {
    const tier = f.tier || 1
    counts[tier] = (counts[tier] || 0) + 1
  }
  return counts
})

const groupedFeatures = computed(() => {
  const groups = []
  let currentTier = null

  for (const f of props.features) {
    const tier = f.tier || 1
    if (tier !== currentTier) {
      currentTier = tier
      groups.push({ type: 'separator', tier, count: tierCounts.value[tier] || 0 })
    }
    groups.push({ type: 'feature', data: f })
  }

  return groups
})
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th class="px-3 py-2 text-left text-gray-700 dark:text-gray-200 font-semibold uppercase text-xs tracking-wide border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900/80">Big Rock</th>
            <th class="px-3 py-2 text-left text-gray-700 dark:text-gray-200 font-semibold uppercase text-xs tracking-wide border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900/80">Feature</th>
            <th class="px-3 py-2 text-left text-gray-700 dark:text-gray-200 font-semibold uppercase text-xs tracking-wide border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900/80">Status</th>
            <th class="px-3 py-2 text-left text-gray-700 dark:text-gray-200 font-semibold uppercase text-xs tracking-wide border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900/80">Priority</th>
            <th class="px-3 py-2 text-left text-gray-700 dark:text-gray-200 font-semibold uppercase text-xs tracking-wide border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900/80">Phase</th>
            <th class="px-3 py-2 text-left text-gray-700 dark:text-gray-200 font-semibold uppercase text-xs tracking-wide border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900/80">Title</th>
            <th class="px-3 py-2 text-left text-gray-700 dark:text-gray-200 font-semibold uppercase text-xs tracking-wide border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900/80">Components</th>
            <th class="px-3 py-2 text-left text-gray-700 dark:text-gray-200 font-semibold uppercase text-xs tracking-wide border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900/80">Target Release</th>
            <th class="px-3 py-2 text-left text-gray-700 dark:text-gray-200 font-semibold uppercase text-xs tracking-wide border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900/80">PM</th>
            <th class="px-3 py-2 text-left text-gray-700 dark:text-gray-200 font-semibold uppercase text-xs tracking-wide border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900/80">Delivery Owner</th>
            <th class="px-3 py-2 text-left text-gray-700 dark:text-gray-200 font-semibold uppercase text-xs tracking-wide border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900/80">RFE</th>
            <th class="px-3 py-2 text-left text-gray-700 dark:text-gray-200 font-semibold uppercase text-xs tracking-wide border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900/80">Fix Version</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="(item, idx) in groupedFeatures" :key="idx">
            <TierSeparator
              v-if="item.type === 'separator'"
              :tier="item.tier"
              :count="item.count"
              :colspan="COL_COUNT"
            />
            <tr
              v-else
              class="hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <td class="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 max-w-[120px] truncate border border-gray-300 dark:border-gray-600">{{ item.data.bigRock || '-' }}</td>
              <td class="px-3 py-2 border border-gray-300 dark:border-gray-600">
                <a
                  :href="item.data.jiraUrl || `${jiraBaseUrl}/${item.data.issueKey}`"
                  target="_blank"
                  rel="noopener"
                  class="text-primary-600 dark:text-blue-400 font-mono text-xs hover:underline"
                >{{ item.data.issueKey }}</a>
              </td>
              <td class="px-3 py-2 border border-gray-300 dark:border-gray-600"><StatusBadge :status="item.data.status" /></td>
              <td class="px-3 py-2 border border-gray-300 dark:border-gray-600">
                <span
                  v-if="item.data.priority"
                  class="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold"
                  :class="PRIORITY_STYLES[item.data.priority] || PRIORITY_STYLES['Normal']"
                >{{ item.data.priority }}</span>
              </td>
              <td class="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600">{{ item.data.phase || '-' }}</td>
              <td class="px-3 py-2 text-gray-900 dark:text-gray-100 max-w-xs truncate border border-gray-300 dark:border-gray-600">{{ item.data.summary }}</td>
              <td class="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600">{{ item.data.components }}</td>
              <td class="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600">{{ item.data.targetRelease }}</td>
              <td class="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600">{{ item.data.pm }}</td>
              <td class="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600">{{ item.data.deliveryOwner || '-' }}</td>
              <td class="px-3 py-2 border border-gray-300 dark:border-gray-600">
                <a
                  v-if="item.data.rfe"
                  :href="`${jiraBaseUrl}/${item.data.rfe}`"
                  target="_blank"
                  rel="noopener"
                  class="text-primary-600 dark:text-blue-400 font-mono text-xs hover:underline"
                >{{ item.data.rfe }}</a>
                <span v-else class="text-gray-400 dark:text-gray-600 text-xs">-</span>
              </td>
              <td class="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600">{{ item.data.fixVersion || '-' }}</td>
            </tr>
          </template>
          <tr v-if="!features || features.length === 0">
            <td :colspan="COL_COUNT" class="px-3 py-8 text-center text-gray-500 border border-gray-300 dark:border-gray-600">
              No features found matching the current filters.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
