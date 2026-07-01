<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">
          AI Engineering OKR Scorecard — {{ data.year }}
        </h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Quarter-over-quarter tracking of all engineering OKRs.
        </p>
      </div>
      <div class="flex items-center gap-3">
        <span
          v-for="s in statusList"
          :key="s.key"
          class="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-600 dark:text-gray-300"
        >
          <span class="inline-block w-2.5 h-2.5 rounded-full" :class="s.dot" />
          {{ s.label }}
        </span>
      </div>
    </div>

    <div v-for="category in data.categories" :key="category.name" class="space-y-2">
      <button
        class="w-full flex items-center gap-2 text-left group"
        @click="toggleCategory(category.name)"
      >
        <svg
          class="w-4 h-4 text-gray-400 transition-transform duration-200"
          :class="{ 'rotate-90': isCategoryOpen(category.name) }"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <h3 class="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
          {{ category.name }}
        </h3>
        <span class="text-xs text-gray-400 dark:text-gray-500 font-medium">
          {{ category.objectives.length }} objective{{ category.objectives.length === 1 ? '' : 's' }}
        </span>
      </button>

      <div
        v-show="isCategoryOpen(category.name)"
        class="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm"
      >
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr class="bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700">
              <th class="px-3 py-3 text-center text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-10">#</th>
              <th class="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-48">Objective</th>
              <th class="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-56">Measure of Success</th>
              <th
                v-for="q in quarters"
                :key="q"
                class="px-4 py-3 text-center text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-40"
              >{{ q }} {{ shortYear }}</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="(obj, objIdx) in category.objectives" :key="obj.id">
              <!-- Single-row objectives (1 KR or no per-KR quarters) -->
              <tr
                v-if="!hasMultiKrRows(obj)"
                class="border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                @click="navigateToDeepDive(obj.id)"
              >
                <td class="px-3 py-3 text-center text-xs font-bold text-gray-400 dark:text-gray-500">{{ objIdx + 1 }}</td>
                <td class="px-4 py-3">
                  <span class="font-semibold text-gray-900 dark:text-gray-100 text-sm">{{ obj.name }}</span>
                </td>
                <td class="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 whitespace-pre-line leading-relaxed">
                  {{ obj.measure }}
                </td>
                <td v-for="q in quarters" :key="q" class="px-3 py-3 text-center">
                  <!-- Editable text input for objectives like Associate Well Being -->
                  <div v-if="obj.editable">
                    <textarea
                      :value="obj.quarters[q] ? obj.quarters[q].summary : ''"
                      @input="updateEditableQuarter(obj.id, q, $event.target.value)"
                      @blur="saveEditableData()"
                      class="w-full text-[11px] leading-relaxed text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-2 min-h-[5.5rem] resize-y focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                      style="word-wrap: break-word; overflow-wrap: break-word; white-space: pre-wrap;"
                      placeholder="Enter status..."
                      @click.stop
                    />
                  </div>
                  <!-- Read-only status box -->
                  <div
                    v-else-if="obj.quarters[q]"
                    class="rounded-lg px-2 py-2 min-h-[3rem] flex items-center justify-center"
                    :class="statusConfig[obj.quarters[q].status].bg"
                  >
                    <span v-if="obj.quarters[q].summary" class="text-[11px] font-medium leading-tight whitespace-pre-line" :class="statusConfig[obj.quarters[q].status].text">{{ obj.quarters[q].summary }}</span>
                    <span v-else class="text-xs text-gray-300 dark:text-gray-600">—</span>
                  </div>
                </td>
              </tr>

              <!-- Multi-row objectives (separate row per KR) -->
              <template v-if="hasMultiKrRows(obj)">
                <tr
                  v-for="(kr, krIdx) in obj.keyResults"
                  :key="kr.id"
                  class="border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                  @click="navigateToDeepDive(obj.id)"
                >
                  <td v-if="krIdx === 0" class="px-3 py-3 text-center align-top text-xs font-bold text-gray-400 dark:text-gray-500" :rowspan="obj.keyResults.length">{{ objIdx + 1 }}</td>
                  <td v-if="krIdx === 0" class="px-4 py-3 align-top" :rowspan="obj.keyResults.length">
                    <span class="font-semibold text-gray-900 dark:text-gray-100 text-sm">{{ obj.name }}</span>
                  </td>
                  <td class="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    {{ kr.description }}
                  </td>
                  <td v-for="q in quarters" :key="q" class="px-3 py-3 text-center">
                    <div
                      v-if="kr.quarters && kr.quarters[q]"
                      class="rounded-lg px-2 py-2 min-h-[3rem] flex items-center justify-center"
                      :class="statusConfig[kr.quarters[q].status].bg"
                    >
                      <span v-if="kr.quarters[q].summary" class="text-[11px] font-medium leading-tight whitespace-pre-line" :class="statusConfig[kr.quarters[q].status].text">{{ kr.quarters[q].summary }}</span>
                      <span v-else class="text-xs text-gray-300 dark:text-gray-600">—</span>
                    </div>
                  </td>
                </tr>
              </template>
            </template>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, inject, onMounted } from 'vue'
import { OKR_DATA, STATUS_CONFIG, QUARTERS } from '../constants/mock-okrs.js'

var nav = inject('moduleNav', null)

var data = reactive(JSON.parse(JSON.stringify(OKR_DATA)))
var statusConfig = STATUS_CONFIG
var quarters = QUARTERS
var shortYear = String(data.year).slice(-2)

var statusList = [
  { key: 'green', label: 'On Track', dot: statusConfig.green.dot },
  { key: 'yellow', label: 'Partial', dot: statusConfig.yellow.dot },
  { key: 'red', label: 'At Risk', dot: statusConfig.red.dot },
  { key: 'not-started', label: 'Not Started', dot: statusConfig['not-started'].dot }
]

var openCategories = reactive({})
for (var i = 0; i < data.categories.length; i++) {
  openCategories[data.categories[i].name] = true
}

function isCategoryOpen(name) {
  return !!openCategories[name]
}

function toggleCategory(name) {
  openCategories[name] = !openCategories[name]
}

function hasMultiKrRows(obj) {
  if (!obj.keyResults || obj.keyResults.length < 2) return false
  for (var i = 0; i < obj.keyResults.length; i++) {
    if (obj.keyResults[i].quarters) return true
  }
  return false
}

function navigateToDeepDive(objectiveId) {
  if (nav) nav.navigateTo('deep-dive', { okr: objectiveId })
}

function findObjective(id) {
  for (var ci = 0; ci < data.categories.length; ci++) {
    var cat = data.categories[ci]
    for (var oi = 0; oi < cat.objectives.length; oi++) {
      if (cat.objectives[oi].id === id) return cat.objectives[oi]
    }
  }
  return null
}

function pctToStatus(pct) {
  if (pct === 100) return 'green'
  if (pct >= 50) return 'yellow'
  return 'red'
}

async function fetchOnTimeReleases() {
  try {
    var res = await fetch('/api/modules/okr-hub/reports/on-time-releases')
    if (!res.ok) return
    var result = await res.json()
    if (!result.releases) return

    var obj = findObjective('on-time-releases')
    if (!obj) return

    var qMap = {}
    for (var i = 0; i < result.releases.length; i++) {
      var rel = result.releases[i]
      var d = new Date(rel.plannedGa + 'T00:00:00')
      var qNum = Math.floor(d.getMonth() / 3) + 1
      var qKey = 'Q' + qNum
      if (!qMap[qKey]) qMap[qKey] = { released: 0, onTime: 0, total: 0 }
      qMap[qKey].total++
      if (rel.released) {
        qMap[qKey].released++
        if (rel.onTime) qMap[qKey].onTime++
      }
    }

    for (var qi = 0; qi < quarters.length; qi++) {
      var q = quarters[qi]
      var stats = qMap[q]
      if (stats && stats.released > 0) {
        var pct = Math.round((stats.onTime / stats.released) * 100)
        obj.quarters[q] = { status: pctToStatus(pct), summary: pct + '%\n' + stats.onTime + ' of ' + stats.released + ' on time' }
      } else if (stats && stats.total > 0) {
        obj.quarters[q] = { status: 'not-started', summary: stats.total + ' upcoming' }
      }
    }
  } catch (err) {
    console.warn('[okr-hub] Failed to fetch on-time-releases for timeline:', err.message)
  }
}

var quarterMonths = {
  Q1: ['jan', 'feb', 'mar'],
  Q2: ['apr', 'may', 'jun'],
  Q3: ['jul', 'aug', 'sep'],
  Q4: ['oct', 'nov', 'dec']
}

async function fetchCveSla() {
  try {
    var res = await fetch('/api/modules/okr-hub/reports/cve-sla')
    if (!res.ok) return
    var result = await res.json()
    if (!result.months || !result.products) return

    var obj = findObjective('cve-sla')
    if (!obj) return

    for (var qi = 0; qi < quarters.length; qi++) {
      var q = quarters[qi]
      var months = quarterMonths[q]
      var totalMet = 0
      var totalMissed = 0
      var hasData = false

      for (var mi = 0; mi < months.length; mi++) {
        var monthData = result.months[months[mi]]
        if (!monthData) continue
        for (var pi = 0; pi < result.products.length; pi++) {
          var pd = monthData[result.products[pi]]
          if (!pd) continue
          var met = pd.met != null ? pd.met : 0
          var missed = pd.missed != null ? pd.missed : 0
          if (met > 0 || missed > 0) hasData = true
          totalMet += met
          totalMissed += missed
        }
      }

      if (hasData) {
        var total = totalMet + totalMissed
        var pct = total > 0 ? Math.round((totalMet / total) * 100) : 0
        obj.quarters[q] = { status: pctToStatus(pct), summary: pct + '%\n' + totalMet + ' met, ' + totalMissed + ' missed' }
      }
    }
  } catch (err) {
    console.warn('[okr-hub] Failed to fetch cve-sla for timeline:', err.message)
  }
}

async function fetchSupportCases() {
  try {
    var res = await fetch('/api/modules/okr-hub/reports/support-cases')
    if (!res.ok) return
    var result = await res.json()
    if (!result.quarters || !result.products) return

    var obj = findObjective('support-cases')
    if (!obj) return

    for (var qi = 0; qi < quarters.length; qi++) {
      var q = quarters[qi]
      var qData = result.quarters[q]
      if (!qData) continue

      var totalCases = 0
      var totalDefects = 0
      var hasData = false
      var avgResSum = 0
      var avgResCount = 0

      for (var pi = 0; pi < result.products.length; pi++) {
        var pd = qData[result.products[pi]]
        if (!pd) continue
        if (pd.totalCases != null && pd.totalCases > 0) {
          hasData = true
          totalCases += pd.totalCases
          totalDefects += pd.defects || 0
        }
        if (pd.avgResolutionDays != null && pd.avgResolutionDays > 0) {
          avgResSum += pd.avgResolutionDays
          avgResCount++
        }
      }

      if (hasData) {
        var defectRate = totalCases > 0 ? ((totalDefects / totalCases) * 100).toFixed(1) : 0
        var avgRes = avgResCount > 0 ? (avgResSum / avgResCount).toFixed(1) : null
        var defectOk = parseFloat(defectRate) <= 10
        var resOk = avgRes != null && parseFloat(avgRes) <= 14
        var status = (defectOk && resOk) ? 'green' : (defectOk || resOk) ? 'yellow' : 'red'
        var summary = defectRate + '% defect rate'
        if (avgRes != null) summary += '\n——————\n' + avgRes + ' avg days'
        obj.quarters[q] = { status: status, summary: summary }
      }
    }
  } catch (err) {
    console.warn('[okr-hub] Failed to fetch support-cases for timeline:', err.message)
  }
}

async function fetchTechnicalVisibility() {
  try {
    var obj = findObjective('tech-visibility')
    if (!obj || !obj.keyResults) return

    var kr1 = null
    var kr2 = null
    for (var ki = 0; ki < obj.keyResults.length; ki++) {
      if (obj.keyResults[ki].id === 'kr-tv-1') kr1 = obj.keyResults[ki]
      if (obj.keyResults[ki].id === 'kr-tv-2') kr2 = obj.keyResults[ki]
    }

    var [tvRes, ccRes] = await Promise.all([
      fetch('/api/modules/okr-hub/reports/tech-visibility'),
      fetch('/api/modules/okr-hub/reports/content-contributions')
    ])

    if (kr1 && tvRes.ok) {
      var tvData = await tvRes.json()
      if (tvData.quarters) {
        for (var tvi = 0; tvi < tvData.quarters.length; tvi++) {
          var tvQ = tvData.quarters[tvi]
          var qMatch = tvQ.label.match(/Q(\d)/i)
          if (!qMatch) continue
          var qKey = 'Q' + qMatch[1]
          if (!kr1.quarters) kr1.quarters = {}
          kr1.quarters[qKey] = {
            status: pctToStatus(tvQ.pct),
            summary: tvQ.pct + '%\n' + tvQ.weeksMet + ' of ' + tvQ.totalWeeks + ' weeks met'
          }
        }
      }
    }

    if (kr2 && ccRes.ok) {
      var ccData = await ccRes.json()
      if (ccData.quarters) {
        for (var cci = 0; cci < ccData.quarters.length; cci++) {
          var ccQ = ccData.quarters[cci]
          var ccMatch = ccQ.label.match(/Q(\d)/i)
          if (!ccMatch) continue
          var ccKey = 'Q' + ccMatch[1]
          if (!kr2.quarters) kr2.quarters = {}
          var completed = ccQ.total ? ccQ.total.completed : 0
          var associates = ccQ.total ? ccQ.total.associates : 0
          var pct = ccQ.total ? ccQ.total.pct : 0
          kr2.quarters[ccKey] = {
            status: pctToStatus(pct),
            summary: pct + '%\n' + completed + ' of ' + associates + ' completed'
          }
        }
      }
    }
  } catch (err) {
    console.warn('[okr-hub] Failed to fetch tech-visibility for timeline:', err.message)
  }
}

onMounted(function() {
  fetchOnTimeReleases()
  fetchCveSla()
  fetchSupportCases()
  fetchTechnicalVisibility()
})
</script>
