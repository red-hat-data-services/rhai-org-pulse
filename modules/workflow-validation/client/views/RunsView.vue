<template>
  <div>
    <div class="mb-4">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Test Runs</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Every workflow run, newest first. Click a row for tasks and linked bugs.</p>
    </div>

    <FilterBar @change="reload" />

    <!-- Active workflow chip (set from Overview drill-down) -->
    <div v-if="filters.workflow" class="mb-4 flex items-center gap-2">
      <span class="text-xs text-gray-500 dark:text-gray-400">Workflow:</span>
      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-100 dark:border-red-800">
        {{ filters.workflow }}
        <button class="hover:text-red-900 dark:hover:text-red-100" @click="clearWorkflow">
          <XIcon :size="13" />
        </button>
      </span>
    </div>

    <div v-if="unreachable" class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-10 text-center">
      <ServerCrashIcon :size="28" class="mx-auto mb-3 text-amber-500" />
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">OpenSearch is unreachable</h3>
      <p class="text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">{{ unreachable }}</p>
    </div>

    <template v-else>
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700/60">
                <th class="px-5 py-3 font-semibold">Verdict</th>
                <th class="px-4 py-3 font-semibold">Workflow</th>
                <th class="px-4 py-3 font-semibold">Version</th>
                <th class="px-4 py-3 font-semibold text-right">Tasks</th>
                <th class="px-4 py-3 font-semibold text-right">AI Cost</th>
                <th class="px-4 py-3 font-semibold text-right">Duration</th>
                <th class="px-4 py-3 font-semibold">Model</th>
                <th class="px-4 py-3 font-semibold text-right">Bugs</th>
                <th class="px-4 py-3 font-semibold">When</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="9" class="px-5 py-10 text-center text-gray-400 dark:text-gray-500">Loading runs…</td>
              </tr>
              <tr
                v-for="r in runs"
                v-else
                :key="r.id"
                class="border-b border-gray-50 dark:border-gray-700/40 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer"
                @click="openRun(r)"
              >
                <td class="px-5 py-3"><StatusBadge :value="r.verdict" /></td>
                <td class="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{{ r.workflow_label }}</td>
                <td class="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-300">{{ r.rhoai_version }}</td>
                <td class="px-4 py-3 text-right font-mono text-xs text-gray-600 dark:text-gray-300">
                  {{ r.tasks_passed }}/{{ r.tasks_total }}
                </td>
                <td class="px-4 py-3 text-right font-mono text-gray-600 dark:text-gray-300">{{ formatUsd(r.cost_usd) }}</td>
                <td class="px-4 py-3 text-right font-mono text-gray-600 dark:text-gray-300">{{ formatDuration(r.duration_s) }}</td>
                <td class="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 max-w-[160px] truncate" :title="r.model">{{ r.model || '—' }}</td>
                <td class="px-4 py-3 text-right">
                  <span v-if="r.bug_count" class="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">{{ r.bug_count }}</span>
                  <span v-else class="text-gray-300 dark:text-gray-600">—</span>
                </td>
                <td class="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{{ formatDate(r.timestamp) }}</td>
              </tr>
              <tr v-if="!loading && !runs.length">
                <td colspan="9" class="px-5 py-10 text-center text-gray-400 dark:text-gray-500">No runs match the current filters</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div class="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-gray-700/60 text-sm">
          <span class="text-gray-500 dark:text-gray-400">
            {{ total ? (page * size + 1) : 0 }}–{{ Math.min((page + 1) * size, total) }} of {{ total }}
          </span>
          <div class="flex items-center gap-2">
            <button class="px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
              :disabled="page === 0 || loading" @click="go(page - 1)">Prev</button>
            <button class="px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
              :disabled="(page + 1) * size >= total || loading" @click="go(page + 1)">Next</button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { inject, onMounted, ref } from 'vue'
import { ServerCrash as ServerCrashIcon, X as XIcon } from 'lucide-vue-next'
import FilterBar from '../components/FilterBar.vue'
import StatusBadge from '../components/StatusBadge.vue'
import {
  filters, useWorkflowValidation, formatUsd, formatDuration, formatDate
} from '../composables/useWorkflowValidation'

const nav = inject('moduleNav')
const { getRuns } = useWorkflowValidation()

const runs = ref([])
const total = ref(0)
const page = ref(0)
const size = ref(25)
const loading = ref(false)
const unreachable = ref('')

async function load() {
  loading.value = true
  unreachable.value = ''
  try {
    const data = await getRuns(page.value, size.value)
    runs.value = data.runs
    total.value = data.total
  } catch (err) {
    if (err.status === 503 || err.data?.code === 'OS_UNREACHABLE') {
      unreachable.value = err.data?.error || err.message
    } else {
      unreachable.value = err.message || 'Failed to load runs'
    }
  } finally {
    loading.value = false
  }
}

function reload() { page.value = 0; load() }
function go(p) { page.value = p; load() }
function clearWorkflow() { filters.workflow = ''; reload() }
function openRun(r) { nav.navigateTo('run-detail', { runKey: r.id || r.run_key }) }

onMounted(load)
</script>
