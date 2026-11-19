<template>
  <section aria-labelledby="version-summary-heading" class="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
    <div class="flex flex-wrap items-start justify-between gap-5 px-6 pb-6 pt-6">
      <div>
        <div class="flex flex-wrap items-center gap-3">
          <h3 id="version-summary-heading" class="text-lg font-semibold text-gray-900 dark:text-gray-100">Version summary</h3>
          <span class="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">TL;DR</span>
        </div>
        <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">All suite runs for this version selection. Outcomes count individual tasks.</p>
      </div>
      <label class="block w-full text-xs font-semibold text-gray-500 sm:w-52 dark:text-gray-400">
        RHOAI version
        <select :value="modelValue" aria-label="Summary RHOAI version"
          class="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 font-mono text-sm font-medium text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          @change="$emit('update:modelValue', $event.target.value)">
          <option value="">All versions</option>
          <option v-if="selectionLabel" value="__selected_versions__" disabled>{{ selectionLabel }}</option>
          <option v-for="version in versions" :key="version" :value="version">{{ version }}</option>
        </select>
      </label>
    </div>

    <dl aria-live="polite" class="grid grid-cols-2 gap-px border-y border-gray-100 bg-gray-100 sm:grid-cols-3 xl:grid-cols-7 dark:border-gray-700 dark:bg-gray-700">
      <div v-for="metric in metrics" :key="metric.key" :data-testid="`summary-${metric.key}`" class="bg-white px-5 py-5 dark:bg-gray-800">
        <dt class="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
          <component :is="metric.icon" :size="15" aria-hidden="true" :class="metric.tone" />
          {{ metric.label }}
        </dt>
        <dd class="mt-3 text-3xl font-semibold tracking-tight tabular-nums" :class="metric.tone || 'text-gray-900 dark:text-gray-100'">{{ formatCount(summary[metric.key]) }}</dd>
        <dd class="mt-1 text-xs text-gray-400 dark:text-gray-500">{{ summary[metric.key] == null ? 'Count unavailable' : metric.description }}</dd>
      </div>
    </dl>

    <div class="px-6 py-5">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span class="font-medium text-gray-600 dark:text-gray-300">Task outcomes</span>
        <span class="text-gray-500 dark:text-gray-400">{{ completeOutcomes ? `${passRate}% passed` : summary.tasks === 0 ? 'No tasks recorded' : 'Task outcomes unavailable' }}</span>
      </div>
      <div role="img" :aria-label="completeOutcomes || summary.tasks === 0 ? `${formatCount(summary.passed)} passed, ${formatCount(summary.failed)} failed, ${formatCount(summary.skipped)} skipped tasks` : 'Task outcomes unavailable'"
        class="flex h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
        <div v-for="outcome in outcomes" :key="outcome.key" :class="outcome.color" :style="{ width: `${completeOutcomes ? summary[outcome.key] / summary.tasks * 100 : 0}%` }" />
      </div>
      <div class="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-500 dark:text-gray-400">
        <span v-for="outcome in outcomes" :key="outcome.key" class="inline-flex items-center gap-1.5">
          <span aria-hidden="true" class="h-2 w-2 rounded-full" :class="outcome.color" />{{ outcome.label }}
        </span>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { Layers, GitBranch, ListChecks, CircleCheck, CircleX, SkipForward, Bug } from 'lucide-vue-next'

const props = defineProps({
  modelValue: { type: String, required: true },
  selectionLabel: { type: String, default: '' },
  versions: { type: Array, required: true },
  summary: { type: Object, required: true }
})
defineEmits(['update:modelValue'])

const formatCount = value => value == null ? '—' : new Intl.NumberFormat('en-US').format(value)
const completeOutcomes = computed(() => props.summary.tasks > 0 && ['tasks', 'passed', 'failed', 'skipped'].every(key => Number.isSafeInteger(props.summary[key]) && props.summary[key] >= 0)
  && props.summary.passed + props.summary.failed + props.summary.skipped === props.summary.tasks)
const passRate = computed(() => Math.round(props.summary.passed / props.summary.tasks * 100))
const metrics = [
  { key: 'suiteRuns', label: 'Test suite runs', description: 'Suite invocations', icon: Layers },
  { key: 'workflows', label: 'Workflows', description: 'Workflow executions', icon: GitBranch },
  { key: 'tasks', label: 'Tasks', description: 'Across all workflows', icon: ListChecks },
  { key: 'passed', label: 'Passed', description: 'Tasks completed', icon: CircleCheck, tone: 'text-emerald-600 dark:text-emerald-400' },
  { key: 'failed', label: 'Failed', description: 'Tasks that failed', icon: CircleX, tone: 'text-red-600 dark:text-red-400' },
  { key: 'skipped', label: 'Skipped', description: 'Tasks skipped', icon: SkipForward, tone: 'text-amber-600 dark:text-amber-400' },
  { key: 'bugs', label: 'Total bugs', description: 'Unique Jira issues', icon: Bug }
]
const outcomes = [
  { key: 'passed', label: 'Passed', color: 'bg-emerald-500' },
  { key: 'failed', label: 'Failed', color: 'bg-red-500' },
  { key: 'skipped', label: 'Skipped', color: 'bg-amber-400' }
]
</script>
