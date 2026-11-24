<template>
  <section aria-labelledby="version-summary-heading" class="version-summary rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
    <header class="border-b border-gray-100 px-4 py-3 dark:border-gray-700 sm:px-5">
      <h3 id="version-summary-heading" class="text-lg font-semibold text-gray-900 dark:text-gray-100">Version summary</h3>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">Counts include all matching runs across pages.</p>
    </header>

    <div aria-live="polite" class="summary-body grid gap-3 p-3 sm:p-4">
      <div class="min-w-0 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <dl>
            <div data-testid="summary-tasks">
              <dt class="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                <ListChecks :size="16" aria-hidden="true" /> Total tasks
              </dt>
              <dd class="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-gray-900 dark:text-gray-100">{{ formatCount(summary.tasks) }}</dd>
            </div>
          </dl>
          <p v-if="hasDistribution" class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ passRate }} passed</p>
        </div>

        <dl aria-label="Task outcomes" class="summary-outcomes mt-3 grid grid-cols-3 gap-2">
          <div v-for="outcome in outcomes" :key="outcome.key" :data-testid="`summary-${outcome.key}`"
            class="compact-count min-w-0 rounded-lg px-2 py-2 text-white sm:px-3" :class="outcome.background">
            <dt class="text-xs font-medium">{{ outcome.label }}</dt>
            <dd class="mt-1 text-base font-semibold leading-tight tabular-nums [overflow-wrap:anywhere] sm:text-xl">
              {{ formatCount(summary[outcome.key]) }}<span v-if="summary[outcome.key] == null" class="sr-only"> Count unavailable</span>
            </dd>
          </div>
        </dl>

        <div v-if="hasDistribution" role="img" :aria-label="`${formatCount(summary.passed)} passed, ${formatCount(summary.failed)} failed, ${formatCount(summary.skipped)} skipped tasks`"
          class="mt-3 flex h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
          <div v-for="outcome in outcomes" :key="outcome.key" :class="outcome.barColor" :style="{ width: `${summary[outcome.key] / summary.tasks * 100}%` }" />
        </div>
        <p v-else class="mt-3 text-xs text-gray-600 dark:text-gray-300">{{ outcomeNotice }}</p>
      </div>

      <dl class="summary-context grid min-w-0 grid-cols-2 gap-2">
        <div v-for="metric in contextMetrics" :key="metric.key" :data-testid="`summary-${metric.key}`"
          class="compact-count min-w-0 rounded-xl border border-gray-200 px-3 py-2 dark:border-gray-700">
          <dt class="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">
            <component :is="metric.icon" :size="15" class="shrink-0" aria-hidden="true" /> {{ metric.label }}
          </dt>
          <dd class="mt-1 text-xl font-semibold tabular-nums text-gray-900 [overflow-wrap:anywhere] dark:text-gray-100">{{ formatCount(summary[metric.key]) }}</dd>
          <dd v-if="summary[metric.key] == null" class="text-xs text-gray-600 dark:text-gray-300">Count unavailable</dd>
        </div>
        <div data-testid="summary-bugs" class="col-span-full rounded-xl bg-red-800 px-3 py-2 text-white">
          <dt class="flex items-center gap-1.5 text-xs font-medium"><Bug :size="15" aria-hidden="true" /> Total bugs</dt>
          <dd class="mt-1 text-xl font-semibold tabular-nums"
            :title="summary.bugsIncomplete ? 'Some Jira issue references could not be verified.' : undefined">
            <a v-if="summary.bugs > 0 && bugUrl" :href="bugUrl" target="_blank" rel="noopener noreferrer"
              :aria-label="summary.bugJql ? 'Open Jira advanced search (opens in a new tab)' : `Open ${formatCount(summary.bugs)} verified Jira issues (opens in a new tab)`"
              class="text-white underline underline-offset-2 hover:decoration-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{{ formatCount(summary.bugs) }}</a>
            <template v-else>{{ formatCount(summary.bugs) }}</template>
          </dd>
          <dd v-if="summary.bugs == null || !summary.bugsIncomplete" class="text-xs">{{ summary.bugs == null ? 'Count unavailable' : 'Unique Jira issues' }}</dd>
        </div>
      </dl>
    </div>

    <details v-if="bugUrl && summary.bugJql" class="px-4 pb-4 text-sm text-gray-700 dark:text-gray-200 sm:px-5">
      <summary class="cursor-pointer font-medium">Show Jira query</summary>
      <label class="mt-2 block">Copy this query into Jira’s advanced search.
        <textarea readonly :value="summary.bugJql" rows="3" class="mt-1 block w-full rounded border border-gray-300 bg-transparent p-2 font-mono text-xs dark:border-gray-600" @focus="$event.target.select()" />
      </label>
    </details>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { Layers, GitBranch, ListChecks, Bug } from 'lucide-vue-next'
import { safeExternalUrl } from '../utils/external-url'

const props = defineProps({ summary: { type: Object, required: true }, showBugSearch: { type: Boolean, default: true } })
const bugUrl = computed(() => props.showBugSearch ? safeExternalUrl(props.summary.bugUrl) : '')

const formatter = new Intl.NumberFormat('en-US')
const formatCount = value => value == null ? '—' : formatter.format(value)
const contextMetrics = [
  { key: 'suiteRuns', label: 'Test suite runs', icon: Layers },
  { key: 'workflows', label: 'Workflow executions', icon: GitBranch }
]
const outcomes = [
  { key: 'passed', label: 'Passed', background: 'bg-emerald-700', barColor: 'bg-emerald-500' },
  { key: 'failed', label: 'Failed', background: 'bg-red-700', barColor: 'bg-red-500' },
  { key: 'skipped', label: 'Skipped', background: 'bg-yellow-800', barColor: 'bg-yellow-500' }
]
const outcomeNotice = computed(() => {
  const { tasks, passed, failed, skipped } = props.summary
  if (![tasks, passed, failed, skipped].every(value => Number.isSafeInteger(value) && value >= 0)) return 'Some task counts are unavailable.'
  if (passed + failed + skipped !== tasks) return 'Task outcomes do not add up to Total tasks.'
  return tasks === 0 ? 'No tasks recorded' : ''
})
const hasDistribution = computed(() => !outcomeNotice.value)
const passRate = computed(() => {
  const { passed, tasks } = props.summary
  const rounded = Math.round(passed / tasks * 100)
  if (rounded === 100 && passed < tasks) return '>99%'
  if (rounded === 0 && passed > 0) return '<1%'
  return `${rounded}%`
})
</script>

<style scoped>
.version-summary {
  container-type: inline-size;
}
@container (min-width: 40rem) {
  .summary-body {
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  }
}
@container (max-width: 22rem) {
  .summary-outcomes, .summary-context {
    grid-template-columns: minmax(0, 1fr);
  }
  .compact-count {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.25rem 0.5rem;
  }
  .compact-count > dd:first-of-type {
    margin-top: 0;
    text-align: right;
  }
  .compact-count > dd + dd {
    grid-column: 1 / -1;
  }
}
</style>
