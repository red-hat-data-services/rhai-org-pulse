<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Draft Plans</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          View / red-pen / freeze over pipeline draft JSON. Keep is implicit — use Move or Descope.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <label class="text-xs text-gray-500 dark:text-gray-400">
          Acting as
          <select
            class="ml-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-2 py-1"
            :value="editor.meta.currentUser"
            @change="setCurrentUser($event.target.value)"
          >
            <option :value="ADMIN">{{ ADMIN }}</option>
            <option v-for="a in assignees" :key="a" :value="a">{{ a }}</option>
          </select>
        </label>
        <button
          type="button"
          class="rounded-md px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
          :disabled="loading || saving"
          @click="onReload"
        >
          Reload
        </button>
        <button
          type="button"
          class="rounded-md px-3 py-1.5 text-sm bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
          :disabled="!dirty || saving || loading"
          @click="persist"
        >
          {{ saving ? 'Saving…' : dirty ? 'Save*' : 'Save' }}
        </button>
        <span v-if="dirty" class="text-xs text-amber-600 dark:text-amber-400">Unsaved changes</span>
      </div>
    </div>

    <div
      v-if="draft && draft.demoMode"
      class="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-300"
    >
      Demo fixture (pipeline draft sample). Live GitLab ingest lands after release-planning MR !25. No Jira writes — freeze simulates Fix Version only.
    </div>

    <div v-if="error" class="rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-2 text-sm text-red-700 dark:text-red-300">
      {{ error }}
    </div>

    <div v-if="loading" class="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">Loading draft plan…</div>

    <div
      v-else-if="!draft"
      class="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400"
    >
      No draft plan loaded. Reload to fetch the demo fixture (3.6) or a stored pipeline draft.
    </div>

    <template v-else>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <div v-for="stat in summaryStats" :key="stat.label" class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2">
          <div class="text-xs text-gray-500 dark:text-gray-400">{{ stat.label }}</div>
          <div class="text-lg font-semibold tabular-nums text-gray-900 dark:text-gray-100">{{ stat.value }}</div>
        </div>
      </div>

      <div v-if="admin" class="flex flex-wrap gap-2 items-center">
        <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Freeze</span>
        <button
          type="button"
          class="rounded-md px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 disabled:opacity-50"
          :disabled="finalFrozen || eventFrozen('EA1')"
          @click="onFreeze('EA1')"
        >
          Freeze EA1
        </button>
        <button
          v-if="eventFrozen('EA1') && !finalFrozen"
          type="button"
          class="rounded-md px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600"
          @click="onUnfreeze('EA1')"
        >
          Unfreeze EA1
        </button>
        <button
          type="button"
          class="rounded-md px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 disabled:opacity-50"
          :disabled="finalFrozen || eventFrozen('EA2')"
          @click="onFreeze('EA2')"
        >
          Freeze EA2
        </button>
        <button
          v-if="eventFrozen('EA2') && !finalFrozen"
          type="button"
          class="rounded-md px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600"
          @click="onUnfreeze('EA2')"
        >
          Unfreeze EA2
        </button>
        <button
          type="button"
          class="rounded-md px-3 py-1.5 text-sm border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 disabled:opacity-50"
          :disabled="finalFrozen"
          @click="onFinalGa"
        >
          Final GA freeze
        </button>
        <button
          v-if="finalFrozen || eventFrozen('EA1') || eventFrozen('EA2') || eventFrozen('GA')"
          type="button"
          class="rounded-md px-3 py-1.5 text-sm border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300"
          @click="onUnfreezePlan"
        >
          Unfreeze plan
        </button>
        <button
          type="button"
          class="rounded-md px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300"
          @click="onReset"
        >
          Reset to base
        </button>
        <span v-if="finalFrozen" class="text-xs font-medium text-red-600 dark:text-red-400">Plan locked (final GA)</span>
      </div>

      <div class="grid md:grid-cols-3 gap-3">
        <div
          v-for="ev in scheduledEvents"
          :key="ev"
          class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3"
        >
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {{ ev }}
              <span v-if="eventFrozen(ev)" class="ml-1 text-[10px] uppercase text-amber-600 dark:text-amber-400">frozen</span>
            </h3>
            <span class="text-xs tabular-nums text-gray-500">{{ counts[ev] || 0 }}</span>
          </div>
          <ul class="space-y-1 max-h-28 overflow-auto">
            <li
              v-for="bar in eventLoadBars(ev).slice(0, 8)"
              :key="ev + bar.component"
              class="flex items-center justify-between text-[11px] text-gray-600 dark:text-gray-300 gap-2"
            >
              <span class="truncate">{{ bar.component }}</span>
              <span class="tabular-nums shrink-0" :class="bar.budget != null && bar.load > bar.budget ? 'text-red-600 dark:text-red-400 font-semibold' : ''">
                {{ bar.load }}<template v-if="bar.budget != null"> / {{ bar.budget }}</template>
              </span>
            </li>
            <li v-if="eventLoadBars(ev).length === 0" class="text-[11px] text-gray-400">No features</li>
          </ul>
        </div>
      </div>

      <div class="flex flex-wrap gap-2 items-end">
        <label class="text-xs text-gray-500 dark:text-gray-400">
          Event
          <select v-model="filterEvent" class="block mt-0.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-2 py-1">
            <option value="">All</option>
            <option v-for="p in filterPlacements" :key="p" :value="p">{{ p }}</option>
          </select>
        </label>
        <label class="text-xs text-gray-500 dark:text-gray-400">
          Component
          <select v-model="filterComponent" class="block mt-0.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-2 py-1">
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
            class="block mt-0.5 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-2 py-1"
          />
        </label>
      </div>

      <div class="overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <table class="w-full text-xs">
          <thead class="bg-gray-50 dark:bg-gray-800/80 text-left text-gray-500 dark:text-gray-400">
            <tr>
              <th class="px-2 py-2 font-medium">Key</th>
              <th class="px-2 py-2 font-medium">Summary</th>
              <th class="px-2 py-2 font-medium">Base</th>
              <th class="px-2 py-2 font-medium">Move</th>
              <th class="px-2 py-2 font-medium">Descope</th>
              <th class="px-2 py-2 font-medium">Approve</th>
              <th class="px-2 py-2 font-medium">Component</th>
              <th class="px-2 py-2 font-medium">Assignee</th>
              <th class="px-2 py-2 font-medium">Proposed FV</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in filteredRows"
              :key="row.key"
              class="border-t border-gray-100 dark:border-gray-800"
              :class="{
                'bg-emerald-50/70 dark:bg-emerald-900/20': row.approved,
                'opacity-60': row.frozen,
                'bg-amber-50/40 dark:bg-amber-900/10': row.changed && !row.approved
              }"
            >
              <td class="px-2 py-2 font-mono whitespace-nowrap">{{ row.key }}</td>
              <td class="px-2 py-2 max-w-[18rem] truncate" :title="row.summary">{{ row.summary }}</td>
              <td class="px-2 py-2 whitespace-nowrap text-gray-500">{{ row.basePlacement }}</td>
              <td class="px-2 py-2">
                <select
                  class="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs px-1 py-0.5 max-w-[7rem]"
                  :disabled="!row.editable"
                  :value="row.decision === 'descope' ? '' : row.event === 'Descope' ? '' : row.event"
                  @change="onMove(row.key, $event.target.value)"
                >
                  <option disabled value="">—</option>
                  <option v-for="p in PLACEMENTS" :key="p" :value="p">{{ p }}</option>
                </select>
              </td>
              <td class="px-2 py-2">
                <button
                  v-if="row.decision !== 'descope'"
                  type="button"
                  class="text-red-600 dark:text-red-400 hover:underline disabled:opacity-40"
                  :disabled="!row.editable"
                  @click="descopeFeature(row.key)"
                >
                  Descope
                </button>
                <button
                  v-else
                  type="button"
                  class="text-gray-600 dark:text-gray-300 hover:underline disabled:opacity-40"
                  :disabled="!row.editable"
                  @click="undescopeFeature(row.key)"
                >
                  Undo
                </button>
              </td>
              <td class="px-2 py-2">
                <input
                  type="checkbox"
                  :checked="row.approved"
                  :disabled="!row.editable || row.decision === 'descope'"
                  @change="approveFeature(row.key, $event.target.checked)"
                />
              </td>
              <td class="px-2 py-2 whitespace-nowrap">{{ row.component }}</td>
              <td class="px-2 py-2 whitespace-nowrap">{{ row.assignee }}</td>
              <td class="px-2 py-2 font-mono whitespace-nowrap text-gray-500">{{ row.proposedFixVersion || '—' }}</td>
            </tr>
            <tr v-if="filteredRows.length === 0">
              <td colspan="9" class="px-2 py-6 text-center text-gray-400">No features match filters</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Audit</h3>
        <ul class="space-y-1 max-h-40 overflow-auto text-[11px] text-gray-600 dark:text-gray-300">
          <li v-for="(a, idx) in editor.audit.slice(0, 40)" :key="idx + a.ts">
            <span class="tabular-nums text-gray-400">{{ formatTs(a.ts) }}</span>
            · {{ a.actor }} · {{ a.detail || a.action }}
          </li>
          <li v-if="editor.audit.length === 0" class="text-gray-400">No edits yet</li>
        </ul>
      </div>
    </template>

    <div
      v-if="pendingCapacity"
      class="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
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
          >
            Cancel
          </button>
          <button
            type="button"
            class="rounded-md px-3 py-1.5 text-sm bg-primary-600 text-white"
            @click="confirmCapacityMove"
          >
            Move anyway
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useDraftPlans } from '../composables/useDraftPlans'

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
  selectedVersion,
  filterEvent,
  filterComponent,
  filterText,
  filteredRows,
  components,
  assignees,
  counts,
  admin,
  finalFrozen,
  eventFrozen,
  eventLoadBars,
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
  setCurrentUser
} = useDraftPlans()

var scheduledEvents = ['EA1', 'EA2', 'GA']
var filterPlacements = PLACEMENTS.concat(['Descope'])

var summaryStats = computed(function() {
  return [
    { label: 'Candidates', value: draft.value && draft.value.summary ? draft.value.summary.candidateCount : filteredRows.value.length },
    { label: 'EA1', value: counts.value.EA1 || 0 },
    { label: 'EA2', value: counts.value.EA2 || 0 },
    { label: 'GA', value: counts.value.GA || 0 },
    { label: 'Below cut', value: counts.value['Below cut'] || 0 },
    { label: 'Descope', value: counts.value.Descope || 0 }
  ]
})

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
  reset()
}

function onReload() {
  if (dirty.value && !window.confirm('Discard unsaved changes and reload?')) return
  loadEditor(selectedVersion.value)
}

function formatTs(ts) {
  if (!ts) return ''
  var d = new Date(ts)
  if (Number.isNaN(d.getTime())) return String(ts)
  return d.toLocaleString()
}

onMounted(function() {
  loadEditor(selectedVersion.value)
})
</script>
