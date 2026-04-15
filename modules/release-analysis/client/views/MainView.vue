<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Release Analysis</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Releases grouped by version with per-product progress, capacity, and forecasting.
        </p>
      </div>
      <button
        class="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
        :disabled="loading || refreshing"
        @click="refreshAnalysis"
      >
        {{ loading ? 'Loading...' : refreshing ? 'Updating...' : 'Refresh' }}
      </button>
    </div>

    <div
      v-if="refreshing && analysis"
      class="flex items-center gap-2 rounded-lg border border-indigo-200 dark:border-indigo-700/50 bg-indigo-50/60 dark:bg-indigo-900/20 px-4 py-2.5 text-sm text-indigo-700 dark:text-indigo-300"
    >
      <svg class="animate-spin h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      Updating data in the background — you can keep working with the current data.
    </div>

    <div v-if="error" class="rounded-lg border border-red-300 bg-red-50 text-red-700 px-4 py-3 text-sm">
      {{ error }}
    </div>

    <div v-if="(loading || refreshing) && !analysis" class="text-sm text-gray-500 dark:text-gray-400">Loading release analytics...</div>

    <template v-if="analysis">
      <div
        v-if="analysis.warning"
        class="rounded-lg border border-yellow-300 bg-yellow-50 text-yellow-800 px-4 py-3 text-sm"
      >
        {{ analysis.warning }}
      </div>

      <div class="text-xs text-gray-500 dark:text-gray-400 space-y-1">
        <p>
          Generated: {{ formatDateTime(analysis.generatedAt) }} |
          Baseline window: {{ analysis.baselineDays }}d |
          Capacity mode: {{ (analysis.capacityMode || '').toUpperCase() }}
        </p>
      </div>

      <section class="space-y-6">
        <div>
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            Releases
          </h3>
          <p class="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mt-2 max-w-3xl">
            {{ riskLegendText }}
          </p>
          <ReleaseFilterBar
            class="mt-4"
            :selected-versions="selectedVersions"
            :visible-versions="visibleVersions"
            :filtered-count="filteredReleases.length"
            :total-count="allReleases.length"
            :toggle-version="toggleVersion"
            :clear-versions="clearVersions"
            :reset-filters="resetFilters"
          />
        </div>

        <div v-if="!filteredReleases.length" class="text-sm text-gray-500 dark:text-gray-400">
          No releases match the current filters.
        </div>

        <template v-else>
          <div class="space-y-5">
            <ReleaseVersionGroup
              v-for="group in groupedByVersion"
              :key="group.version"
              :group="group"
              :mc-inputs-map="mcInputsMap"
              :get-mc-target="getMcTarget"
              :default-open="false"
              @set-mc-target="setMcTarget"
            />
          </div>
        </template>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, reactive } from 'vue'
import { useReleaseAnalysis } from '../composables/useReleaseAnalysis'
import { useReleaseFilter } from '../composables/useReleaseFilter'
import ReleaseFilterBar from '../components/ReleaseFilterBar.vue'
import ReleaseVersionGroup from '../components/ReleaseVersionGroup.vue'

const { loading, refreshing, error, analysis, refreshAnalysis } = useReleaseAnalysis()

const allReleases = computed(() => analysis.value?.releases || [])

const {
  selectedVersions,
  visibleVersions,
  filteredReleases,
  groupedByVersion,
  toggleVersion,
  clearVersions,
  resetFilters
} = useReleaseFilter(allReleases)

// ── Monte Carlo state ──

const mcTargets = reactive({})

function getMcTarget(releaseNum) {
  return mcTargets[releaseNum] || 'codeFreeze'
}

function setMcTarget(releaseNum, target) {
  mcTargets[releaseNum] = target
}

function lookupHistoricalVelocity(componentNames) {
  const cv = analysis.value?.componentVelocity || {}
  let total = 0
  const seen = new Set()
  for (const name of componentNames) {
    if (seen.has(name)) continue
    seen.add(name)
    const entry = cv[name]
    if (entry) total += entry.velocity
  }
  return Math.round(total * 10) / 10
}

function getMonteCarloInputs(release) {
  const issues = releaseIssues(release)
  if (!issues.length) return null

  const cfDate = release.codeFreezeDate || null
  const gaDate = release.dueDate || null

  let activeTarget = getMcTarget(release.releaseNumber)
  if (activeTarget === 'codeFreeze' && !cfDate) activeTarget = 'ga'
  if (activeTarget === 'ga' && !gaDate) activeTarget = 'codeFreeze'

  const deadline = activeTarget === 'codeFreeze' ? cfDate : gaDate
  if (!deadline) return null

  let notDoneCount = 0
  const componentNames = new Set()
  for (const issue of issues) {
    if (issue.statusBucket !== 'done') notDoneCount++
    const comps = issue.components?.length ? issue.components : ['(No component)']
    for (const c of comps) componentNames.add(c)
  }

  const totalVelocity = lookupHistoricalVelocity([...componentNames])

  return {
    notDoneCount,
    totalVelocity,
    dueDate: deadline,
    releaseDate: gaDate,
    codeFreezeDate: cfDate,
    activeTarget
  }
}

function releaseIssues(release) {
  if (!release) return []
  if (Array.isArray(release.issues) && release.issues.length) return release.issues
  return Array.isArray(release.features) ? release.features : []
}

const mcInputsMap = computed(() => {
  const map = new Map()
  for (const r of filteredReleases.value) {
    const inputs = getMonteCarloInputs(r)
    if (inputs) map.set(r.releaseNumber, inputs)
  }
  return map
})

const riskLegendText = computed(() => {
  const a = analysis.value
  const g = a?.riskThresholds?.issuesPerDayGreenMax ?? 1
  const y = a?.riskThresholds?.issuesPerDayYellowMax ?? 10
  return (
    'Risk level compares open issues (to do + in progress) to days until the due date. ' +
    `Green: at most ${g} open issue(s) per day of runway; yellow: above ${g} and at most ${y}/day; red: above ${y}/day or past due. Grey: no issues in scope.`
  )
})


function formatDateTime(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}
</script>
