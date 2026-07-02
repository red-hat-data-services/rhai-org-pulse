<template>
  <div class="space-y-4">
    <div v-if="loading" class="text-sm text-gray-500 dark:text-gray-400">Loading support case data...</div>
    <div v-else-if="error" class="rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-4 py-3 text-sm">{{ error }}</div>

    <template v-else-if="data">
      <!-- Summary Header -->
      <div class="flex items-center gap-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-6 py-5">
        <div class="text-center">
          <div class="text-4xl font-black tabular-nums" :class="overallDefectRateClass">{{ overallDefectRate }}%</div>
          <div class="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-1">Defect Rate</div>
        </div>
        <div class="h-12 w-px bg-gray-200 dark:bg-gray-700" />
        <div class="flex items-center gap-5 text-sm">
          <div class="text-center">
            <div class="text-lg font-bold tabular-nums" :class="overallAvgResClass">{{ overallAvgRes }}</div>
            <div class="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">Avg Resolution (days)</div>
          </div>
          <div class="text-center">
            <div class="text-lg font-bold tabular-nums" :class="overallMedianResClass">{{ overallMedianRes }}</div>
            <div class="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">Median Resolution (days)</div>
          </div>
          <div class="text-center">
            <div class="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">{{ overallTotalCases }}</div>
            <div class="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">Total Cases</div>
          </div>
        </div>
        <div class="ml-auto flex items-center gap-3">
          <div class="text-right text-xs text-gray-400 dark:text-gray-500">
            <div>Defect Rate Target: &lt;= 10%</div>
            <div>Resolution Target: 10-14 days</div>
          </div>
          <button v-if="canEdit" @click="openSettings" class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" title="Edit data">
            <svg class="w-5 h-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Settings Panel -->
      <div v-if="showSettings" class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg overflow-hidden">
        <div class="px-5 py-3 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <span class="text-sm font-bold text-gray-900 dark:text-gray-100">Edit Support Case Data</span>
          <div class="flex gap-1">
            <button v-for="qKey in quarterKeys" :key="qKey" @click="editQuarter = qKey"
              class="px-3 py-1 text-xs font-semibold rounded-md transition-colors"
              :class="editQuarter === qKey ? 'bg-primary-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'">{{ qKey }} {{ data.year }}</button>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-xs border-collapse">
            <thead>
              <tr class="bg-gray-50 dark:bg-gray-800/60">
                <th class="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">Product</th>
                <th class="px-2 py-2 text-center text-[10px] font-semibold text-gray-500 uppercase w-20">Total Cases</th>
                <th class="px-2 py-2 text-center text-[10px] font-semibold text-gray-500 uppercase w-16">Defects</th>
                <th class="px-2 py-2 text-center text-[10px] font-semibold text-gray-500 uppercase w-20">Cases Closed</th>
                <th class="px-2 py-2 text-center text-[10px] font-semibold text-gray-500 uppercase w-20">Bugs (ENG)</th>
                <th class="px-2 py-2 text-center text-[10px] font-semibold text-gray-500 uppercase w-14">RFE</th>
                <th class="px-2 py-2 text-center text-[10px] font-semibold text-gray-500 uppercase w-20">Support Ex</th>
                <th class="px-2 py-2 text-center text-[10px] font-semibold text-gray-500 uppercase w-14">Other</th>
                <th class="px-2 py-2 text-center text-[10px] font-semibold text-gray-500 uppercase w-20">Avg Res (days)</th>
                <th class="px-2 py-2 text-center text-[10px] font-semibold text-gray-500 uppercase w-20">Median Res (days)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="product in data.products" :key="product" class="border-b border-gray-100 dark:border-gray-800">
                <td class="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">{{ product }}</td>
                <td class="px-1 py-1" v-for="field in editFields" :key="field">
                  <input
                    :value="getEditVal(product, field)"
                    @input="setEditVal(product, field, $event.target.value)"
                    type="number" step="any"
                    class="w-full text-center text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-1 py-1 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-primary-500"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="px-5 py-3 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button @click="cancelSettings" class="px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">Cancel</button>
          <button @click="saveSettings" :disabled="saving" class="px-4 py-1.5 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50">{{ saving ? 'Saving...' : 'Save' }}</button>
        </div>
      </div>

      <!-- Q1-Q4 Collapsibles -->
      <div v-for="qKey in quarterKeys" :key="qKey" class="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        <button
          @click="toggleQuarter(qKey)"
          class="w-full flex items-center justify-between px-5 py-3 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700 text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <div class="flex items-center gap-3">
            <svg class="w-4 h-4 text-gray-400 transition-transform duration-200" :class="{ 'rotate-90': openQuarters[qKey] }" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" /></svg>
            <span class="text-sm font-bold text-gray-900 dark:text-gray-100">{{ qKey }} {{ data.year }}</span>
            <span class="text-xs text-gray-500 dark:text-gray-400">{{ quarterSummaryText(qKey) }}</span>
          </div>
          <span class="text-sm font-bold tabular-nums px-2.5 py-0.5 rounded-full" :class="defectRateBadgeClass(quarterDefectRate(qKey))">{{ quarterDefectRate(qKey) }}%</span>
        </button>

        <div v-show="openQuarters[qKey]" class="overflow-x-auto">
          <table class="w-full text-sm border-collapse">
            <thead>
              <tr class="bg-gray-50 dark:bg-gray-800/60">
                <th class="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Product</th>
                <th class="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Cases</th>
                <th class="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Defects</th>
                <th class="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Defect Rate</th>
                <th class="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cases Closed</th>
                <th class="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Bugs (ENG)</th>
                <th class="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">RFE</th>
                <th class="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Support Ex</th>
                <th class="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Other</th>
                <th class="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Avg Res (days)</th>
                <th class="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Median Res (days)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="product in data.products" :key="product" class="border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <td class="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">{{ product }}</td>
                <td class="px-3 py-2.5 text-center tabular-nums text-gray-700 dark:text-gray-300">{{ displayVal(qKey, product, 'totalCases') }}</td>
                <td class="px-3 py-2.5 text-center tabular-nums text-gray-700 dark:text-gray-300">{{ displayVal(qKey, product, 'defects') }}</td>
                <td class="px-3 py-2.5 text-center tabular-nums font-semibold" :class="defectRateColorClass(productDefectRate(qKey, product))">{{ productDefectRate(qKey, product) }}%</td>
                <td class="px-3 py-2.5 text-center tabular-nums text-gray-700 dark:text-gray-300">{{ displayVal(qKey, product, 'casesClosed') }}</td>
                <td class="px-3 py-2.5 text-center tabular-nums text-gray-700 dark:text-gray-300">{{ displayVal(qKey, product, 'bugsEng') }}</td>
                <td class="px-3 py-2.5 text-center tabular-nums text-gray-700 dark:text-gray-300">{{ displayVal(qKey, product, 'rfe') }}</td>
                <td class="px-3 py-2.5 text-center tabular-nums text-gray-700 dark:text-gray-300">{{ displayVal(qKey, product, 'supportEx') }}</td>
                <td class="px-3 py-2.5 text-center tabular-nums text-gray-700 dark:text-gray-300">{{ displayVal(qKey, product, 'other') }}</td>
                <td class="px-3 py-2.5 text-center tabular-nums font-semibold" :class="resolutionColorClass(getNum(qKey, product, 'avgResolutionDays'))">{{ displayVal(qKey, product, 'avgResolutionDays') }}</td>
                <td class="px-3 py-2.5 text-center tabular-nums font-semibold" :class="resolutionColorClass(getNum(qKey, product, 'medianResolutionDays'))">{{ displayVal(qKey, product, 'medianResolutionDays') }}</td>
              </tr>
              <!-- TOTAL row -->
              <tr class="bg-gray-50 dark:bg-gray-800/60 font-bold border-t-2 border-gray-300 dark:border-gray-600">
                <td class="px-4 py-2.5 text-gray-900 dark:text-gray-100">TOTAL</td>
                <td class="px-3 py-2.5 text-center tabular-nums text-gray-900 dark:text-gray-100">{{ quarterTotal(qKey, 'totalCases') }}</td>
                <td class="px-3 py-2.5 text-center tabular-nums text-gray-900 dark:text-gray-100">{{ quarterTotal(qKey, 'defects') }}</td>
                <td class="px-3 py-2.5 text-center tabular-nums" :class="defectRateColorClass(quarterDefectRate(qKey))">{{ quarterDefectRate(qKey) }}%</td>
                <td class="px-3 py-2.5 text-center tabular-nums text-gray-900 dark:text-gray-100">{{ quarterTotal(qKey, 'casesClosed') }}</td>
                <td class="px-3 py-2.5 text-center tabular-nums text-gray-900 dark:text-gray-100">{{ quarterTotal(qKey, 'bugsEng') }}</td>
                <td class="px-3 py-2.5 text-center tabular-nums text-gray-900 dark:text-gray-100">{{ quarterTotal(qKey, 'rfe') }}</td>
                <td class="px-3 py-2.5 text-center tabular-nums text-gray-900 dark:text-gray-100">{{ quarterTotal(qKey, 'supportEx') }}</td>
                <td class="px-3 py-2.5 text-center tabular-nums text-gray-900 dark:text-gray-100">{{ quarterTotal(qKey, 'other') }}</td>
                <td class="px-3 py-2.5 text-center tabular-nums" :class="resolutionColorClass(quarterAvg(qKey, 'avgResolutionDays'))">{{ quarterAvgDisplay(qKey, 'avgResolutionDays') }}</td>
                <td class="px-3 py-2.5 text-center tabular-nums" :class="resolutionColorClass(quarterAvg(qKey, 'medianResolutionDays'))">{{ quarterAvgDisplay(qKey, 'medianResolutionDays') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useOkrPermissions } from '../composables/useOkrPermissions.js'

var { canEdit } = useOkrPermissions()
var loading = ref(true)
var error = ref(null)
var data = ref(null)
var openQuarters = ref({})
var showSettings = ref(false)
var saving = ref(false)
var editQuarter = ref('Q1')
var editData = ref(null)
var ALL_QUARTER_KEYS = ['Q1', 'Q2', 'Q3', 'Q4']
var quarterKeys = ref(ALL_QUARTER_KEYS)
var editFields = ['totalCases', 'defects', 'casesClosed', 'bugsEng', 'rfe', 'supportEx', 'other', 'avgResolutionDays', 'medianResolutionDays']

function getNum(qKey, product, field) {
  if (!data.value || !data.value.quarters[qKey] || !data.value.quarters[qKey][product]) return null
  var v = data.value.quarters[qKey][product][field]
  return v != null ? v : null
}

function displayVal(qKey, product, field) {
  var v = getNum(qKey, product, field)
  if (v == null) return ''
  if (field === 'avgResolutionDays' || field === 'medianResolutionDays') return Number(v).toFixed(1)
  return v
}

function productDefectRate(qKey, product) {
  var total = getNum(qKey, product, 'totalCases')
  var defects = getNum(qKey, product, 'defects')
  if (!total || total === 0) return '—'
  return ((defects || 0) / total * 100).toFixed(1)
}

function quarterTotal(qKey, field) {
  if (!data.value || !data.value.quarters[qKey]) return 0
  var sum = 0
  var hasAny = false
  for (var i = 0; i < data.value.products.length; i++) {
    var p = data.value.products[i]
    var v = getNum(qKey, p, field)
    if (v != null) { sum += v; hasAny = true }
  }
  return hasAny ? sum : ''
}

function quarterDefectRate(qKey) {
  var total = quarterTotal(qKey, 'totalCases')
  var defects = quarterTotal(qKey, 'defects')
  if (!total || total === 0) return '—'
  return ((defects || 0) / total * 100).toFixed(1)
}

function quarterAvg(qKey, field) {
  if (!data.value || !data.value.quarters[qKey]) return null
  var sum = 0
  var count = 0
  for (var i = 0; i < data.value.products.length; i++) {
    var v = getNum(qKey, data.value.products[i], field)
    if (v != null && v > 0) { sum += v; count++ }
  }
  return count > 0 ? sum / count : null
}

function quarterAvgDisplay(qKey, field) {
  var avg = quarterAvg(qKey, field)
  return avg != null ? avg.toFixed(1) : ''
}

function quarterSummaryText(qKey) {
  var total = quarterTotal(qKey, 'totalCases')
  if (!total) return 'No data'
  return total + ' cases, ' + quarterTotal(qKey, 'defects') + ' defects'
}

var overallDefectRate = computed(function() {
  if (!data.value) return '—'
  var totalCases = 0
  var totalDefects = 0
  for (var qi = 0; qi < ALL_QUARTER_KEYS.length; qi++) {
    var t = quarterTotal(ALL_QUARTER_KEYS[qi], 'totalCases')
    var d = quarterTotal(ALL_QUARTER_KEYS[qi], 'defects')
    if (typeof t === 'number') totalCases += t
    if (typeof d === 'number') totalDefects += d
  }
  if (totalCases === 0) return '—'
  return ((totalDefects / totalCases) * 100).toFixed(1)
})

var overallDefectRateClass = computed(function() {
  var v = parseFloat(overallDefectRate.value)
  if (isNaN(v)) return 'text-gray-400'
  return v <= 10 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
})

var overallTotalCases = computed(function() {
  if (!data.value) return 0
  var total = 0
  for (var qi = 0; qi < ALL_QUARTER_KEYS.length; qi++) {
    var t = quarterTotal(ALL_QUARTER_KEYS[qi], 'totalCases')
    if (typeof t === 'number') total += t
  }
  return total
})

var overallAvgRes = computed(function() {
  return computeOverallAvg('avgResolutionDays')
})

var overallMedianRes = computed(function() {
  return computeOverallAvg('medianResolutionDays')
})

var overallAvgResClass = computed(function() {
  var v = parseFloat(overallAvgRes.value)
  if (isNaN(v)) return 'text-gray-400'
  return v <= 14 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
})

var overallMedianResClass = computed(function() {
  var v = parseFloat(overallMedianRes.value)
  if (isNaN(v)) return 'text-gray-400'
  return v <= 14 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
})

function computeOverallAvg(field) {
  if (!data.value) return '—'
  var sum = 0
  var count = 0
  for (var qi = 0; qi < ALL_QUARTER_KEYS.length; qi++) {
    var avg = quarterAvg(ALL_QUARTER_KEYS[qi], field)
    if (avg != null) { sum += avg; count++ }
  }
  return count > 0 ? (sum / count).toFixed(1) : '—'
}

function defectRateColorClass(rate) {
  var v = parseFloat(rate)
  if (isNaN(v)) return 'text-gray-400'
  return v <= 10 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
}

function defectRateBadgeClass(rate) {
  var v = parseFloat(rate)
  if (isNaN(v)) return 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/60'
  if (v <= 10) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40'
  return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40'
}

function resolutionColorClass(val) {
  if (val == null) return 'text-gray-400'
  return val <= 14 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
}

function toggleQuarter(qKey) {
  openQuarters.value[qKey] = !openQuarters.value[qKey]
}

function getEditVal(product, field) {
  if (!editData.value || !editData.value[editQuarter.value] || !editData.value[editQuarter.value][product]) return ''
  var v = editData.value[editQuarter.value][product][field]
  return v != null ? v : ''
}

function setEditVal(product, field, rawVal) {
  if (!editData.value[editQuarter.value]) editData.value[editQuarter.value] = {}
  if (!editData.value[editQuarter.value][product]) editData.value[editQuarter.value][product] = {}
  var val = rawVal === '' ? null : parseFloat(rawVal)
  editData.value[editQuarter.value][product][field] = isNaN(val) ? null : val
}

function openSettings() {
  editData.value = JSON.parse(JSON.stringify(data.value.quarters))
  editQuarter.value = 'Q1'
  showSettings.value = true
}

function cancelSettings() {
  showSettings.value = false
}

async function saveSettings() {
  saving.value = true
  try {
    var payload = { year: data.value.year, products: data.value.products, quarters: editData.value }
    var res = await fetch('/api/modules/okr-hub/reports/support-cases', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (!res.ok) throw new Error('Save failed: ' + res.status)
    data.value = payload
    showSettings.value = false
  } catch (err) {
    alert('Failed to save: ' + err.message)
  } finally {
    saving.value = false
  }
}

function quarterHasData(qKey) {
  if (!data.value || !data.value.quarters || !data.value.quarters[qKey]) return false
  for (var i = 0; i < data.value.products.length; i++) {
    var p = data.value.products[i]
    if (data.value.quarters[qKey][p] && data.value.quarters[qKey][p].totalCases != null) return true
  }
  return false
}

function reorderQuarters() {
  var withData = []
  var withoutData = []
  for (var i = 0; i < ALL_QUARTER_KEYS.length; i++) {
    if (quarterHasData(ALL_QUARTER_KEYS[i])) withData.push(ALL_QUARTER_KEYS[i])
    else withoutData.push(ALL_QUARTER_KEYS[i])
  }
  withData.reverse()
  quarterKeys.value = withData.concat(withoutData)
}

onMounted(async function() {
  try {
    var res = await fetch('/api/modules/okr-hub/reports/support-cases')
    if (!res.ok) throw new Error('Failed to load report: ' + res.status)
    data.value = await res.json()

    reorderQuarters()
    if (quarterKeys.value.length > 0) {
      openQuarters.value[quarterKeys.value[0]] = true
    }
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
})
</script>
