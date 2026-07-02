<template>
  <div class="space-y-4">
    <div v-if="loading" class="text-sm text-gray-500 dark:text-gray-400">Loading release data...</div>
    <div v-else-if="error" class="rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-4 py-3 text-sm">{{ error }}</div>

    <template v-else-if="data">
      <!-- Summary -->
      <div class="flex items-center gap-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-6 py-5">
        <div class="text-center">
          <div class="text-4xl font-black tabular-nums" :class="pctClass">{{ data.summary.pct }}%</div>
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
        <div class="ml-auto flex items-center gap-3">
          <span class="text-xs text-gray-400 dark:text-gray-500">Releases with planned GA after {{ data.since }}</span>
          <button
            v-if="canEdit"
            @click="showSettings = !showSettings"
            class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Manage releases"
          >
            <svg class="w-5 h-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Settings Panel -->
      <div v-if="showSettings" class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg overflow-hidden">
        <div class="px-5 py-3 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <span class="text-sm font-bold text-gray-900 dark:text-gray-100">Manage Releases</span>
          <button @click="addCustomRelease" class="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors">+ Add Release</button>
        </div>
        <div class="divide-y divide-gray-100 dark:divide-gray-800 max-h-96 overflow-y-auto">
          <div v-for="(entry, idx) in settingsEntries" :key="entry.id" class="px-5 py-3 flex items-center gap-3" :class="entry.removed ? 'opacity-40' : ''">
            <div class="flex-1 grid grid-cols-3 gap-3">
              <div>
                <label class="text-[10px] font-semibold text-gray-400 uppercase">Name</label>
                <input
                  v-model="entry.displayName"
                  class="mt-0.5 w-full text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Release name"
                />
              </div>
              <div>
                <label class="text-[10px] font-semibold text-gray-400 uppercase">Planned GA</label>
                <input
                  v-model="entry.plannedGa"
                  type="date"
                  class="mt-0.5 w-full text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label class="text-[10px] font-semibold text-gray-400 uppercase">Actual GA</label>
                <input
                  v-model="entry.actualGa"
                  type="date"
                  class="mt-0.5 w-full text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
            <button
              @click="toggleRemove(idx)"
              class="mt-4 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              :title="entry.removed ? 'Restore' : 'Remove'"
            >
              <svg v-if="!entry.removed" class="w-4 h-4 text-red-400 hover:text-red-600" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 01.78.72l.5 6.5a.75.75 0 01-1.49.12l-.5-6.5a.75.75 0 01.71-.84zm3.62.72a.75.75 0 10-1.49-.12l-.5 6.5a.75.75 0 101.49.12l.5-6.5z" clip-rule="evenodd" /></svg>
              <svg v-else class="w-4 h-4 text-emerald-500 hover:text-emerald-600" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H4.598a.75.75 0 00-.75.75v3.634a.75.75 0 001.5 0v-2.033l.312.312a7 7 0 0011.712-3.138.75.75 0 00-1.06-.18zm-1.024-7.848a7 7 0 00-11.712 3.138.75.75 0 001.06.18 5.5 5.5 0 019.201-2.466l.312.311h-2.433a.75.75 0 000 1.5h3.634a.75.75 0 00.75-.75V1.855a.75.75 0 00-1.5 0v2.033l-.312-.312z" clip-rule="evenodd" /></svg>
            </button>
          </div>
          <div v-if="settingsEntries.length === 0" class="px-5 py-6 text-center text-sm text-gray-400 italic">No releases configured.</div>
        </div>
        <div class="px-5 py-3 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button @click="cancelSettings" class="px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">Cancel</button>
          <button @click="saveSettings" :disabled="saving" class="px-4 py-1.5 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50">{{ saving ? 'Saving...' : 'Save' }}</button>
        </div>
      </div>

      <!-- Quarterly Collapsibles -->
      <div v-for="q in quarters" :key="q.label" class="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
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
            <span class="text-xs text-gray-500 dark:text-gray-400">{{ q.releases.length }} release{{ q.releases.length !== 1 ? 's' : '' }}</span>
          </div>
          <span class="text-sm font-bold tabular-nums px-2.5 py-0.5 rounded-full" :class="quarterBadgeClass(q)">{{ q.pct !== null ? q.pct + '%' : '—' }}</span>
        </button>

        <div v-show="openQuarters[q.label]" class="overflow-x-auto">
          <table class="w-full text-sm border-collapse">
            <thead>
              <tr class="bg-gray-50 dark:bg-gray-800/60">
                <th class="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Release</th>
                <th class="px-4 py-2.5 text-center text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-36">Planned GA</th>
                <th class="px-4 py-2.5 text-center text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-36">Actual GA</th>
                <th class="px-4 py-2.5 text-center text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28">Status</th>
                <th class="px-4 py-2.5 text-center text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28">Days Late</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="rel in q.releases"
                :key="rel.id"
                class="border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <td class="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">
                  {{ rel.displayName }}
                  <span v-if="rel.custom" class="ml-1 text-[9px] font-bold text-primary-500 uppercase">custom</span>
                </td>
                <td class="px-4 py-3 text-center text-gray-600 dark:text-gray-400 tabular-nums">{{ formatDate(rel.plannedGa) }}</td>
                <td class="px-4 py-3 text-center tabular-nums" :class="rel.actualGa ? 'text-gray-600 dark:text-gray-400' : 'text-gray-300 dark:text-gray-600'">
                  {{ rel.actualGa ? formatDate(rel.actualGa) : '—' }}
                </td>
                <td class="px-4 py-3 text-center">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold" :class="statusBadgeClass(rel)">{{ statusLabel(rel) }}</span>
                </td>
                <td class="px-4 py-3 text-center tabular-nums" :class="daysLateClass(rel)">
                  {{ rel.daysLate != null ? (rel.daysLate <= 0 ? '0' : '+' + rel.daysLate) : '—' }}
                </td>
              </tr>
              <tr v-if="q.releases.length === 0">
                <td colspan="5" class="px-4 py-6 text-center text-gray-400 dark:text-gray-500 text-sm italic">No releases in this quarter.</td>
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
var settingsEntries = ref([])

var pctClass = computed(function() {
  if (!data.value) return 'text-gray-400'
  var pct = data.value.summary.pct
  if (pct === 100) return 'text-emerald-600 dark:text-emerald-400'
  if (pct >= 66) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
})

var quarters = computed(function() {
  if (!data.value || !data.value.releases) return []
  var map = {}
  for (var i = 0; i < data.value.releases.length; i++) {
    var rel = data.value.releases[i]
    var d = new Date(rel.plannedGa + 'T00:00:00')
    var year = d.getFullYear()
    var qNum = Math.floor(d.getMonth() / 3) + 1
    var label = 'Q' + qNum + ' ' + year
    if (!map[label]) {
      map[label] = { label: label, releases: [], sortKey: year * 10 + qNum }
    }
    map[label].releases.push(rel)
  }
  var result = Object.keys(map).map(function(k) { return map[k] })
  result.sort(function(a, b) { return b.sortKey - a.sortKey })
  for (var qi = 0; qi < result.length; qi++) {
    var q = result[qi]
    var released = 0
    var onTime = 0
    for (var ri = 0; ri < q.releases.length; ri++) {
      if (q.releases[ri].released) {
        released++
        if (q.releases[ri].onTime) onTime++
      }
    }
    q.pct = released > 0 ? Math.round((onTime / released) * 100) : null
    delete q.sortKey
  }
  return result
})

function quarterBadgeClass(q) {
  if (q.pct === null) return 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/60'
  if (q.pct === 100) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40'
  if (q.pct >= 66) return 'text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/40'
  return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40'
}

function toggleQuarter(label) {
  openQuarters.value[label] = !openQuarters.value[label]
}

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

function addCustomRelease() {
  settingsEntries.value.push({
    id: 'custom-' + Date.now(),
    displayName: '',
    plannedGa: '',
    actualGa: '',
    custom: true,
    removed: false
  })
}

function toggleRemove(idx) {
  settingsEntries.value[idx].removed = !settingsEntries.value[idx].removed
}

function cancelSettings() {
  showSettings.value = false
  loadSettingsEntries()
}

async function saveSettings() {
  saving.value = true
  try {
    var payload = {
      releases: settingsEntries.value.map(function(e) {
        var entry = { id: e.id, displayName: e.displayName, plannedGa: e.plannedGa, actualGa: e.actualGa || null }
        if (e.custom) entry.custom = true
        if (e.removed) entry.removed = true
        return entry
      })
    }
    var res = await fetch('/api/modules/okr-hub/reports/on-time-releases/overrides', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (!res.ok) throw new Error('Save failed: ' + res.status)
    showSettings.value = false
    await loadData()
  } catch (err) {
    alert('Failed to save: ' + err.message)
  } finally {
    saving.value = false
  }
}

async function loadSettingsEntries() {
  try {
    var res = await fetch('/api/modules/okr-hub/reports/on-time-releases/overrides')
    if (res.ok) {
      var result = await res.json()
      settingsEntries.value = (result.releases || []).map(function(r) {
        return { id: r.id, displayName: r.displayName || '', plannedGa: r.plannedGa || '', actualGa: r.actualGa || '', custom: r.custom || false, removed: r.removed || false }
      })
    }
  } catch (loadErr) {
    console.warn('[okr-hub] Failed to load overrides:', loadErr.message)
    /* ignore */
  }

  if (data.value && data.value.releases) {
    var existingIds = {}
    for (var i = 0; i < settingsEntries.value.length; i++) {
      existingIds[settingsEntries.value[i].id] = true
    }
    for (var j = 0; j < data.value.releases.length; j++) {
      var rel = data.value.releases[j]
      if (!existingIds[rel.id] && !rel.custom) {
        settingsEntries.value.push({
          id: rel.id,
          displayName: rel.displayName,
          plannedGa: rel.plannedGa,
          actualGa: rel.actualGa || '',
          custom: false,
          removed: false
        })
      }
    }
  }
}

async function loadData() {
  try {
    var res = await fetch('/api/modules/okr-hub/reports/on-time-releases')
    if (!res.ok) throw new Error('Failed to load report: ' + res.status)
    data.value = await res.json()

    var now = new Date()
    var currentQ = 'Q' + (Math.floor(now.getMonth() / 3) + 1) + ' ' + now.getFullYear()
    openQuarters.value[currentQ] = true
  } catch (err) {
    error.value = err.message
  }
}

onMounted(async function() {
  await loadData()
  await loadSettingsEntries()
  loading.value = false
})
</script>
