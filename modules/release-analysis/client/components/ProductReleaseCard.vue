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
        <span
          v-if="predictedDate"
          class="inline-flex items-center gap-1 text-xs text-teal-600 dark:text-teal-400"
          title="95% confidence predicted completion date (Monte Carlo)"
        >
          Predicted {{ predictedDate }}
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
            {{ componentList.length }} component(s) across {{ releaseTeamsList.length }} project(s)
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

      <!-- Release-level capacity forecast -->
      <div v-if="componentList.length" class="rounded-lg bg-gray-50/60 dark:bg-gray-800/30 border border-gray-200/60 dark:border-gray-700/40 px-4 py-2.5">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1.5 text-[11px]">
          <div>
            <span class="text-gray-400 dark:text-gray-500">Feature Velocity (V) — 6mo avg</span>
            <p class="font-semibold text-gray-700 dark:text-gray-300">{{ releaseForecast.velocity }} <span class="font-normal text-gray-400 dark:text-gray-500">issues / 14d</span></p>
          </div>
          <div>
            <span class="text-gray-400 dark:text-gray-500">Remaining Issues (RI)</span>
            <p class="font-semibold text-gray-700 dark:text-gray-300">{{ releaseForecast.remaining }} <span class="font-normal text-gray-400 dark:text-gray-500">not done</span></p>
          </div>
          <div>
            <span class="text-gray-400 dark:text-gray-500">Sprint (14d window) Remaining (W)</span>
            <p class="font-semibold text-gray-700 dark:text-gray-300">{{ releaseForecast.windowsRemaining }} <span class="font-normal text-gray-400 dark:text-gray-500">({{ releaseForecast.T }}d ÷ 14)</span></p>
          </div>
          <div>
            <span class="text-gray-400 dark:text-gray-500">Capacity (C = V x W)</span>
            <p class="font-semibold text-gray-700 dark:text-gray-300">{{ releaseForecast.totalCapacity }} <span class="font-normal text-gray-400 dark:text-gray-500">projected</span></p>
          </div>
        </div>
        <div class="mt-2 text-xs space-y-1">
          <div class="flex items-center gap-3 flex-wrap">
            <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold" :class="confidenceBadgeClass(releaseForecast.level)">
              <span class="h-2 w-2 rounded-full" :class="confidenceDotClass(releaseForecast.level)" />
              {{ releaseForecast.paceStatus }}
            </span>
            <span v-if="releaseForecast.riskSource === 'components'" class="text-red-600 dark:text-red-400">
              At Risk Due To: {{ releaseForecast.atRiskComponents.join(', ') }}
            </span>
            <span v-else-if="releaseForecast.remaining > 0 && releaseForecast.delta < 0" class="text-red-600 dark:text-red-400">
              Capacity Required: {{ releaseForecast.remaining }} but Projected {{ releaseForecast.totalCapacity }}
            </span>
            <span v-else-if="releaseForecast.remaining > 0" class="text-emerald-600 dark:text-emerald-400">
              Capacity Required: {{ releaseForecast.remaining }}; Projected {{ releaseForecast.totalCapacity }}
            </span>
            <span v-else class="text-emerald-600 dark:text-emerald-400 font-medium">All issues resolved</span>
          </div>
          <div v-if="releaseForecast.riskSource === 'components' && releaseForecast.remaining > 0" class="pl-[calc(2.5rem+0.75rem)] text-gray-500 dark:text-gray-400">
            Overall Capacity: Required {{ releaseForecast.remaining }}; Projected {{ releaseForecast.totalCapacity }}
            <span class="font-semibold" :class="releaseForecast.delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'">
              ({{ releaseForecast.delta >= 0 ? '+' : '' }}{{ releaseForecast.delta }})
            </span>
          </div>
        </div>
      </div>

      <div v-if="!componentList.length" class="text-sm text-gray-500 dark:text-gray-400">
        No issues mapped to this release yet.
      </div>

      <!-- Component rows -->
      <div v-else class="flex flex-col gap-3">
        <!-- At Risk block -->
        <div v-if="atRiskComponents.length" class="rounded-lg bg-red-50/60 dark:bg-red-950/20 border border-red-200/80 dark:border-red-800/50 overflow-hidden">
          <div class="flex items-center gap-2 px-4 py-2 border-b border-red-200/60 dark:border-red-800/40">
            <span class="h-2 w-2 rounded-full bg-red-500" />
            <span class="text-xs font-semibold text-red-700 dark:text-red-300 uppercase tracking-wide">At Risk</span>
            <span class="text-[10px] text-red-500/70 dark:text-red-400/60">{{ atRiskComponents.length }} component{{ atRiskComponents.length !== 1 ? 's' : '' }}</span>
          </div>
          <div class="divide-y divide-red-100 dark:divide-red-900/30">
            <ComponentDetailRow v-for="comp in atRiskComponents" :key="comp.name" :comp="comp" variant="risk" />
          </div>
        </div>

        <!-- On Track / Complete block -->
        <div v-if="nonRiskComponents.length" class="rounded-lg border border-emerald-200/80 dark:border-emerald-800/50 overflow-hidden">
          <div class="flex items-center gap-2 px-4 py-2 border-b border-emerald-200/60 dark:border-emerald-800/40 bg-emerald-50/60 dark:bg-emerald-950/20">
            <span class="h-2 w-2 rounded-full bg-emerald-500" />
            <span class="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">On Track</span>
            <span class="text-[10px] text-emerald-500/70 dark:text-emerald-400/60">{{ nonRiskComponents.length }} component{{ nonRiskComponents.length !== 1 ? 's' : '' }}</span>
          </div>
          <div class="divide-y divide-gray-100 dark:divide-gray-800">
            <ComponentDetailRow v-for="comp in nonRiskComponents" :key="comp.name" :comp="comp" />
          </div>
        </div>
      </div>

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
import ComponentDetailRow from './ComponentDetailRow.vue'
import { extractProduct } from '../composables/useReleaseFilter'
import { gammaSample } from '../utils/monteCarlo'

const FORECAST_WINDOW = 14
const STRATEGIC_TYPES = new Set(['feature', 'initiative', 'spike'])
const BUCKET_ORDER = { to_do: 0, doing: 1, done: 2 }

function normalizeType(t) { return (t || '').toLowerCase().trim() }

function countByBucket(issues) {
  const counts = { done: 0, doing: 0, to_do: 0 }
  for (const i of issues) {
    if (i.statusBucket === 'done') counts.done++
    else if (i.statusBucket === 'doing') counts.doing++
    else counts.to_do++
  }
  return counts
}

function sortRemainingFirst(issues) {
  return [...issues].sort((a, b) => (BUCKET_ORDER[a.statusBucket] ?? 1) - (BUCKET_ORDER[b.statusBucket] ?? 1))
}

const props = defineProps({
  release: { type: Object, required: true },
  mcInputs: { type: Object, default: null },
  activeMcTarget: { type: String, default: 'codeFreeze' },
  componentVelocity: { type: Object, default: () => ({}) },
  selectedProjects: { type: Set, default: () => new Set() },
  defaultExpanded: { type: Boolean, default: false }
})

defineEmits(['set-mc-target'])

const expanded = ref(props.defaultExpanded)

const productLabel = computed(() => extractProduct(props.release.releaseNumber).toUpperCase())

const releaseTeamsList = computed(() => {
  if (!props.release?.teams) return []
  return Object.values(props.release.teams).sort((a, b) => a.projectKey.localeCompare(b.projectKey))
})

function daysUntilDeadline() {
  const deadline = props.release?.codeFreezeDate || props.release?.dueDate
  if (!deadline) return 0
  const target = new Date(deadline + 'T00:00:00')
  if (isNaN(target.getTime())) return 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.max(0, Math.ceil((target - today) / (1000 * 60 * 60 * 24)))
}

function lookupVelocity(componentNames) {
  const cv = props.componentVelocity || {}
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

function computeForecast(remaining, componentNames) {
  const velocity = lookupVelocity(componentNames)
  const T = daysUntilDeadline()
  const windowsRemaining = T / FORECAST_WINDOW
  const totalCapacity = velocity * windowsRemaining
  const delta = totalCapacity - remaining

  let paceStatus, level
  if (remaining === 0) {
    paceStatus = 'Complete'
    level = 'High'
  } else if (totalCapacity >= remaining) {
    paceStatus = 'On Track'
    level = 'High'
  } else {
    paceStatus = 'At Risk'
    level = 'Low'
  }

  return {
    velocity,
    remaining,
    windowsRemaining: +windowsRemaining.toFixed(1),
    totalCapacity: +totalCapacity.toFixed(1),
    delta: +delta.toFixed(1),
    paceStatus,
    level,
    T
  }
}

const projectFilteredIssues = computed(() => {
  const all = releaseIssues.value
  if (!props.selectedProjects.size) return all
  return all.filter(i => props.selectedProjects.has(i.projectKey))
})

const componentList = computed(() => {
  const issues = projectFilteredIssues.value
  if (!issues.length) return []

  const strategicMap = {}
  for (const issue of issues) {
    if (STRATEGIC_TYPES.has(normalizeType(issue.issueType))) {
      strategicMap[issue.key] = issue
    }
  }

  const childKeySet = new Set()
  const childrenByParent = {}
  for (const issue of issues) {
    if (issue.parentKey && strategicMap[issue.parentKey]) {
      childKeySet.add(issue.key)
      if (!childrenByParent[issue.parentKey]) childrenByParent[issue.parentKey] = []
      childrenByParent[issue.parentKey].push(issue)
    }
  }

  const map = {}
  for (const issue of issues) {
    const names = issue.components?.length ? issue.components : ['(No component)']
    for (const name of names) {
      if (!map[name]) {
        map[name] = { name, projects: new Set(), issues_to_do: 0, issues_doing: 0, issues_done: 0, allIssues: [] }
      }
      const entry = map[name]
      entry.projects.add(issue.projectKey)
      entry.allIssues.push(issue)
      if (issue.statusBucket === 'to_do') entry.issues_to_do++
      else if (issue.statusBucket === 'doing') entry.issues_doing++
      else entry.issues_done++
    }
  }

  return Object.values(map)
    .map(c => {
      const remaining = c.issues_to_do + c.issues_doing

      const compStrategic = c.allIssues.filter(i => strategicMap[i.key])
      const compStrategicKeys = new Set(compStrategic.map(i => i.key))

      const TYPE_ORDER = { Feature: 0, Initiative: 1, Spike: 2 }
      const strategicItems = compStrategic
        .map(si => {
          const children = sortRemainingFirst(childrenByParent[si.key] || [])
          return {
            key: si.key, summary: si.summary, issueType: si.issueType,
            status: si.status, statusBucket: si.statusBucket, link: si.link,
            children,
            childCounts: countByBucket(children)
          }
        })
        .sort((a, b) => {
          const ta = TYPE_ORDER[a.issueType] ?? 3
          const tb = TYPE_ORDER[b.issueType] ?? 3
          if (ta !== tb) return ta - tb
          return a.key.localeCompare(b.key)
        })

      const otherItems = sortRemainingFirst(
        c.allIssues.filter(i => !compStrategicKeys.has(i.key) && !childKeySet.has(i.key))
      )

      return {
        name: c.name,
        projects: [...c.projects].sort(),
        issues_to_do: c.issues_to_do,
        issues_doing: c.issues_doing,
        issues_done: c.issues_done,
        forecast: computeForecast(remaining, [c.name]),
        strategicItems,
        otherItems,
        otherCounts: countByBucket(otherItems)
      }
    })
    .sort((a, b) => {
      if (a.name === '(No component)') return 1
      if (b.name === '(No component)') return -1
      const riskOrder = { Low: 0, High: 1 }
      const ra = riskOrder[a.forecast.level] ?? 0
      const rb = riskOrder[b.forecast.level] ?? 0
      if (ra !== rb) return ra - rb
      return a.name.localeCompare(b.name)
    })
})

const atRiskComponents = computed(() => componentList.value.filter(c => c.forecast.paceStatus === 'At Risk'))
const nonRiskComponents = computed(() => componentList.value.filter(c => c.forecast.paceStatus !== 'At Risk'))

const releaseForecast = computed(() => {
  const allNames = componentList.value.map(c => c.name)
  const seen = new Set()
  let totalRemaining = 0
  for (const issue of projectFilteredIssues.value) {
    if (seen.has(issue.key)) continue
    seen.add(issue.key)
    if (issue.statusBucket !== 'done') totalRemaining++
  }
  const forecast = computeForecast(totalRemaining, allNames)

  const atRisk = componentList.value.filter(c => c.forecast.paceStatus === 'At Risk')
  if (atRisk.length > 0 && forecast.paceStatus !== 'At Risk') {
    forecast.paceStatus = 'At Risk'
    forecast.level = 'Low'
    forecast.riskSource = 'components'
  }
  forecast.atRiskComponents = atRisk.map(c => c.name)
  return forecast
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

// ── Lightweight Monte Carlo for header predicted date ──

const MC_ITERATIONS = 1000
const MC_MAX_DAYS = 730

const predictedDate = computed(() => {
  const mc = props.mcInputs
  if (!mc || mc.notDoneCount <= 0 || mc.totalVelocity <= 0) return null

  const scale = 14 / mc.totalVelocity
  const n = mc.notDoneCount
  const completionDays = new Array(MC_ITERATIONS)
  for (let i = 0; i < MC_ITERATIONS; i++) {
    completionDays[i] = Math.min(Math.ceil(gammaSample(n, scale)), MC_MAX_DAYS)
  }
  completionDays.sort((a, b) => a - b)

  const p95Days = completionDays[Math.ceil(MC_ITERATIONS * 0.95) - 1]
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const p95Date = new Date(today)
  p95Date.setDate(p95Date.getDate() + p95Days)

  return p95Date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })
})

const releaseRiskTitle = computed(() => {
  return props.release?.riskSummary || 'Schedule risk from open issue count vs days to due date.'
})

// ── Styling helpers ──

function riskDotClass(risk) {
  if (risk === 'red') return 'bg-red-500 dark:bg-red-600'
  if (risk === 'yellow') return 'bg-amber-400 dark:bg-amber-500'
  if (risk === 'none') return 'bg-gray-300 dark:bg-gray-600'
  return 'bg-emerald-500 dark:bg-emerald-600'
}

function confidenceBadgeClass(level) {
  if (level === 'High') return 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
  return 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
}

function confidenceDotClass(level) {
  if (level === 'High') return 'bg-emerald-500'
  return 'bg-red-500'
}

function pct(part, total) {
  if (!total || part <= 0) return '0%'
  return `${Math.min(100, (part / total) * 100)}%`
}

function fmtCount(n) {
  if (n == null || !Number.isFinite(Number(n))) return '0'
  return String(Math.round(Number(n)))
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
