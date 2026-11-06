<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import {
  usePromotionGates,
  isPrProblem,
  prProblemReason,
  summarizePullRequests
} from '../composables/usePromotionGates'

const nav = inject('moduleNav', null)

const {
  loading,
  error,
  notFound,
  notConfigured,
  job,
  pullRequests,
  gates,
  issues,
  releaseBranches,
  loadLatest
} = usePromotionGates()

// --- Tabs ---

const TABS = [
  { id: 'latest', label: 'Latest job' },
  { id: 'branches', label: 'Release branches' }
]

const localTab = ref('latest')

const activeTab = computed(() => {
  const fromNav = nav && nav.params && nav.params.value ? nav.params.value.tab : null
  if (fromNav === 'branches') return 'branches'
  if (fromNav === 'latest') return 'latest'
  return localTab.value
})

function selectTab(tab) {
  localTab.value = tab
  if (nav && nav.updateParams) {
    nav.updateParams({ tab: tab === 'latest' ? undefined : tab })
  }
}

// --- Header card ---

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function stateBadgeClass(state) {
  if (state === 'MERGED') return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
  if (state === 'OPEN') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
}

// --- Gates ---

const GATE_LABELS = {
  'component-builds': 'Component builds',
  'early-gate-build': 'Early gate build',
  'early-gate-test': 'Early gate test'
}

function gateLabel(id) {
  return GATE_LABELS[id] || id
}

function statusBadgeClass(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'success' || s === 'succeeded' || s === 'passed') {
    return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
  }
  if (s === 'failed' || s === 'failure' || s === 'build-failure' || s === 'merge-failure') {
    return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
  }
  if (s === 'pending' || s === 'build-pending' || s === 'unknown') {
    return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
  }
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
}

function formatStatus(status) {
  const s = String(status || '').toLowerCase()
  if (!s) return 'unknown'
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const earlyGateBlocks = computed(() => {
  const earlyGate = (job.value && job.value.early_gate) || {}
  return [
    { key: 'build', label: 'Early gate build', data: earlyGate.build },
    { key: 'test', label: 'Early gate test', data: earlyGate.test }
  ]
})

// --- Components table ---

const repoFilter = ref('')
const statusFilter = ref('all')

const summary = computed(() => summarizePullRequests(pullRequests.value))

const filteredPullRequests = computed(() => {
  const query = repoFilter.value.trim().toLowerCase()
  return pullRequests.value.filter((pr) => {
    if (query && !String(pr.repo || '').toLowerCase().includes(query)) return false
    if (statusFilter.value === 'problems') return isPrProblem(pr)
    if (statusFilter.value === 'success') return !isPrProblem(pr)
    return true
  })
})

function runLinks(pr) {
  const runs = (pr['build-observations'] && pr['build-observations'].runs) || []
  return runs.filter((run) => run.url)
}

// --- Release branches ---

const branchRepoFilter = ref('')

const filteredReleaseBranches = computed(() => {
  const query = branchRepoFilter.value.trim().toLowerCase()
  if (!query) return releaseBranches.value
  return releaseBranches.value.filter((row) => row.repo.toLowerCase().includes(query))
})

function prNumberFromUrl(url) {
  const match = /\/pull\/(\d+)/.exec(url || '')
  return match ? `#${match[1]}` : 'PR'
}

onMounted(loadLatest)
</script>

<template>
  <div class="max-w-[1400px]">
    <!-- Header -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Promotion gates</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-3xl">
        Daily code promotion from main to stable for RHOAI component repositories. Each day a
        leader PR in
        <a
          href="https://github.com/red-hat-data-services/gated-artifacts-promoter"
          target="_blank"
          rel="noopener noreferrer"
          class="text-primary-600 dark:text-primary-400 hover:underline"
        >gated-artifacts-promoter</a>
        drives one child PR per repository; this page shows whether that promotion succeeded and
        what is blocking it.
      </p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-12 text-gray-500 dark:text-gray-400">
      Loading promotion gates…
    </div>

    <!-- Friendly empty/error states -->
    <div
      v-else-if="notFound || notConfigured"
      class="rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-6 py-10 text-center"
    >
      <p class="text-sm font-medium text-gray-900 dark:text-white">
        No promotion gates data yet
      </p>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        The page reads the AIPCC Dashboard API, and no job has been collected so far — is the
        dashboard collector configured?
      </p>
    </div>
    <div v-else-if="error" class="text-center py-12 text-sm text-red-600 dark:text-red-400">
      {{ error }}
    </div>

    <template v-else-if="job">
      <!-- Tabs -->
      <div class="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav class="flex gap-4 overflow-x-auto" role="tablist" aria-label="Promotion gates views">
          <button
            v-for="tab in TABS"
            :key="tab.id"
            type="button"
            role="tab"
            :aria-selected="activeTab === tab.id"
            class="py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors"
            :class="activeTab === tab.id
              ? 'border-gray-900 dark:border-gray-100 text-gray-900 dark:text-gray-100'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
            @click="selectTab(tab.id)"
          >{{ tab.label }}</button>
        </nav>
      </div>

      <!-- Tab: Latest job -->
      <div
        v-show="activeTab === 'latest'"
        role="tabpanel"
        aria-label="Latest job"
        class="space-y-8"
      >
        <!-- Leader PR header card -->
        <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-5 py-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div class="flex items-center gap-3 flex-wrap">
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                  <a
                    v-if="job.source_url"
                    :href="job.source_url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="hover:underline"
                  >Leader PR #{{ job.pr_number }}</a>
                  <template v-else>Leader PR #{{ job.pr_number }}</template>
                </h2>
                <span
                  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                  :class="stateBadgeClass(job.state)"
                >{{ job.state }}</span>
                <span
                  v-if="job.is_test"
                  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300"
                >Test run</span>
              </div>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Trigger <code class="text-xs">{{ job.trigger_id }}</code> ·
                created {{ formatDateTime(job.created_at) }}
                <template v-if="job.merged_at"> · merged {{ formatDateTime(job.merged_at) }}</template>
                <template v-else-if="job.closed_at"> · closed {{ formatDateTime(job.closed_at) }}</template>
              </p>
            </div>
            <p v-if="job.synced_at" class="text-xs text-gray-400 dark:text-gray-500">
              Data synced {{ formatDateTime(job.synced_at) }}
            </p>
          </div>
          <div v-if="job.labels && job.labels.length" class="mt-3 flex flex-wrap gap-2">
            <span
              v-for="label in job.labels"
              :key="label"
              class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
            >{{ label }}</span>
          </div>
        </div>

        <!-- Gate status cards -->
        <section>
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">Gates</h3>
          <div class="grid gap-4 sm:grid-cols-3">
            <div
              v-for="gate in gates"
              :key="gate.id"
              class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm font-medium text-gray-900 dark:text-white">{{ gateLabel(gate.id) }}</span>
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                  :class="statusBadgeClass(gate.status)"
                >{{ formatStatus(gate.status) }}</span>
              </div>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {{ gate.required ? 'Required' : 'Optional' }}
              </p>
            </div>
          </div>
        </section>

        <!-- Early gate build / test -->
        <section>
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">Early gate</h3>
          <div class="grid gap-4 sm:grid-cols-2">
            <div
              v-for="block in earlyGateBlocks"
              :key="block.key"
              class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm font-medium text-gray-900 dark:text-white">{{ block.label }}</span>
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                  :class="statusBadgeClass(block.data && block.data.status)"
                >{{ formatStatus(block.data && block.data.status) }}</span>
              </div>
              <template v-if="block.data && block.data.status && block.data.status !== 'unknown'">
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  <template v-if="block.data.ephemeral_branch">
                    Ephemeral branch <code class="text-xs">{{ block.data.ephemeral_branch }}</code>
                  </template>
                  <template v-if="block.data.updated_at">
                    {{ block.data.ephemeral_branch ? ' · ' : '' }}updated {{ formatDateTime(block.data.updated_at) }}
                  </template>
                </p>
                <div class="mt-2 flex flex-wrap gap-3 text-xs">
                  <a
                    v-if="block.data.pipeline_url"
                    :href="block.data.pipeline_url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-primary-600 dark:text-primary-400 hover:underline"
                  >PipelineRun</a>
                  <a
                    v-if="block.data.comment_url"
                    :href="block.data.comment_url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-primary-600 dark:text-primary-400 hover:underline"
                  >GitHub comment</a>
                </div>
              </template>
              <p v-else class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Not run yet
              </p>
            </div>
          </div>
        </section>

        <!-- Issues -->
        <section>
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            PR creation and auto-merge issues
          </h3>
          <div
            v-if="issues.length === 0"
            class="rounded-md bg-green-50 dark:bg-green-900/20 px-4 py-3 text-sm text-green-700 dark:text-green-300"
          >
            No PR creation or auto-merge issues — every child PR was created or updated and merged cleanly.
          </div>
          <div v-else class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
            <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
              <thead class="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Repo</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Reason</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Links</th>
                </tr>
              </thead>
              <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                <tr
                  v-for="issue in issues"
                  :key="issue.repo"
                  class="hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <td class="px-4 py-3 text-sm text-gray-900 dark:text-white">{{ issue.repo }}</td>
                  <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{{ issue.reason }}</td>
                  <td class="px-4 py-3 text-sm space-x-3 whitespace-nowrap">
                    <a
                      v-if="issue['pr-url']"
                      :href="issue['pr-url']"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-primary-600 dark:text-primary-400 hover:underline"
                    >PR</a>
                    <a
                      v-if="issue['workflow-url']"
                      :href="issue['workflow-url']"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-primary-600 dark:text-primary-400 hover:underline"
                    >Workflow</a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Components -->
        <section>
          <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Components</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              {{ summary.ok }} ok · {{ summary.failing }} failing · {{ summary.pending }} pending
            </p>
          </div>
          <div class="flex flex-wrap gap-3 mb-3">
            <input
              v-model="repoFilter"
              type="search"
              placeholder="Filter by repo"
              class="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
            />
            <select
              v-model="statusFilter"
              class="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
            >
              <option value="all">All statuses</option>
              <option value="problems">Problems only</option>
              <option value="success">Success only</option>
            </select>
          </div>
          <div class="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
            <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
              <thead class="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Repo</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Child PR</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Blocking reason</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Builds</th>
                </tr>
              </thead>
              <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                <tr
                  v-for="pr in filteredPullRequests"
                  :key="pr.repo"
                  class="hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{{ pr.repo }}</td>
                  <td class="px-4 py-3 text-sm">
                    <a
                      v-if="pr['pr-url']"
                      :href="pr['pr-url']"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-primary-600 dark:text-primary-400 hover:underline"
                    >{{ prNumberFromUrl(pr['pr-url']) }}</a>
                  </td>
                  <td class="px-4 py-3 text-sm">
                    <span
                      class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                      :class="statusBadgeClass(pr['pr-status'])"
                    >{{ formatStatus(pr['pr-status']) }}</span>
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    <template v-if="isPrProblem(pr)">{{ prProblemReason(pr) }}</template>
                    <template v-else>—</template>
                  </td>
                  <td class="px-4 py-3 text-sm">
                    <div class="flex flex-wrap gap-x-3 gap-y-1">
                      <a
                        v-for="run in runLinks(pr)"
                        :key="run.name"
                        :href="run.url"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-primary-600 dark:text-primary-400 hover:underline"
                      >{{ run.name }}</a>
                    </div>
                  </td>
                </tr>
                <tr v-if="filteredPullRequests.length === 0">
                  <td colspan="5" class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    No components match the current filters.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <!-- Tab: Release branches -->
      <div
        v-show="activeTab === 'branches'"
        role="tabpanel"
        aria-label="Release branches"
        class="space-y-4"
      >
        <p class="text-sm text-gray-500 dark:text-gray-400 max-w-3xl">
          One row per promoted repository. The diff link shows what is in main and has not been
          promoted to stable yet.
        </p>
        <div class="flex flex-wrap gap-3 mb-1">
          <input
            v-model="branchRepoFilter"
            type="search"
            placeholder="Filter by repo"
            class="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
          />
        </div>
        <div class="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
          <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
            <thead class="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Repo</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Child PR</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Target branch</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Diff</th>
              </tr>
            </thead>
            <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              <tr
                v-for="row in filteredReleaseBranches"
                :key="row.repo"
                class="hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{{ row.repo }}</td>
                <td class="px-4 py-3 text-sm">
                  <a
                    v-if="row.prUrl"
                    :href="row.prUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-primary-600 dark:text-primary-400 hover:underline"
                  >{{ prNumberFromUrl(row.prUrl) }}</a>
                  <span v-else class="text-gray-400 dark:text-gray-500 text-xs">{{ row.reason }}</span>
                </td>
                <td class="px-4 py-3 text-sm">
                  <span
                    v-if="row.prStatus"
                    class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                    :class="statusBadgeClass(row.prStatus)"
                  >{{ formatStatus(row.prStatus) }}</span>
                  <span v-else class="text-gray-400 dark:text-gray-500 text-xs">No child PR</span>
                </td>
                <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{{ row.targetBranch || 'stable' }}</td>
                <td class="px-4 py-3 text-sm">
                  <a
                    :href="row.diffUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-primary-600 dark:text-primary-400 hover:underline"
                  >{{ row.targetBranch || 'stable' }}…{{ row.sourceBranch || 'main' }}</a>
                </td>
              </tr>
              <tr v-if="filteredReleaseBranches.length === 0">
                <td colspan="5" class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  No repositories match the current filter.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>
