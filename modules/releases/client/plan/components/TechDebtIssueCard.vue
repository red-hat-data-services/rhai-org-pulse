<template>
  <article
    class="group relative rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600"
    :data-testid="`tech-debt-${pane}-card`"
  >
    <div class="flex items-start gap-3">
      <div
        v-if="rank"
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-900 text-sm font-bold text-white dark:bg-gray-100 dark:text-gray-900"
        :aria-label="`Tech debt backlog rank ${rank}`"
      >
        {{ rank }}
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <a
            :href="issue.link"
            target="_blank"
            rel="noopener noreferrer"
            class="font-semibold text-primary-700 hover:underline dark:text-primary-300"
          >
            {{ issue.key }}
            <span class="sr-only">(opens in a new tab)</span>
          </a>
          <span :class="issueTypeClass" data-testid="tech-debt-issue-type">
            {{ issue.issueType }}
          </span>
          <span :class="priorityClass" data-testid="tech-debt-priority">
            {{ issue.jiraPriority }}
          </span>
        </div>
        <h4 class="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-gray-900 dark:text-gray-100">
          {{ issue.summary || 'No summary' }}
        </h4>
      </div>
    </div>

    <div class="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 dark:border-gray-700">
      <span :class="statusClass" data-testid="tech-debt-status">
        {{ issue.status }}
      </span>
      <span
        v-if="hasPriorityScore"
        :class="scoreBadgeClass"
        data-testid="tech-debt-score"
      >
        {{ scoreBadgeText }}
      </span>
      <span v-else class="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
        Score pending
      </span>
    </div>

    <div v-if="isScoredBug" class="mt-3 flex flex-wrap gap-1.5" data-testid="tech-debt-bug-classification">
      <span class="rounded-full bg-indigo-100 px-2 py-1 text-[11px] font-bold text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200">
        {{ issue.primaryBugType?.label || 'Unclassified Bug' }}
      </span>
      <span
        v-for="signal in secondaryClassificationSignals"
        :key="signal.code"
        class="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300"
      >
        {{ signal.label }}
      </span>
    </div>

    <div v-if="issue.triageFlags?.length" class="mt-3 flex flex-wrap gap-1.5" data-testid="tech-debt-triage-flags">
      <span
        v-for="flag in issue.triageFlags"
        :key="flag.code"
        :class="flag.code === 'sla-breached' ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'"
        class="rounded-full px-2 py-1 text-[11px] font-semibold"
      >
        {{ flag.label }}
      </span>
    </div>

    <details v-if="hasPriorityScore" :class="scoreBreakdownClass" data-testid="tech-debt-score-breakdown">
      <summary :class="scoreSummaryClass">
        Score breakdown · {{ issue.priorityBand.label }}
      </summary>
      <p class="mt-2 font-medium text-gray-700 dark:text-gray-200">{{ scoreEquation }}</p>
      <dl class="mt-2 grid gap-1 text-gray-600 dark:text-gray-300">
        <div v-for="row in breakdownRows" :key="row.label" class="flex justify-between gap-3">
          <dt>{{ row.label }} · {{ row.state }}</dt>
          <dd class="shrink-0 font-semibold">+{{ row.points }}</dd>
        </div>
      </dl>
      <div v-if="isScoredBug && issue.classificationSignals?.length" class="mt-2 border-t border-current/10 pt-2 text-gray-600 dark:text-gray-300">
        <p class="font-semibold text-gray-700 dark:text-gray-200">Classification evidence</p>
        <p v-for="signal in issue.classificationSignals" :key="signal.code" class="mt-1">
          <strong>{{ signal.label }}:</strong> {{ signal.evidence }}
        </p>
      </div>
      <div v-if="issue.guardrail?.applied" class="mt-2 rounded-md bg-orange-100 px-2 py-1.5 text-orange-900 dark:bg-orange-900/40 dark:text-orange-100" data-testid="tech-debt-guardrail">
        <p v-for="reason in issue.guardrail.reasons" :key="reason">{{ reason }}</p>
        <p class="mt-1 font-semibold">Effective score raised from {{ issue.rawScore }} to {{ issue.priorityScore }}.</p>
      </div>
      <p class="mt-2 text-gray-500 dark:text-gray-400">{{ issue.priorityBand.expectedAction }}</p>
    </details>

    <dl class="mt-3 grid grid-cols-1 gap-2 text-xs text-gray-600 sm:grid-cols-2 dark:text-gray-300">
      <div>
        <dt class="font-semibold uppercase tracking-wide text-gray-400">Assignee</dt>
        <dd class="mt-0.5 truncate">{{ issue.assignee?.name || 'Unassigned' }}</dd>
      </div>
      <div>
        <dt class="font-semibold uppercase tracking-wide text-gray-400">Due</dt>
        <dd class="mt-0.5">{{ formatDate(issue.dueDate) }}</dd>
      </div>
      <div>
        <dt class="font-semibold uppercase tracking-wide text-gray-400">Updated</dt>
        <dd class="mt-0.5">{{ formatAge(issue.updatedAt) }}</dd>
      </div>
      <div>
        <dt class="font-semibold uppercase tracking-wide text-gray-400">Fix version</dt>
        <dd class="mt-0.5 truncate">{{ issue.fixVersions?.join(', ') || 'None' }}</dd>
      </div>
    </dl>

    <div v-if="issue.components?.length" class="mt-3 flex flex-wrap gap-1.5">
      <span
        v-for="component in issue.components"
        :key="component"
        class="rounded-md bg-gray-50 px-2 py-1 text-xs text-gray-600 dark:bg-gray-700/70 dark:text-gray-300"
      >
        {{ component }}
      </span>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  issue: { type: Object, required: true },
  pane: { type: String, required: true },
  rank: { type: Number, default: null }
})

const isScoredVulnerability = computed(function () {
  return props.issue.issueType?.toLowerCase() === 'vulnerability' && props.issue.scoreStatus === 'scored'
})

const isScoredBug = computed(function () {
  return props.issue.issueType?.toLowerCase() === 'bug' && ['scored', 'preview'].includes(props.issue.scoreStatus)
})

const hasPriorityScore = computed(function () {
  return isScoredVulnerability.value || isScoredBug.value
})

const secondaryClassificationSignals = computed(function () {
  const primaryCode = props.issue.primaryBugType?.code
  return (props.issue.classificationSignals || []).filter(function (signal) {
    return signal.code !== primaryCode && signal.code !== 'component-team'
  })
})

const breakdownRows = computed(function () {
  const breakdown = props.issue.scoreBreakdown || {}
  if (isScoredBug.value) {
    return [
      { label: 'Customer', ...breakdown.customerImpact },
      { label: 'Delivery/security', ...breakdown.deliverySecurity },
      { label: 'Detection', ...breakdown.detectionSource },
      { label: 'Jira severity', ...breakdown.jiraSeverity },
      { label: 'Due date', ...breakdown.dueDate },
      { label: 'Age', ...breakdown.age }
    ]
  }
  return [
    { label: 'SLA', ...breakdown.sla },
    { label: 'CVSS', ...breakdown.cvss },
    { label: 'Due date', ...breakdown.dueDate },
    { label: 'Review', ...breakdown.reviewOutcome },
    { label: 'Age', ...breakdown.age },
    { label: 'Uncertainty', ...breakdown.uncertainty }
  ]
})

const scoreEquation = computed(function () {
  const labels = isScoredBug.value ? [
    ['Customer', props.issue.scoreBreakdown?.customerImpact?.points || 0],
    ['Delivery/security', props.issue.scoreBreakdown?.deliverySecurity?.points || 0],
    ['Detection', props.issue.scoreBreakdown?.detectionSource?.points || 0],
    ['Jira severity', props.issue.scoreBreakdown?.jiraSeverity?.points || 0],
    ['Due', props.issue.scoreBreakdown?.dueDate?.points || 0],
    ['Age', props.issue.scoreBreakdown?.age?.points || 0]
  ] : [
    ['SLA', props.issue.scoreBreakdown?.sla?.points || 0],
    ['CVSS', props.issue.scoreBreakdown?.cvss?.points || 0],
    ['Due', props.issue.scoreBreakdown?.dueDate?.points || 0],
    ['Review', props.issue.scoreBreakdown?.reviewOutcome?.points || 0],
    ['Age', props.issue.scoreBreakdown?.age?.points || 0],
    ['Uncertainty', props.issue.scoreBreakdown?.uncertainty?.points || 0]
  ]
  return labels.map(function ([label, points]) { return `${points} ${label}` }).join(' + ') + ` = ${props.issue.rawScore}`
})

const scoreBadgeText = computed(function () {
  return `${props.issue.priorityBand?.level || '—'} · ${props.issue.priorityScore}`
})

const scoreBreakdownClass = computed(function () {
  const base = 'mt-3 rounded-lg border px-3 py-2 text-xs '
  return isScoredBug.value
    ? base + 'border-indigo-100 bg-indigo-50/60 dark:border-indigo-900/50 dark:bg-indigo-950/20'
    : base + 'border-fuchsia-100 bg-fuchsia-50/60 dark:border-fuchsia-900/50 dark:bg-fuchsia-950/20'
})

const scoreSummaryClass = computed(function () {
  const base = 'cursor-pointer font-semibold '
  return isScoredBug.value
    ? base + 'text-indigo-800 dark:text-indigo-200'
    : base + 'text-fuchsia-800 dark:text-fuchsia-200'
})

const scoreBadgeClass = computed(function () {
  const base = 'rounded-full px-2.5 py-1 text-xs font-bold '
  const level = props.issue.priorityBand?.level
  if (level === 'P0') return base + 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
  if (level === 'P1') return base + 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200'
  if (level === 'P2') return base + 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
  if (level === 'P3') return base + 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200'
  return base + 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
})

const issueTypeClass = computed(function () {
  const base = 'rounded-full px-2.5 py-1 text-xs font-semibold '
  return props.issue.issueType?.toLowerCase() === 'vulnerability'
    ? base + 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-200'
    : base + 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
})

const priorityClass = computed(function () {
  const base = 'rounded-full px-2.5 py-1 text-xs font-semibold '
  const priority = String(props.issue.jiraPriority || '').toLowerCase()
  if (['blocker', 'highest', 'critical'].includes(priority)) return base + 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
  if (['high', 'major'].includes(priority)) return base + 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200'
  if (['medium', 'normal'].includes(priority)) return base + 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
  return base + 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
})

const statusClass = computed(function () {
  const base = 'rounded-full px-2.5 py-1 text-xs font-semibold '
  const status = String(props.issue.status || '').toLowerCase()
  if (status === 'in progress') return base + 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200'
  if (status === 'review') return base + 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
  return base + 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
})

function formatDate(value) {
  if (!value) return 'No due date'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No due date'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatAge(value) {
  if (!value) return 'Unknown'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000))
  if (days === 0) return 'Today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}
</script>
