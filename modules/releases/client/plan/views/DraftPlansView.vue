<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useDraftPlans } from '../composables/useDraftPlans'
import DraftPlanRow from '../components/DraftPlanRow.vue'
import DraftPlanDrawer from '../components/DraftPlanDrawer.vue'

var jiraBaseUrl = 'https://issues.redhat.com/browse'

var {
  ADMIN,
  PLACEMENTS,
  draft,
  editor,
  loading,
  saving,
  error,
  dirty,
  pendingCapacity,
  selectedProduct,
  selectedVersion,
  availableProducts,
  availableCycles,
  cycleLabel,
  activeCycleMeta,
  filterEvent,
  filterComponent,
  filterText,
  filteredRows,
  components,
  assignees,
  counts,
  admin,
  session,
  finalFrozen,
  eventFrozen,
  loadCycles,
  loadEditor,
  persist,
  moveFeature,
  confirmCapacityMove,
  cancelCapacityMove,
  descopeFeature,
  undescopeFeature,
  approveFeature,
  freeze,
  unfreeze,
  unfreezeAll,
  freezeFinalGa,
  reset,
  setCurrentUser,
  setProductFilter
} = useDraftPlans()

var selectedFeatureKey = ref(null)
var filterPlacements = PLACEMENTS.concat(['Descope'])

var selectedFeature = computed(function() {
  if (!selectedFeatureKey.value) return null
  var rows = filteredRows.value
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].key === selectedFeatureKey.value) return rows[i]
  }
  // Keep drawer open if filter hides row — look in full draft via filtered miss
  return null
})

watch(filteredRows, function(rows) {
  if (!selectedFeatureKey.value) return
  var found = false
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].key === selectedFeatureKey.value) {
      found = true
      break
    }
  }
  if (!found) selectedFeatureKey.value = null
})

var headers = [
  { id: 'h-num', label: '#' },
  { id: 'h-key', label: 'Key' },
  { id: 'h-title', label: 'Title' },
  { id: 'h-base', label: 'Base' },
  { id: 'h-place', label: 'Placement' },
  { id: 'h-move', label: 'Move' },
  { id: 'h-descope', label: 'Descope' },
  { id: 'h-approve', label: 'Approve' },
  { id: 'h-product', label: 'Product' },
  { id: 'h-comp', label: 'Component' },
  { id: 'h-assignee', label: 'Assignee' },
  { id: 'h-ready', label: 'Ready' },
  { id: 'h-frozen', label: 'Frozen' }
]

var summaryBits = computed(function() {
  return [
    { label: filteredRows.value.length + ' features' },
    { label: (counts.value.EA1 || 0) + ' EA1', tone: 'sky' },
    { label: (counts.value.EA2 || 0) + ' EA2', tone: 'sky' },
    { label: (counts.value.GA || 0) + ' GA', tone: 'sky' },
    { label: (counts.value['Below cut'] || 0) + ' below cut', tone: 'amber' },
    { label: (counts.value.Descope || 0) + ' descope', tone: 'red' }
  ]
})

function onSelectFeature(feature) {
  selectedFeatureKey.value = feature.key
}

function onMove(key, placement) {
  if (!placement) return
  moveFeature(key, placement)
}

function onFreeze(ev) {
  freeze(ev)
}

function onUnfreeze(ev) {
  unfreeze(ev)
}

function onUnfreezePlan() {
  if (!window.confirm('Unfreeze plan? Clears event freezes and Final GA lock. Auto-descoped Below-cut features stay Descoped unless you Reset to base.')) {
    return
  }
  unfreezeAll()
}

function onFinalGa() {
  if (!window.confirm('Final GA freeze locks the plan and auto-descopes remaining Below cut. Continue? (demo — no Jira writes)')) {
    return
  }
  freezeFinalGa()
}

function onReset() {
  if (!window.confirm('Reset all edits, freezes, and audit to the base draft?')) return
  selectedFeatureKey.value = null
  reset()
}

function onReload() {
  if (dirty.value && !window.confirm('Discard unsaved changes and reload?')) return
  selectedFeatureKey.value = null
  loadEditor(selectedVersion.value)
}

function onProductChange(product) {
  setProductFilter(product)
}

async function onVersionChange(version) {
  if (version === selectedVersion.value) return
  if (dirty.value && !window.confirm('Discard unsaved changes and switch cycle?')) return
  selectedFeatureKey.value = null
  await loadEditor(version)
}

function formatTs(ts) {
  if (!ts) return ''
  var d = new Date(ts)
  if (Number.isNaN(d.getTime())) return String(ts)
  return d.toLocaleString()
}

onMounted(async function() {
  try {
    await loadCycles('RHOAI')
  } catch {
    // loadEditor still tries demo/editor path
  }
  await loadEditor(selectedVersion.value)
})
</script>

<template>
  <div class="space-y-0 overflow-hidden">
    <!-- Cycle / product bar (mirrors Features List release bar) -->
    <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      <div class="flex flex-wrap items-center gap-3 min-w-0">
        <div class="min-w-0">
          <p class="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Release cycle</p>
          <h2 class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{{ cycleLabel }} Draft Plan</h2>
        </div>
        <label class="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
          Cycle
          <select
            class="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            :value="selectedVersion"
            :disabled="loading || saving || availableCycles.length === 0"
            @change="onVersionChange($event.target.value)"
          >
            <option v-for="c in availableCycles" :key="c.version" :value="c.version">
              {{ c.version }}{{ c.demoMode ? ' (demo)' : '' }}
            </option>
          </select>
        </label>
        <label class="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
          Product
          <select
            class="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100"
            :value="selectedProduct"
            :disabled="loading || saving"
            @change="onProductChange($event.target.value)"
          >
            <option value="">All (RHOAI + RHAII)</option>
            <option v-for="p in availableProducts" :key="p" :value="p">{{ p }}</option>
          </select>
        </label>
      </div>
      <div class="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
        <span v-for="bit in summaryBits" :key="bit.label">{{ bit.label }}</span>
        <label
          v-if="session && session.canImpersonate"
          class="flex items-center gap-1"
        >
          Acting as
          <select
            class="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 text-xs"
            :value="editor.meta.currentUser"
            @change="setCurrentUser($event.target.value)"
          >
            <option :value="ADMIN">{{ ADMIN }}</option>
            <option v-for="a in assignees" :key="a" :value="a">{{ a }}</option>
          </select>
          <span class="text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400">demo</span>
        </label>
        <span
          v-else
          class="flex items-center gap-1"
          :title="session && session.email ? session.email : ''"
        >
          Signed in as
          <strong class="text-gray-700 dark:text-gray-200 font-semibold">{{
            (editor.meta && editor.meta.currentUser) || (session && session.actor) || '—'
          }}</strong>
          <span
            v-if="admin"
            class="text-[10px] uppercase tracking-wide text-sky-600 dark:text-sky-400"
          >plan admin</span>
        </span>
        <button
          type="button"
          class="px-3 py-1 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          :disabled="loading || saving"
          @click="onReload"
        >Reload</button>
        <button
          type="button"
          class="px-3 py-1 text-xs font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
          :disabled="!dirty || saving || loading"
          @click="persist"
        >{{ saving ? 'Saving…' : dirty ? 'Save*' : 'Save' }}</button>
        <span v-if="dirty" class="text-amber-600 dark:text-amber-400">Unsaved</span>
      </div>
    </div>

    <!-- Plan-level freeze toolbar -->
    <div
      v-if="admin && draft"
      class="flex flex-wrap items-center gap-2 px-4 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700"
    >
      <span class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Freeze</span>
      <button
        type="button"
        class="px-3 py-1 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 disabled:opacity-50"
        :disabled="finalFrozen || eventFrozen('EA1')"
        @click="onFreeze('EA1')"
      >Freeze EA1</button>
      <button
        v-if="eventFrozen('EA1') && !finalFrozen"
        type="button"
        class="px-3 py-1 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600"
        @click="onUnfreeze('EA1')"
      >Unfreeze EA1</button>
      <button
        type="button"
        class="px-3 py-1 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 disabled:opacity-50"
        :disabled="finalFrozen || eventFrozen('EA2')"
        @click="onFreeze('EA2')"
      >Freeze EA2</button>
      <button
        v-if="eventFrozen('EA2') && !finalFrozen"
        type="button"
        class="px-3 py-1 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600"
        @click="onUnfreeze('EA2')"
      >Unfreeze EA2</button>
      <button
        type="button"
        class="px-3 py-1 text-xs font-medium rounded-md border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 disabled:opacity-50"
        :disabled="finalFrozen"
        @click="onFinalGa"
      >Final GA freeze</button>
      <button
        v-if="finalFrozen || eventFrozen('EA1') || eventFrozen('EA2') || eventFrozen('GA')"
        type="button"
        class="px-3 py-1 text-xs font-medium rounded-md border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300"
        @click="onUnfreezePlan"
      >Unfreeze plan</button>
      <button
        type="button"
        class="px-3 py-1 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300"
        @click="onReset"
      >Reset to base</button>
      <span v-if="finalFrozen" class="text-xs font-medium text-red-600 dark:text-red-400">Plan locked</span>
    </div>

    <!-- Filter strip -->
    <div class="flex flex-wrap items-end gap-3 px-4 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      <label class="text-xs text-gray-500 dark:text-gray-400">
        Event
        <select v-model="filterEvent" class="mt-0.5 block rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-2 py-1.5">
          <option value="">All</option>
          <option v-for="p in filterPlacements" :key="p" :value="p">{{ p }}</option>
        </select>
      </label>
      <label class="text-xs text-gray-500 dark:text-gray-400">
        Component
        <select v-model="filterComponent" class="mt-0.5 block rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-2 py-1.5">
          <option value="">All</option>
          <option v-for="c in components" :key="c" :value="c">{{ c }}</option>
        </select>
      </label>
      <label class="text-xs text-gray-500 dark:text-gray-400 flex-1 min-w-[12rem]">
        Search
        <input
          v-model="filterText"
          type="search"
          placeholder="Key, summary, assignee…"
          class="mt-0.5 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-2 py-1.5"
        />
      </label>
    </div>

    <div
      v-if="draft && draft.demoMode"
      class="mx-4 mt-3 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-300"
    >
      Demo fixture. Move / Descope / Approve stay in the table. Click a row for feature details.
    </div>

    <div
      v-if="error"
      role="alert"
      class="mx-4 mt-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4 text-sm text-red-700 dark:text-red-400"
    >
      {{ error }}
    </div>

    <!-- Dense table -->
    <div class="overflow-x-auto">
      <table role="table" class="w-full text-xs">
        <thead role="rowgroup" class="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
          <tr role="row">
            <th
              v-for="header in headers"
              :key="header.id"
              role="columnheader"
              scope="col"
              class="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
              :class="header.id === 'h-num' ? 'px-2 text-center w-8' : ''"
            >
              {{ header.label }}
            </th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          <template v-if="loading && filteredRows.length === 0">
            <tr v-for="i in 5" :key="'skel-' + i" role="row" class="border-b border-gray-100 dark:border-gray-800">
              <td v-for="j in headers.length" :key="j" class="px-3 py-3">
                <div class="h-3 rounded animate-pulse bg-gray-200 dark:bg-gray-700" :class="j === 3 ? 'w-24' : 'w-16'" />
              </td>
            </tr>
          </template>

          <DraftPlanRow
            v-for="(row, idx) in filteredRows"
            :key="row.key"
            :feature="row"
            :index="idx + 1"
            :jira-base-url="jiraBaseUrl"
            :placements="PLACEMENTS"
            @select="onSelectFeature"
            @move="onMove"
            @descope="descopeFeature"
            @undescope="undescopeFeature"
            @approve="approveFeature"
          />

          <tr v-if="!loading && !draft" role="row">
            <td :colspan="headers.length" class="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
              No draft plan loaded
            </td>
          </tr>
          <tr v-else-if="!loading && filteredRows.length === 0" role="row">
            <td :colspan="headers.length" class="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
              No features match filters
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div
      v-if="draft"
      class="px-4 py-2 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900"
    >
      <span v-if="draft.generatedAt">Generated {{ formatTs(draft.generatedAt) }}</span>
      <span v-if="activeCycleMeta && activeCycleMeta.source"> · source: {{ activeCycleMeta.source }}</span>
      <span> · click a row for details</span>
      <span v-if="editor.audit.length"> · {{ editor.audit.length }} audit entries</span>
    </div>

    <DraftPlanDrawer
      :feature="selectedFeature"
      :jira-base-url="jiraBaseUrl"
      @close="selectedFeatureKey = null"
    />

    <div
      v-if="pendingCapacity"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div class="w-full max-w-md rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4 shadow-lg">
        <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">Over capacity</h3>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
          {{ pendingCapacity.check && pendingCapacity.check.message }}
        </p>
        <div class="mt-4 flex justify-end gap-2">
          <button
            type="button"
            class="rounded-md px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600"
            @click="cancelCapacityMove"
          >Cancel</button>
          <button
            type="button"
            class="rounded-md px-3 py-1.5 text-sm bg-primary-600 text-white"
            @click="confirmCapacityMove"
          >Move anyway</button>
        </div>
      </div>
    </div>
  </div>
</template>
