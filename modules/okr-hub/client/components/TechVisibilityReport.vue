<template>
  <div class="space-y-5">
    <!-- KR1: Weekly Posts -->
    <div class="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
      <button
        @click="kr1Open = !kr1Open"
        class="w-full flex items-center justify-between px-5 py-4 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700 text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <div class="flex items-center gap-3">
          <svg
            class="w-4 h-4 text-gray-400 transition-transform duration-200"
            :class="{ 'rotate-90': kr1Open }"
            viewBox="0 0 20 20" fill="currentColor"
          ><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" /></svg>
          <div>
            <div class="text-sm font-bold text-gray-900 dark:text-gray-100">KR1: Weekly Posts</div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">>= 5 posts/week across internal and external sources</div>
          </div>
        </div>
        <span v-if="kr1Data" class="text-sm font-bold tabular-nums px-2.5 py-0.5 rounded-full" :class="pctBadgeClass(kr1Data.overall.pct)">{{ kr1Data.overall.pct }}%</span>
        <span v-else-if="kr1Loading" class="text-xs text-gray-400">Loading...</span>
      </button>

      <div v-show="kr1Open" class="p-5 space-y-4 bg-white dark:bg-gray-900">
        <div v-if="kr1Loading" class="text-sm text-gray-500 dark:text-gray-400">Loading weekly posts data...</div>
        <div v-else-if="kr1Error" class="rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-4 py-3 text-sm">{{ kr1Error }}</div>
        <template v-else-if="kr1Data">
          <!-- Summary -->
          <div class="flex items-center gap-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-6 py-5">
            <div class="text-center">
              <div class="text-4xl font-black tabular-nums" :class="pctColorClass(kr1Data.overall.pct)">{{ kr1Data.overall.pct }}%</div>
              <div class="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-1">Weeks Met</div>
            </div>
            <div class="h-12 w-px bg-gray-200 dark:bg-gray-700" />
            <div class="flex items-center gap-5 text-sm">
              <div class="text-center">
                <div class="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">{{ kr1Data.overall.weeksMet }}</div>
                <div class="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 uppercase">Met Target</div>
              </div>
              <div class="text-center">
                <div class="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">{{ kr1Data.overall.totalWeeks - kr1Data.overall.weeksMet }}</div>
                <div class="text-[10px] font-medium text-red-600 dark:text-red-400 uppercase">Missed</div>
              </div>
              <div class="text-center">
                <div class="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">{{ kr1Data.overall.totalWeeks }}</div>
                <div class="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">Total Weeks</div>
              </div>
            </div>
            <div class="ml-auto text-xs text-gray-400 dark:text-gray-500">Target: >= {{ kr1Data.target }} posts/week</div>
          </div>

          <!-- Quarter sections -->
          <div v-for="q in kr1Data.quarters" :key="q.label" class="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              @click="toggleSection('kr1-' + q.label)"
              class="w-full flex items-center justify-between px-5 py-3 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700 text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <div class="flex items-center gap-3">
                <svg class="w-4 h-4 text-gray-400 transition-transform duration-200" :class="{ 'rotate-90': openSections['kr1-' + q.label] }" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" /></svg>
                <span class="text-sm font-bold text-gray-900 dark:text-gray-100">{{ q.label }}</span>
                <span class="text-xs text-gray-500 dark:text-gray-400">{{ q.weeksMet }} of {{ q.totalWeeks }} weeks met</span>
              </div>
              <span class="text-sm font-bold tabular-nums px-2.5 py-0.5 rounded-full" :class="pctBadgeClass(q.pct)">{{ q.pct }}%</span>
            </button>
            <div v-show="openSections['kr1-' + q.label]" class="overflow-x-auto">
              <table class="w-full text-sm border-collapse">
                <thead>
                  <tr class="bg-gray-50 dark:bg-gray-800/60">
                    <th class="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Week Of</th>
                    <th class="px-4 py-2.5 text-center text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">Articles</th>
                    <th class="px-4 py-2.5 text-center text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="week in q.weeks" :key="week.weekOf" class="border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td class="px-4 py-2.5 text-gray-700 dark:text-gray-300">{{ formatDate(week.weekOf) }}</td>
                    <td class="px-4 py-2.5 text-center tabular-nums font-semibold" :class="week.met ? 'text-gray-900 dark:text-gray-100' : 'text-red-600 dark:text-red-400'">{{ week.count }}</td>
                    <td class="px-4 py-2.5 text-center">
                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold" :class="week.met ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'">{{ week.met ? 'Met' : 'Missed' }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div v-if="kr1Data.source" class="text-xs text-gray-400 dark:text-gray-500 text-center">
            Source: Google Sheets tab "{{ kr1Data.source }}" | Last fetched: {{ formatDateTime(kr1Data.fetchedAt) }}
          </div>
        </template>
      </div>
    </div>

    <!-- KR2: Associate Content Contributions -->
    <div class="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
      <button
        @click="kr2Open = !kr2Open"
        class="w-full flex items-center justify-between px-5 py-4 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700 text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <div class="flex items-center gap-3">
          <svg
            class="w-4 h-4 text-gray-400 transition-transform duration-200"
            :class="{ 'rotate-90': kr2Open }"
            viewBox="0 0 20 20" fill="currentColor"
          ><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" /></svg>
          <div>
            <div class="text-sm font-bold text-gray-900 dark:text-gray-100">KR2: Associate Content Contributions</div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">1 piece of content per AI Eng associate for the year (blog, demo, tutorial)</div>
          </div>
        </div>
        <span v-if="kr2Data" class="text-sm font-bold tabular-nums px-2.5 py-0.5 rounded-full" :class="pctBadgeClass(kr2Data.overall.pct)">{{ kr2Data.overall.pct }}%</span>
        <span v-else-if="kr2Loading" class="text-xs text-gray-400">Loading...</span>
      </button>

      <div v-show="kr2Open" class="p-5 space-y-4 bg-white dark:bg-gray-900">
        <div v-if="kr2Loading" class="text-sm text-gray-500 dark:text-gray-400">Loading content contributions data...</div>
        <div v-else-if="kr2Error" class="rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-4 py-3 text-sm">{{ kr2Error }}</div>
        <template v-else-if="kr2Data">
          <!-- Summary -->
          <div class="flex items-center gap-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-6 py-5">
            <div class="text-center">
              <div class="text-4xl font-black tabular-nums" :class="pctColorClass(kr2Data.overall.pct)">{{ kr2Data.overall.pct }}%</div>
              <div class="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-1">Completed</div>
            </div>
            <div class="h-12 w-px bg-gray-200 dark:bg-gray-700" />
            <div class="flex items-center gap-5 text-sm">
              <div class="text-center">
                <div class="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">{{ kr2Data.overall.completed }}</div>
                <div class="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 uppercase">Completed</div>
              </div>
              <div class="text-center">
                <div class="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">{{ kr2Data.overall.associates - kr2Data.overall.completed }}</div>
                <div class="text-[10px] font-medium text-red-600 dark:text-red-400 uppercase">Remaining</div>
              </div>
              <div class="text-center">
                <div class="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">{{ kr2Data.overall.associates }}</div>
                <div class="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">Total Associates</div>
              </div>
            </div>
            <div class="ml-auto text-xs text-gray-400 dark:text-gray-500">Target: 1 content/associate/year</div>
          </div>

          <!-- Quarter sections -->
          <div v-for="q in kr2Data.quarters" :key="q.label" class="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              @click="toggleSection('kr2-' + q.label)"
              class="w-full flex items-center justify-between px-5 py-3 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700 text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <div class="flex items-center gap-3">
                <svg class="w-4 h-4 text-gray-400 transition-transform duration-200" :class="{ 'rotate-90': openSections['kr2-' + q.label] }" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" /></svg>
                <span class="text-sm font-bold text-gray-900 dark:text-gray-100">{{ q.label }}</span>
                <span class="text-xs text-gray-500 dark:text-gray-400">{{ q.total.completed }} of {{ q.total.associates }} associates completed</span>
              </div>
              <span class="text-sm font-bold tabular-nums px-2.5 py-0.5 rounded-full" :class="pctBadgeClass(q.total.pct)">{{ q.total.pct }}%</span>
            </button>
            <div v-show="openSections['kr2-' + q.label]" class="overflow-x-auto">
              <table class="w-full text-sm border-collapse">
                <thead>
                  <tr class="bg-gray-50 dark:bg-gray-800/60">
                    <th class="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Team Name</th>
                    <th class="px-4 py-2.5 text-center text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28">Associates</th>
                    <th class="px-4 py-2.5 text-center text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28">Completed</th>
                    <th class="px-4 py-2.5 text-center text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">% Done</th>
                    <th class="px-4 py-2.5 text-center text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">Status</th>
                    <th class="px-4 py-2.5 text-center text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28">Target Date</th>
                    <th class="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-44">Performance vs. Quarter</th>
                    <th class="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-40">Progress</th>
                    <th class="px-4 py-2.5 text-center text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">End of Q Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="team in q.teams" :key="team.name" class="border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td class="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">{{ team.name }}</td>
                    <td class="px-4 py-2.5 text-center tabular-nums text-gray-700 dark:text-gray-300">{{ team.associates }}</td>
                    <td class="px-4 py-2.5 text-center tabular-nums text-gray-700 dark:text-gray-300">{{ team.completed }}</td>
                    <td class="px-4 py-2.5 text-center tabular-nums font-semibold" :class="pctColorClass(team.pct)">{{ team.pct }}%</td>
                    <td class="px-4 py-2.5 text-center">
                      <span v-if="team.status" class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300">{{ team.status }}</span>
                    </td>
                    <td class="px-4 py-2.5 text-center text-xs text-gray-600 dark:text-gray-400">{{ q.targetDate || '' }}</td>
                    <td class="px-4 py-2.5 text-xs text-gray-600 dark:text-gray-400">{{ team.performance || '' }}</td>
                    <td class="px-4 py-2.5">
                      <div class="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div class="h-full rounded-full transition-all duration-300" :class="progressBarClass(team.pct)" :style="{ width: Math.min(team.pct, 100) + '%' }" />
                      </div>
                    </td>
                    <td class="px-4 py-2.5 text-center tabular-nums text-xs font-semibold" :class="team.endQPct != null ? pctColorClass(team.endQPct) : 'text-gray-400'">{{ team.endQPct != null ? team.endQPct + '%' : '' }}</td>
                  </tr>
                  <!-- TOTAL row -->
                  <tr class="bg-gray-50 dark:bg-gray-800/60 font-bold border-t-2 border-gray-300 dark:border-gray-600">
                    <td class="px-4 py-2.5 text-gray-900 dark:text-gray-100">TOTAL</td>
                    <td class="px-4 py-2.5 text-center tabular-nums text-gray-900 dark:text-gray-100">{{ q.total.associates }}</td>
                    <td class="px-4 py-2.5 text-center tabular-nums text-gray-900 dark:text-gray-100">{{ q.total.completed }}</td>
                    <td class="px-4 py-2.5 text-center tabular-nums" :class="pctColorClass(q.total.pct)">{{ q.total.pct }}%</td>
                    <td class="px-4 py-2.5" />
                    <td class="px-4 py-2.5" />
                    <td class="px-4 py-2.5" />
                    <td class="px-4 py-2.5">
                      <div class="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div class="h-full rounded-full transition-all duration-300" :class="progressBarClass(q.total.pct)" :style="{ width: Math.min(q.total.pct, 100) + '%' }" />
                      </div>
                    </td>
                    <td class="px-4 py-2.5 text-center tabular-nums text-xs font-semibold" :class="q.total.endQPct != null ? pctColorClass(q.total.endQPct) : 'text-gray-400'">{{ q.total.endQPct != null ? q.total.endQPct + '%' : '' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="text-xs text-gray-400 dark:text-gray-500 text-center">
            Last fetched: {{ formatDateTime(kr2Data.fetchedAt) }}
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

var kr1Open = ref(false)
var kr2Open = ref(false)
var kr1Loading = ref(true)
var kr2Loading = ref(true)
var kr1Error = ref(null)
var kr2Error = ref(null)
var kr1Data = ref(null)
var kr2Data = ref(null)
var openSections = ref({})

function pctColorClass(pct) {
  if (pct >= 100) return 'text-emerald-600 dark:text-emerald-400'
  if (pct >= 50) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

function pctBadgeClass(pct) {
  if (pct >= 100) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40'
  if (pct >= 50) return 'text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/40'
  return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40'
}

function progressBarClass(pct) {
  if (pct >= 100) return 'bg-emerald-500'
  if (pct >= 50) return 'bg-yellow-500'
  return 'bg-amber-500'
}

function toggleSection(key) {
  openSections.value[key] = !openSections.value[key]
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

onMounted(function() {
  fetchKr1()
  fetchKr2()
})

async function fetchKr1() {
  try {
    var res = await fetch('/api/modules/okr-hub/reports/tech-visibility')
    if (!res.ok) throw new Error('Failed to load report: ' + res.status)
    var result = await res.json()
    if (result.error) {
      kr1Error.value = result.error
    } else {
      if (result.quarters && result.quarters.length > 0) {
        result.quarters.reverse()
      }
      kr1Data.value = result
      if (result.quarters && result.quarters.length > 0) {
        openSections.value['kr1-' + result.quarters[0].label] = true
      }
    }
  } catch (err) {
    kr1Error.value = err.message
  } finally {
    kr1Loading.value = false
  }
}

async function fetchKr2() {
  try {
    var res = await fetch('/api/modules/okr-hub/reports/content-contributions')
    if (!res.ok) throw new Error('Failed to load report: ' + res.status)
    var result = await res.json()
    if (result.error) {
      kr2Error.value = result.error
    } else {
      if (result.quarters && result.quarters.length > 0) {
        result.quarters.reverse()
      }
      kr2Data.value = result
      if (result.quarters && result.quarters.length > 0) {
        openSections.value['kr2-' + result.quarters[0].label] = true
      }
    }
  } catch (err) {
    kr2Error.value = err.message
  } finally {
    kr2Loading.value = false
  }
}
</script>
