<template>
  <section class="space-y-6" data-testid="tech-debt-prioritization">
    <div>
      <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">
        Tech Debt Prioritization
      </h2>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Focus engineering effort on the most important open bugs and vulnerabilities.
      </p>
    </div>

    <aside
      class="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-red-900 dark:border-red-800 dark:bg-red-950/35 dark:text-red-100"
      role="alert"
      data-testid="tech-debt-user-testing-warning"
    >
      <span class="mt-0.5 text-lg leading-none text-red-600 dark:text-red-300" aria-hidden="true">⚠</span>
      <div>
        <h3 class="text-sm font-bold">User testing notice</h3>
        <p class="mt-0.5 text-sm leading-5 text-red-800 dark:text-red-200">
          This report is currently under user testing. Results and prioritization may change; validate the underlying Jira data before making delivery decisions and proceed with caution.
        </p>
      </div>
    </aside>

    <aside
      class="flex items-start gap-3 rounded-xl border border-primary-200 bg-primary-50/70 px-4 py-3 dark:border-primary-800 dark:bg-primary-950/30"
      aria-labelledby="tech-debt-importance-heading"
      data-testid="tech-debt-importance"
    >
      <div class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700 dark:bg-primary-900/60 dark:text-primary-300" aria-hidden="true">
        ◈
      </div>
      <div>
        <h3 id="tech-debt-importance-heading" class="text-sm font-bold text-gray-900 dark:text-gray-100">Why this report matters</h3>
        <p class="mt-0.5 max-w-5xl text-sm leading-5 text-gray-600 dark:text-gray-300">
          High-quality, secure software earns the trust enterprise customers place in Red Hat. AI Engineering treats CVE remediation as part of every feature we deliver—patching continuously helps make vulnerability management sustainable, not a series of fire drills.
        </p>
        <button
          type="button"
          class="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 underline decoration-primary-300 underline-offset-4 hover:text-primary-800 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-primary-300 dark:hover:text-primary-200"
          aria-haspopup="dialog"
          data-testid="vulnerability-rubric-open"
          @click="scoringRubricOpen = true"
        >
          View comprehensive scoring rubrics
          <span aria-hidden="true">↗</span>
        </button>
      </div>
    </aside>

    <TechDebtScoringRubricModal
      v-if="scoringRubricOpen"
      :initial-tab="selectedIssueType === 'Bug' ? 'bug' : 'vulnerability'"
      @close="scoringRubricOpen = false"
    />

    <section class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800" aria-label="Tech debt filters">
      <div class="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_15rem_15rem_15rem]">
        <div ref="componentFilterContainer" class="relative">
          <label for="tech-debt-component-filter" class="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Component
          </label>
          <button
            id="tech-debt-component-filter"
            type="button"
            class="flex min-h-12 w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-3 text-left text-sm font-medium text-gray-900 transition-colors hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-wait disabled:opacity-60 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:border-gray-500"
            :aria-expanded="componentMenuOpen"
            aria-haspopup="listbox"
            :disabled="componentsLoading"
            data-testid="tech-debt-component-filter"
            @click="componentMenuOpen = !componentMenuOpen"
          >
            <span>{{ componentFilterLabel }}</span>
            <span aria-hidden="true" class="ml-3 text-gray-500">⌄</span>
          </button>

          <div
            v-if="componentMenuOpen"
            class="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-600 dark:bg-gray-800"
            role="listbox"
            aria-label="Jira components"
            aria-multiselectable="true"
          >
            <label
              v-for="component in componentOptions"
              :key="component.id"
              class="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <input
                type="checkbox"
                :checked="selectedComponents.includes(component.name)"
                class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                :aria-label="component.name"
                @change="toggleComponent(component.name)"
              >
              <span>{{ component.name }}</span>
            </label>
            <p v-if="!componentsLoading && !componentOptions.length" class="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
              No Jira components found.
            </p>
          </div>
        </div>

        <div>
          <label for="tech-debt-issue-type-filter" class="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Issue type
          </label>
          <select
            id="tech-debt-issue-type-filter"
            v-model="selectedIssueType"
            data-testid="tech-debt-issue-type-filter"
            class="min-h-12 w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          >
            <option value="">All issue types</option>
            <option value="Bug">Bugs</option>
            <option value="Vulnerability">CVE (Vulnerability)</option>
          </select>
        </div>

        <div>
          <label for="tech-debt-triage-filter" class="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Triage
          </label>
          <select
            id="tech-debt-triage-filter"
            v-model="selectedTriage"
            :disabled="selectedIssueType === 'Bug'"
            data-testid="tech-debt-triage-filter"
            class="min-h-12 w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          >
            <option value="">All tracking states</option>
            <option value="exceptions">Needs Triage / Exceptions</option>
          </select>
        </div>

        <div>
          <label for="tech-debt-release-filter" class="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Release
          </label>
          <select
            id="tech-debt-release-filter"
            v-model="selectedRelease"
            data-testid="tech-debt-release-filter"
            class="min-h-12 w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          >
            <option value="">All Releases</option>
          </select>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Release filtering will be wired next.
          </p>
        </div>
      </div>

      <div v-if="selectedFilters.length" class="mt-5 border-t border-gray-100 pt-4 dark:border-gray-700" data-testid="tech-debt-selected-filters">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Selected filters</span>
          <span
            v-for="filter in selectedFilters"
            :key="filter.key"
            class="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1 text-sm text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
          >
            {{ filter.label }}
            <button
              type="button"
              class="rounded-full px-1 text-primary-700 hover:bg-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-primary-300 dark:hover:bg-primary-900/50"
              :aria-label="`Remove ${filter.label} filter`"
              @click="removeFilter(filter)"
            >
              ×
            </button>
          </span>
        </div>
      </div>

      <div class="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p v-if="componentsError" class="text-sm text-red-600 dark:text-red-400" role="alert">
          {{ componentsError }}
        </p>
        <p v-else-if="componentsLoading" class="text-sm text-gray-500 dark:text-gray-400" aria-live="polite">
          Loading Jira components…
        </p>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">
          {{ selectedComponents.length ? `${selectedComponents.length} component${selectedComponents.length === 1 ? '' : 's'} selected` : 'Select at least one component to load the cockpit' }}
        </span>
        <button
          type="button"
          class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          :disabled="!hasActiveFilters"
          data-testid="tech-debt-clear-filters"
          @click="clearFilters"
        >
          Clear filters
        </button>
      </div>
    </section>

    <section
      v-if="!selectedComponents.length"
      class="rounded-2xl border border-dashed border-gray-300 bg-gradient-to-br from-gray-50 to-white px-6 py-16 text-center dark:border-gray-700 dark:from-gray-800 dark:to-gray-900"
      data-testid="tech-debt-component-required"
    >
      <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 text-xl text-primary-700 dark:bg-primary-900/40 dark:text-primary-300" aria-hidden="true">
        ◫
      </div>
      <h3 class="mt-4 text-base font-semibold text-gray-900 dark:text-gray-100">Choose a component to open the cockpit</h3>
      <p class="mx-auto mt-2 max-w-lg text-sm text-gray-500 dark:text-gray-400">
        The cockpit combines active work and the remaining unresolved backlog for the components you select above.
      </p>
    </section>

    <section v-else class="space-y-5" data-testid="tech-debt-cockpit">
      <div v-if="cockpitData?.warning" class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200" role="status" data-testid="tech-debt-stale-warning">
        {{ cockpitData.warning }}
      </div>

      <div v-if="cockpitLoading && cockpitData" class="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200" role="status" data-testid="tech-debt-background-refresh">
        Updating Jira data in the background. Previously loaded results remain available while the refresh completes.
      </div>

      <div v-if="cockpitError" class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200" role="alert" data-testid="tech-debt-error">
        <span>{{ cockpitError }}</span>
        <button type="button" class="rounded-lg border border-red-300 px-3 py-1.5 font-semibold hover:bg-red-100 dark:border-red-700 dark:hover:bg-red-900/40" @click="loadIssues(false)">
          Retry
        </button>
      </div>

      <div class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div class="flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 px-5 py-5 dark:border-gray-700">
          <div>
            <p class="text-xs font-bold uppercase tracking-[0.16em] text-primary-600 dark:text-primary-300">Tech Debt Cockpit</p>
            <h3 class="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">Open engineering debt at a glance</h3>
          <p v-if="cockpitData?.fetchedAt" class="mt-1 text-xs text-gray-500 dark:text-gray-400" data-testid="tech-debt-fetched-at">
              Refreshed {{ formatTimestamp(cockpitData.fetchedAt) }} · {{ cockpitData.clientCacheStatus === 'hit' ? 'saved session data' : cockpitData.cacheStatus === 'hit' ? 'cached Jira data' : cockpitData.cacheStatus === 'stale' ? 'stale Jira data' : 'live Jira data' }}
          </p>
          <p class="mt-2 max-w-2xl text-xs text-gray-500 dark:text-gray-400">
            Bug and vulnerability scores guide queue ordering and never override mandatory organizational security policy.
          </p>
          </div>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-wait disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            :disabled="cockpitLoading"
            data-testid="tech-debt-refresh"
            @click="loadIssues(true)"
          >
            <span aria-hidden="true">↻</span>
            {{ cockpitLoading ? 'Refreshing…' : 'Refresh' }}
          </button>
        </div>

        <div v-if="cockpitLoading && !cockpitData" class="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-5" aria-label="Loading cockpit summary">
          <div v-for="index in 5" :key="index" class="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-700" />
        </div>
        <div v-else class="grid gap-px bg-gray-200 sm:grid-cols-2 lg:grid-cols-5 dark:bg-gray-700" data-testid="tech-debt-summary">
          <div v-for="stat in summaryStats" :key="stat.label" class="bg-white px-5 py-4 dark:bg-gray-800">
            <p class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{{ stat.label }}</p>
            <p class="mt-1 text-2xl font-bold" :class="stat.color">{{ stat.value }}</p>
          </div>
        </div>
      </div>

      <div v-if="cockpitLoading && !cockpitData" class="grid gap-6 xl:grid-cols-2" data-testid="tech-debt-loading">
        <div v-for="pane in 2" :key="pane" class="space-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
          <div class="h-7 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          <div v-for="card in 3" :key="card" class="h-52 animate-pulse rounded-xl bg-white dark:bg-gray-800" />
        </div>
      </div>

      <div v-else-if="cockpitData" class="grid items-start gap-6 xl:grid-cols-2">
        <section class="overflow-hidden rounded-2xl border border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20" aria-labelledby="in-flight-heading">
          <header class="flex items-center justify-between gap-3 border-b border-blue-200 px-5 py-4 dark:border-blue-900">
            <div>
              <h3 id="in-flight-heading" class="font-bold text-gray-900 dark:text-gray-100">In-Flight Work</h3>
              <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Active Bugs and CVEs ordered by effective priority score</p>
            </div>
            <span class="rounded-full bg-blue-100 px-3 py-1 text-sm font-bold text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">{{ cockpitData.counts?.inFlight || 0 }}</span>
          </header>
          <div class="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2" data-testid="tech-debt-in-flight-pane">
            <TechDebtIssueCard v-for="issue in visibleInFlightIssues" :key="issue.key" :issue="issue" pane="in-flight" />
            <div v-if="!cockpitData.inFlight?.length" class="rounded-xl border border-dashed border-blue-200 bg-white px-5 py-10 text-center text-sm text-gray-500 sm:col-span-2 dark:border-blue-900 dark:bg-gray-800 dark:text-gray-400">
              No In Progress or Review issues match these components.
            </div>
            <button v-if="hasMoreInFlight" type="button" class="w-full rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 sm:col-span-2 dark:border-blue-800 dark:bg-gray-800 dark:text-blue-300 dark:hover:bg-gray-700" data-testid="tech-debt-in-flight-more" @click="visibleInFlight += PAGE_SIZE">
              Show more in-flight work
            </button>
          </div>
        </section>

        <section class="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/40" aria-labelledby="backlog-heading">
          <header class="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
            <div>
              <h3 id="backlog-heading" class="font-bold text-gray-900 dark:text-gray-100">Prioritized Backlog</h3>
              <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Bugs and CVEs ranked together by effective priority score</p>
            </div>
            <span class="rounded-full bg-gray-200 px-3 py-1 text-sm font-bold text-gray-800 dark:bg-gray-700 dark:text-gray-200">{{ cockpitData.counts?.backlog || 0 }}</span>
          </header>
          <div class="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2" data-testid="tech-debt-backlog-pane">
            <TechDebtIssueCard v-for="issue in visibleBacklogIssues" :key="issue.key" :issue="issue" :rank="issue.rank" pane="backlog" />
            <div v-if="!cockpitData.backlog?.length" class="rounded-xl border border-dashed border-gray-300 bg-white px-5 py-10 text-center text-sm text-gray-500 sm:col-span-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              No unresolved backlog issues match these components.
            </div>
            <button v-if="hasMoreBacklog" type="button" class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 sm:col-span-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700" data-testid="tech-debt-backlog-more" @click="visibleBacklog += PAGE_SIZE">
              Show more backlog
            </button>
          </div>
        </section>
      </div>
    </section>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { apiRequest } from '@shared/client/services/api'
import TechDebtIssueCard from '../components/TechDebtIssueCard.vue'
import TechDebtScoringRubricModal from '../components/TechDebtScoringRubricModal.vue'
import {
  readTechDebtIssueCache,
  techDebtIssueCacheKey,
  writeTechDebtIssueCache
} from '../services/techDebtIssueCache'

const PAGE_SIZE = 25
const componentOptions = ref([])
const selectedComponents = ref([])
const selectedRelease = ref('')
const selectedIssueType = ref('')
const selectedTriage = ref('')
const scoringRubricOpen = ref(false)
const componentMenuOpen = ref(false)
const componentFilterContainer = ref(null)
const componentsLoading = ref(false)
const componentsError = ref('')
const cockpitData = ref(null)
const cockpitLoading = ref(false)
const cockpitError = ref('')
const visibleInFlight = ref(PAGE_SIZE)
const visibleBacklog = ref(PAGE_SIZE)
let issueRequestId = 0

const componentFilterLabel = computed(() => {
  if (componentsLoading.value) return 'Loading components…'
  if (!selectedComponents.value.length) return 'All Components'
  if (selectedComponents.value.length === 1) return selectedComponents.value[0]
  return `${selectedComponents.value.length} components selected`
})

const selectedFilters = computed(() => {
  const filters = selectedComponents.value.map(function (name) {
    return { key: 'component:' + name, type: 'component', value: name, label: 'Component: ' + name }
  })
  if (selectedRelease.value) {
    filters.push({ key: 'release:' + selectedRelease.value, type: 'release', value: selectedRelease.value, label: 'Release: ' + selectedRelease.value })
  }
  if (selectedIssueType.value) {
    filters.push({
      key: 'issueType:' + selectedIssueType.value,
      type: 'issueType',
      value: selectedIssueType.value,
      label: selectedIssueType.value === 'Bug' ? 'Issue type: Bugs' : 'Issue type: CVE (Vulnerability)'
    })
  }
  if (selectedTriage.value === 'exceptions') {
    filters.push({ key: 'triage:exceptions', type: 'triage', value: 'exceptions', label: 'Triage: Needs Triage / Exceptions' })
  }
  return filters
})

const hasActiveFilters = computed(() => selectedFilters.value.length > 0)
const summaryStats = computed(function () {
  const counts = cockpitData.value?.counts || {}
  return [
    { label: 'Total', value: counts.total || 0, color: 'text-gray-900 dark:text-gray-100' },
    { label: 'In flight', value: counts.inFlight || 0, color: 'text-blue-700 dark:text-blue-300' },
    { label: 'Backlog', value: counts.backlog || 0, color: 'text-gray-700 dark:text-gray-200' },
    { label: 'Bugs', value: counts.bugs || 0, color: 'text-red-700 dark:text-red-300' },
    { label: 'Vulnerabilities', value: counts.vulnerabilities || 0, color: 'text-fuchsia-700 dark:text-fuchsia-300' }
  ]
})
const visibleInFlightIssues = computed(() => (cockpitData.value?.inFlight || []).slice(0, visibleInFlight.value))
const visibleBacklogIssues = computed(() => (cockpitData.value?.backlog || []).slice(0, visibleBacklog.value))
const hasMoreInFlight = computed(() => (cockpitData.value?.inFlight || []).length > visibleInFlight.value)
const hasMoreBacklog = computed(() => (cockpitData.value?.backlog || []).length > visibleBacklog.value)

function toggleComponent(name) {
  if (selectedComponents.value.includes(name)) {
    selectedComponents.value = selectedComponents.value.filter(function (item) { return item !== name })
  } else {
    selectedComponents.value = selectedComponents.value.concat(name)
  }
}

function removeFilter(filter) {
  if (filter.type === 'component') {
    selectedComponents.value = selectedComponents.value.filter(function (name) { return name !== filter.value })
  } else if (filter.type === 'release') {
    selectedRelease.value = ''
  } else if (filter.type === 'issueType') {
    selectedIssueType.value = ''
  } else if (filter.type === 'triage') {
    selectedTriage.value = ''
  }
}

function clearFilters() {
  selectedComponents.value = []
  selectedRelease.value = ''
  selectedIssueType.value = ''
  selectedTriage.value = ''
  componentMenuOpen.value = false
}

function closeComponentMenuOnOutsideClick(event) {
  if (
    componentMenuOpen.value &&
    componentFilterContainer.value &&
    !componentFilterContainer.value.contains(event.target)
  ) {
    componentMenuOpen.value = false
  }
}

function issuePath(refresh) {
  const params = new URLSearchParams()
  for (const component of selectedComponents.value) params.append('component', component)
  if (selectedIssueType.value) params.set('issueType', selectedIssueType.value)
  if (selectedTriage.value) params.set('triage', selectedTriage.value)
  if (refresh) params.set('refresh', 'true')
  return '/modules/releases/tech-debt/issues?' + params.toString()
}

function normalizeCockpitResponse(response, clientCacheStatus) {
  return {
    ...response,
    clientCacheStatus,
    counts: response?.counts || {},
    inFlight: Array.isArray(response?.inFlight) ? response.inFlight : [],
    backlog: Array.isArray(response?.backlog) ? response.backlog : []
  }
}

async function loadIssues(refresh) {
  const requestId = ++issueRequestId
  if (!selectedComponents.value.length) {
    cockpitData.value = null
    cockpitError.value = ''
    cockpitLoading.value = false
    return
  }

  const cacheKey = techDebtIssueCacheKey(
    selectedComponents.value,
    selectedIssueType.value,
    selectedTriage.value
  )
  const cached = refresh ? null : readTechDebtIssueCache(cacheKey)

  if (cached) {
    cockpitData.value = normalizeCockpitResponse(cached.data, 'hit')
    if (cached.fresh) {
      cockpitError.value = ''
      cockpitLoading.value = false
      visibleInFlight.value = PAGE_SIZE
      visibleBacklog.value = PAGE_SIZE
      return
    }
  }

  cockpitLoading.value = true
  cockpitError.value = ''
  visibleInFlight.value = PAGE_SIZE
  visibleBacklog.value = PAGE_SIZE
  if (!refresh && !cached) cockpitData.value = null

  try {
    const response = await apiRequest(issuePath(refresh))
    const normalizedResponse = normalizeCockpitResponse(response, 'network')
    writeTechDebtIssueCache(cacheKey, normalizedResponse)
    if (requestId !== issueRequestId) return
    cockpitData.value = normalizedResponse
  } catch (err) {
    if (requestId !== issueRequestId) return
    cockpitError.value = err && err.message ? err.message : 'Unable to load tech debt issues.'
    if (!refresh && !cached) cockpitData.value = null
  } finally {
    if (requestId === issueRequestId) cockpitLoading.value = false
  }
}

async function loadComponents() {
  componentsLoading.value = true
  componentsError.value = ''
  try {
    const response = await apiRequest('/modules/releases/tech-debt/components')
    componentOptions.value = Array.isArray(response && response.components)
      ? response.components.filter(function (component) { return component && component.name }).map(function (component) {
        return { id: String(component.id || component.name), name: String(component.name) }
      })
      : []
  } catch (err) {
    componentsError.value = err && err.message ? err.message : 'Unable to load Jira components.'
  } finally {
    componentsLoading.value = false
  }
}

function formatTimestamp(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'time unknown'
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

watch([selectedComponents, selectedIssueType, selectedTriage], function () {
  if (selectedIssueType.value === 'Bug' && selectedTriage.value) {
    selectedTriage.value = ''
    return
  }
  loadIssues(false)
})

onMounted(function () {
  loadComponents()
  document.addEventListener('click', closeComponentMenuOnOutsideClick)
})

onBeforeUnmount(function () {
  document.removeEventListener('click', closeComponentMenuOnOutsideClick)
})
</script>
