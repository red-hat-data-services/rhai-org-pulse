<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import {
  usePromotionGates,
  isPrProblem,
  isBlockingPr,
  prProblemReason,
  prStatus,
  promotionVerdict,
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

// --- Formatting ---

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function lower(value) {
  return String(value || '').toLowerCase()
}

/** `build-failure` → `Build failure`, `success` → `Success`. */
function statusLabel(status) {
  const s = lower(status)
  if (!s) return 'Unknown'
  if (s === 'succeeded' || s === 'passed') return 'Success'
  if (s === 'failure') return 'Failure'
  return s.replace(/[-_]+/g, ' ').replace(/^./, (c) => c.toUpperCase())
}

function stateBadgeClass(state) {
  const s = lower(state)
  if (s === 'merged') return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
  if (s === 'open') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
  if (s === 'closed') return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
}

function statusBadgeClass(status) {
  const s = lower(status)
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

function prNumberFromUrl(url) {
  const match = /\/pull\/(\d+)/.exec(url || '')
  return match ? `#${match[1]}` : 'PR'
}

const REPO_ORG = 'red-hat-data-services'

/** GitHub URL for a repo name, which may be a bare name or an owner/name pair. */
function repoUrl(repo) {
  if (!repo) return null
  const full = String(repo).includes('/') ? String(repo) : `${REPO_ORG}/${repo}`
  return `https://github.com/${full}`
}

// --- Hero ---

const VERDICTS = {
  blocked: {
    label: 'Promotion blocked',
    card: 'border-red-200 bg-red-50/60 dark:border-red-900/70 dark:bg-red-950/20',
    dot: 'bg-red-500'
  },
  progress: {
    label: 'Promotion in progress',
    card: 'border-amber-200 bg-amber-50/60 dark:border-amber-900/70 dark:bg-amber-950/20',
    dot: 'bg-amber-500'
  },
  complete: {
    label: 'Promotion complete',
    card: 'border-green-200 bg-green-50/60 dark:border-green-900/70 dark:bg-green-950/20',
    dot: 'bg-green-500'
  },
  empty: {
    label: 'No data',
    card: 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800',
    dot: 'bg-gray-400'
  }
}

const summary = computed(() => summarizePullRequests(pullRequests.value))
const verdict = computed(() => VERDICTS[promotionVerdict(job.value)] || VERDICTS.empty)

const chips = computed(() => [
  {
    key: 'ok',
    label: `${summary.value.ok} ok`,
    count: summary.value.ok,
    dot: 'bg-green-500',
    text: 'text-green-700 dark:text-green-300'
  },
  {
    key: 'blocked',
    label: `${summary.value.failing} blocked`,
    count: summary.value.failing,
    dot: 'bg-red-500',
    text: 'text-red-700 dark:text-red-300'
  },
  {
    key: 'pending',
    label: `${summary.value.pending} pending`,
    count: summary.value.pending,
    dot: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-300'
  }
])

const barSegments = computed(() => {
  const total = summary.value.total
  if (!total) return []
  return [
    { key: 'ok', width: (summary.value.ok / total) * 100, class: 'bg-green-500' },
    { key: 'blocked', width: (summary.value.failing / total) * 100, class: 'bg-red-500' },
    { key: 'pending', width: (summary.value.pending / total) * 100, class: 'bg-amber-400' }
  ].filter((segment) => segment.width > 0)
})

// --- Stage strip ---

const earlyGate = computed(() => (job.value && job.value.early_gate) || {})
const earlyBuild = computed(() => earlyGate.value.build || {})
const earlyTest = computed(() => earlyGate.value.test || {})
const earlyGateFailed = computed(() => lower(earlyBuild.value.status) === 'failed')

function gateState(status) {
  const s = lower(status)
  if (s === 'failed' || s === 'failure') return 'failed'
  if (s === 'succeeded' || s === 'success' || s === 'passed') return 'ok'
  return 'idle'
}

function gateValue(status) {
  const state = gateState(status)
  if (state === 'failed') return 'Failed'
  if (state === 'ok') return 'Passed'
  return 'Not run'
}

const stages = computed(() => {
  const prs = pullRequests.value
  const total = prs.length
  const withPr = prs.filter((pr) => pr['pr-url']).length
  const counts = summary.value
  const leaderState = lower(job.value && job.value.state)

  const buildState = counts.failing > 0 ? 'failed' : counts.pending > 0 ? 'pending' : 'ok'

  const mergeState = leaderState === 'merged'
    ? 'ok'
    : leaderState === 'closed'
      ? 'failed'
      : counts.total > 0 && counts.ok === counts.total
        ? 'pending'
        : 'failed'
  const mergeValue = leaderState === 'merged'
    ? 'Merged'
    : leaderState === 'closed'
      ? 'Leader PR closed'
      : counts.total > 0 && counts.ok === counts.total
        ? 'Waiting'
        : 'Blocked'

  return [
    {
      key: 'child-prs',
      label: 'Child PRs',
      value: withPr === total ? `${total} opened` : `${withPr} of ${total} opened`,
      state: withPr === total && total > 0 ? 'ok' : withPr === 0 ? 'failed' : 'pending',
      url: null,
      gateId: null
    },
    {
      key: 'builds',
      label: 'Builds',
      value: counts.total ? `${counts.ok} of ${counts.total} ok` : 'No builds',
      state: buildState,
      url: null,
      gateId: 'component-builds'
    },
    {
      key: 'early-build',
      label: 'Early gate build',
      value: gateValue(earlyBuild.value.status),
      state: gateState(earlyBuild.value.status),
      url: earlyBuild.value.pipeline_url || null,
      gateId: 'early-gate-build'
    },
    {
      key: 'early-test',
      label: 'Early gate test',
      value: gateValue(earlyTest.value.status),
      state: gateState(earlyTest.value.status),
      url: earlyTest.value.pipeline_url || null,
      gateId: 'early-gate-test'
    },
    {
      key: 'merge',
      label: 'Merge',
      value: mergeValue,
      state: mergeState,
      url: job.value && job.value.source_url ? job.value.source_url : null,
      gateId: null
    }
  ]
})

const firstProblemIndex = computed(() => stages.value.findIndex((stage) => stage.state === 'failed' || stage.state === 'pending'))

function stageDotClass(state) {
  if (state === 'failed') return 'bg-red-500'
  if (state === 'pending') return 'bg-amber-500'
  if (state === 'ok') return 'bg-green-500'
  return 'bg-gray-300 dark:bg-gray-600'
}

function stageHighlightClass(index, state) {
  if (index !== firstProblemIndex.value) return ''
  if (state === 'failed') return 'bg-red-50 ring-1 ring-inset ring-red-200 dark:bg-red-900/20 dark:ring-red-900'
  if (state === 'pending') return 'bg-amber-50 ring-1 ring-inset ring-amber-200 dark:bg-amber-900/20 dark:ring-amber-900'
  return ''
}

function gateHint(id) {
  if (!id) return null
  const gate = gates.value.find((item) => item.id === id)
  if (!gate) return null
  return gate.required ? 'required' : 'optional'
}

const earlyGateDetail = computed(() => {
  const build = earlyBuild.value
  const test = earlyTest.value
  return {
    branch: build.ephemeral_branch || null,
    updated: build.updated_at || test.updated_at || null,
    links: [
      { key: 'build-run', label: 'Build PipelineRun', url: build.pipeline_url },
      { key: 'build-comment', label: 'Build comment', url: build.comment_url },
      { key: 'test-run', label: 'Test PipelineRun', url: test.pipeline_url },
      { key: 'test-comment', label: 'Test comment', url: test.comment_url }
    ].filter((link) => link.url)
  }
})

// --- Components ---

const problemPullRequests = computed(() => pullRequests.value.filter(isPrProblem))

// Hard failures first, then anything still pending; alphabetical within a group.
const BLOCKING_RANK = { 'build-failure': 0, 'merge-failure': 1 }

function blockingRank(pr) {
  const status = prStatus(pr)
  return status in BLOCKING_RANK ? BLOCKING_RANK[status] : 2
}

const blockingPullRequests = computed(() =>
  [...problemPullRequests.value].sort(
    (a, b) => blockingRank(a) - blockingRank(b) || String(a.repo).localeCompare(String(b.repo))
  )
)

const passingPullRequests = computed(() =>
  pullRequests.value
    .filter((pr) => !isPrProblem(pr))
    .sort((a, b) => String(a.repo).localeCompare(String(b.repo)))
)

const MAX_RUN_LINKS = 3

/**
 * Failing PipelineRuns for a component row, capped so the row stays compact.
 * A single failure is labelled generically because the reason already names
 * the component; several failures keep their names so they can be told apart.
 */
function failures(pr) {
  const runs = (pr['build-observations'] && pr['build-observations'].runs) || []
  const failing = runs.filter((run) => run.url && !['success', 'succeeded'].includes(lower(run.status)))
  const single = failing.length === 1
  return {
    label: single ? 'Failing build' : 'Failing builds',
    hidden: Math.max(0, failing.length - MAX_RUN_LINKS),
    links: failing.slice(0, MAX_RUN_LINKS).map((run) => ({
      url: run.url,
      label: single ? 'PipelineRun' : run.component || run.name || 'Build',
      title: run.component || run.name || 'Build'
    }))
  }
}

/** Gate reasons sometimes carry an unrendered `${{ matrix.x }}`; hide it in the row. */
function displayReason(pr) {
  return prProblemReason(pr).replace(/\s*\(\$\{\{[^}]*\}\}\)\s*/g, ' ').replace(/\s+/g, ' ').trim()
}

// --- Release branches ---

const branchRepoFilter = ref('')

const filteredReleaseBranches = computed(() => {
  const query = branchRepoFilter.value.trim().toLowerCase()
  if (!query) return releaseBranches.value
  return releaseBranches.value.filter((row) => row.repo.toLowerCase().includes(query))
})

onMounted(loadLatest)
</script>

<template>
  <div class="max-w-[1400px]">
    <!-- Title -->
    <div class="flex flex-wrap items-end justify-between gap-3 mb-4">
      <div>
        <h1 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Promotion gates</h1>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          Daily promotion from main to stable, one child PR per component repo.
        </p>
      </div>
      <a
        href="https://github.com/red-hat-data-services/gated-artifacts-promoter"
        target="_blank"
        rel="noopener noreferrer"
        class="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
      >gated-artifacts-promoter ↗</a>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-12 text-sm text-gray-500 dark:text-gray-400">
      Loading promotion gates…
    </div>

    <!-- Friendly empty/error states -->
    <div
      v-else-if="notConfigured"
      class="rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-6 py-10 text-center"
    >
      <p class="text-sm font-medium text-gray-900 dark:text-white">
        Dashboard API not configured
      </p>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Set the dashboard API address in this page's settings to load promotion gates data.
      </p>
    </div>
    <div
      v-else-if="notFound"
      class="rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-6 py-10 text-center"
    >
      <p class="text-sm font-medium text-gray-900 dark:text-white">
        No promotion gates data yet
      </p>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        The dashboard API has no collected job — the collector may not have run yet.
      </p>
    </div>
    <div v-else-if="error" class="text-center py-12 text-sm text-red-600 dark:text-red-400">
      {{ error }}
    </div>

    <template v-else-if="job">
      <!-- Tabs -->
      <div class="border-b border-gray-200 dark:border-gray-700 mb-4">
        <nav class="flex gap-5" role="tablist" aria-label="Promotion gates views">
          <button
            v-for="tab in TABS"
            :key="tab.id"
            type="button"
            role="tab"
            :aria-selected="activeTab === tab.id"
            class="pb-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors"
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
        class="space-y-4"
      >
        <!-- Hero: the answer -->
        <section class="rounded-lg border px-5 py-5 sm:px-6" :class="verdict.card">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="min-w-0">
              <h2 class="flex items-center gap-2.5 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
                <span class="h-2.5 w-2.5 shrink-0 rounded-full" :class="verdict.dot" />
                {{ verdict.label }}
              </h2>
              <div class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-gray-600 dark:text-gray-300">
                <span>{{ formatDate(job.created_at) }}</span>
                <span class="text-gray-300 dark:text-gray-600">·</span>
                <a
                  v-if="job.source_url"
                  :href="job.source_url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="font-medium text-gray-900 dark:text-gray-100 hover:underline"
                >Leader PR #{{ job.pr_number }}</a>
                <template v-else>
                  <span class="font-medium text-gray-900 dark:text-gray-100">Leader PR #{{ job.pr_number }}</span>
                </template>
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                  :class="stateBadgeClass(job.state)"
                >{{ job.state }}</span>
                <span
                  v-if="job.is_test"
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300"
                >Test run</span>
              </div>
            </div>

            <template v-if="earlyGateFailed">
              <a
                v-if="earlyBuild.pipeline_url"
                :href="earlyBuild.pipeline_url"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-800 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60"
              >
                <span class="h-1.5 w-1.5 rounded-full bg-red-500" />
                Early gate build failed ↗
              </a>
              <span
                v-else
                class="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-800 dark:bg-red-900/40 dark:text-red-300"
              >
                <span class="h-1.5 w-1.5 rounded-full bg-red-500" />
                Early gate build failed
              </span>
            </template>
          </div>

          <!-- Progress -->
          <div class="mt-5">
            <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2">
              <p class="text-sm font-medium text-gray-900 dark:text-gray-100">
                {{ summary.ok }} of {{ summary.total }} components passed
              </p>
              <div class="flex items-center gap-1.5">
                <span
                  v-for="chip in chips"
                  :key="chip.key"
                  class="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-gray-200 dark:bg-gray-800 dark:ring-gray-700"
                  :class="[chip.text, chip.count === 0 ? 'opacity-50' : '']"
                >
                  <span class="h-1.5 w-1.5 rounded-full" :class="chip.dot" />
                  {{ chip.label }}
                </span>
              </div>
            </div>
            <div class="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-gray-200/80 dark:bg-gray-700">
              <div
                v-for="segment in barSegments"
                :key="segment.key"
                class="h-full"
                :class="segment.class"
                :style="{ width: `${segment.width}%` }"
              />
            </div>
            <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Every component is promoted together, only once all builds and gates pass — a
              single failing build blocks the whole batch.
            </p>
          </div>
        </section>

        <!-- Stage strip -->
        <section class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
          <div class="flex items-stretch gap-1.5 overflow-x-auto">
            <template v-for="(stage, index) in stages" :key="stage.key">
              <div
                class="min-w-[8.5rem] flex-1 rounded-md px-3 py-2"
                :class="stageHighlightClass(index, stage.state)"
              >
                <div class="flex items-center gap-1.5">
                  <span class="h-1.5 w-1.5 shrink-0 rounded-full" :class="stageDotClass(stage.state)" />
                  <span class="truncate text-xs font-medium text-gray-500 dark:text-gray-400">{{ stage.label }}</span>
                  <span
                    v-if="gateHint(stage.gateId)"
                    class="shrink-0 text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500"
                  >{{ gateHint(stage.gateId) }}</span>
                </div>
                <div class="mt-0.5 truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                  <a
                    v-if="stage.url"
                    :href="stage.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="hover:underline"
                  >{{ stage.value }}</a>
                  <template v-else>{{ stage.value }}</template>
                </div>
              </div>
              <span
                v-if="index < stages.length - 1"
                class="self-center text-xs text-gray-300 dark:text-gray-600"
                aria-hidden="true"
              >→</span>
            </template>
          </div>

          <p
            v-if="earlyGateDetail.branch || earlyGateDetail.updated || earlyGateDetail.links.length"
            class="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-gray-100 dark:border-gray-700 pt-2 text-xs text-gray-500 dark:text-gray-400"
          >
            <span class="font-medium text-gray-600 dark:text-gray-300">Early gate</span>
            <template v-if="earlyGateDetail.branch">
              <span class="text-gray-300 dark:text-gray-600">·</span>
              <span>branch <code class="text-[11px]">{{ earlyGateDetail.branch }}</code></span>
            </template>
            <template v-if="earlyGateDetail.updated">
              <span class="text-gray-300 dark:text-gray-600">·</span>
              <span>updated {{ formatDateTime(earlyGateDetail.updated) }}</span>
            </template>
            <template v-for="link in earlyGateDetail.links" :key="link.key">
              <span class="text-gray-300 dark:text-gray-600">·</span>
              <a
                :href="link.url"
                target="_blank"
                rel="noopener noreferrer"
                class="text-primary-600 dark:text-primary-400 hover:underline"
              >{{ link.label }}</a>
            </template>
          </p>
        </section>

        <!-- Blocking components -->
        <section v-if="problemPullRequests.length > 0" class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-700 px-4 py-3">
            <div class="flex items-center gap-2">
              <h2 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Blocking components</h2>
              <span class="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/40 dark:text-red-300">
                {{ problemPullRequests.length }}
              </span>
            </div>
          </div>

          <ul class="divide-y divide-gray-100 dark:divide-gray-700">
            <li
              v-for="pr in blockingPullRequests"
              :key="pr.repo"
              class="px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/40"
            >
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span
                  class="h-1.5 w-1.5 shrink-0 rounded-full"
                  :class="isBlockingPr(pr) ? 'bg-red-500' : isPrProblem(pr) ? 'bg-amber-500' : 'bg-green-500'"
                />
                <a
                  :href="repoUrl(pr.repo)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="w-56 shrink-0 truncate text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
                  :title="pr.repo"
                >{{ pr.repo }}</a>
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                  :class="statusBadgeClass(pr['pr-status'])"
                >{{ statusLabel(pr['pr-status']) }}</span>
                <span
                  class="min-w-0 flex-1 truncate text-xs text-gray-500 dark:text-gray-400"
                  :title="isPrProblem(pr) ? prProblemReason(pr) : ''"
                >
                  <template v-if="isPrProblem(pr)">{{ displayReason(pr) }}</template>
                  <template v-else>Ready to merge</template>
                </span>
                <a
                  v-if="pr['pr-url']"
                  :href="pr['pr-url']"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="shrink-0 whitespace-nowrap text-xs text-primary-600 dark:text-primary-400 hover:underline"
                >{{ prNumberFromUrl(pr['pr-url']) }}</a>
              </div>
              <div
                v-if="failures(pr).links.length"
                class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 pl-[1.15rem] text-xs text-gray-500 dark:text-gray-400"
              >
                <span>{{ failures(pr).label }}</span>
                <template v-for="run in failures(pr).links" :key="run.url">
                  <span class="text-gray-300 dark:text-gray-600">·</span>
                  <a
                    :href="run.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="max-w-[16rem] truncate text-primary-600 dark:text-primary-400 hover:underline"
                    :title="run.title"
                  >{{ run.label }}</a>
                </template>
                <span v-if="failures(pr).hidden" class="text-gray-400 dark:text-gray-500">+{{ failures(pr).hidden }} more</span>
              </div>
            </li>
          </ul>
        </section>

        <!-- Nothing blocking: one quiet line instead of a section -->
        <p
          v-else-if="summary.total > 0"
          class="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50/60 px-4 py-3 text-sm text-green-800 dark:border-green-900/70 dark:bg-green-950/20 dark:text-green-300"
        >
          <span class="h-1.5 w-1.5 rounded-full bg-green-500" />
          All {{ summary.total }} components passed — nothing is blocking the promotion.
        </p>

        <!-- Succeeded components -->
        <section
          v-if="passingPullRequests.length > 0"
          class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
        >
          <div class="flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 px-4 py-3">
            <h2 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Succeeded components</h2>
            <span class="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300">
              {{ passingPullRequests.length }}
            </span>
          </div>
          <ul class="divide-y divide-gray-100 dark:divide-gray-700">
            <li
              v-for="pr in passingPullRequests"
              :key="pr.repo"
              class="px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/40"
            >
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
                <a
                  :href="repoUrl(pr.repo)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="w-56 shrink-0 truncate text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
                  :title="pr.repo"
                >{{ pr.repo }}</a>
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                  :class="statusBadgeClass(pr['pr-status'])"
                >{{ statusLabel(pr['pr-status']) }}</span>
                <span class="min-w-0 flex-1 truncate text-xs text-gray-500 dark:text-gray-400">Ready to merge</span>
                <a
                  v-if="pr['pr-url']"
                  :href="pr['pr-url']"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="shrink-0 whitespace-nowrap text-xs text-primary-600 dark:text-primary-400 hover:underline"
                >{{ prNumberFromUrl(pr['pr-url']) }}</a>
              </div>
            </li>
          </ul>
        </section>

        <!-- PR creation / auto-merge issues: only when something went wrong -->
        <section
          v-if="issues.length > 0"
          class="rounded-lg border border-amber-200 bg-amber-50/60 dark:border-amber-900/70 dark:bg-amber-950/20"
        >
          <div class="flex items-center gap-2 border-b border-amber-200/70 dark:border-amber-900/70 px-4 py-3">
            <h2 class="text-sm font-semibold text-amber-900 dark:text-amber-200">PR creation and auto-merge issues</h2>
            <span class="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
              {{ issues.length }}
            </span>
          </div>
          <ul class="divide-y divide-amber-200/60 dark:divide-amber-900/60">
            <li
              v-for="issue in issues"
              :key="issue.repo"
              class="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5"
            >
              <a
                :href="repoUrl(issue.repo)"
                target="_blank"
                rel="noopener noreferrer"
                class="truncate text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
              >{{ issue.repo }}</a>
              <span class="min-w-0 flex-1 truncate text-xs text-gray-600 dark:text-gray-300" :title="issue.reason">{{ issue.reason }}</span>
              <span class="flex shrink-0 items-center gap-x-3 whitespace-nowrap text-xs">
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
              </span>
            </li>
          </ul>
        </section>

        <!-- Muted footer -->
        <footer class="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-xs text-gray-400 dark:text-gray-500">
          <span v-if="job.synced_at">Data synced {{ formatDateTime(job.synced_at) }}</span>
          <span v-if="job.synced_at" class="text-gray-300 dark:text-gray-600">·</span>
          <span>Trigger <code class="text-[11px]">{{ job.trigger_id }}</code></span>
        </footer>
      </div>

      <!-- Tab: Release branches -->
      <div
        v-show="activeTab === 'branches'"
        role="tabpanel"
        aria-label="Release branches"
      >
        <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div class="flex items-baseline gap-2">
              <h2 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Release branches</h2>
              <span class="text-xs text-gray-500 dark:text-gray-400">{{ releaseBranches.length }} repositories</span>
            </div>
            <input
              v-model="branchRepoFilter"
              type="search"
              placeholder="Filter by repo"
              class="w-48 px-2.5 py-1 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div class="overflow-x-auto border-t border-gray-100 dark:border-gray-700">
            <table class="min-w-full divide-y divide-gray-100 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Repo</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Child PR</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">PR state</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Compare</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
                <tr
                  v-for="row in filteredReleaseBranches"
                  :key="row.repo"
                  class="hover:bg-gray-50 dark:hover:bg-gray-700/40"
                >
                  <td class="px-4 py-2 text-sm font-medium">
                    <a
                      :href="repoUrl(row.repo)"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-primary-600 dark:text-primary-400 hover:underline"
                    >{{ row.repo }}</a>
                  </td>
                  <td class="px-4 py-2 text-sm">
                    <a
                      v-if="row.prUrl"
                      :href="row.prUrl"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-primary-600 dark:text-primary-400 hover:underline"
                    >{{ prNumberFromUrl(row.prUrl) }}</a>
                    <span v-else class="text-xs text-gray-400 dark:text-gray-500">{{ row.reason || 'No child PR' }}</span>
                  </td>
                  <td class="px-4 py-2 text-sm">
                    <span
                      v-if="row.prStatus"
                      class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                      :class="statusBadgeClass(row.prStatus)"
                    >{{ statusLabel(row.prStatus) }}</span>
                    <span v-else class="text-xs text-gray-400 dark:text-gray-500">No child PR</span>
                  </td>
                  <td class="px-4 py-2 text-sm">
                    <a
                      :href="row.diffUrl"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-primary-600 dark:text-primary-400 hover:underline"
                    >{{ row.sourceBranch || 'main' }} → {{ row.targetBranch || 'stable' }}</a>
                  </td>
                </tr>
                <tr v-if="filteredReleaseBranches.length === 0">
                  <td colspan="4" class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    No repositories match the current filter.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="border-t border-gray-100 dark:border-gray-700 px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
            Compare shows what is in main and not yet in stable.
          </p>
        </div>
      </div>
    </template>
  </div>
</template>
