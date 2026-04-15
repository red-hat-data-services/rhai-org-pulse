<template>
  <article
    class="rounded-lg border border-gray-200/70 dark:border-gray-700/60 bg-white dark:bg-gray-900/50 shadow-sm overflow-hidden"
  >
    <!-- Collapsible header -->
    <button
      class="w-full flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-gray-50/60 dark:hover:bg-gray-800/30"
      @click="expanded = !expanded"
    >
      <div class="flex items-center gap-3 min-w-0 flex-wrap">
        <svg
          class="h-3.5 w-3.5 text-gray-400 transition-transform duration-200 shrink-0"
          :class="{ 'rotate-90': expanded }"
          viewBox="0 0 20 20" fill="currentColor"
        >
          <path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" />
        </svg>
        <p class="font-semibold text-gray-900 dark:text-gray-100 text-sm">
          {{ release.releaseNumber }}
        </p>
        <span
          class="inline-flex items-center gap-1.5 rounded-md bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300"
        >{{ productLabel }}</span>
        <div
          class="inline-flex items-center gap-1.5 rounded-full border border-gray-200/80 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-800/50 px-2 py-0.5"
        >
          <span class="text-[9px] font-bold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400 select-none">Risk</span>
          <span class="h-2.5 w-px shrink-0 bg-gray-200 dark:bg-gray-600" aria-hidden="true" />
          <span
            v-if="releaseHasNoIssues"
            class="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-gray-300 dark:bg-gray-600 ring-2 ring-white dark:ring-gray-900"
            title="No risk — no issues in scope"
          />
          <span
            v-else
            class="inline-flex h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white dark:ring-gray-900"
            :class="riskDotClass(release.risk)"
            :title="releaseRiskTitle"
          />
        </div>
        <span class="text-xs text-gray-500 dark:text-gray-400">
          Due {{ formatDate(release.dueDate) }} · {{ release.daysRemaining }}d left
        </span>
      </div>
      <div class="flex items-center gap-4 shrink-0">
        <!-- Compact progress bar -->
        <div class="hidden sm:flex items-center gap-2">
          <div class="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400">
            <span class="inline-flex items-center gap-0.5"><span class="h-1.5 w-1.5 rounded-full bg-emerald-500" />{{ fmtCount(release.totals?.issues_done) }}</span>
            <span class="inline-flex items-center gap-0.5"><span class="h-1.5 w-1.5 rounded-full bg-blue-500" />{{ fmtCount(release.totals?.issues_doing) }}</span>
            <span class="inline-flex items-center gap-0.5"><span class="h-1.5 w-1.5 rounded-full bg-gray-400" />{{ fmtCount(release.totals?.issues_to_do) }}</span>
          </div>
          <div class="w-20 h-1.5 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 ring-1 ring-inset ring-gray-200/60 dark:ring-gray-700/60">
            <div class="h-full flex">
              <div class="h-full bg-emerald-500 dark:bg-emerald-600" :style="{ width: pct(release.totals?.issues_done, issueSum) }" />
              <div class="h-full bg-blue-500 dark:bg-blue-600" :style="{ width: pct(release.totals?.issues_doing, issueSum) }" />
              <div class="h-full bg-gray-400 dark:bg-gray-500" :style="{ width: pct(release.totals?.issues_to_do, issueSum) }" />
            </div>
          </div>
        </div>
        <span class="text-xs tabular-nums text-gray-500 dark:text-gray-400">
          {{ issueSum }} issues in scope
        </span>
      </div>
    </button>

    <!-- Collapsible body -->
    <div v-show="expanded" class="border-t border-gray-100 dark:border-gray-800 px-4 py-3 flex flex-col gap-3">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div class="min-w-0">
          <p class="text-xs text-gray-500 dark:text-gray-400">{{ release.productName }}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {{ releaseTeamsList.length }} project(s)
            <span v-if="release.riskDriver"> · Driver: {{ release.riskDriver }}</span>
          </p>
          <p
            v-if="!releaseHasNoIssues && release.riskSummary"
            class="text-xs text-gray-600 dark:text-gray-300 mt-1.5 leading-snug border-l-2 pl-2 border-gray-200 dark:border-gray-600"
          >
            {{ release.riskSummary }}
          </p>
        </div>
        <div class="grid grid-cols-3 gap-1.5 text-xs shrink-0">
          <div class="rounded bg-gray-50 dark:bg-gray-800 px-1.5 py-0.5 text-center min-w-[3.5rem]">
            <div class="text-gray-500 text-[10px]">To Do</div>
            <div class="font-medium text-gray-900 dark:text-gray-100">{{ fmtCount(release.totals?.issues_to_do) }}</div>
          </div>
          <div class="rounded bg-gray-50 dark:bg-gray-800 px-1.5 py-0.5 text-center min-w-[3.5rem]">
            <div class="text-gray-500 text-[10px]">Doing</div>
            <div class="font-medium text-gray-900 dark:text-gray-100">{{ fmtCount(release.totals?.issues_doing) }}</div>
          </div>
          <div class="rounded bg-gray-50 dark:bg-gray-800 px-1.5 py-0.5 text-center min-w-[3.5rem]">
            <div class="text-gray-500 text-[10px]">Done</div>
            <div class="font-medium text-gray-900 dark:text-gray-100">{{ fmtCount(release.totals?.issues_done) }}</div>
          </div>
        </div>
      </div>

      <div v-if="!releaseTeamsList.length" class="text-sm text-gray-500 dark:text-gray-400">
        No issues mapped to this release yet.
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="team in releaseTeamsList"
          :key="team.projectKey"
          class="space-y-1.5"
        >
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <span class="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
              {{ team.projectKey }}
            </span>
            <div
              class="inline-flex items-center gap-1.5 rounded-full border border-gray-200/80 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-800/50 px-2 py-0.5"
            >
              <span class="text-[9px] font-bold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400 select-none">Risk</span>
              <span class="h-2.5 w-px shrink-0 bg-gray-200 dark:bg-gray-600" aria-hidden="true" />
              <span
                class="inline-flex h-2 w-2 shrink-0 rounded-full ring-1 ring-white dark:ring-gray-900"
                :class="riskDotClass(team.risk)"
              />
            </div>
          </div>
          <div
            class="flex h-2 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 ring-1 ring-inset ring-gray-200/60 dark:ring-gray-700/60"
          >
            <template v-if="teamIssueSum(team) > 0">
              <div class="h-full bg-emerald-500 dark:bg-emerald-600" :style="{ width: pct(team.issues_done, teamIssueSum(team)) }" />
              <div class="h-full bg-blue-500 dark:bg-blue-600" :style="{ width: pct(team.issues_doing, teamIssueSum(team)) }" />
              <div class="h-full bg-gray-400 dark:bg-gray-500" :style="{ width: pct(team.issues_to_do, teamIssueSum(team)) }" />
            </template>
          </div>
          <div class="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-gray-600 dark:text-gray-300">
            <span class="inline-flex items-center gap-1"><span class="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Done {{ fmtCount(team.issues_done) }}</span>
            <span class="inline-flex items-center gap-1"><span class="h-1.5 w-1.5 rounded-full bg-blue-500" /> Doing {{ fmtCount(team.issues_doing) }}</span>
            <span class="inline-flex items-center gap-1"><span class="h-1.5 w-1.5 rounded-full bg-gray-400" /> To do {{ fmtCount(team.issues_to_do) }}</span>
            <span class="text-gray-500 dark:text-gray-400">· {{ teamIssueSum(team) }} issues</span>
          </div>
        </div>
      </div>

      <!-- Capacity table -->
      <details class="group rounded-lg border border-gray-200 dark:border-gray-700 open:bg-gray-50/50 dark:open:bg-gray-800/30">
        <summary class="cursor-pointer select-none px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 list-none flex items-center gap-2">
          <span class="text-gray-400 group-open:rotate-90 transition-transform">&#9656;</span>
          Capacity &amp; throughput
        </summary>
        <div class="px-3 pb-3 overflow-x-auto border-t border-gray-100 dark:border-gray-800">
          <table class="min-w-full text-sm mt-2">
            <thead class="text-left text-gray-600 dark:text-gray-300">
              <tr>
                <th class="pr-3 py-1">Team</th>
                <th class="pr-3 py-1">Remaining</th>
                <th class="pr-3 py-1">Done</th>
                <th class="pr-3 py-1">Expected to due</th>
                <th class="pr-3 py-1">Required/day</th>
                <th class="pr-3 py-1">Available/day</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="team in releaseTeamsList"
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

      <!-- Issues table -->
      <details class="group rounded-lg border border-gray-200 dark:border-gray-700 open:bg-gray-50/50 dark:open:bg-gray-800/30">
        <summary class="cursor-pointer select-none px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 list-none flex items-center gap-2">
          <span class="text-gray-400 group-open:rotate-90 transition-transform">&#9656;</span>
          Issues ({{ releaseIssues.length }})
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
                v-for="issue in releaseIssues"
                :key="issue.key"
                class="border-b border-gray-100 dark:border-gray-800"
              >
                <td class="px-3 py-2">
                  <a :href="issue.link" target="_blank" rel="noopener" class="text-blue-600 hover:underline">{{ issue.key }}</a>
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

      <!-- Monte Carlo -->
      <details
        v-if="mcInputs"
        class="group rounded-lg border border-gray-200 dark:border-gray-700 open:bg-gray-50/50 dark:open:bg-gray-800/30"
      >
        <summary class="cursor-pointer select-none px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 list-none flex items-center gap-2">
          <span class="text-gray-400 group-open:rotate-90 transition-transform">&#9656;</span>
          <span>Monte Carlo Simulation</span>
          <span class="text-xs font-normal text-gray-500 dark:text-gray-400">
            {{ mcInputs.notDoneCount }} remaining · {{ mcInputs.totalVelocity }} issues/14d
          </span>
        </summary>
        <div class="px-3 pb-3 border-t border-gray-100 dark:border-gray-800">
          <div class="flex items-center justify-between gap-3 mt-3 mb-3">
            <div class="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 p-0.5">
              <div class="relative group/cf">
                <button
                  class="px-3 py-1 rounded-md text-xs font-medium transition-all duration-150"
                  :disabled="!release.codeFreezeDate"
                  :class="!release.codeFreezeDate
                    ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                    : activeMcTarget === 'codeFreeze'
                      ? 'bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-300 shadow-sm ring-1 ring-gray-200/60 dark:ring-gray-600/60'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
                  @click="$emit('set-mc-target', release.releaseNumber, 'codeFreeze')"
                >Code Freeze</button>
                <div v-if="!release.codeFreezeDate" class="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 hidden group-hover/cf:flex z-10">
                  <div class="whitespace-nowrap rounded-md bg-gray-900 dark:bg-gray-700 px-2.5 py-1.5 text-[11px] font-medium text-white shadow-lg">
                    <div class="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-gray-900 dark:border-b-gray-700" />
                    No code freeze date available
                  </div>
                </div>
              </div>
              <div class="relative group/ga">
                <button
                  class="px-3 py-1 rounded-md text-xs font-medium transition-all duration-150"
                  :disabled="!release.dueDate"
                  :class="!release.dueDate
                    ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                    : activeMcTarget === 'ga'
                      ? 'bg-white dark:bg-gray-700 text-purple-700 dark:text-purple-300 shadow-sm ring-1 ring-gray-200/60 dark:ring-gray-600/60'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
                  @click="$emit('set-mc-target', release.releaseNumber, 'ga')"
                >GA</button>
                <div v-if="!release.dueDate" class="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 hidden group-hover/ga:flex z-10">
                  <div class="whitespace-nowrap rounded-md bg-gray-900 dark:bg-gray-700 px-2.5 py-1.5 text-[11px] font-medium text-white shadow-lg">
                    <div class="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-gray-900 dark:border-b-gray-700" />
                    No GA date available
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="mb-4 rounded-lg bg-gray-50/80 dark:bg-gray-800/40 border border-gray-200/60 dark:border-gray-700/40 px-4 py-3 text-xs text-gray-600 dark:text-gray-400 leading-relaxed space-y-1.5">
            <p>
              <span class="font-semibold text-gray-700 dark:text-gray-300">1,000 Monte Carlo simulations</span> to predict when remaining work will be completed.
            </p>
            <p>
              <span class="font-medium text-gray-700 dark:text-gray-300">Inputs:</span>
              <span class="font-semibold text-gray-700 dark:text-gray-300">{{ mcInputs.notDoneCount }}</span> not-done issues,
              <span class="font-semibold text-gray-700 dark:text-gray-300">{{ mcInputs.totalVelocity }} issues / 14 days</span> throughput, measured against the
              <template v-if="mcInputs.activeTarget === 'codeFreeze'">
                code freeze date of <span class="font-semibold text-gray-700 dark:text-gray-300">{{ formatDueDate(mcInputs.codeFreezeDate) }}</span>
                (GA: {{ formatDueDate(mcInputs.releaseDate) }}).
              </template>
              <template v-else>
                GA date of <span class="font-semibold text-gray-700 dark:text-gray-300">{{ formatDueDate(mcInputs.releaseDate) }}</span><template v-if="mcInputs.codeFreezeDate">
                (code freeze: {{ formatDueDate(mcInputs.codeFreezeDate) }})</template>.
              </template>
            </p>
          </div>
          <MonteCarloChart
            :not-done-count="mcInputs.notDoneCount"
            :velocity="mcInputs.totalVelocity"
            :due-date="mcInputs.dueDate"
            :deadline-label="mcInputs.activeTarget === 'codeFreeze' ? 'Code Freeze' : 'GA'"
            :code-freeze-date="mcInputs.codeFreezeDate"
            :release-date="mcInputs.releaseDate"
          />
        </div>
      </details>
    </div>
  </article>
</template>

<script setup>
import { computed, ref } from 'vue'
import MonteCarloChart from './MonteCarloChart.vue'
import { extractProduct } from '../composables/useReleaseFilter'

const props = defineProps({
  release: { type: Object, required: true },
  mcInputs: { type: Object, default: null },
  activeMcTarget: { type: String, default: 'codeFreeze' },
  defaultExpanded: { type: Boolean, default: false }
})

defineEmits(['set-mc-target'])

const expanded = ref(props.defaultExpanded)

const productLabel = computed(() => extractProduct(props.release.releaseNumber).toUpperCase())

const releaseTeamsList = computed(() => {
  if (!props.release?.teams) return []
  return Object.values(props.release.teams).sort((a, b) => a.projectKey.localeCompare(b.projectKey))
})

const releaseIssues = computed(() => {
  const r = props.release
  if (!r) return []
  if (Array.isArray(r.issues) && r.issues.length) return r.issues
  return Array.isArray(r.features) ? r.features : []
})

const issueSum = computed(() => {
  const t = props.release?.totals
  if (!t) return 0
  return (t.issues_to_do || 0) + (t.issues_doing || 0) + (t.issues_done || 0)
})

const releaseHasNoIssues = computed(() => issueSum.value === 0)

const releaseRiskTitle = computed(() => {
  return props.release?.riskSummary || 'Schedule risk from open issue count vs days to due date.'
})

function riskDotClass(risk) {
  if (risk === 'red') return 'bg-red-500 dark:bg-red-600'
  if (risk === 'yellow') return 'bg-amber-400 dark:bg-amber-500'
  if (risk === 'none') return 'bg-gray-300 dark:bg-gray-600'
  return 'bg-emerald-500 dark:bg-emerald-600'
}

function teamIssueSum(team) {
  if (!team) return 0
  return (team.issues_to_do || 0) + (team.issues_doing || 0) + (team.issues_done || 0)
}

function pct(part, total) {
  if (!total || part <= 0) return '0%'
  return `${Math.min(100, (part / total) * 100)}%`
}

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

function formatDueDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>
