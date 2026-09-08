<template>
  <div>
    <div class="mb-4">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Activity</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
        Root causes classified by the RCA agent, including JIRA and spec-fix actions.
      </p>
    </div>

    <FilterBar @change="reload" />

    <div v-if="unreachable" class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-10 text-center">
      <ServerCrashIcon :size="28" class="mx-auto mb-3 text-amber-500" />
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">OpenSearch is unreachable</h3>
      <p class="text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">{{ unreachable }}</p>
    </div>

    <template v-else>
      <!-- KPIs -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard :value="kpis.total" label="Root Causes" tone="amber" />
        <MetricCard :value="kpis.opened" label="Opened (Filed)" tone="red" />
        <MetricCard :value="kpis.distinctJira" label="Distinct JIRA" tone="teal" />
        <MetricCard :value="specFixCount" label="Spec Fixes" tone="neutral" />
      </div>

      <!-- Action filter chips -->
      <div class="flex flex-wrap items-center gap-2 mb-5">
        <span class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mr-1">Activity type</span>
        <button
          class="px-3 py-1 rounded-full text-xs font-medium border transition"
          :class="!filters.action ? 'bg-red-600 text-white border-red-600' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600'"
          @click="setAction('')"
        >All</button>
        <button
          v-for="a in byAction"
          :key="a.action"
          class="px-3 py-1 rounded-full text-xs font-medium border transition inline-flex items-center gap-1.5"
          :class="filters.action === a.action ? 'bg-red-600 text-white border-red-600' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600'"
          @click="setAction(a.action)"
        >{{ actionLabel(a.action) }} <span class="opacity-60">{{ a.count }}</span></button>
      </div>

      <!-- Data-source note -->
      <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/60 rounded-lg px-4 py-2.5 mb-6 text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2">
        <InfoIcon :size="15" class="mt-0.5 shrink-0" />
        <span>JIRA status shown reflects the value captured at indexing time (no live JIRA call in this POC), and spec-fix merge-request links are not present in the dataset.</span>
      </div>

      <!-- Activity feed -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
          <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">Activity Feed</h3>
          <span class="text-xs text-gray-500 dark:text-gray-400">{{ total }} records</span>
        </div>
        <div v-if="loading" class="px-6 py-10 text-center text-gray-400 dark:text-gray-500">Loading activity…</div>
        <div v-else-if="bugs.length" class="divide-y divide-gray-50 dark:divide-gray-700/40">
          <BugRow v-for="b in bugs" :key="b.id" :bug="b" />
        </div>
        <p v-else class="px-6 py-10 text-center text-sm text-gray-400 dark:text-gray-500">No activity matches the current filters</p>

        <div class="flex items-center justify-between px-6 py-3 border-t border-gray-100 dark:border-gray-700/60 text-sm">
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
import { computed, onMounted, reactive, ref } from 'vue'
import { ServerCrash as ServerCrashIcon, Info as InfoIcon } from 'lucide-vue-next'
import FilterBar from '../components/FilterBar.vue'
import MetricCard from '../components/MetricCard.vue'
import BugRow from '../components/BugRow.vue'
import { filters, useWorkflowValidation } from '../composables/useWorkflowValidation'

const { getBugs } = useWorkflowValidation()

const bugs = ref([])
const total = ref(0)
const page = ref(0)
const size = ref(50)
const loading = ref(false)
const unreachable = ref('')
const kpis = reactive({ total: 0, opened: 0, distinctJira: 0 })
const byAction = ref([])

const specFixCount = computed(() => (byAction.value.find((a) => a.action === 'SPEC_FIX') || {}).count || 0)

function actionLabel(a) {
  return { FILED: 'Filed', MATCH: 'Matched', EXISTING: 'Existing', SPEC_FIX: 'Spec fix', NONE: 'No action' }[a] || a
}

async function load() {
  loading.value = true
  unreachable.value = ''
  try {
    const data = await getBugs(page.value, size.value)
    bugs.value = data.bugs
    total.value = data.total
    Object.assign(kpis, data.kpis)
    byAction.value = data.byAction
  } catch (err) {
    if (err.status === 503 || err.data?.code === 'OS_UNREACHABLE') {
      unreachable.value = err.data?.error || err.message
    } else {
      unreachable.value = err.message || 'Failed to load activity'
    }
  } finally {
    loading.value = false
  }
}

function reload() { page.value = 0; load() }
function go(p) { page.value = p; load() }
function setAction(a) { filters.action = a; reload() }

onMounted(load)
</script>
