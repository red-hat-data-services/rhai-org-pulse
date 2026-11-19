<script setup>
import { ref, computed, onMounted, inject, watch } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { useChartTheme } from '../composables/useChartTheme.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)
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

// Early-gate test results and deployment health live in the separate
// deployment-health Org Pulse instance; keep the address here for one edit.
const DEPLOYMENT_HEALTH_URL =
  'https://team-tracker.apps.int.spoke.prod.us-west-2.aws.paas.redhat.com/#/system-health/test-execution?tab=gates&source=promotion-gate-tests'

const {
  loading,
  error,
  notFound,
  notConfigured,
  job,
  pullRequests,
  gates,
  repoLinks,
  issues,
  summary: trendSummary,
  summaryLoading,
  summaryError,
  loadSummary,
  releaseBranches,
  loadLatest
} = usePromotionGates()

// --- Tabs ---

const TABS = [
  { id: 'latest', label: 'Latest job' },
  { id: 'branches', label: 'Release branches' },
  { id: 'trends', label: 'Trends' }
]

const localTab = ref('latest')

const activeTab = computed(() => {
  const fromNav = nav && nav.params && nav.params.value ? nav.params.value.tab : null
  if (fromNav === 'branches') return 'branches'
  if (fromNav === 'trends') return 'trends'
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


// --- Trends ---

const TREND_PERIODS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' }
]

const trendDays = ref(30)

const trendRuns = computed(() => (trendSummary.value && trendSummary.value.runs) || [])
const trendComponents = computed(() => (trendSummary.value && trendSummary.value.components) || [])
const trendTotals = computed(
  () => (trendSummary.value && trendSummary.value.totals) || { runs: 0, runs_all_passed: 0, components: 0, passed: 0, failed: 0, blocked: 0, creator_issues: 0 }
)

const CLASS_BAR = {
  build_failure: 'bg-red-500',
  build_pending: 'bg-amber-400',
  merge_failure: 'bg-orange-400',
  creator_issue: 'bg-sky-400'
}

const CLASS_TINT = {
  build_failure: 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  build_pending: 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  merge_failure: 'bg-orange-50 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  creator_issue: 'bg-sky-50 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300'
}

const CLASS_LABEL = {
  build_failure: 'Build failure',
  build_pending: 'Build pending',
  merge_failure: 'Merge conflict',
  creator_issue: 'PR creation'
}

/** Plain-language reason behind the Promoted check mark. */
function promotedReason(run) {
  if (run.all_passed) {
    return 'Every component passed, no PR-creation failures, and all required gates succeeded'
  }
  const reasons = []
  if (run.state && run.state !== 'MERGED') reasons.push(`state is ${run.state}`)
  if (run.failed) reasons.push(`${run.failed} component${run.failed === 1 ? '' : 's'} blocked`)
  if (run.pending) reasons.push(`${run.pending} still building`)
  if (run.creator_issues) {
    reasons.push(`${run.creator_issues} PR-creation failure${run.creator_issues === 1 ? '' : 's'}`)
  }
  if (run.gates_passed === false) reasons.push('a required promotion gate did not succeed')
  return reasons.length ? `Not promoted: ${reasons.join(', ')}` : 'Not promoted'
}

function pct(part, whole) {
  if (!whole) return 0
  return Math.round((part / whole) * 1000) / 10
}

const averageBlocksPerRun = computed(() => {
  const runs = trendTotals.value.runs
  if (!runs) return 0
  return Math.round((trendTotals.value.failed / runs) * 10) / 10
})

function selectPeriod(days) {
  trendDays.value = days
  loadSummary(days)
}

const summaryQuery = computed(() => `days=${trendDays.value}`)

function loadTrends() {
  if (!trendSummary.value) loadSummary(trendDays.value)
}

// Load the aggregate the first time the tab is opened.
watch(
  activeTab,
  (tab) => {
    if (tab === 'trends') loadTrends()
  },
  { immediate: true }
)


const { textColor: chartTextColor, gridColor: chartGridColor } = useChartTheme()

/** Owner filter for the failure-rate chart: '' plots all components. */
const chartRepoFilter = ref('')

const chartRepoOptions = computed(() =>
  trendComponents.value.map((row) => row.repo).sort((a, b) => a.localeCompare(b))
)

// A period switch can shrink the component list; drop a selection that no
// longer exists so the chart never plots a repo with no data.
watch(chartRepoOptions, (repos) => {
  if (chartRepoFilter.value && !repos.includes(chartRepoFilter.value)) {
    chartRepoFilter.value = ''
  }
})

/** One run, one repo: 100 when it blocked the batch, 0 when it passed,
 * null when it was absent or still building (no point plotted). */
function repoBlockedValue(run, repo) {
  const entry = (run.repos || []).find((item) => item.repo === repo)
  if (!entry || entry.class === 'build_pending') return null
  return entry.class ? 100 : 0
}

/** Share of blocked components per run — the "how often does it fail" chart. */
const failureRateChart = computed(() => {
  const labels = trendRuns.value.map((run) => shortDate(run.date))
  const repo = chartRepoFilter.value
  if (repo) {
    return {
      labels,
      datasets: [
        {
          label: `Blocked — ${repo}`,
          data: trendRuns.value.map((run) => repoBlockedValue(run, repo)),
          borderColor: 'rgb(239, 68, 68)',
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          pointBackgroundColor: 'rgb(239, 68, 68)',
          borderWidth: 2,
          pointRadius: 3,
          fill: true,
          stepped: true,
          spanGaps: false
        }
      ]
    }
  }
  return {
    labels,
    datasets: [
      {
        label: 'Blocked components',
        data: trendRuns.value.map((run) => (run.components ? pct(run.failed, run.components) : null)),
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        pointBackgroundColor: 'rgb(239, 68, 68)',
        borderWidth: 2,
        pointRadius: 3,
        fill: true,
        tension: 0.3,
        spanGaps: true
      },
      {
        label: 'Fully promoted',
        data: trendRuns.value.map((run) => (run.all_passed ? 100 : 0)),
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        pointBackgroundColor: 'rgb(16, 185, 129)',
        borderWidth: 1,
        pointRadius: 2,
        stepped: true,
        fill: false,
        spanGaps: true
      }
    ]
  }
})

const failureRateOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'bottom',
      labels: { color: chartTextColor.value, boxWidth: 10, boxHeight: 10, font: { size: 10 } }
    },
    tooltip: {
      callbacks: {
        label: (item) => {
          const run = trendRuns.value[item.dataIndex]
          if (chartRepoFilter.value) {
            return item.raw === 100
              ? `Blocked (${shortDate(run && run.date)})`
              : `Passed (${shortDate(run && run.date)})`
          }
          if (item.dataset.label === 'Fully promoted') {
            return run && run.all_passed
              ? `Fully promoted (${shortDate(run.date)})`
              : `Not fully promoted (${shortDate(run && run.date)})`
          }
          if (!run) return `${item.formattedValue}% blocked`
          const attempts = run.attempts > 1 ? ` · ${run.attempts} attempts` : ''
          const pending = run.pending ? `, ${run.pending} still building` : ''
          return `${item.formattedValue}% failed — ${run.failed} of ${run.components} (PR #${run.pr_number}${attempts}${pending})`
        }
      }
    }
  },
  scales: {
    x: {
      ticks: { color: chartTextColor.value, font: { size: 9 }, maxRotation: 0, maxTicksLimit: 12 },
      grid: { display: false }
    },
    y: {
      beginAtZero: true,
      max: 100,
      ticks: { color: chartTextColor.value, font: { size: 10 }, callback: (value) => `${value}%` },
      grid: { color: chartGridColor.value },
      title: chartRepoFilter.value
        ? { display: true, text: `Blocked vs passed — ${chartRepoFilter.value}`, color: chartTextColor.value, font: { size: 10 } }
        : { display: false }
    }
  }
}))

function shortDate(iso) {
  if (!iso) return '—'
  const [, month, day] = iso.split('-')
  return `${month}/${day}`
}

/** Abbreviated weekday from an ISO date, computed in UTC so it never drifts. */
function weekday(iso) {
  if (!iso) return ''
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return ''
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
}

/**
 * Longer windows shrink each day to a single dot, so 30 or 90 days stay one
 * readable grid instead of a wall of labels.
 */
const compactHeatmap = computed(() => trendDays.value > 7)

/** Month spans for the compact header, one per consecutive month of runs. */
const heatmapMonths = computed(() => {
  const groups = []
  for (const run of trendRuns.value) {
    const [year, month] = (run.date || '').split('-')
    if (!year || !month) continue
    const key = `${year}-${month}`
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.count += 1
    else groups.push({ key, label: monthName(month), count: 1 })
  }
  return groups
})

function monthName(month) {
  return [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ][Number(month) - 1] || ''
}

function dayOfMonth(iso) {
  if (!iso) return ''
  return String(Number(iso.split('-')[2]))
}

const CLASS_SOFT = {
  build_failure: 'bg-red-300/80 dark:bg-red-800/90',
  build_pending: 'bg-amber-300/80 dark:bg-amber-800/90',
  merge_failure: 'bg-orange-300/80 dark:bg-orange-800/90',
  creator_issue: 'bg-sky-300/80 dark:bg-sky-800/90'
}

/** Soft fill for the compact grid: class, passed, or not in the run. */
function fillClass(cell) {
  if (!cell.seen) return 'bg-gray-300/80 dark:bg-gray-700/90'
  return cell.class ? CLASS_SOFT[cell.class] || 'bg-gray-200' : 'bg-emerald-300/80 dark:bg-emerald-800/90'
}

/**
 * Repos blocking most often, one cell per run: the class that blocked it, a
 * green cell when it took part and passed, blank when it was not in that run.
 * Cells for a failed repo link to the Jira the GAP bot filed for it.
 */
const heatmapRows = computed(() => {
  const runs = trendRuns.value
  const rows = trendComponents.value.slice(0, 12).map((row) => {
    const cells = runs.map((run) => {
      const entry = (run.repos || []).find((repo) => repo.repo === row.repo)
      if (!entry) {
        return {
          pr: run.pr_number,
          class: null,
          seen: false,
          label: '—',
          tint: 'bg-gray-50 text-gray-400 dark:bg-gray-700/40 dark:text-gray-500',
          title: `not in PR #${run.pr_number}`,
          link: null,
          key: ''
        }
      }
      if (!entry.class) {
        return {
          pr: run.pr_number,
          class: null,
          seen: true,
          label: 'Passed',
          tint: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
          title: `passed in PR #${run.pr_number}`,
          link: null,
          key: ''
        }
      }
      // Jira links exist only for repos that actually failed, not pending ones.
      // A repo can carry several tickets (one per scope); the first opens the
      // cell, the tooltip lists them all.
      const urls = entry.class !== 'build_pending' ? (run.links || {})[row.repo] || [] : []
      const link = urls[0] || null
      const keys = urls.map(jiraKeyFromUrl).filter(Boolean)
      let title = `${CLASS_LABEL[entry.class] || entry.class} in PR #${run.pr_number}`
      if (keys.length) title += ` · ${keys.join(', ')}`
      return {
        pr: run.pr_number,
        class: entry.class,
        seen: true,
        label: CLASS_LABEL[entry.class] || entry.class,
        tint: CLASS_TINT[entry.class] || 'bg-gray-50 text-gray-700 dark:bg-gray-700/40 dark:text-gray-300',
        title,
        link,
        key: keys[0] || ''
      }
    })
    const seen = cells.filter((cell) => cell.seen).length
    return { repo: row.repo, blocks: row.blocks, seen, cells }
  })
  // The rows are chosen by block count, but shown alphabetically so an owner
  // can find their component by name instead of scanning a ranking.
  return rows.sort((a, b) => a.repo.localeCompare(b.repo))
})

/** Jira issue key from a browse URL, e.g. RHAI-123 from .../browse/RHAI-123. */
function jiraKeyFromUrl(url) {
  const key = String(url).split('?')[0].split('/').pop() || ''
  return /^[A-Z][A-Z0-9]*-\d+$/.test(key) ? key : ''
}

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

/**
 * Failing PipelineRuns for a component row, capped so the row stays compact.
 * A single failure is labelled generically because the reason already names
 * the component; several failures keep their names so they can be told apart.
 */
// Lines shown per blocking repo before the rest collapse into a count.
const MAX_COMPONENT_LINES = 4

function failingBuilds(pr) {
  const runs = (pr['build-observations'] && pr['build-observations'].runs) || []
  return runs
    // any non-success run blocks the batch, including "missing" ones that
    // carry no PipelineRun URL yet
    .filter((run) => !['success', 'succeeded'].includes(lower(run.status)))
    .map((run) => ({
      url: run.url || '',
      component: run.component || run.name || 'Build',
      reason: run.reason || run.status || 'failed'
    }))
}

/**
 * Gate reason for rows with no build list (merge feasibility, lookup
 * problems); when builds failed, the per-component lines carry the detail.
 */
function problemSummary(pr) {
  return failingBuilds(pr).length ? '' : displayReason(pr)
}

/** The bot sometimes writes a bare scope ("feasibility", "odh-kserve") where
 * a run carries the versioned component name ("odh-kserve-agent-v3-7-ea-1"). */
function labelMatches(label, component) {
  if (!label || !component) return false
  return label === component || component.startsWith(`${label}-`)
}

/**
 * One line per component that matters, pairing its Jira with its build state:
 * failed builds first, then builds flagged by a Jira that now pass, then
 * Jiras whose component has no build in this run.
 */
function failureEntries(pr) {
  const builds = failingBuilds(pr)
  const links = (repoLinks.value[pr.repo] && repoLinks.value[pr.repo].jira) || []
  const runs = (pr['build-observations'] && pr['build-observations'].runs) || []
  const runFor = (label) =>
    runs.find((run) => labelMatches(label, run.component || run.name)) || null

  const entries = []
  const used = new Set()
  for (const build of builds) {
    const jira = links.find((link) => labelMatches(link.label, build.component)) || null
    if (jira) used.add(jira)
    entries.push({ key: `build:${entries.length}:${build.component}`, component: build.component, url: build.url, reason: build.reason, jira, state: 'failed' })
  }
  for (const jira of links) {
    if (used.has(jira)) continue
    const component = jira.label || ''
    const status = component ? lower((runFor(component) || {}).status) || null : null
    entries.push({
      key: `jira:${jira.key}:${component}`,
      component: component || 'no component in the Jira link',
      url: null,
      reason: status === 'success' ? 'build succeeded' : status || 'no build in this run',
      jira,
      state: status === 'success' ? 'recovered' : 'unlinked'
    })
  }
  return entries
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
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
        <a
          :href="DEPLOYMENT_HEALTH_URL"
          target="_blank"
          rel="noopener noreferrer"
          class="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
        >RHOAI Deployment Health ↗</a>
        <a
          href="https://github.com/red-hat-data-services/gated-artifacts-promoter"
          target="_blank"
          rel="noopener noreferrer"
          class="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
        >gated-artifacts-promoter ↗</a>
      </div>
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
                  <template v-if="isPrProblem(pr)">{{ problemSummary(pr) }}</template>
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
                v-if="failureEntries(pr).length"
                class="mt-1 space-y-0.5 pl-[1.15rem] text-xs text-gray-500 dark:text-gray-400"
              >
                <div
                  v-for="entry in failureEntries(pr).slice(0, MAX_COMPONENT_LINES)"
                  :key="entry.key"
                  class="flex flex-wrap items-baseline gap-x-2"
                >
                  <a
                    v-if="entry.jira"
                    :href="entry.jira.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="group relative inline-flex items-center rounded-md bg-blue-50 px-1.5 py-0.5 font-medium text-blue-700 ring-1 ring-inset ring-blue-200 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-800 dark:hover:bg-blue-900/50"
                  >
                    {{ entry.jira.key }}
                    <span
                      v-if="entry.jira.label"
                      role="tooltip"
                      class="pointer-events-none absolute bottom-full left-0 z-20 mb-1 hidden max-w-[22rem] truncate rounded bg-gray-900 px-2 py-1 text-[11px] font-normal text-white shadow-lg group-hover:block dark:bg-gray-700"
                    >{{ entry.jira.label }}</span>
                  </a>
                  <a
                    v-if="entry.url"
                    :href="entry.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="max-w-[22rem] truncate text-primary-600 dark:text-primary-400 hover:underline"
                    :title="entry.component"
                  >{{ entry.component }}</a>
                  <span v-else class="max-w-[22rem] truncate text-gray-600 dark:text-gray-300" :title="entry.component">{{ entry.component }}</span>
                  <span class="text-gray-300 dark:text-gray-600">·</span>
                  <span
                    class="truncate"
                    :class="entry.state === 'recovered' ? 'text-green-700 dark:text-green-400' : 'text-gray-600 dark:text-gray-300'"
                  >{{ entry.reason }}</span>
                </div>
                <div
                  v-if="failureEntries(pr).length > MAX_COMPONENT_LINES"
                  class="text-gray-400 dark:text-gray-500"
                  :title="failureEntries(pr).slice(MAX_COMPONENT_LINES).map((entry) => entry.component).join(', ')"
                >+{{ failureEntries(pr).length - MAX_COMPONENT_LINES }} more blocked components</div>
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

      <!-- Trends -->
      <div
        v-show="activeTab === 'trends'"
        role="tabpanel"
        aria-label="Trends"
        class="space-y-4"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-1.5">
            <button
              v-for="period in TREND_PERIODS"
              :key="period.days"
              type="button"
              class="rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset transition-colors"
              :class="trendDays === period.days
                ? 'bg-primary-600 text-white ring-primary-600'
                : 'bg-white text-gray-600 ring-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700'"
              @click="selectPeriod(period.days)"
            >{{ period.label }}</button>
          </div>
          <div class="flex items-center gap-3 text-xs">
            <a
              :href="`/api/modules/system-health/promotion-gates/summary?${summaryQuery}&format=csv`"
              class="font-medium text-primary-600 dark:text-primary-400 hover:underline"
            >Export CSV ↓</a>
            <a
              :href="`/api/modules/system-health/promotion-gates/summary?${summaryQuery}`"
              target="_blank"
              rel="noopener noreferrer"
              class="font-medium text-primary-600 dark:text-primary-400 hover:underline"
            >JSON ↗</a>
          </div>
        </div>

        <p v-if="summaryLoading" class="py-8 text-center text-sm text-gray-500 dark:text-gray-400">Loading history…</p>
        <p v-else-if="summaryError" class="py-8 text-center text-sm text-red-600 dark:text-red-400">{{ summaryError }}</p>
        <p v-else-if="!trendRuns.length" class="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
          No runs recorded in this period yet.
        </p>

        <template v-else>
          <div class="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <div class="rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
              <p class="text-xs text-gray-500 dark:text-gray-400">Promotion days</p>
              <p class="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{{ trendTotals.runs }}</p>
              <p class="text-[11px] text-gray-500 dark:text-gray-400">{{ trendDays }} day window</p>
            </div>
            <div class="rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
              <p class="text-xs text-gray-500 dark:text-gray-400">Failures per day</p>
              <p class="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {{ averageBlocksPerRun }}
                <span class="text-sm font-normal text-gray-500 dark:text-gray-400">components</span>
              </p>
              <p class="text-[11px] text-gray-500 dark:text-gray-400">across {{ trendRuns.length }} days</p>
              <p v-if="trendTotals.creator_issues" class="text-[11px] text-orange-700 dark:text-orange-300">
                plus {{ trendTotals.creator_issues }} PR creation failure{{ trendTotals.creator_issues === 1 ? '' : 's' }}
              </p>
            </div>
            <div class="rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
              <p class="text-xs text-gray-500 dark:text-gray-400">Fully promoted</p>
              <p class="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {{ trendTotals.runs_all_passed }} of {{ trendTotals.runs }}
                <span class="text-sm font-normal text-gray-500 dark:text-gray-400">runs · {{ pct(trendTotals.runs_all_passed, trendTotals.runs) }}%</span>
              </p>
              <p v-if="!trendTotals.runs_all_passed" class="text-[11px] text-gray-500 dark:text-gray-400">no successful run yet</p>
            </div>
          </div>

          <section class="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-700">
              <div>
                <h2 class="text-sm font-semibold text-gray-900 dark:text-gray-100">How often does promotion fail?</h2>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  Share of each day's components whose build or merge failed, from the attempt that carried the batch.
                  Components still building are not counted as failures. 100% means nothing was promoted.
                </p>
              </div>
              <label class="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                Component
                <select
                  v-model="chartRepoFilter"
                  class="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  aria-label="Filter the chart by component"
                >
                  <option value="">All components</option>
                  <option v-for="repo in chartRepoOptions" :key="repo" :value="repo">{{ repo }}</option>
                </select>
              </label>
            </div>
            <div class="h-56 px-2 py-3">
              <Line :data="failureRateChart" :options="failureRateOptions" />
            </div>
          </section>

          <section class="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <div class="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-700">
              <div>
                <h2 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Promotion history - frequent blockers</h2>
              </div>
              <div class="flex flex-wrap items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400">
                <span class="inline-flex items-center gap-1"><span class="h-2 w-2 rounded-sm bg-red-500" />Build failure</span>
                <span class="inline-flex items-center gap-1"><span class="h-2 w-2 rounded-sm bg-amber-400" />Build pending</span>
                <span class="inline-flex items-center gap-1"><span class="h-2 w-2 rounded-sm bg-orange-400" />Merge conflict</span>
                <span class="inline-flex items-center gap-1"><span class="h-2 w-2 rounded-sm bg-emerald-400" />Passed</span>
                <span class="inline-flex items-center gap-1"><span class="h-2 w-2 rounded-sm bg-gray-200 dark:bg-gray-600" />Not in run</span>
              </div>
            </div>
            <div class="overflow-x-auto px-4 py-3">
              <table class="min-w-full border-separate border-spacing-0.5 text-xs">
                <thead>
                  <template v-if="compactHeatmap">
                    <tr>
                      <th rowspan="2" class="sticky left-0 bg-white px-2 py-1 text-left font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">Repository</th>
                      <th
                        v-for="group in heatmapMonths"
                        :key="group.key"
                        :colspan="group.count"
                        class="border-b border-gray-100 px-1 py-1 text-center text-[11px] font-medium text-gray-500 dark:border-gray-700 dark:text-gray-400"
                      >{{ group.label }}</th>
                      <th rowspan="2" class="px-2 py-1 text-right font-medium text-gray-500 dark:text-gray-400">Failed</th>
                    </tr>
                    <tr>
                      <th
                        v-for="run in trendRuns"
                        :key="run.pr_number"
                        class="min-w-[1.1rem] px-0.5 py-1 text-center text-[10px] font-normal text-gray-400 dark:text-gray-500"
                        :title="`Leader PR #${run.pr_number}`"
                      >{{ dayOfMonth(run.date) }}</th>
                    </tr>
                  </template>
                  <tr v-else>
                    <th class="sticky left-0 bg-white px-2 py-1 text-left font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">Repository</th>
                    <th
                      v-for="run in trendRuns"
                      :key="run.pr_number"
                      class="px-1 py-1 text-center font-medium text-gray-400 dark:text-gray-500"
                      :title="`Leader PR #${run.pr_number}`"
                    >{{ weekday(run.date) }} {{ shortDate(run.date) }}</th>
                    <th class="px-2 py-1 text-right font-medium text-gray-500 dark:text-gray-400">Failed</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in heatmapRows" :key="row.repo">
                    <td class="sticky left-0 max-w-[14rem] truncate bg-white px-2 py-1 dark:bg-gray-800">
                      <a
                        :href="repoUrl(row.repo)"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-primary-600 dark:text-primary-400 hover:underline"
                        :title="row.repo"
                      >{{ row.repo }}</a>
                    </td>
                    <td v-for="cell in row.cells" :key="`${row.repo}-${cell.pr}`" class="px-0.5 py-0.5">
                      <template v-if="compactHeatmap">
                        <a
                          v-if="cell.link"
                          :href="cell.link"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="flex h-5 min-w-[1.1rem] items-center justify-center rounded hover:ring-1 hover:ring-gray-300 dark:hover:ring-gray-500"
                          :title="cell.title"
                          :aria-label="cell.title"
                        >
                          <span class="h-4 w-5 rounded" :class="fillClass(cell)" />
                        </a>
                        <div
                          v-else
                          role="img"
                          class="flex h-5 min-w-[1.1rem] items-center justify-center"
                          :title="cell.title"
                          :aria-label="cell.title"
                        >
                          <span class="h-4 w-5 rounded" :class="fillClass(cell)" />
                        </div>
                      </template>
                      <div
                        v-else
                        class="flex h-7 w-40 items-center justify-center gap-0.5 rounded px-0.5 text-[11px] font-medium"
                        :class="cell.tint"
                        :title="cell.title"
                        :aria-label="cell.title"
                      >
                        <span
                          v-if="cell.class"
                          class="h-1.5 w-1.5 shrink-0 rounded-full"
                          :class="CLASS_BAR[cell.class]"
                        />
                        <span class="min-w-0 truncate">{{ cell.label }}</span>
                        <span v-if="cell.key" class="shrink-0 text-gray-400 dark:text-gray-500">-</span>
                        <a
                          v-if="cell.key"
                          :href="cell.link"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="shrink-0 text-[10px] leading-none underline decoration-dotted underline-offset-2 hover:text-gray-900 dark:hover:text-gray-100"
                          :title="`Open ${cell.key} in Jira`"
                        >{{ cell.key }}</a>
                        <a
                          v-else-if="cell.link"
                          :href="cell.link"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="shrink-0 opacity-70 hover:opacity-100"
                          title="Open the Jira ticket"
                        >
                          <svg class="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                            <path d="M7 17 17 7M9 7h8v8" stroke-linecap="round" stroke-linejoin="round" />
                          </svg>
                        </a>
                      </div>
                    </td>
                    <td class="px-2 py-1 text-right text-gray-600 dark:text-gray-300">{{ row.blocks }}/{{ row.seen }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section class="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <div class="border-b border-gray-100 px-4 py-3 dark:border-gray-700">
              <h2 class="text-sm font-semibold text-gray-900 dark:text-gray-100">How the gate works</h2>
              <p class="text-xs text-gray-500 dark:text-gray-400">Live numbers from the latest run, one batch for every component.</p>
            </div>
            <div class="flex flex-wrap items-stretch gap-1.5 px-4 py-3">
              <template v-for="(stage, index) in stages" :key="stage.key">
                <div class="min-w-[8.5rem] flex-1 rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-700/40">
                  <p class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ stage.label }}</p>
                  <p class="mt-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100">{{ stage.value }}</p>
                </div>
                <span v-if="index < stages.length - 1" class="self-center text-xs text-gray-300 dark:text-gray-600" aria-hidden="true">→</span>
              </template>
            </div>
          </section>

          <section class="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <div class="border-b border-gray-100 px-4 py-3 dark:border-gray-700">
              <h2 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Run rollup</h2>
            </div>
            <div class="overflow-x-auto">
              <table class="min-w-full text-sm">
                <thead class="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  <tr>
                    <th class="px-4 py-2">Date</th>
                    <th class="px-4 py-2">Leader PR</th>
                    <th class="px-4 py-2">State</th>
                    <th class="px-4 py-2">Promoted</th>
                    <th class="px-4 py-2">Release</th>
                    <th class="px-4 py-2">Components</th>
                    <th class="px-4 py-2">Passed</th>
                    <th class="px-4 py-2">Failed</th>
                    <th class="px-4 py-2">Pending</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
                  <tr v-for="run in trendRuns" :key="run.pr_number">
                    <td class="px-4 py-2 text-gray-500 dark:text-gray-400">{{ run.date }}</td>
                    <td class="px-4 py-2">
                      <a
                        :href="`https://github.com/red-hat-data-services/gated-artifacts-promoter/pull/${run.pr_number}`"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-primary-600 dark:text-primary-400 hover:underline"
                      >#{{ run.pr_number }}</a>
                      <span v-if="run.attempts > 1" class="text-[11px] text-gray-400 dark:text-gray-500">· {{ run.attempts }} attempts</span>
                    </td>
                    <td class="px-4 py-2 text-gray-600 dark:text-gray-300">{{ run.state }}</td>
                    <td class="px-4 py-2">
                      <span v-if="run.all_passed" class="text-emerald-600 dark:text-emerald-400" :title="promotedReason(run)">✓</span>
                      <span v-else class="text-gray-400 dark:text-gray-500" :title="promotedReason(run)">—</span>
                    </td>
                    <td class="px-4 py-2 text-gray-600 dark:text-gray-300">{{ run.release || '—' }}</td>
                    <td class="px-4 py-2 text-gray-600 dark:text-gray-300">
                      <span v-if="run.components">{{ run.components }}</span>
                      <span
                        v-else-if="run.creator_issues"
                        class="text-orange-700 dark:text-orange-300"
                        title="The batch never produced child PRs"
                      >creation failed</span>
                      <span v-else>—</span>
                    </td>
                    <td class="px-4 py-2 text-gray-600 dark:text-gray-300">{{ run.components ? run.passed : '—' }}</td>
                    <td class="px-4 py-2 text-gray-600 dark:text-gray-300">{{ run.components ? run.failed : '—' }}</td>
                    <td class="px-4 py-2 text-gray-600 dark:text-gray-300">{{ run.components ? run.pending : '—' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </template>
      </div>
    </template>
  </div>
</template>
