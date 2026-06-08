<script setup>
import { ref, computed, onMounted } from 'vue'
import { useFeatureReadiness } from '../composables/useFeatureReadiness'
import FeatureReadinessFilterBar from '../components/FeatureReadinessFilterBar.vue'
import FeatureReadinessRow from '@shared/client/components/FeatureReadinessRow.vue'
import FeatureReadinessDrawer from '@shared/client/components/FeatureReadinessDrawer.vue'

const jiraBaseUrl = 'https://issues.redhat.com/browse'

const { pendingReview, approved, filterMeta, meta, loading, error, loadFeatureReadiness } = useFeatureReadiness()

onMounted(function() {
  loadFeatureReadiness()
})

const activeTab = ref('approved')
const selectedFeature = ref(null)

const filters = ref({
  outcome: null,
  targetVersion: null,
  fixVersion: null,
  component: null,
  priority: null,
  team: null,
  needsAttention: false
})

function matchesFilters(feature) {
  const f = filters.value
  if (f.outcome && feature.bigRock !== f.outcome) return false
  if (f.targetVersion && !(feature.targetVersions || []).includes(f.targetVersion)) return false
  if (f.fixVersion && feature.fixVersion !== f.fixVersion) return false
  if (f.component && !(feature.components || []).includes(f.component)) return false
  if (f.priority && feature.priority !== f.priority) return false
  if (f.team && feature.team !== f.team) return false
  if (f.needsAttention && !feature.needsAttention) return false
  return true
}

const filteredPending = computed(() => pendingReview.value.filter(matchesFilters))
const filteredApproved = computed(() => approved.value.filter(matchesFilters))

const headers = [
  { id: 'h-num',        label: '#',               scope: 'col' },
  { id: 'h-score',      label: 'Score',           scope: 'col' },
  { id: 'h-key',        label: 'Key',             scope: 'col' },
  { id: 'h-title',      label: 'Title',           scope: 'col' },
  { id: 'h-tier',       label: 'Tier',            scope: 'col' },
  { id: 'h-outcome',    label: 'Outcome',         scope: 'col' },
  { id: 'h-target',     label: 'Target Version',  scope: 'col' },
  { id: 'h-fixver',     label: 'Fix Version',     scope: 'col' },
  { id: 'h-comp',       label: 'Components',      scope: 'col' },
  { id: 'h-team',       label: 'Team',            scope: 'col' },
  { id: 'h-rubric',     label: 'Rubric',          scope: 'col' },
  { id: 'h-rec',        label: 'Recommendation',  scope: 'col' },
  { id: 'h-status',     label: 'Status',          scope: 'col' },
  { id: 'h-priority',   label: 'Priority',        scope: 'col' },
  { id: 'h-attention',  label: '',                scope: 'col' },
]

function formatSyncDate(dateStr) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleString()
  } catch {
    return dateStr
  }
}

</script>

<template>
  <div class="space-y-0">

    <!-- Filter bar -->
    <FeatureReadinessFilterBar
      :filterMeta="filterMeta"
      v-model="filters"
    />

    <!-- Inner tab bar -->
    <div class="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <div role="tablist" aria-label="Feature readiness groups" class="flex -mb-px px-4">
        <button
          role="tab"
          id="tab-fr-pending"
          :aria-selected="activeTab === 'pending'"
          aria-controls="panel-fr-pending"
          :tabindex="activeTab === 'pending' ? 0 : -1"
          @click="activeTab = 'pending'"
          class="inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors"
          :class="activeTab === 'pending'
            ? 'border-primary-500 text-primary-600 dark:text-primary-400'
            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'"
        >
          Pending Approval – Not Ready
          <span
            class="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold"
            :class="activeTab === 'pending'
              ? 'bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-400'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'"
          >{{ filteredPending.length }}</span>
        </button>

        <button
          role="tab"
          id="tab-fr-approved"
          :aria-selected="activeTab === 'approved'"
          aria-controls="panel-fr-approved"
          :tabindex="activeTab === 'approved' ? 0 : -1"
          @click="activeTab = 'approved'"
          class="inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors"
          :class="activeTab === 'approved'
            ? 'border-primary-500 text-primary-600 dark:text-primary-400'
            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'"
        >
          Approved
          <span
            class="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold"
            :class="activeTab === 'approved'
              ? 'bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-400'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'"
          >{{ filteredApproved.length }}</span>
        </button>
      </div>
    </div>

    <!-- Error state -->
    <div
      v-if="error"
      role="alert"
      class="mx-4 mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4 text-sm text-red-700 dark:text-red-400"
    >
      {{ error }}
    </div>

    <!-- Table panel -->
    <div
      id="panel-fr-pending"
      role="tabpanel"
      aria-labelledby="tab-fr-pending"
      v-show="activeTab === 'pending'"
      class="overflow-x-auto"
    >
      <table role="table" class="w-full text-xs">
        <thead role="rowgroup" class="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
          <tr role="row">
            <th
              v-for="header in headers"
              :key="header.id"
              role="columnheader"
              :scope="header.scope"
              class="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide leading-tight"
            >{{ header.label }}</th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          <!-- Loading skeleton -->
          <template v-if="loading && filteredPending.length === 0">
            <tr v-for="i in 5" :key="'skel-p-' + i" role="row" class="border-b border-gray-100 dark:border-gray-800">
              <td v-for="j in headers.length" :key="j" class="px-3 py-3">
                <div class="h-3 rounded animate-pulse bg-gray-200 dark:bg-gray-700" :class="j === 3 ? 'w-24' : 'w-16'"></div>
              </td>
            </tr>
          </template>

          <!-- Rows -->
          <FeatureReadinessRow
            v-for="(feature, i) in filteredPending"
            :key="feature.key"
            :feature="feature"
            :index="i + 1"
            :jiraBaseUrl="jiraBaseUrl"
            @select="selectedFeature = $event"
          />

          <!-- Empty state -->
          <tr v-if="!loading && filteredPending.length === 0" role="row">
            <td :colspan="headers.length" class="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
              No features pending approval
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div
      id="panel-fr-approved"
      role="tabpanel"
      aria-labelledby="tab-fr-approved"
      v-show="activeTab === 'approved'"
      class="overflow-x-auto"
    >
      <table role="table" class="w-full text-xs">
        <thead role="rowgroup" class="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
          <tr role="row">
            <th
              v-for="header in headers"
              :key="header.id"
              role="columnheader"
              :scope="header.scope"
              class="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide leading-tight"
            >{{ header.label }}</th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          <!-- Loading skeleton -->
          <template v-if="loading && filteredApproved.length === 0">
            <tr v-for="i in 5" :key="'skel-a-' + i" role="row" class="border-b border-gray-100 dark:border-gray-800">
              <td v-for="j in headers.length" :key="j" class="px-3 py-3">
                <div class="h-3 rounded animate-pulse bg-gray-200 dark:bg-gray-700" :class="j === 3 ? 'w-24' : 'w-16'"></div>
              </td>
            </tr>
          </template>

          <!-- Rows -->
          <FeatureReadinessRow
            v-for="(feature, i) in filteredApproved"
            :key="feature.key"
            :feature="feature"
            :index="i + 1"
            :jiraBaseUrl="jiraBaseUrl"
            @select="selectedFeature = $event"
          />

          <!-- Empty state -->
          <tr v-if="!loading && filteredApproved.length === 0" role="row">
            <td :colspan="headers.length" class="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
              No approved features
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Footer: last synced -->
    <div
      v-if="meta"
      class="px-4 py-2 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900"
    >
      Last synced: {{ formatSyncDate(meta.lastSyncedAt) }}
      <span class="ml-1 text-gray-300 dark:text-gray-600">(strat-pipeline runs every ~2h)</span>
    </div>

  </div>

  <FeatureReadinessDrawer
    :feature="selectedFeature"
    :jiraBaseUrl="jiraBaseUrl"
    @close="selectedFeature = null"
  />
</template>
