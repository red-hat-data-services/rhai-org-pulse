<script setup>
import { ref, computed, watch, inject } from 'vue'
import { ArrowLeftIcon, ExternalLinkIcon, CheckCircle2Icon, XCircleIcon, ChevronDownIcon } from 'lucide-vue-next'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler
} from 'chart.js'
import { useDisconnectedReadiness } from '../composables/useDisconnectedReadiness.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

const nav = inject('moduleNav')
const { loadRepoDetail } = useDisconnectedReadiness()

const detail = ref(null)
const loading = ref(false)
const error = ref(null)

const repoKey = computed(() => nav.params.value?.repo)

watch(repoKey, async (key) => {
  if (!key) return
  loading.value = true
  error.value = null
  try {
    detail.value = await loadRepoDetail(key)
  } catch (err) {
    error.value = err.message || 'Failed to load report'
  } finally {
    loading.value = false
  }
}, { immediate: true })

const report = computed(() => detail.value?.latest)
const history = computed(() => detail.value?.history || [])

const totalBlockers = computed(() => report.value?.blockerCount || 0)
const totalInfos = computed(() => report.value?.infoCount || 0)
const rulesPassed = computed(() => report.value?.rulesPassedCount || 0)
const totalRules = computed(() => report.value?.ruleCount || 0)

const trendEntries = computed(() => {
  if (!report.value) return []
  const current = { blockerCount: report.value.blockerCount, score: report.value.score, date: report.value.date }
  return [...history.value].reverse().concat([current])
})

const trendChartData = computed(() => ({
  labels: trendEntries.value.map(e =>
    new Date(e.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  ),
  datasets: [{
    label: 'Blockers',
    data: trendEntries.value.map(e => e.blockerCount),
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    fill: true,
    tension: 0.3,
    pointRadius: 3,
    pointBackgroundColor: trendEntries.value.map(e =>
      e.score === 'READY' ? '#10b981' : '#ef4444'
    )
  }]
}))

const trendChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx) => ctx.parsed.y + ' blocker' + (ctx.parsed.y !== 1 ? 's' : '')
      }
    }
  },
  scales: {
    x: {
      ticks: { font: { size: 9 }, maxRotation: 0 },
      grid: { display: false }
    },
    y: {
      min: 0,
      ticks: { font: { size: 9 }, stepSize: 1, precision: 0 },
      grid: { color: 'rgba(0,0,0,0.05)' }
    }
  }
}

const repoUrl = computed(() => {
  if (!report.value?.repo) return null
  return 'https://github.com/' + report.value.repo
})

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  })
}

const expandedRules = ref(new Set())

function toggleRule(ruleName) {
  if (expandedRules.value.has(ruleName)) {
    expandedRules.value.delete(ruleName)
  } else {
    expandedRules.value.add(ruleName)
  }
}
</script>

<template>
  <div class="max-w-5xl">
    <button
      @click="nav.navigateTo('component-maturity', { tab: 'disconnected' })"
      class="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mb-4 transition-colors"
    >
      <ArrowLeftIcon :size="14" />
      Back to Disconnected readiness
    </button>

    <div v-if="loading" class="space-y-4">
      <div class="animate-pulse">
        <div class="h-7 w-64 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
        <div class="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
      <div class="grid grid-cols-3 gap-4">
        <div v-for="i in 3" :key="i" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
          <div class="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded mb-1" />
          <div class="h-3 w-12 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    </div>

    <div v-else-if="error" class="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg p-4 text-red-700 dark:text-red-400 text-sm">{{ error }}</div>

    <div v-else-if="report" class="space-y-6">
      <div>
        <div class="flex items-center gap-3 flex-wrap">
          <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">{{ report.repo }}</h2>
          <span class="inline-block px-2.5 py-0.5 rounded border text-xs font-semibold"
            :class="{
              'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-green-300 dark:border-green-500/30': report.score === 'READY',
              'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-red-300 dark:border-red-500/30': report.score === 'NOT READY'
            }">{{ report.score }}</span>
          <a v-if="repoUrl" :href="repoUrl" target="_blank" rel="noopener noreferrer"
            class="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400">
            GitHub <ExternalLinkIcon :size="12" />
          </a>
        </div>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Last scanned: {{ formatDate(report.date) }}</p>
      </div>

      <div class="grid grid-cols-3 gap-4">
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div class="text-2xl font-bold tabular-nums" :class="totalBlockers > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'">{{ totalBlockers }}</div>
          <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Blockers</div>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div class="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{{ totalInfos }}</div>
          <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Infos</div>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div class="text-2xl font-bold tabular-nums" :class="rulesPassed === totalRules ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-gray-100'">{{ rulesPassed }}/{{ totalRules }}</div>
          <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Rules passed</div>
        </div>
      </div>

      <!-- Blocker Trend Chart -->
      <div v-if="trendEntries.length > 1" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Blocker trend</h3>
        <div class="h-[140px]">
          <Line :data="trendChartData" :options="trendChartOptions" />
        </div>
        <p class="text-[10px] text-gray-400 dark:text-gray-500 mt-2">
          Green dots = READY, red dots = NOT READY. One data point per day, up to 90 days.
        </p>
      </div>

      <div>
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Rules</h3>
        <div class="space-y-2">
          <div v-for="rule in report.rules" :key="rule.name"
            class="border-l-4 rounded-lg border bg-white dark:bg-gray-800 overflow-hidden"
            :class="rule.passed ? 'border-l-green-500 border-gray-200 dark:border-gray-700' : 'border-l-red-500 border-gray-200 dark:border-gray-700'">
            <div class="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
              @click="rule.findings.length > 0 && toggleRule(rule.name)">
              <div class="flex items-center gap-2.5">
                <CheckCircle2Icon v-if="rule.passed" :size="16" class="text-green-500 shrink-0" />
                <XCircleIcon v-else :size="16" class="text-red-500 shrink-0" />
                <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ rule.name }}</span>
              </div>
              <div class="flex items-center gap-4 text-xs">
                <span v-if="rule.blockers > 0" class="font-semibold text-red-600 dark:text-red-400">{{ rule.blockers }} blocker{{ rule.blockers !== 1 ? 's' : '' }}</span>
                <span v-if="rule.infos > 0" class="text-gray-500 dark:text-gray-400">{{ rule.infos }} info{{ rule.infos !== 1 ? 's' : '' }}</span>
                <ChevronDownIcon v-if="rule.findings.length > 0" :size="14" class="text-gray-400 transition-transform" :class="{ 'rotate-180': expandedRules.has(rule.name) }" />
              </div>
            </div>

            <div v-if="expandedRules.has(rule.name) && rule.findings.length > 0"
              class="border-t border-gray-100 dark:border-gray-700 px-4 py-3 space-y-2 bg-gray-50/50 dark:bg-gray-800/50">
              <div v-for="(f, idx) in rule.findings" :key="idx" class="flex items-start gap-2 text-xs">
                <span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 mt-0.5"
                  :class="f.severity === 'blocker' ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400' : 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400'">{{ f.severity }}</span>
                <span v-if="f.file" class="text-gray-700 dark:text-gray-300 font-mono shrink-0">{{ f.file }}<span v-if="f.line">:{{ f.line }}</span></span>
                <span class="text-gray-500 dark:text-gray-400">{{ f.message }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <details v-if="report.false_positive_help?.exception_snippets?.length"
        class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <summary class="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
          Exception help ({{ report.false_positive_help.exception_snippets.length }} snippet{{ report.false_positive_help.exception_snippets.length !== 1 ? 's' : '' }})
        </summary>
        <div class="border-t border-gray-100 dark:border-gray-700 px-4 py-3 space-y-3">
          <p class="text-xs text-gray-500 dark:text-gray-400">
            Add these to the central <code class="text-xs bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">config/config.yaml</code> in the disconnected-readiness-scorer repo to mark false positives:
          </p>
          <pre v-for="(snippet, idx) in report.false_positive_help.exception_snippets" :key="idx"
            class="text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md p-3 overflow-x-auto text-gray-700 dark:text-gray-300">{{ snippet }}</pre>
        </div>
      </details>

      <div v-if="history.length > 0">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">History ({{ history.length }})</h3>
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 dark:border-gray-700">
                <th class="px-4 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">Date</th>
                <th class="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">Score</th>
                <th class="px-3 py-2 text-center text-gray-500 dark:text-gray-400 font-medium">Blockers</th>
                <th class="px-3 py-2 text-center text-gray-500 dark:text-gray-400 font-medium">Rules</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(h, idx) in history" :key="idx" class="border-b border-gray-100 dark:border-gray-800">
                <td class="px-4 py-2 text-gray-700 dark:text-gray-300 text-xs">{{ formatDate(h.date) }}</td>
                <td class="px-3 py-2">
                  <span class="inline-block px-2 py-0.5 rounded border text-xs font-medium"
                    :class="{
                      'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-green-300 dark:border-green-500/30': h.score === 'READY',
                      'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-red-300 dark:border-red-500/30': h.score === 'NOT READY'
                    }">{{ h.score }}</span>
                </td>
                <td class="px-3 py-2 text-center" :class="h.blockerCount > 0 ? 'font-semibold text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'">{{ h.blockerCount }}</td>
                <td class="px-3 py-2 text-center text-gray-700 dark:text-gray-300">{{ h.rulesPassedCount }}/{{ h.ruleCount }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
