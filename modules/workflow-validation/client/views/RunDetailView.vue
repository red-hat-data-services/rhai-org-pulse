<template>
  <div>
    <div v-if="loading" class="text-gray-400 dark:text-gray-500 py-10 text-center">Loading test…</div>
    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center text-red-700 dark:text-red-300">
      {{ error }}
    </div>

    <template v-else-if="run">
      <!-- Header -->
      <div class="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div>
          <div class="flex items-center gap-3 mb-1">
            <StatusBadge :value="displayedTestOutcome({ ...run, productBugs: bugs })" />
            <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ run.workflow_label || run.workflow || 'Unknown test' }}</h2>
          </div>
          <p class="text-sm text-gray-500 dark:text-gray-400 font-mono break-all">{{ run.execution_id }}</p>
        </div>
        <button v-if="run.workflow" class="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400" @click="openTrend">View test trend →</button>
      </div>

      <div
        v-if="hasPassedTestWithFailedTask"
        role="alert"
        class="flex items-start gap-3 mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200"
      >
        <AlertTriangleIcon :size="18" class="mt-0.5 shrink-0" />
        <p class="text-sm">
          This test is marked passed but with a failed task. An AI judge determines pass and fail statuses for tests and tasks. This verdict represents a corner case and the AI's judgement may have been incorrect.
        </p>
      </div>

      <!-- KPI strip -->
      <div class="flex flex-wrap justify-center gap-4 mb-6 [&>*]:w-[calc(50%-0.5rem)] md:[&>*]:w-[calc(33.333%-0.75rem)] lg:[&>*]:w-[calc(16.666%-0.875rem)]">
        <MetricCard :value="run.rhoai_version" label="Version" />
        <MetricCard :value="formatRatio(run.tasks_passed, run.tasks_total)" label="Tasks Passed"
          :tone="run.tasks_failed == null ? 'neutral' : run.tasks_failed ? 'red' : 'green'" />
        <MetricCard v-if="costsVisible" :value="formatUsd(run.cost_usd)" label="AI Cost" tone="teal" />
        <MetricCard v-if="costsVisible" :value="formatUsd(run.infra_cost_usd)" label="Infra Cost" tone="teal" />
        <MetricCard :value="formatDuration(run.duration_s)" label="Duration" />
        <MetricCard :value="run.num_turns ?? '—'" label="Agent Turns" />
      </div>

      <!-- Meta -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-5 mb-6 text-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-2 gap-x-8">
        <div><span class="text-gray-500 dark:text-gray-400">Model:</span> <span class="text-gray-800 dark:text-gray-200">{{ run.model || '—' }}</span></div>
        <div><span class="text-gray-500 dark:text-gray-400">When:</span> <span class="text-gray-800 dark:text-gray-200">{{ formatDate(run.timestamp) }}</span></div>
        <div><span class="text-gray-500 dark:text-gray-400">Cluster:</span> <span class="text-gray-800 dark:text-gray-200 break-all">{{ run.cluster_name || '—' }}</span></div>
        <div v-if="run.telemetry_origin"><span class="text-gray-500 dark:text-gray-400">Origin:</span> <span class="text-gray-800 dark:text-gray-200">{{ run.telemetry_origin }}</span></div>
        <div v-if="run.classification"><span class="text-gray-500 dark:text-gray-400">RCA:</span> <StatusBadge :value="run.classification" /></div>
        <div v-if="run.rhoaieng_component"><span class="text-gray-500 dark:text-gray-400">Component:</span> <span class="text-gray-800 dark:text-gray-200">{{ run.rhoaieng_component }}</span></div>
      </div>

      <!-- Root cause cards -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 overflow-hidden mb-6">
          <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
            <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">Root Cause Analysis</h3>
            <span class="text-xs text-gray-500 dark:text-gray-400">{{ bugs.length }} finding{{ bugs.length === 1 ? '' : 's' }}</span>
          </div>
          <div v-if="bugs.length" class="divide-y divide-gray-50 dark:divide-gray-700/40">
            <BugRow v-for="b in bugs" :key="b.id" :bug="b" />
          </div>
          <div v-else class="px-6 py-10 text-center">
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ run.verdict === 'PASS' ? 'Clean test — no root-cause findings recorded.' : 'No root-cause findings recorded for this test.' }}
            </p>
            <div v-if="run.classification" class="mt-3 inline-flex items-center gap-2">
              <span class="text-xs text-gray-500 dark:text-gray-400">Test classification:</span>
              <StatusBadge :value="run.classification" />
            </div>
          </div>
      </div>

      <!-- Tasks -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 overflow-hidden mb-6">
        <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700/60">
          <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">Tasks</h3>
        </div>
        <div v-if="tasks.length">
          <div v-for="(t, i) in tasks" :key="i"
            class="px-6 py-3 border-b border-gray-50 dark:border-gray-700/40 last:border-0">
            <div class="flex items-center gap-3">
              <StatusBadge :value="t.status" />
              <span class="text-sm text-gray-800 dark:text-gray-200 font-medium">{{ t.task || 'Unknown task' }}</span>
            </div>
            <p v-if="t.reason" class="text-xs mt-1 pl-1 italic"
              :class="String(t.status).toUpperCase() === 'FAIL' ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'">
              {{ t.reason }}
            </p>
          </div>
        </div>
        <p v-else class="px-6 py-8 text-center text-sm text-gray-400 dark:text-gray-500">No per-task detail recorded for this test</p>
      </div>

      <!-- Summary text -->
      <div v-if="run.summary_text" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-5 mb-6">
        <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">AI Summary</h3>
        <MarkdownContent :content="run.summary_text" />
      </div>

    </template>
  </div>
</template>

<script setup>
import { computed, inject, onMounted, ref, watch } from 'vue'
import { AlertTriangle as AlertTriangleIcon } from 'lucide-vue-next'
import MetricCard from '../components/MetricCard.vue'
import StatusBadge from '../components/StatusBadge.vue'
import BugRow from '../components/BugRow.vue'
import MarkdownContent from '../components/MarkdownContent.vue'
import { useCostVisibility } from '../composables/useCostVisibility'
import { displayedTestOutcome, useWorkflowValidation, formatUsd, formatDuration, formatDate, formatRatio } from '../composables/useWorkflowValidation'

const nav = inject('moduleNav')
const { getRun } = useWorkflowValidation()
const costsVisible = useCostVisibility()

const run = ref(null)
const bugs = ref([])
const tasks = ref([])
const loading = ref(false)
const error = ref('')
const hasPassedTestWithFailedTask = computed(() =>
  String(run.value?.verdict || '').toUpperCase() === 'PASS' && (
    Number(run.value?.tasks_failed) > 0 || tasks.value.some((task) =>
      String(task.status || '').toUpperCase() === 'FAIL' || task.passed === false)
  ))

function openTrend() { nav.navigateTo('workflow-history', { workflow: run.value.workflow }) }

async function load() {
  const runKey = nav.params.value?.runKey
  if (!runKey) { error.value = 'No test specified'; return }
  loading.value = true
  error.value = ''
  try {
    const data = await getRun(runKey)
    run.value = data.run
    tasks.value = data.tasks || []
    bugs.value = data.bugs || []
  } catch (err) {
    error.value = err.data?.error || err.message || 'Failed to load test'
  } finally {
    loading.value = false
  }
}

watch(() => nav.params.value?.runKey, load)
onMounted(load)
</script>
