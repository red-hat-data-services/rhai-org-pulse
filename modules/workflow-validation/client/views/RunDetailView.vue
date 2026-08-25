<template>
  <div>
    <button class="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 mb-4"
      @click="nav.navigateTo('runs')">
      <ChevronLeftIcon :size="16" /> Back to runs
    </button>

    <div v-if="loading" class="text-gray-400 dark:text-gray-500 py-10 text-center">Loading run…</div>
    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center text-red-700 dark:text-red-300">
      {{ error }}
    </div>

    <template v-else-if="run">
      <!-- Header -->
      <div class="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div>
          <div class="flex items-center gap-3 mb-1">
            <StatusBadge :value="run.verdict" />
            <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ run.workflow_label }}</h2>
          </div>
          <p class="text-sm text-gray-500 dark:text-gray-400 font-mono">{{ run.run_key }}</p>
        </div>
      </div>

      <!-- KPI strip -->
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <MetricCard :value="run.rhoai_version" label="Version" />
        <MetricCard :value="run.tasks_passed + '/' + run.tasks_total" label="Tasks Passed"
          :tone="run.tasks_failed ? 'red' : 'green'" />
        <MetricCard :value="formatUsd(run.cost_usd)" label="AI Cost" tone="teal" />
        <MetricCard :value="formatUsd(run.infra_cost_usd)" label="Infra Cost" tone="teal" />
        <MetricCard :value="formatDuration(run.duration_s)" label="Duration" />
        <MetricCard :value="run.num_turns ?? '—'" label="Agent Turns" />
      </div>

      <!-- Meta -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-5 mb-6 text-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-2 gap-x-8">
        <div><span class="text-gray-500 dark:text-gray-400">Model:</span> <span class="text-gray-800 dark:text-gray-200">{{ run.model || '—' }}</span></div>
        <div><span class="text-gray-500 dark:text-gray-400">Provider:</span> <span class="text-gray-800 dark:text-gray-200">{{ run.inference_provider || '—' }}</span></div>
        <div><span class="text-gray-500 dark:text-gray-400">When:</span> <span class="text-gray-800 dark:text-gray-200">{{ formatDate(run.timestamp) }}</span></div>
        <div><span class="text-gray-500 dark:text-gray-400">Cluster:</span> <span class="text-gray-800 dark:text-gray-200 break-all">{{ run.cluster_name || '—' }}</span></div>
        <div v-if="run.classification"><span class="text-gray-500 dark:text-gray-400">RCA:</span> <StatusBadge :value="run.classification" /></div>
        <div v-if="run.rhoaieng_component"><span class="text-gray-500 dark:text-gray-400">Component:</span> <span class="text-gray-800 dark:text-gray-200">{{ run.rhoaieng_component }}</span></div>
      </div>

      <!-- Split pane: root cause (left) + impacted workflows (right) -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <!-- Root cause cards -->
        <div class="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 overflow-hidden">
          <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
            <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">Root Cause Analysis</h3>
            <span class="text-xs text-gray-500 dark:text-gray-400">{{ bugs.length }} finding{{ bugs.length === 1 ? '' : 's' }}</span>
          </div>
          <div v-if="bugs.length" class="divide-y divide-gray-50 dark:divide-gray-700/40">
            <BugRow v-for="b in bugs" :key="b.id" :bug="b" />
          </div>
          <div v-else class="px-6 py-10 text-center">
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ run.verdict === 'PASS' ? 'Clean run — no root-cause findings recorded.' : 'No root-cause findings recorded for this run.' }}
            </p>
            <div v-if="run.classification" class="mt-3 inline-flex items-center gap-2">
              <span class="text-xs text-gray-500 dark:text-gray-400">Run classification:</span>
              <StatusBadge :value="run.classification" />
            </div>
          </div>
        </div>

        <!-- Impacted workflows -->
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 overflow-hidden">
          <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700/60">
            <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">Impacted Workflows</h3>
          </div>
          <div v-if="impactedWorkflows.length" class="p-3 space-y-1.5">
            <div
              v-for="wf in impactedWorkflows"
              :key="wf"
              class="px-3 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/40 flex items-center gap-2"
            >
              <GitBranchIcon :size="14" class="text-gray-400 shrink-0" />
              <span class="truncate">{{ wf }}</span>
            </div>
          </div>
          <p v-else class="px-6 py-8 text-center text-sm text-gray-400 dark:text-gray-500">No linked impact</p>
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
              <span class="text-sm text-gray-800 dark:text-gray-200 font-medium">{{ t.name }}</span>
            </div>
            <p v-if="t.reason" class="text-xs mt-1 pl-1 italic"
              :class="String(t.status).toUpperCase() === 'FAIL' ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'">
              {{ t.reason }}
            </p>
          </div>
        </div>
        <p v-else class="px-6 py-8 text-center text-sm text-gray-400 dark:text-gray-500">No per-task detail recorded for this run</p>
      </div>

      <!-- Summary text -->
      <div v-if="run.summary_text" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-5 mb-6">
        <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">AI Summary</h3>
        <p class="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line">{{ run.summary_text }}</p>
      </div>

    </template>
  </div>
</template>

<script setup>
import { computed, inject, onMounted, ref, watch } from 'vue'
import { ChevronLeft as ChevronLeftIcon, GitBranch as GitBranchIcon } from 'lucide-vue-next'
import MetricCard from '../components/MetricCard.vue'
import StatusBadge from '../components/StatusBadge.vue'
import BugRow from '../components/BugRow.vue'
import { useWorkflowValidation, formatUsd, formatDuration, formatDate } from '../composables/useWorkflowValidation'

const nav = inject('moduleNav')
const { getRun } = useWorkflowValidation()

const run = ref(null)
const bugs = ref([])
const loading = ref(false)
const error = ref('')

const tasks = computed(() => (run.value && Array.isArray(run.value.tasks)) ? run.value.tasks : [])

// Union of every workflow the linked bugs flag as impacted, plus this run's own.
const impactedWorkflows = computed(() => {
  const set = new Set()
  if (run.value?.workflow) set.add(run.value.workflow)
  for (const b of bugs.value) {
    if (Array.isArray(b.impacted_workflows)) b.impacted_workflows.forEach((w) => set.add(w))
    else if (b.workflow) set.add(b.workflow)
  }
  return [...set].sort()
})

async function load() {
  const runKey = nav.params.value?.runKey
  if (!runKey) { error.value = 'No run specified'; return }
  loading.value = true
  error.value = ''
  try {
    const data = await getRun(runKey)
    run.value = data.run
    bugs.value = data.bugs || []
  } catch (err) {
    error.value = err.data?.error || err.message || 'Failed to load run'
  } finally {
    loading.value = false
  }
}

watch(() => nav.params.value?.runKey, load)
onMounted(load)
</script>
