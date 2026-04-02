<script setup>
import { onMounted, inject, computed } from 'vue'
import { useFeatureDetail } from '../composables/useFeatureTraffic'
import StatusBadge from '../components/StatusBadge.vue'
import MetricsCards from '../components/MetricsCards.vue'
import TrafficMap from '../components/TrafficMap.vue'
import EpicBreakdown from '../components/EpicBreakdown.vue'

const nav = inject('moduleNav')
const { feature, loading, error, loadFeature } = useFeatureDetail()

const JIRA_BASE = 'https://redhat.atlassian.net/browse/'

const featureKey = computed(() => nav.params.value.key)

function goBack() {
  nav.navigateTo('overview')
}

function formatDate(iso) {
  if (!iso) return 'N/A'
  return new Date(iso).toLocaleDateString()
}

onMounted(() => {
  if (featureKey.value) {
    loadFeature(featureKey.value)
  }
})
</script>

<template>
  <div class="space-y-6">
    <!-- Back button -->
    <button
      class="text-sm text-gray-400 hover:text-white flex items-center gap-1"
      @click="goBack"
    >
      &larr; Back to Overview
    </button>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-12 text-gray-500">
      Loading feature details...
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
      {{ error }}
    </div>

    <!-- Feature detail -->
    <template v-else-if="feature">
      <!-- Header -->
      <div class="bg-surface rounded-lg border border-gray-700 p-6">
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1">
            <div class="flex items-center gap-3 mb-2">
              <a
                :href="JIRA_BASE + feature.key"
                class="text-blue-400 hover:underline font-mono text-sm"
                target="_blank"
              >{{ feature.key }}</a>
              <StatusBadge :status="feature.status" />
              <StatusBadge :health="feature.metrics?.health">{{ feature.metrics?.health }}</StatusBadge>
            </div>
            <h1 class="text-xl font-bold text-white">{{ feature.summary }}</h1>
            <div class="flex flex-wrap gap-3 mt-3 text-xs text-gray-400">
              <span v-if="feature.assignee">Owner: <span class="text-gray-300">{{ feature.assignee.displayName }}</span></span>
              <span>Created: {{ formatDate(feature.created) }}</span>
              <span>Updated: {{ formatDate(feature.updated) }}</span>
              <span
                v-for="v in (feature.fixVersions || [])"
                :key="v"
                class="px-1.5 py-0.5 rounded bg-gray-700 text-gray-300"
              >{{ v }}</span>
            </div>
          </div>
        </div>

        <!-- Status notes banner -->
        <div
          v-if="feature.statusNotes"
          class="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg"
        >
          <div class="text-xs text-blue-400 font-medium mb-1">Status Notes</div>
          <div class="text-sm text-gray-300 whitespace-pre-wrap">{{ feature.statusNotes }}</div>
        </div>
      </div>

      <!-- Metrics cards -->
      <MetricsCards v-if="feature.metrics" :metrics="feature.metrics" />

      <!-- Traffic map -->
      <div>
        <h2 class="text-lg font-semibold text-white mb-3">Delivery Pipeline</h2>
        <TrafficMap
          :repos="feature.topology?.repos || []"
          :epics="feature.epics || []"
          :health="feature.metrics?.health || 'YELLOW'"
        />
      </div>

      <!-- Epic breakdown -->
      <div>
        <h2 class="text-lg font-semibold text-white mb-3">
          Epic Breakdown
          <span class="text-sm font-normal text-gray-400">({{ (feature.epics || []).length }} epics)</span>
        </h2>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <EpicBreakdown :epics="feature.epics || []" />
        </div>
      </div>

      <!-- Issue links -->
      <div v-if="(feature.issueLinks || []).length > 0">
        <h2 class="text-lg font-semibold text-white mb-3">Related Issues</h2>
        <div class="bg-surface rounded-lg border border-gray-700 p-4">
          <div class="space-y-2">
            <div
              v-for="(link, i) in feature.issueLinks"
              :key="i"
              class="flex items-center gap-2 text-sm"
            >
              <span class="text-gray-500 text-xs min-w-[80px]">{{ link.type }}</span>
              <a
                :href="JIRA_BASE + link.linkedKey"
                class="text-blue-400 hover:underline font-mono text-xs"
                target="_blank"
              >{{ link.linkedKey }}</a>
              <span class="text-gray-300 truncate">{{ link.linkedSummary }}</span>
              <StatusBadge v-if="link.linkedStatus" :status="link.linkedStatus" class="ml-auto" />
            </div>
          </div>
        </div>
      </div>

      <!-- Repo breakdown -->
      <div v-if="(feature.topology?.repos || []).length > 0">
        <h2 class="text-lg font-semibold text-white mb-3">Repository Breakdown</h2>
        <div class="bg-surface rounded-lg border border-gray-700">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-700">
                <th class="px-4 py-2 text-left text-gray-400">Repository</th>
                <th class="px-4 py-2 text-left text-gray-400">Issues</th>
                <th class="px-4 py-2 text-left text-gray-400">Components</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="repo in feature.topology.repos"
                :key="repo.url"
                class="border-b border-gray-800"
              >
                <td class="px-4 py-2">
                  <a
                    :href="'https://' + repo.url"
                    class="text-blue-400 hover:underline text-xs"
                    target="_blank"
                  >{{ repo.url }}</a>
                </td>
                <td class="px-4 py-2 text-gray-300">{{ repo.issueCount }}</td>
                <td class="px-4 py-2">
                  <span
                    v-for="c in (repo.components || [])"
                    :key="c"
                    class="inline-block px-1.5 py-0.5 rounded bg-gray-700 text-gray-300 text-xs mr-1 mb-1"
                  >{{ c }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- No feature key -->
    <div v-else class="text-center py-12 text-gray-500">
      No feature key provided. Go back to the overview and select a feature.
    </div>
  </div>
</template>
