<script setup>
import { ref, computed } from 'vue'
import FeatureHealthRow from './FeatureHealthRow.vue'

const props = defineProps({
  features: { type: Array, default: () => [] },
  canEdit: { type: Boolean, default: false },
  jiraBaseUrl: { type: String, default: '' }
})

const emit = defineEmits(['toggleDorItem', 'updateNotes', 'setOverride', 'removeOverride'])

var PAGE_SIZE = 50
var expandedRows = ref({})
var sortKey = ref('health')
var sortAsc = ref(true)
var currentPage = ref(1)

var columns = [
  { key: 'expand', label: '', sortable: false },
  { key: 'key', label: 'Feature', sortable: true },
  { key: 'summary', label: 'Summary', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'health', label: 'Health', sortable: true },
  { key: 'priority', label: 'Priority', sortable: true },
  { key: 'rice', label: 'RICE', sortable: true },
  { key: 'components', label: 'Component', sortable: true },
  { key: 'owner', label: 'Delivery Owner', sortable: true },
  { key: 'fixVersions', label: 'Fix Version', sortable: true },
  { key: 'targetRelease', label: 'Target Release', sortable: true }
]

var RISK_ORDER = { red: 0, yellow: 1, green: 2 }

function getRiskLevel(feature) {
  if (!feature.risk) return 'green'
  if (feature.risk.override) return feature.risk.override.riskOverride || feature.risk.level
  return feature.risk.level || 'green'
}

var sortedFeatures = computed(function() {
  var list = props.features.slice()
  var key = sortKey.value
  var asc = sortAsc.value

  list.sort(function(a, b) {
    var va, vb

    if (key === 'key') {
      va = a.key || ''
      vb = b.key || ''
    } else if (key === 'summary') {
      va = (a.summary || '').toLowerCase()
      vb = (b.summary || '').toLowerCase()
    } else if (key === 'status') {
      va = a.status || ''
      vb = b.status || ''
    } else if (key === 'health') {
      va = RISK_ORDER[getRiskLevel(a)] * 1000 + (1000 - (a.dor ? a.dor.completionPct : 0))
      vb = RISK_ORDER[getRiskLevel(b)] * 1000 + (1000 - (b.dor ? b.dor.completionPct : 0))
    } else if (key === 'priority') {
      va = a.priorityScore != null ? a.priorityScore : -1
      vb = b.priorityScore != null ? b.priorityScore : -1
    } else if (key === 'rice') {
      va = a.rice && a.rice.score != null ? a.rice.score : -1
      vb = b.rice && b.rice.score != null ? b.rice.score : -1
    } else if (key === 'components') {
      va = (a.components || '').toLowerCase()
      vb = (b.components || '').toLowerCase()
    } else if (key === 'owner') {
      va = (a.deliveryOwner || '').toLowerCase()
      vb = (b.deliveryOwner || '').toLowerCase()
    } else if (key === 'fixVersions') {
      va = (a.fixVersions || '').toLowerCase()
      vb = (b.fixVersions || '').toLowerCase()
    } else if (key === 'targetRelease') {
      va = (a.targetRelease || '').toLowerCase()
      vb = (b.targetRelease || '').toLowerCase()
    } else {
      return 0
    }

    var cmp = (typeof va === 'number' && typeof vb === 'number')
      ? va - vb
      : String(va).localeCompare(String(vb))

    return asc ? cmp : -cmp
  })

  return list
})

var totalPages = computed(function() {
  return Math.max(1, Math.ceil(sortedFeatures.value.length / PAGE_SIZE))
})

var paginatedFeatures = computed(function() {
  var start = (currentPage.value - 1) * PAGE_SIZE
  return sortedFeatures.value.slice(start, start + PAGE_SIZE)
})

var needsPagination = computed(function() {
  return sortedFeatures.value.length > PAGE_SIZE
})

function handleSort(key) {
  if (key === 'expand') return
  if (sortKey.value === key) {
    sortAsc.value = !sortAsc.value
  } else {
    sortKey.value = key
    sortAsc.value = true
  }
  currentPage.value = 1
}

function toggleRow(featureKey) {
  var updated = Object.assign({}, expandedRows.value)
  if (updated[featureKey]) {
    delete updated[featureKey]
  } else {
    updated[featureKey] = true
  }
  expandedRows.value = updated
}

function handleDorToggle(featureKey, itemId, checked) {
  emit('toggleDorItem', featureKey, itemId, checked)
}

function handleNotesUpdate(featureKey, notes) {
  emit('updateNotes', featureKey, notes)
}

function handleRemoveOverride(featureKey) {
  emit('removeOverride', featureKey)
}

function goToPage(page) {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
  }
}

function sortIndicator(key) {
  if (sortKey.value !== key) return ''
  return sortAsc.value ? ' ↑' : ' ↓'
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-sm border-collapse">
        <caption class="sr-only">Feature health assessment</caption>
        <thead>
          <tr>
            <th
              v-for="col in columns"
              :key="col.key"
              scope="col"
              class="px-3 py-2 text-left text-gray-700 dark:text-gray-200 font-semibold uppercase text-xs tracking-wide border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900/80"
              :class="col.sortable ? 'cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 select-none' : ''"
              @click="col.sortable ? handleSort(col.key) : null"
            >
              {{ col.label }}{{ sortIndicator(col.key) }}
            </th>
          </tr>
        </thead>
        <tbody>
          <template v-for="feature in paginatedFeatures" :key="feature.key">
            <FeatureHealthRow
              :feature="feature"
              :expanded="!!expandedRows[feature.key]"
              :canEdit="canEdit"
              :jiraBaseUrl="jiraBaseUrl"
              @toggle="toggleRow"
              @toggleDorItem="handleDorToggle"
              @updateNotes="handleNotesUpdate"
              @removeOverride="handleRemoveOverride"
            />
          </template>
          <tr v-if="!features || features.length === 0">
            <td colspan="11" class="px-3 py-8 text-center text-gray-500 border border-gray-300 dark:border-gray-600">
              No features found matching the current filters.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="needsPagination" class="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-600">
      <div class="text-xs text-gray-500 dark:text-gray-400">
        Showing {{ (currentPage - 1) * PAGE_SIZE + 1 }}-{{ Math.min(currentPage * PAGE_SIZE, sortedFeatures.length) }}
        of {{ sortedFeatures.length }} features
      </div>
      <div class="flex items-center gap-1">
        <button
          :disabled="currentPage <= 1"
          @click="goToPage(currentPage - 1)"
          class="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >Prev</button>
        <span class="text-xs text-gray-600 dark:text-gray-400 px-2">
          Page {{ currentPage }} of {{ totalPages }}
        </span>
        <button
          :disabled="currentPage >= totalPages"
          @click="goToPage(currentPage + 1)"
          class="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >Next</button>
      </div>
    </div>
  </div>
</template>
