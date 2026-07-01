<template>
  <div class="space-y-5">
    <div v-if="loading" class="text-sm text-gray-500 dark:text-gray-400">Loading visibility data from Google Sheets...</div>
    <div v-else-if="error" class="rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-4 py-3 text-sm">{{ error }}</div>

    <template v-else-if="data">
      <!-- Summary Header -->
      <div class="flex items-center gap-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-6 py-5">
        <div class="text-center">
          <div class="text-4xl font-black tabular-nums" :class="overallPctClass">{{ data.overall.pct }}%</div>
          <div class="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-1">Weeks Met</div>
        </div>
        <div class="h-12 w-px bg-gray-200 dark:bg-gray-700" />
        <div class="flex items-center gap-5 text-sm">
          <div class="text-center">
            <div class="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">{{ data.overall.weeksMet }}</div>
            <div class="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 uppercase">Met Target</div>
          </div>
          <div class="text-center">
            <div class="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">{{ data.overall.totalWeeks - data.overall.weeksMet }}</div>
            <div class="text-[10px] font-medium text-red-600 dark:text-red-400 uppercase">Missed</div>
          </div>
          <div class="text-center">
            <div class="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">{{ data.overall.totalWeeks }}</div>
            <div class="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">Total Weeks</div>
          </div>
        </div>
        <div class="ml-auto text-xs text-gray-400 dark:text-gray-500">
          Target: >= {{ data.target }} posts/week
        </div>
      </div>

      <!-- Quarter Sections -->
      <div v-for="q in data.quarters" :key="q.label" class="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        <button
          @click="toggleQuarter(q.label)"
          class="w-full flex items-center justify-between px-5 py-3 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700 text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <div class="flex items-center gap-3">
            <svg
              class="w-4 h-4 text-gray-400 transition-transform duration-200"
              :class="{ 'rotate-90': openQuarters[q.label] }"
              viewBox="0 0 20 20" fill="currentColor"
            ><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" /></svg>
            <span class="text-sm font-bold text-gray-900 dark:text-gray-100">{{ q.label }}</span>
            <span class="text-xs text-gray-500 dark:text-gray-400">{{ q.weeksMet }} of {{ q.totalWeeks }} weeks met</span>
          </div>
          <span
            class="text-sm font-bold tabular-nums px-2.5 py-0.5 rounded-full"
            :class="pctBadgeClass(q.pct)"
          >{{ q.pct }}%</span>
        </button>

        <div v-show="openQuarters[q.label]" class="overflow-x-auto">
          <table class="w-full text-sm border-collapse">
            <thead>
              <tr class="bg-gray-50 dark:bg-gray-800/60">
                <th class="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Week Of</th>
                <th class="px-4 py-2.5 text-center text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">Articles</th>
                <th class="px-4 py-2.5 text-center text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="week in q.weeks"
                :key="week.weekOf"
                class="border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <td class="px-4 py-2.5 text-gray-700 dark:text-gray-300">{{ formatDate(week.weekOf) }}</td>
                <td class="px-4 py-2.5 text-center tabular-nums font-semibold" :class="week.met ? 'text-gray-900 dark:text-gray-100' : 'text-red-600 dark:text-red-400'">{{ week.count }}</td>
                <td class="px-4 py-2.5 text-center">
                  <span
                    class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold"
                    :class="week.met ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'"
                  >{{ week.met ? 'Met' : 'Missed' }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="data.source" class="text-xs text-gray-400 dark:text-gray-500 text-center">
        Source: Google Sheets tab "{{ data.source }}" | Last fetched: {{ formatDateTime(data.fetchedAt) }}
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

var loading = ref(true)
var error = ref(null)
var data = ref(null)
var openQuarters = ref({})

var overallPctClass = computed(function() {
  if (!data.value) return 'text-gray-400'
  var pct = data.value.overall.pct
  if (pct === 100) return 'text-emerald-600 dark:text-emerald-400'
  if (pct >= 66) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
})

function pctBadgeClass(pct) {
  if (pct === 100) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40'
  if (pct >= 66) return 'text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/40'
  return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40'
}

function toggleQuarter(label) {
  openQuarters.value[label] = !openQuarters.value[label]
}

function formatDate(iso) {
  if (!iso) return ''
  var d = new Date(iso + 'T00:00:00')
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDateTime(iso) {
  if (!iso) return ''
  var d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

onMounted(async function() {
  try {
    var res = await fetch('/api/modules/okr-hub/reports/tech-visibility')
    if (!res.ok) throw new Error('Failed to load report: ' + res.status)
    var result = await res.json()
    if (result.error) {
      error.value = result.error
    } else {
      data.value = result
      if (result.quarters && result.quarters.length > 0) {
        openQuarters.value[result.quarters[result.quarters.length - 1].label] = true
      }
    }
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
})
</script>
