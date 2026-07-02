<template>
  <div class="space-y-4">
    <div v-if="loading" class="text-sm text-gray-500 dark:text-gray-400">Loading feature delivery data...</div>
    <div v-else-if="error" class="rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-4 py-3 text-sm">{{ error }}</div>

    <template v-else>
      <!-- Summary Header -->
      <div class="flex items-center gap-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-6 py-5">
        <div class="text-center">
          <div class="text-4xl font-black tabular-nums" :class="accuracyColorClass(data.summary.accuracy)">{{ data.summary.accuracy }}%</div>
          <div class="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-1">Accuracy</div>
        </div>
        <div class="h-12 w-px bg-gray-200 dark:bg-gray-700" />
        <div class="flex items-center gap-5 text-sm">
          <div class="text-center">
            <div class="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">{{ data.summary.committed }}</div>
            <div class="text-[10px] font-medium text-blue-600 dark:text-blue-400 uppercase">Committed</div>
          </div>
          <div class="text-center">
            <div class="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">{{ data.summary.delivered }}</div>
            <div class="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 uppercase">Delivered</div>
          </div>
          <div class="text-center">
            <div class="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">{{ data.releases.length }}</div>
            <div class="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">Releases</div>
          </div>
        </div>
        <div class="ml-auto flex items-center gap-3">
          <span class="text-xs text-gray-400 dark:text-gray-500">Committed (TV) vs Delivered (FV)</span>
          <button
            v-if="canEdit"
            @click="showSettings = !showSettings"
            class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Configure releases"
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
          <span class="text-sm font-bold text-gray-900 dark:text-gray-100">Configure Releases</span>
          <button @click="addRelease" class="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors">+ Add Release</button>
        </div>
        <div class="max-h-[28rem] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
          <div v-for="(rel, ri) in settingsEntries" :key="ri" class="px-5 py-4">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <label class="text-[10px] font-semibold text-gray-400 uppercase">Release Name</label>
                <input
                  v-model="rel.name"
                  class="w-48 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="e.g. Release 3.4"
                />
              </div>
              <div class="flex items-center gap-1">
                <button @click="addProduct(ri)" class="px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded transition-colors">+ Version</button>
                <button @click="removeRelease(ri)" class="px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors">Remove</button>
              </div>
            </div>
            <div class="space-y-2">
              <div class="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-[10px] font-semibold text-gray-400 uppercase pl-1">
                <span>Version Name</span>
                <span class="w-36 text-center">Planning Freeze</span>
                <span class="w-36 text-center">Release Date</span>
                <span class="w-6"></span>
              </div>
              <div v-for="(p, pi) in rel.products" :key="pi" class="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
                <input
                  v-model="p.version"
                  class="text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="e.g. rhoai-3.4"
                />
                <input
                  v-model="p.freezeDate"
                  type="date"
                  class="w-36 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                />
                <input
                  v-model="p.releaseDate"
                  type="date"
                  class="w-36 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                />
                <button @click="removeProduct(ri, pi)" class="p-1 text-red-400 hover:text-red-600 dark:hover:text-red-300 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Remove version">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
          </div>
          <div v-if="settingsEntries.length === 0" class="px-5 py-8 text-center text-sm text-gray-400 italic">No releases configured. Click "+ Add Release" to get started.</div>
        </div>
        <div class="px-5 py-3 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button @click="cancelSettings" class="px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">Cancel</button>
          <button @click="saveSettings" :disabled="saving" class="px-4 py-1.5 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50">{{ saving ? 'Saving...' : 'Save & Compute' }}</button>
        </div>
      </div>

      <!-- No config state -->
      <div v-if="data.releases.length === 0 && !showSettings" class="text-center py-12 text-gray-500 dark:text-gray-400">
        <p class="text-sm">No releases configured.</p>
        <p v-if="canEdit" class="text-xs mt-1">Click the gear icon to add releases and product versions.</p>
      </div>

      <!-- Release Sections -->
      <div v-for="rel in data.releases" :key="rel.name" class="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        <button
          @click="toggleRelease(rel.name)"
          class="w-full flex items-center justify-between px-5 py-3 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700 text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <div class="flex items-center gap-3">
            <svg
              class="w-4 h-4 text-gray-400 transition-transform duration-200"
              :class="{ 'rotate-90': openReleases[rel.name] }"
              viewBox="0 0 20 20" fill="currentColor"
            ><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" /></svg>
            <span class="text-sm font-bold text-gray-900 dark:text-gray-100">{{ rel.name }}</span>
            <span class="text-xs text-gray-500 dark:text-gray-400">{{ rel.committed }} committed, {{ rel.delivered }} delivered</span>
          </div>
          <span class="text-sm font-bold tabular-nums px-2.5 py-0.5 rounded-full" :class="accuracyBadgeClass(rel.accuracy)">{{ rel.accuracy }}%</span>
        </button>

        <div v-show="openReleases[rel.name]" class="overflow-x-auto">
          <table class="w-full text-sm border-collapse">
            <thead>
              <tr class="bg-gray-50 dark:bg-gray-800/60">
                <th class="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Product Version</th>
                <th class="px-4 py-2.5 text-center text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28">Committed</th>
                <th class="px-4 py-2.5 text-center text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28">Delivered</th>
                <th class="px-4 py-2.5 text-center text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28">Accuracy</th>
                <th class="px-4 py-2.5 text-center text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">Freeze Date</th>
                <th class="px-4 py-2.5 text-center text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">Release Date</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in rel.products" :key="p.version" class="border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <td class="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">{{ p.version }}</td>
                <td class="px-4 py-2.5 text-center tabular-nums text-blue-600 dark:text-blue-400 font-semibold">{{ p.committed }}</td>
                <td class="px-4 py-2.5 text-center tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">{{ p.delivered }}</td>
                <td class="px-4 py-2.5 text-center">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold" :class="accuracyBadgeClass(p.accuracy)">{{ p.accuracy }}%</span>
                </td>
                <td class="px-4 py-2.5 text-center text-gray-600 dark:text-gray-400 tabular-nums">{{ formatDate(p.freezeDate) }}</td>
                <td class="px-4 py-2.5 text-center text-gray-600 dark:text-gray-400 tabular-nums">{{ formatDate(p.releaseDate) }}</td>
              </tr>
              <!-- Total row -->
              <tr class="bg-gray-50 dark:bg-gray-800/60 font-bold border-t-2 border-gray-300 dark:border-gray-600">
                <td class="px-4 py-2.5 text-gray-900 dark:text-gray-100">Total</td>
                <td class="px-4 py-2.5 text-center tabular-nums text-blue-600 dark:text-blue-400">{{ rel.committed }}</td>
                <td class="px-4 py-2.5 text-center tabular-nums text-emerald-600 dark:text-emerald-400">{{ rel.delivered }}</td>
                <td class="px-4 py-2.5 text-center">
                  <span class="text-sm font-black tabular-nums" :class="accuracyColorClass(rel.accuracy)">{{ rel.accuracy }}%</span>
                </td>
                <td class="px-4 py-2.5"></td>
                <td class="px-4 py-2.5"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useOkrPermissions } from '../composables/useOkrPermissions.js'

var { canEdit } = useOkrPermissions()
var loading = ref(true)
var error = ref(null)
var data = ref({ releases: [], summary: { committed: 0, delivered: 0, accuracy: 0 } })
var openReleases = ref({})
var showSettings = ref(false)
var saving = ref(false)
var settingsEntries = ref([])

function accuracyColorClass(pct) {
  if (pct >= 90) return 'text-emerald-600 dark:text-emerald-400'
  if (pct >= 70) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

function accuracyBadgeClass(pct) {
  if (pct >= 90) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40'
  if (pct >= 70) return 'text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/40'
  return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40'
}

function formatDate(iso) {
  if (!iso) return '—'
  var d = new Date(iso + 'T00:00:00')
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function toggleRelease(name) {
  openReleases.value[name] = !openReleases.value[name]
}

function addRelease() {
  settingsEntries.value.push({
    name: '',
    products: [
      { version: '', freezeDate: '', releaseDate: '' },
      { version: '', freezeDate: '', releaseDate: '' },
      { version: '', freezeDate: '', releaseDate: '' }
    ]
  })
}

function removeRelease(ri) {
  settingsEntries.value.splice(ri, 1)
}

function addProduct(ri) {
  settingsEntries.value[ri].products.push({ version: '', freezeDate: '', releaseDate: '' })
}

function removeProduct(ri, pi) {
  settingsEntries.value[ri].products.splice(pi, 1)
}

function cancelSettings() {
  showSettings.value = false
  loadSettingsEntries()
}

async function loadSettingsEntries() {
  try {
    var res = await fetch('/api/modules/okr-hub/reports/feature-delivery-config')
    if (res.ok) {
      var result = await res.json()
      settingsEntries.value = (result.releases || []).map(function(r) {
        return {
          name: r.name || '',
          products: (r.products || []).map(function(p) {
            return { version: p.version || '', freezeDate: p.freezeDate || '', releaseDate: p.releaseDate || '' }
          })
        }
      })
    }
  } catch (loadErr) {
    console.warn('[okr-hub] Failed to load feature delivery config:', loadErr.message)
  }
}

async function saveSettings() {
  saving.value = true
  try {
    var cleaned = settingsEntries.value
      .filter(function(r) { return r.name })
      .map(function(r) {
        return {
          name: r.name,
          products: r.products.filter(function(p) { return p.version })
        }
      })
      .filter(function(r) { return r.products.length > 0 })

    var res = await fetch('/api/modules/okr-hub/reports/feature-delivery-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ releases: cleaned })
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

async function loadData() {
  try {
    var res = await fetch('/api/modules/okr-hub/reports/feature-delivery')
    if (!res.ok) throw new Error('Failed to load report: ' + res.status)
    data.value = await res.json()

    if (data.value.releases.length > 0) {
      openReleases.value[data.value.releases[0].name] = true
    }
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
