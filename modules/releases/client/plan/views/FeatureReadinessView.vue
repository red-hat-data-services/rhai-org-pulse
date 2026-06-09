<script setup>
import { ref, computed, onMounted } from 'vue'
import { useFeatureReadiness } from '../composables/useFeatureReadiness'
import { useReleases } from '../composables/useReleasePlanning'
import FeatureReadinessFilterBar from '../components/FeatureReadinessFilterBar.vue'
import FeatureReadinessRow from '@shared/client/components/FeatureReadinessRow.vue'
import FeatureReadinessDrawer from '@shared/client/components/FeatureReadinessDrawer.vue'

const jiraBaseUrl = 'https://issues.redhat.com/browse'

const { pendingReview, ready, filterMeta, meta, loading, error, loadFeatureReadiness } = useFeatureReadiness()
const { releases, loadReleases } = useReleases()

onMounted(function() {
  loadFeatureReadiness()
  loadReleases()
})

const selectedFeature = ref(null)
const selectedVersion = ref('')

const filters = ref({
  outcome: [],
  targetVersion: [],
  fixVersion: [],
  component: [],
  priority: [],
  team: [],
  readiness: null
})

function matchesFilters(feature) {
  const f = filters.value
  if (f.outcome.length) {
    var featureRocks = feature.bigRock ? feature.bigRock.split(', ') : []
    if (!featureRocks.some(function(r) { return f.outcome.includes(r) })) return false
  }
  if (f.targetVersion.length && !(feature.targetVersions || []).some(function(tv) { return f.targetVersion.includes(tv) })) return false
  if (f.fixVersion.length && !f.fixVersion.includes(feature.fixVersion)) return false
  if (f.component.length && !(feature.components || []).some(function(c) { return f.component.includes(c) })) return false
  if (f.priority.length && !f.priority.includes(feature.priority)) return false
  if (f.team.length && !f.team.includes(feature.team)) return false
  if (f.readiness === 'ready' && feature.confidence === 'not-ready') return false
  if (f.readiness === 'not-ready' && feature.confidence !== 'not-ready') return false
  if (selectedVersion.value) {
    if (!(feature.targetVersions || []).some(function(tv) {
      return tv === selectedVersion.value || tv.indexOf(selectedVersion.value) !== -1 || selectedVersion.value.indexOf(tv) !== -1
    })) return false
  }
  return true
}

const filteredFeatures = computed(() => {
  var all = pendingReview.value.concat(ready.value)
  return all.filter(matchesFilters).sort(function(a, b) {
    if (b.effectivePriorityScore !== a.effectivePriorityScore) {
      return b.effectivePriorityScore - a.effectivePriorityScore
    }
    return b.rubricTotal - a.rubricTotal
  })
})

const readyCounts = computed(() => {
  var all = pendingReview.value.concat(ready.value).filter(function(f) {
    const fv = filters.value
    if (fv.outcome.length) {
      var countRocks = f.bigRock ? f.bigRock.split(', ') : []
      if (!countRocks.some(function(r) { return fv.outcome.includes(r) })) return false
    }
    if (fv.targetVersion.length && !(f.targetVersions || []).some(function(tv) { return fv.targetVersion.includes(tv) })) return false
    if (fv.fixVersion.length && !fv.fixVersion.includes(f.fixVersion)) return false
    if (fv.component.length && !(f.components || []).some(function(c) { return fv.component.includes(c) })) return false
    if (fv.priority.length && !fv.priority.includes(f.priority)) return false
    if (fv.team.length && !fv.team.includes(f.team)) return false
    if (selectedVersion.value) {
      if (!(f.targetVersions || []).some(function(tv) {
        return tv === selectedVersion.value || tv.indexOf(selectedVersion.value) !== -1 || selectedVersion.value.indexOf(tv) !== -1
      })) return false
    }
    return true
  })
  var readyCount = 0
  var notReadyCount = 0
  for (var i = 0; i < all.length; i++) {
    if (all[i].confidence === 'not-ready') notReadyCount++
    else readyCount++
  }
  return { ready: readyCount, notReady: notReadyCount, total: all.length }
})

const releaseOptions = computed(() => {
  var opts = [{ version: '', label: 'All Releases' }]
  for (var i = 0; i < releases.value.length; i++) {
    opts.push({ version: releases.value[i].version, label: releases.value[i].version })
  }
  return opts
})

const headers = [
  { id: 'h-num',        label: '#',               scope: 'col' },
  { id: 'h-score',      label: 'Score',           scope: 'col' },
  { id: 'h-readiness',  label: 'Readiness',       scope: 'col', hasTooltip: true },
  { id: 'h-key',        label: 'Key',             scope: 'col' },
  { id: 'h-title',      label: 'Title',           scope: 'col' },
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

const showLegend = ref(false)

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

    <!-- Release selector + summary bar -->
    <div class="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      <div class="flex items-center gap-3">
        <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Release:</label>
        <select
          v-model="selectedVersion"
          class="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
        >
          <option v-for="opt in releaseOptions" :key="opt.version" :value="opt.version">
            {{ opt.label }}
          </option>
        </select>
      </div>
      <div class="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        <span>{{ readyCounts.total }} features</span>
        <span class="text-green-600 dark:text-green-400">{{ readyCounts.ready }} ready</span>
        <span class="text-red-600 dark:text-red-400">{{ readyCounts.notReady }} not ready</span>
      </div>
    </div>

    <!-- Filter bar -->
    <FeatureReadinessFilterBar
      :filterMeta="filterMeta"
      v-model="filters"
    />

    <!-- Error state -->
    <div
      v-if="error"
      role="alert"
      class="mx-4 mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4 text-sm text-red-700 dark:text-red-400"
    >
      {{ error }}
    </div>

    <!-- Unified table -->
    <div class="overflow-x-auto">
      <table role="table" class="w-full text-xs">
        <thead role="rowgroup" class="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
          <tr role="row">
            <th
              v-for="header in headers"
              :key="header.id"
              role="columnheader"
              :scope="header.scope"
              class="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide leading-tight"
            >
              <span v-if="header.hasTooltip" class="inline-flex items-center gap-1">
                {{ header.label }}
                <button
                  type="button"
                  class="relative inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500 text-[9px] font-bold leading-none cursor-help"
                  title="Color indicates confidence: Green=Committed, Yellow=Ready, Red=Not Ready"
                  @click.stop="showLegend = !showLegend"
                >i</button>
                <div
                  v-if="showLegend"
                  class="absolute z-50 mt-1 top-8 left-0 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-xs text-left font-normal normal-case tracking-normal"
                >
                  <p class="font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Confidence Legend</p>
                  <div class="space-y-1">
                    <div class="flex items-center gap-2">
                      <span class="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0"></span>
                      <span class="text-gray-600 dark:text-gray-300"><strong>Committed</strong> — fix version assigned</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="w-2.5 h-2.5 rounded-full bg-yellow-500 shrink-0"></span>
                      <span class="text-gray-600 dark:text-gray-300"><strong>Ready</strong> — passes gates, not yet committed</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0"></span>
                      <span class="text-gray-600 dark:text-gray-300"><strong>Not Ready</strong> — does not pass readiness gates</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    class="mt-2 text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    @click.stop="showLegend = false"
                  >Close</button>
                </div>
              </span>
              <span v-else>{{ header.label }}</span>
            </th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          <!-- Loading skeleton -->
          <template v-if="loading && filteredFeatures.length === 0">
            <tr v-for="i in 5" :key="'skel-' + i" role="row" class="border-b border-gray-100 dark:border-gray-800">
              <td v-for="j in headers.length" :key="j" class="px-3 py-3">
                <div class="h-3 rounded animate-pulse bg-gray-200 dark:bg-gray-700" :class="j === 3 ? 'w-24' : 'w-16'"></div>
              </td>
            </tr>
          </template>

          <!-- Rows -->
          <FeatureReadinessRow
            v-for="(feature, i) in filteredFeatures"
            :key="feature.key"
            :feature="feature"
            :index="i + 1"
            :jiraBaseUrl="jiraBaseUrl"
            @select="selectedFeature = $event"
          />

          <!-- Empty state -->
          <tr v-if="!loading && filteredFeatures.length === 0" role="row">
            <td :colspan="headers.length" class="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
              No features found
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
