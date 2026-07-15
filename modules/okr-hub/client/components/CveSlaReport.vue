<template>
  <div class="space-y-5">
    <div v-if="loading" class="text-sm text-gray-500 dark:text-gray-400">Loading CVE SLA data...</div>
    <div v-else-if="error" class="rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-4 py-3 text-sm">{{ error }}</div>

    <template v-else-if="data">
      <!-- Summary Header -->
      <div class="flex items-center gap-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-6 py-5">
        <div class="text-center">
          <div class="text-4xl font-black tabular-nums" :class="overallPctClass">{{ overallPct }}%</div>
          <div class="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-1">YTD SLA</div>
        </div>
        <div class="h-12 w-px bg-gray-200 dark:bg-gray-700" />
        <div class="flex items-center gap-5 text-sm">
          <div class="text-center">
            <div class="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">{{ totalMet }}</div>
            <div class="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 uppercase">CVEs Met</div>
          </div>
          <div class="text-center">
            <div class="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">{{ totalMissed }}</div>
            <div class="text-[10px] font-medium text-red-600 dark:text-red-400 uppercase">CVEs Missed</div>
          </div>
          <div class="text-center">
            <div class="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">{{ data.products.length }}</div>
            <div class="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">Products</div>
          </div>
        </div>
        <div class="ml-auto flex items-center gap-2">
          <span v-if="dirty" class="text-xs text-amber-600 dark:text-amber-400 font-medium">Unsaved changes</span>
          <button
            v-if="dirty"
            @click="save"
            :disabled="saving"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            <svg v-if="saving" class="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" class="opacity-25" /><path d="M4 12a8 8 0 018-8" stroke="currentColor" stroke-width="4" stroke-linecap="round" class="opacity-75" /></svg>
            {{ saving ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </div>

      <!-- Manage Products -->
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Products:</span>
        <span
          v-for="(prod, pi) in data.products"
          :key="prod"
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-300"
        >
          {{ prod }}
          <button @click="removeProduct(pi)" class="text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" title="Remove product">
            <svg class="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
          </button>
        </span>
        <button @click="showAddProduct = true" v-if="!showAddProduct" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-dashed border-gray-300 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
          <svg class="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" /></svg>
          Add
        </button>
        <div v-if="showAddProduct" class="flex items-center gap-1">
          <input
            ref="addProductInput"
            v-model="newProductName"
            @keyup.enter="addProduct"
            @keyup.escape="showAddProduct = false; newProductName = ''"
            class="px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-gray-100 w-40"
            placeholder="Product name"
          />
          <button @click="addProduct" class="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400">
            <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd" /></svg>
          </button>
          <button @click="showAddProduct = false; newProductName = ''" class="text-gray-400 hover:text-red-500">
            <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
          </button>
        </div>
      </div>

      <!-- Quarter Sections -->
      <div v-for="q in quarters" :key="q.label" class="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        <!-- Quarter Header (clickable) -->
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
            <span class="text-sm font-bold text-gray-900 dark:text-gray-100">{{ q.label }} {{ data.year }}</span>
          </div>
          <span
            class="text-sm font-bold tabular-nums px-2.5 py-0.5 rounded-full"
            :class="quarterPctClass(quarterPct(q))"
          >{{ quarterPct(q) }}%</span>
        </button>

        <!-- Quarter Table (collapsible) -->
        <div v-show="openQuarters[q.label]" class="overflow-x-auto">
          <table class="w-full text-xs border-collapse">
            <thead>
              <tr class="bg-gray-50 dark:bg-gray-800/60">
                <th class="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-36 sticky left-0 bg-gray-50 dark:bg-gray-800/60 z-10">Month</th>
                <th
                  v-for="prod in data.products"
                  :key="prod"
                  class="px-2 py-2 text-center text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[80px]"
                >{{ prod }}</th>
                <th class="px-3 py-2 text-center text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-20 border-l border-gray-200 dark:border-gray-700">Totals</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="monthKey in q.months" :key="monthKey">
                <!-- Met row -->
                <tr class="border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
                  <td class="px-3 py-1.5 font-medium text-gray-700 dark:text-gray-300 sticky left-0 bg-white dark:bg-gray-900 z-10">{{ monthLabel(monthKey) }} CVE Met</td>
                  <td v-for="prod in data.products" :key="prod + '-met'" class="px-1 py-1 text-center">
                    <input
                      type="number"
                      :value="getVal(monthKey, prod, 'met')"
                      @input="setVal(monthKey, prod, 'met', $event)"
                      min="0"
                      class="w-16 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-center text-xs tabular-nums text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-primary-400 focus:border-primary-400 outline-none"
                    />
                  </td>
                  <td class="px-3 py-1.5 text-center font-semibold text-gray-900 dark:text-gray-100 tabular-nums border-l border-gray-200 dark:border-gray-700">{{ monthTotal(monthKey, 'met') || '' }}</td>
                </tr>
                <!-- Missed row -->
                <tr class="bg-white dark:bg-gray-900">
                  <td class="px-3 py-1.5 font-medium text-gray-700 dark:text-gray-300 sticky left-0 bg-white dark:bg-gray-900 z-10">{{ monthLabel(monthKey) }} CVE Missed</td>
                  <td v-for="prod in data.products" :key="prod + '-missed'" class="px-1 py-1 text-center">
                    <input
                      type="number"
                      :value="getVal(monthKey, prod, 'missed')"
                      @input="setVal(monthKey, prod, 'missed', $event)"
                      min="0"
                      class="w-16 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-center text-xs tabular-nums text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-primary-400 focus:border-primary-400 outline-none"
                    />
                  </td>
                  <td class="px-3 py-1.5 text-center font-semibold text-gray-900 dark:text-gray-100 tabular-nums border-l border-gray-200 dark:border-gray-700">{{ monthTotal(monthKey, 'missed') || '' }}</td>
                </tr>
                <!-- Percentage row -->
                <tr class="bg-gray-50/50 dark:bg-gray-800/30 border-b border-gray-200 dark:border-gray-700">
                  <td class="px-3 py-1 sticky left-0 bg-gray-50/50 dark:bg-gray-800/30 z-10"></td>
                  <td v-for="prod in data.products" :key="prod + '-pct'" class="px-1 py-1 text-center">
                    <span class="text-[10px] font-bold tabular-nums" :class="cellPctClass(monthPct(monthKey, prod))">{{ monthPct(monthKey, prod) }}</span>
                  </td>
                  <td class="px-3 py-1 text-center border-l border-gray-200 dark:border-gray-700">
                    <span class="text-[10px] font-bold tabular-nums" :class="cellPctClass(monthTotalPct(monthKey))">{{ monthTotalPct(monthKey) }}</span>
                  </td>
                </tr>
              </template>
              <!-- Quarter Total Row -->
              <tr class="bg-amber-50 dark:bg-amber-900/20 border-t-2 border-amber-300 dark:border-amber-700">
                <td class="px-3 py-2 font-bold text-gray-900 dark:text-gray-100 sticky left-0 bg-amber-50 dark:bg-amber-900/20 z-10">{{ q.label }} {{ data.year }} Total</td>
                <td :colspan="data.products.length" class="px-3 py-2"></td>
                <td class="px-3 py-2 text-center border-l border-amber-300 dark:border-amber-700">
                  <span class="text-sm font-black tabular-nums" :class="quarterPctClass(quarterPct(q))">{{ quarterPct(q) }}%</span>
                </td>
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

var MONTH_KEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
var MONTH_LABELS = { jan: 'Jan', feb: 'Feb', mar: 'Mar', apr: 'Apr', may: 'May', jun: 'Jun', jul: 'Jul', aug: 'Aug', sep: 'Sep', oct: 'Oct', nov: 'Nov', dec: 'Dec' }

var ALL_QUARTERS = [
  { label: 'Q1', months: ['jan', 'feb', 'mar'] },
  { label: 'Q2', months: ['apr', 'may', 'jun'] },
  { label: 'Q3', months: ['jul', 'aug', 'sep'] },
  { label: 'Q4', months: ['oct', 'nov', 'dec'] }
]
var quarters = ref(ALL_QUARTERS)

var loading = ref(true)
var error = ref(null)
var data = ref(null)
var dirty = ref(false)
var saving = ref(false)
var openQuarters = ref({})
var showAddProduct = ref(false)
var newProductName = ref('')
var addProductInput = ref(null)

function monthLabel(key) { return MONTH_LABELS[key] || key }

function ensureMonthProduct(monthKey, prod) {
  if (!data.value.months[monthKey]) data.value.months[monthKey] = {}
  if (!data.value.months[monthKey][prod]) data.value.months[monthKey][prod] = { met: null, missed: null }
}

function getVal(monthKey, prod, field) {
  ensureMonthProduct(monthKey, prod)
  var v = data.value.months[monthKey][prod][field]
  return v === null || v === undefined ? '' : v
}

function getNumVal(monthKey, prod, field) {
  ensureMonthProduct(monthKey, prod)
  var v = data.value.months[monthKey][prod][field]
  return (v === null || v === undefined) ? 0 : v
}

function setVal(monthKey, prod, field, event) {
  ensureMonthProduct(monthKey, prod)
  var raw = event.target.value.trim()
  data.value.months[monthKey][prod][field] = raw === '' ? null : Math.max(0, parseInt(raw, 10) || 0)
  dirty.value = true
}

function monthTotal(monthKey, field) {
  var sum = 0
  for (var i = 0; i < data.value.products.length; i++) {
    sum += getNumVal(monthKey, data.value.products[i], field)
  }
  return sum
}

function monthPct(monthKey, prod) {
  var m = getNumVal(monthKey, prod, 'met')
  var mi = getNumVal(monthKey, prod, 'missed')
  var total = m + mi
  if (total === 0) return ''
  return Math.round((m / total) * 100) + '%'
}

function monthTotalPct(monthKey) {
  var met = monthTotal(monthKey, 'met')
  var missed = monthTotal(monthKey, 'missed')
  var total = met + missed
  if (total === 0) return ''
  return Math.round((met / total) * 100) + '%'
}

function quarterPct(q) {
  var met = 0
  var missed = 0
  for (var mi = 0; mi < q.months.length; mi++) {
    met += monthTotal(q.months[mi], 'met')
    missed += monthTotal(q.months[mi], 'missed')
  }
  var total = met + missed
  if (total === 0) return 0
  return Math.round((met / total) * 100)
}

var totalMet = computed(function() {
  var sum = 0
  for (var i = 0; i < MONTH_KEYS.length; i++) sum += monthTotal(MONTH_KEYS[i], 'met')
  return sum
})

var totalMissed = computed(function() {
  var sum = 0
  for (var i = 0; i < MONTH_KEYS.length; i++) sum += monthTotal(MONTH_KEYS[i], 'missed')
  return sum
})

var overallPct = computed(function() {
  var total = totalMet.value + totalMissed.value
  if (total === 0) return 0
  return Math.round((totalMet.value / total) * 100)
})

var overallPctClass = computed(function() {
  var p = overallPct.value
  if (p === 100) return 'text-emerald-600 dark:text-emerald-400'
  if (p >= 66) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
})

function quarterPctClass(pct) {
  if (pct === 100) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40'
  if (pct >= 66) return 'text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/40'
  return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40'
}

function cellPctClass(val) {
  if (!val) return 'text-gray-300 dark:text-gray-600'
  var n = parseInt(val)
  if (n === 100) return 'text-emerald-600 dark:text-emerald-400'
  if (n >= 66) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

function toggleQuarter(label) {
  openQuarters.value[label] = !openQuarters.value[label]
}

function addProduct() {
  var name = newProductName.value.trim()
  if (!name || data.value.products.indexOf(name) !== -1) return
  data.value.products.push(name)
  dirty.value = true
  newProductName.value = ''
  showAddProduct.value = false
}

function removeProduct(index) {
  var prod = data.value.products[index]
  data.value.products.splice(index, 1)
  for (var mk = 0; mk < MONTH_KEYS.length; mk++) {
    var m = data.value.months[MONTH_KEYS[mk]]
    if (m && m[prod]) delete m[prod]
  }
  dirty.value = true
}

async function save() {
  saving.value = true
  try {
    var res = await fetch('/api/modules/okr-hub/reports/cve-sla', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data.value)
    })
    if (!res.ok) throw new Error('Save failed: ' + res.status)
    dirty.value = false
  } catch (err) {
    error.value = err.message
  } finally {
    saving.value = false
  }
}

function quarterHasData(q) {
  if (!data.value || !data.value.months) return false
  for (var mi = 0; mi < q.months.length; mi++) {
    var m = data.value.months[q.months[mi]]
    if (!m) continue
    for (var pi = 0; pi < (data.value.products || []).length; pi++) {
      var prod = data.value.products[pi]
      if (m[prod] && (m[prod].met != null || m[prod].missed != null)) return true
    }
  }
  return false
}

function reorderQuarters() {
  var withData = []
  var withoutData = []
  for (var i = 0; i < ALL_QUARTERS.length; i++) {
    if (quarterHasData(ALL_QUARTERS[i])) withData.push(ALL_QUARTERS[i])
    else withoutData.push(ALL_QUARTERS[i])
  }
  withData.reverse()
  quarters.value = withData.concat(withoutData)
}

onMounted(async function() {
  try {
    var res = await fetch('/api/modules/okr-hub/reports/cve-sla')
    if (!res.ok) throw new Error('Failed to load CVE SLA data: ' + res.status)
    data.value = await res.json()
    if (!data.value.months) data.value.months = {}
    for (var i = 0; i < MONTH_KEYS.length; i++) {
      if (!data.value.months[MONTH_KEYS[i]]) data.value.months[MONTH_KEYS[i]] = {}
    }

    reorderQuarters()
    if (quarters.value.length > 0) {
      openQuarters.value[quarters.value[0].label] = true
    }
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
})
</script>
