<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Release Analysis</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Per-release cards with project progress (done / doing / to do). Open the sections below a card for throughput and issues.
        </p>
      </div>
      <button
        class="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
        :disabled="loading"
        @click="refreshAnalysis"
      >
        {{ loading ? 'Refreshing...' : 'Refresh' }}
      </button>
    </div>

    <div v-if="error" class="rounded-lg border border-red-300 bg-red-50 text-red-700 px-4 py-3 text-sm">
      {{ error }}
    </div>

    <div v-if="loading" class="text-sm text-gray-500 dark:text-gray-400">Loading release analytics...</div>

    <template v-if="!loading && analysis">
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
          <div class="flex gap-1 mt-4 border-b border-gray-200 dark:border-gray-700">
            <button
              v-for="tab in tabs"
              :key="tab.key"
              class="px-4 py-2 text-sm font-medium transition-colors -mb-px"
              :class="activeTab === tab.key
                ? 'border-b-2 border-gray-900 dark:border-gray-100 text-gray-900 dark:text-gray-100'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-b-2 hover:border-gray-300 dark:hover:border-gray-600'"
              @click="activeTab = tab.key"
            >
              {{ tab.label }}
            </button>
          </div>
        </div>

        <article
          v-for="release in filteredReleases"
          :key="release.releaseNumber"
          class="rounded-xl border border-gray-200/80 dark:border-gray-700/80 bg-white dark:bg-gray-900/40 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.04)] flex flex-col gap-4"
        >
          <div class="flex flex-wrap items-start justify-between gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-3">
                <p class="font-semibold text-gray-900 dark:text-gray-100 text-base">
                  {{ release.releaseNumber }}
                </p>
                <div
                  class="inline-flex items-center gap-2.5 rounded-full border border-gray-200/90 dark:border-gray-600 bg-gradient-to-r from-gray-50/95 to-white dark:from-gray-800/70 dark:to-gray-900/50 px-3 py-1.5 shadow-sm ring-1 ring-gray-100/90 dark:ring-gray-700/60"
                >
                  <span
                    class="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400 select-none"
                  >Risk level</span>
                  <span class="h-3.5 w-px shrink-0 bg-gray-200 dark:bg-gray-600" aria-hidden="true" />
                  <span
                    v-if="releaseHasNoIssues(release)"
                    class="inline-flex h-3 w-3 shrink-0 rounded-full bg-gray-300 dark:bg-gray-600 ring-2 ring-white dark:ring-gray-900"
                    title="No risk — no issues in scope"
                    aria-label="No risk"
                  />
                  <span
                    v-else
                    class="inline-flex h-3 w-3 shrink-0 rounded-full ring-2 ring-white dark:ring-gray-900"
                    :class="riskDotClass(release.risk)"
                    :title="releaseRiskTitle(release)"
                    :aria-label="`Release risk: ${release.risk || 'unknown'}`"
                  />
                </div>
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ release.productName }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Due {{ formatDate(release.dueDate) }} · {{ release.daysRemaining }}d left ·
                {{ releaseTeamsList(release).length }} project(s)
                <span v-if="release.riskDriver"> · Driver: {{ release.riskDriver }}</span>
              </p>
              <p
                v-if="!releaseHasNoIssues(release) && releaseRiskSummary(release)"
                class="text-xs text-gray-600 dark:text-gray-300 mt-2 leading-snug border-l-2 pl-2 border-gray-200 dark:border-gray-600"
              >
                {{ releaseRiskSummary(release) }}
              </p>
            </div>
            <div class="flex flex-col items-end gap-1 shrink-0 text-right">
              <p class="text-[11px] text-gray-600 dark:text-gray-300">
                <span class="font-medium text-gray-800 dark:text-gray-200">{{ releaseIssueSum(release) }}</span>
                issues in scope
              </p>
              <div class="grid grid-cols-3 gap-2 text-xs">
                <div class="rounded bg-gray-50 dark:bg-gray-800 px-2 py-1 text-center min-w-[4.5rem]">
                  <div class="text-gray-500">To Do</div>
                  <div class="font-medium text-gray-900 dark:text-gray-100">{{ fmtCount(release.totals?.issues_to_do) }}</div>
                </div>
                <div class="rounded bg-gray-50 dark:bg-gray-800 px-2 py-1 text-center min-w-[4.5rem]">
                  <div class="text-gray-500">Doing</div>
                  <div class="font-medium text-gray-900 dark:text-gray-100">{{ fmtCount(release.totals?.issues_doing) }}</div>
                </div>
                <div class="rounded bg-gray-50 dark:bg-gray-800 px-2 py-1 text-center min-w-[4.5rem]">
                  <div class="text-gray-500">Done</div>
                  <div class="font-medium text-gray-900 dark:text-gray-100">{{ fmtCount(release.totals?.issues_done) }}</div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="!releaseTeamsList(release).length" class="text-sm text-gray-500 dark:text-gray-400">
            No issues mapped to this release yet.
          </div>

          <div v-else class="space-y-4">
            <div
              v-for="team in releaseTeamsList(release)"
              :key="team.projectKey"
              class="space-y-2"
            >
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <span class="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                  {{ team.projectKey }}
                </span>
                <div
                  class="inline-flex items-center gap-2 rounded-full border border-gray-200/80 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-800/50 px-2.5 py-1 ring-1 ring-gray-100/80 dark:ring-gray-700/50"
                >
                  <span class="text-[9px] font-bold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400 select-none">Risk level</span>
                  <span class="h-3 w-px shrink-0 bg-gray-200 dark:bg-gray-600" aria-hidden="true" />
                  <span
                    class="inline-flex h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white dark:ring-gray-900"
                    :class="riskDotClass(team.risk)"
                    :title="`Project risk (${team.projectKey}): ${team.risk}`"
                    :aria-label="`Project ${team.projectKey} risk: ${team.risk}`"
                  />
                </div>
              </div>
              <div
                class="flex h-2.5 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 ring-1 ring-inset ring-gray-200/60 dark:ring-gray-700/60"
                role="img"
                :aria-label="progressAriaTeam(team)"
              >
                <template v-if="teamIssueSum(team) > 0">
                  <div
                    class="h-full bg-emerald-500 dark:bg-emerald-600"
                    :style="{ width: pct(team.issues_done, teamIssueSum(team)) }"
                  />
                  <div
                    class="h-full bg-blue-500 dark:bg-blue-600"
                    :style="{ width: pct(team.issues_doing, teamIssueSum(team)) }"
                  />
                  <div
                    class="h-full bg-gray-400 dark:bg-gray-500"
                    :style="{ width: pct(team.issues_to_do, teamIssueSum(team)) }"
                  />
                </template>
              </div>
              <div class="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-gray-600 dark:text-gray-300">
                <span class="inline-flex items-center gap-1">
                  <span class="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Done {{ fmtCount(team.issues_done) }}
                </span>
                <span class="inline-flex items-center gap-1">
                  <span class="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  Doing {{ fmtCount(team.issues_doing) }}
                </span>
                <span class="inline-flex items-center gap-1">
                  <span class="h-1.5 w-1.5 rounded-full bg-gray-400" />
                  To do {{ fmtCount(team.issues_to_do) }}
                </span>
                <span class="text-gray-500 dark:text-gray-400">
                  · {{ teamIssueSum(team) }} issues · capacity row uses {{ fmt(team.total) }} weighted pts
                </span>
              </div>
            </div>
          </div>

          <details class="group rounded-lg border border-gray-200 dark:border-gray-700 open:bg-gray-50/50 dark:open:bg-gray-800/30">
            <summary class="cursor-pointer select-none px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 list-none flex items-center gap-2">
              <span class="text-gray-400 group-open:rotate-90 transition-transform">▸</span>
              Capacity &amp; throughput by project
            </summary>
            <div class="px-3 pb-3 overflow-x-auto border-t border-gray-100 dark:border-gray-800">
              <table class="min-w-full text-sm mt-2">
                <thead class="text-left text-gray-600 dark:text-gray-300">
                  <tr>
                    <th class="pr-3 py-1">Team</th>
                    <th class="pr-3 py-1">
                      <span class="inline-flex items-center gap-1">
                        Remaining
                        <button
                          class="inline-flex items-center justify-center h-4 w-4 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-[10px] font-bold leading-none hover:bg-gray-300 dark:hover:bg-gray-600 cursor-help"
                          :title="metricInfo.remaining"
                        >i</button>
                      </span>
                    </th>
                    <th class="pr-3 py-1">
                      <span class="inline-flex items-center gap-1">
                        Done
                        <button
                          class="inline-flex items-center justify-center h-4 w-4 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-[10px] font-bold leading-none hover:bg-gray-300 dark:hover:bg-gray-600 cursor-help"
                          :title="metricInfo.done"
                        >i</button>
                      </span>
                    </th>
                    <th class="pr-3 py-1">
                      <span class="inline-flex items-center gap-1">
                        Expected to due
                        <button
                          class="inline-flex items-center justify-center h-4 w-4 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-[10px] font-bold leading-none hover:bg-gray-300 dark:hover:bg-gray-600 cursor-help"
                          :title="metricInfo.expectedToDue"
                        >i</button>
                      </span>
                    </th>
                    <th class="pr-3 py-1">
                      <span class="inline-flex items-center gap-1">
                        Required/day
                        <button
                          class="inline-flex items-center justify-center h-4 w-4 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-[10px] font-bold leading-none hover:bg-gray-300 dark:hover:bg-gray-600 cursor-help"
                          :title="metricInfo.requiredPerDay"
                        >i</button>
                      </span>
                    </th>
                    <th class="pr-3 py-1">
                      <span class="inline-flex items-center gap-1">
                        Available/day
                        <button
                          class="inline-flex items-center justify-center h-4 w-4 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-[10px] font-bold leading-none hover:bg-gray-300 dark:hover:bg-gray-600 cursor-help"
                          :title="metricInfo.availablePerDay"
                        >i</button>
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="team in releaseTeamsList(release)"
                    :key="`cap-${team.projectKey}`"
                    class="border-t border-gray-100 dark:border-gray-800"
                  >
                    <td class="py-2 pr-3 font-medium">{{ team.projectKey }}</td>
                    <td class="py-2 pr-3">{{ fmt(team.remaining) }}</td>
                    <td class="py-2 pr-3">{{ fmt(team.actualDoneThisRelease) }}</td>
                    <td class="py-2 pr-3">{{ fmt(team.expectedThroughputToDue) }}</td>
                    <td class="py-2 pr-3">{{ fmt(team.requiredRatePerDay) }}</td>
                    <td class="py-2 pr-3">{{ fmt(team.availableRatePerDay) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </details>

          <details class="group rounded-lg border border-gray-200 dark:border-gray-700 open:bg-gray-50/50 dark:open:bg-gray-800/30">
            <summary class="cursor-pointer select-none px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 list-none flex items-center gap-2">
              <span class="text-gray-400 group-open:rotate-90 transition-transform">▸</span>
              Issues for this release ({{ releaseIssues(release).length }})
            </summary>
            <div class="overflow-x-auto max-h-[min(440px,50vh)] border-t border-gray-100 dark:border-gray-800">
              <table class="min-w-full text-sm">
                <thead class="bg-white dark:bg-gray-900 sticky top-0 text-left text-gray-600 dark:text-gray-300">
                  <tr>
                    <th class="px-3 py-2">Issue</th>
                    <th class="px-3 py-2">Type</th>
                    <th class="px-3 py-2">Team</th>
                    <th class="px-3 py-2">Status</th>
                    <th class="px-3 py-2">Weight</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="issue in releaseIssues(release)"
                    :key="issue.key"
                    class="border-b border-gray-100 dark:border-gray-800"
                  >
                    <td class="px-3 py-2">
                      <a :href="issue.link" target="_blank" rel="noopener" class="text-blue-600 hover:underline">
                        {{ issue.key }}
                      </a>
                      <div class="text-xs text-gray-500 dark:text-gray-400 max-w-[320px] truncate">{{ issue.summary }}</div>
                    </td>
                    <td class="px-3 py-2">{{ issue.issueType || '—' }}</td>
                    <td class="px-3 py-2">{{ issue.projectKey }}</td>
                    <td class="px-3 py-2">
                      <span class="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700">{{ issue.statusBucket }}</span>
                      <span class="text-xs text-gray-500 ml-1">{{ issue.status }}</span>
                    </td>
                    <td class="px-3 py-2">{{ fmt(issue.weight) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </details>
        </article>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useReleaseAnalysis } from '../composables/useReleaseAnalysis'

const { loading, error, analysis, refreshAnalysis } = useReleaseAnalysis()

const activeTab = ref('all')

const metricInfo = {
  remaining: 'Remaining = Total weighted points (story points or feature weight) for issues in To Do + Doing status. Formula: Σ weight(issue) where status ≠ Done.',
  done: 'Done = Total weighted points completed for this release within the baseline window. Formula: Σ weight(issue) where status = Done and resolved within this release.',
  expectedToDue: 'Expected to Due = Projected throughput from now until the due date, based on historical capacity. Formula: (Baseline per month ÷ 30) × Days remaining. Baseline uses P90 or Avg monthly throughput over the trailing window.',
  requiredPerDay: 'Required/day = The daily throughput rate needed to finish all remaining work by the due date. Formula: Remaining ÷ Days remaining. If days = 0 and work remains, this is ∞.',
  availablePerDay: 'Available/day = Historical daily throughput capacity for this team. Formula: Baseline per month ÷ 30. Baseline = P90 (or Avg) of monthly completed weighted points over the trailing window (default 180 days).'
}

const tabs = computed(() => {
  const releases = analysis.value?.releases || []
  const products = [...new Set(releases.map(r => {
    const num = (r.releaseNumber || '').toLowerCase()
    const dash = num.indexOf('-')
    return dash > 0 ? num.slice(0, dash) : num
  }).filter(Boolean))]
  products.sort()
  return [
    { key: 'all', label: 'All' },
    ...products.map(p => ({ key: p, label: p }))
  ]
})

const filteredReleases = computed(() => {
  if (!analysis.value?.releases) return []
  if (activeTab.value === 'all') return analysis.value.releases
  return analysis.value.releases.filter(r =>
    (r.releaseNumber || '').toLowerCase().startsWith(activeTab.value)
  )
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

function releaseTeamsList(release) {
  if (!release?.teams) return []
  return Object.values(release.teams).sort((a, b) => a.projectKey.localeCompare(b.projectKey))
}

function releaseIssues(release) {
  if (!release) return []
  if (Array.isArray(release.issues) && release.issues.length) return release.issues
  return Array.isArray(release.features) ? release.features : []
}

function pct(part, total) {
  if (!total || part <= 0) return '0%'
  return `${Math.min(100, (part / total) * 100)}%`
}

function teamIssueSum(team) {
  if (!team) return 0
  return (team.issues_to_do || 0) + (team.issues_doing || 0) + (team.issues_done || 0)
}

function releaseIssueSum(release) {
  const t = release?.totals
  if (!t) return 0
  return (t.issues_to_do || 0) + (t.issues_doing || 0) + (t.issues_done || 0)
}

/** No mapped issues — schedule risk is not assessed (badge shows "No risk"). */
function releaseHasNoIssues(release) {
  return releaseIssueSum(release) === 0
}

function progressAriaTeam(team) {
  return `${team.projectKey}: done ${team.issues_done ?? 0}, doing ${team.issues_doing ?? 0}, to do ${team.issues_to_do ?? 0} (${teamIssueSum(team)} issues)`
}

/** Integer issue counts (no decimals). */
function fmtCount(n) {
  if (n == null || !Number.isFinite(Number(n))) return '0'
  return String(Math.round(Number(n)))
}

function fmt(n) {
  if (!Number.isFinite(Number(n))) return String(n)
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function formatDate(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString()
}

function formatDateTime(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

/** Solid color chip for schedule risk (open issues vs days remaining). Grey = no scope via `releaseHasNoIssues` + separate span. */
function riskDotClass(risk) {
  if (risk === 'red') return 'bg-red-500 dark:bg-red-600'
  if (risk === 'yellow') return 'bg-amber-400 dark:bg-amber-500'
  if (risk === 'none') return 'bg-gray-300 dark:bg-gray-600'
  return 'bg-emerald-500 dark:bg-emerald-600'
}

function releaseRiskSummary(release) {
  return release?.riskSummary || ''
}

function releaseRiskTitle(release) {
  const s = release?.riskSummary
  if (s) return s
  return 'Schedule risk from open issue count (to do + in progress) vs days to due date.'
}


</script>
