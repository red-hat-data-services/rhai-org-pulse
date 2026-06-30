<template>
  <div class="space-y-4">
    <div v-if="loading" class="text-sm text-gray-500 dark:text-gray-400">Loading release data...</div>
    <div v-else-if="error" class="rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-4 py-3 text-sm">{{ error }}</div>

    <template v-else-if="data">
      <!-- Summary -->
      <div class="flex items-center gap-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-6 py-5">
        <div class="text-center">
          <div
            class="text-4xl font-black tabular-nums"
            :class="pctClass"
          >{{ data.summary.pct }}%</div>
          <div class="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-1">On Time</div>
        </div>
        <div class="h-12 w-px bg-gray-200 dark:bg-gray-700" />
        <div class="flex items-center gap-5 text-sm">
          <div class="text-center">
            <div class="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">{{ data.summary.onTime }}</div>
            <div class="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 uppercase">On Time</div>
          </div>
          <div class="text-center">
            <div class="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">{{ data.summary.late }}</div>
            <div class="text-[10px] font-medium text-red-600 dark:text-red-400 uppercase">Late</div>
          </div>
          <div class="text-center">
            <div class="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">{{ data.summary.upcoming }}</div>
            <div class="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">Upcoming</div>
          </div>
        </div>
        <div class="ml-auto text-xs text-gray-400 dark:text-gray-500">
          Releases with planned GA after {{ data.since }}
        </div>
      </div>

      <!-- Table -->
      <div class="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr class="bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700">
              <th class="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Release</th>
              <th class="px-4 py-3 text-center text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-36">Planned GA</th>
              <th class="px-4 py-3 text-center text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-36">Actual GA</th>
              <th class="px-4 py-3 text-center text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28">Status</th>
              <th class="px-4 py-3 text-center text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28">Days Late</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="rel in data.releases"
              :key="rel.id"
              class="border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <td class="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">{{ rel.displayName }}</td>
              <td class="px-4 py-3 text-center text-gray-600 dark:text-gray-400 tabular-nums">{{ formatDate(rel.plannedGa) }}</td>
              <td class="px-4 py-3 text-center tabular-nums" :class="rel.actualGa ? 'text-gray-600 dark:text-gray-400' : 'text-gray-300 dark:text-gray-600'">
                {{ rel.actualGa ? formatDate(rel.actualGa) : '—' }}
              </td>
              <td class="px-4 py-3 text-center">
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold"
                  :class="statusBadgeClass(rel)"
                >{{ statusLabel(rel) }}</span>
              </td>
              <td class="px-4 py-3 text-center tabular-nums" :class="daysLateClass(rel)">
                {{ rel.daysLate != null ? (rel.daysLate <= 0 ? '0' : '+' + rel.daysLate) : '—' }}
              </td>
            </tr>
            <tr v-if="!data.releases.length">
              <td colspan="5" class="px-4 py-8 text-center text-gray-400 dark:text-gray-500 text-sm italic">
                No releases found after {{ data.since }}.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

var loading = ref(true)
var error = ref(null)
var data = ref(null)

var pctClass = computed(function() {
  if (!data.value) return 'text-gray-400'
  var pct = data.value.summary.pct
  if (pct === 100) return 'text-emerald-600 dark:text-emerald-400'
  if (pct >= 66) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
})

function statusBadgeClass(rel) {
  if (!rel.released) return 'bg-gray-100 dark:bg-gray-700/60 text-gray-500 dark:text-gray-400'
  if (rel.onTime) return 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
  return 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
}

function statusLabel(rel) {
  if (!rel.released) return 'Upcoming'
  if (rel.onTime) return 'On Time'
  return 'Late'
}

function daysLateClass(rel) {
  if (rel.daysLate == null) return 'text-gray-300 dark:text-gray-600'
  if (rel.daysLate <= 0) return 'text-emerald-600 dark:text-emerald-400 font-semibold'
  return 'text-red-600 dark:text-red-400 font-semibold'
}

function formatDate(iso) {
  if (!iso) return '—'
  var d = new Date(iso + 'T00:00:00')
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

onMounted(async function() {
  try {
    var res = await fetch('/api/modules/okr-hub/reports/on-time-releases')
    if (!res.ok) throw new Error('Failed to load report: ' + res.status)
    data.value = await res.json()
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
})
</script>
