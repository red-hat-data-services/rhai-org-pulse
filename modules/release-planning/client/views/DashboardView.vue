<script setup>
import { ref, computed, inject, onMounted, onUnmounted, watch } from 'vue'
import { useReleasePlanning, useReleases } from '../composables/useReleasePlanning'
import { useReleaseHealth } from '../composables/useReleaseHealth'
import { useBigRockEditor } from '../composables/useBigRockEditor'
import { useFilters } from '../composables/useFilters'
import SummaryCards from '../components/SummaryCards.vue'
import BigRocksTable from '../components/BigRocksTable.vue'
import BigRockEditPanel from '../components/BigRockEditPanel.vue'
import BigRockDeleteDialog from '../components/BigRockDeleteDialog.vue'
import NewReleaseDialog from '../components/NewReleaseDialog.vue'
import FeaturesTable from '../components/FeaturesTable.vue'
import RfesTable from '../components/RfesTable.vue'
import FilterBar from '../components/FilterBar.vue'
import ReleaseSelector from '../components/ReleaseSelector.vue'
import RecentActivity from '../components/RecentActivity.vue'

const {
  candidates, loading, error, refreshing, cacheStale, permissions,
  loadCandidates, triggerRefresh, checkRefreshStatus, loadPermissions,
  saveBigRock, deleteBigRock: deleteBigRockApi, updateBigRocksInPlace,
  reorderBigRocks, seedFromFixture
} = useReleasePlanning()

const { releases, loadReleases } = useReleases()

const { healthData, loadHealth } = useReleaseHealth()

const {
  formData, editingRock, isNewRock,
  openForEdit, openForNew, close: closeEditPanel,
  setSaving, setSaveError, setFieldErrors
} = useBigRockEditor()

const selectedVersion = ref('')
const activeTab = ref('big-rocks')

// Delete dialog state
const deleteDialogOpen = ref(false)
const deleteTarget = ref(null)
const deleting = ref(false)

// New release dialog state
const newReleaseDialogOpen = ref(false)

// Seed state
const seeding = ref(false)

// Refresh polling
let refreshPollTimer = null

function startRefreshPolling() {
  stopRefreshPolling()
  refreshPollTimer = setInterval(async function() {
    const status = await checkRefreshStatus()
    if (!status.running) {
      stopRefreshPolling()
      if (selectedVersion.value) {
        loadCandidates(selectedVersion.value)
      }
    }
  }, 3000)
}

function stopRefreshPolling() {
  if (refreshPollTimer) {
    clearInterval(refreshPollTimer)
    refreshPollTimer = null
  }
}

watch(refreshing, function(isRefreshing) {
  if (isRefreshing) {
    startRefreshPolling()
  }
})

const features = computed(() => candidates.value ? candidates.value.features || [] : [])
const rfes = computed(() => candidates.value ? candidates.value.rfes || [] : [])
const bigRocks = computed(() => candidates.value ? candidates.value.bigRocks || [] : [])
const summary = computed(() => candidates.value ? candidates.value.summary : null)
const filterOptions = computed(() => candidates.value ? candidates.value.filterOptions || {} : {})
const jiraBaseUrl = computed(() => candidates.value ? candidates.value.jiraBaseUrl || '' : '')
const demoMode = computed(() => candidates.value ? candidates.value.demoMode : false)

const healthByKey = computed(function() {
  if (!healthData.value || !healthData.value.features) return {}
  var map = {}
  for (var i = 0; i < healthData.value.features.length; i++) {
    var f = healthData.value.features[i]
    map[f.key] = f
  }
  return map
})

const healthSummary = computed(function() {
  return healthData.value ? healthData.value.summary : null
})
const warning = computed(() => candidates.value ? candidates.value.warning : null)
const pipelineWarnings = computed(() => candidates.value ? candidates.value.pipelineWarnings || [] : [])
const canEdit = computed(() => !demoMode.value && permissions.value && permissions.value.canEdit)

const {
  selectedPillar,
  selectedRock,
  selectedStatus,
  selectedPriority,
  selectedTeams,
  searchQuery,
  filteredFeatures,
  filteredRfes,
  hasActiveFilters,
  clearFilters
} = useFilters(features, rfes, bigRocks)

const moduleNav = inject('moduleNav', null)

const tabs = [
  { id: 'big-rocks', label: 'Big Rocks' },
  { id: 'features', label: 'Features' },
  { id: 'rfes', label: 'RFEs' }
]

const featureCount = computed(() => filteredFeatures.value.length)
const rfeCount = computed(() => filteredRfes.value.length)
const bigRockCount = computed(() => bigRocks.value.length)

function tabCount(tabId) {
  if (tabId === 'features') return featureCount.value
  if (tabId === 'rfes') return rfeCount.value
  if (tabId === 'big-rocks') return bigRockCount.value
  return 0
}

function escapeCell(val) {
  return String(val).replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

function escapeCsv(val) {
  const s = String(val)
  if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1 || s.indexOf('\r') !== -1) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

const exportMenuOpen = ref(false)

function closeExportMenu() {
  exportMenuOpen.value = false
}

function toggleExportMenu() {
  exportMenuOpen.value = !exportMenuOpen.value
}

function exportMarkdown() {
  const lines = []
  let filename

  if (activeTab.value === 'big-rocks') {
    lines.push('# Big Rocks - ' + selectedVersion.value)
    lines.push('')
    lines.push('| **Priority** | **Pillar** | **Big Rock** | **Owner** | **Architect** | **Features** | **RFEs** | **Notes** |')
    lines.push('|:--------:|--------|----------|-------|-----------|:--------:|:----:|-------|')
    for (const rock of bigRocks.value) {
      lines.push('| ' + [
        rock.priority,
        escapeCell(rock.pillar || '-'),
        escapeCell(rock.name),
        escapeCell(rock.owner || '-'),
        escapeCell(rock.architect || '-'),
        rock.featureCount,
        rock.rfeCount,
        escapeCell(rock.notes || '-')
      ].join(' | ') + ' |')
    }
    filename = 'big-rocks-' + selectedVersion.value + '.md'
  } else if (activeTab.value === 'features') {
    lines.push('# Features - ' + selectedVersion.value)
    lines.push('')
    lines.push('| **Big Rock** | **Feature** | **Status** | **Priority** | **Phase** | **Title** | **Components** | **Target Release** | **PM** | **Delivery Owner** | **RFE** | **Fix Version** |')
    lines.push('|----------|---------|--------|----------|-------|-------|------------|----------------|-----|----------------|-----|-------------|')
    for (const f of filteredFeatures.value) {
      lines.push('| ' + [
        escapeCell(f.bigRock || '-'),
        f.issueKey,
        escapeCell(f.status || '-'),
        escapeCell(f.priority || '-'),
        escapeCell(f.phase || '-'),
        escapeCell(f.summary || '-'),
        escapeCell(f.components || '-'),
        escapeCell(f.targetRelease || '-'),
        escapeCell(f.pm || '-'),
        escapeCell(f.deliveryOwner || '-'),
        f.rfe || '-',
        escapeCell(f.fixVersion || '-')
      ].join(' | ') + ' |')
    }
    filename = 'features-' + selectedVersion.value + '.md'
  } else {
    lines.push('# RFEs - ' + selectedVersion.value)
    lines.push('')
    lines.push('| **Big Rock** | **RFE** | **Status** | **Priority** | **Title** | **Components** | **PM** | **Labels** |')
    lines.push('|----------|-----|--------|----------|-------|------------|-----|--------|')
    for (const r of filteredRfes.value) {
      lines.push('| ' + [
        escapeCell(r.bigRock || '-'),
        r.issueKey,
        escapeCell(r.status || '-'),
        escapeCell(r.priority || '-'),
        escapeCell(r.summary || '-'),
        escapeCell(r.components || '-'),
        escapeCell(r.pm || '-'),
        escapeCell(r.labels || '-')
      ].join(' | ') + ' |')
    }
    filename = 'rfes-' + selectedVersion.value + '.md'
  }

  const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function exportCsv() {
  closeExportMenu()
  const rows = []
  let filename

  if (activeTab.value === 'big-rocks') {
    rows.push(['Priority', 'Pillar', 'Big Rock', 'Owner', 'Architect', 'Features', 'RFEs', 'Notes'])
    for (const rock of bigRocks.value) {
      rows.push([
        rock.priority,
        rock.pillar || '',
        rock.name,
        rock.owner || '',
        rock.architect || '',
        rock.featureCount,
        rock.rfeCount,
        rock.notes || ''
      ])
    }
    filename = 'big-rocks-' + selectedVersion.value + '.csv'
  } else if (activeTab.value === 'features') {
    rows.push(['Big Rock', 'Feature', 'Status', 'Priority', 'Phase', 'Title', 'Components', 'Target Release', 'PM', 'Delivery Owner', 'RFE', 'Fix Version'])
    for (const f of filteredFeatures.value) {
      rows.push([
        f.bigRock || '',
        f.issueKey,
        f.status || '',
        f.priority || '',
        f.phase || '',
        f.summary || '',
        f.components || '',
        f.targetRelease || '',
        f.pm || '',
        f.deliveryOwner || '',
        f.rfe || '',
        f.fixVersion || ''
      ])
    }
    filename = 'features-' + selectedVersion.value + '.csv'
  } else {
    rows.push(['Big Rock', 'RFE', 'Status', 'Priority', 'Title', 'Components', 'PM', 'Labels'])
    for (const r of filteredRfes.value) {
      rows.push([
        r.bigRock || '',
        r.issueKey,
        r.status || '',
        r.priority || '',
        r.summary || '',
        r.components || '',
        r.pm || '',
        r.labels || ''
      ])
    }
    filename = 'rfes-' + selectedVersion.value + '.csv'
  }

  const csv = rows.map(function(row) { return row.map(escapeCsv).join(',') }).join('\n')
  const blob = new Blob([csv + '\n'], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function handleExportMarkdown() {
  closeExportMenu()
  exportMarkdown()
}

function formatDate(iso) {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleString()
}

// ─── Edit handlers ───

function handleEditRock(rock) {
  openForEdit(rock)
}

function handleAddRock() {
  openForNew()
}

async function handleSave() {
  setSaving(true)
  setSaveError(null)
  setFieldErrors({})

  try {
    const originalName = isNewRock.value ? null : editingRock.value.name
    const result = await saveBigRock(selectedVersion.value, originalName, formData.value)

    if (result.status === 'skipped') {
      // Demo mode
      closeEditPanel()
      return
    }

    // Update the bigRocks in the candidates data
    if (result.bigRocks) {
      updateBigRocksInPlace(result.bigRocks)
    }
    closeEditPanel()
  } catch (err) {
    if (err.status === 400 && err.data && err.data.fields) {
      setFieldErrors(err.data.fields)
    }
    setSaveError(err.message || 'Save failed. Your changes have not been lost -- please retry.')
  } finally {
    setSaving(false)
  }
}

function handleCancelEdit() {
  closeEditPanel()
}

// ─── Delete handlers ───

function handleDeleteRock(rock) {
  deleteTarget.value = rock
  deleteDialogOpen.value = true
}

async function handleConfirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true

  try {
    const result = await deleteBigRockApi(selectedVersion.value, deleteTarget.value.name)

    if (result.status === 'skipped') {
      // Demo mode
      deleteDialogOpen.value = false
      deleteTarget.value = null
      deleting.value = false
      return
    }

    if (result.bigRocks) {
      updateBigRocksInPlace(result.bigRocks)
    }
    deleteDialogOpen.value = false
    deleteTarget.value = null
  } catch (err) {
    // Show error but keep dialog open for retry
    error.value = err.message
    deleteDialogOpen.value = false
    deleteTarget.value = null
  } finally {
    deleting.value = false
  }
}

function handleCancelDelete() {
  deleteDialogOpen.value = false
  deleteTarget.value = null
}

// ─── Reorder handler ───

async function handleReorder(orderedNames) {
  const previousBigRocks = bigRocks.value.slice()
  const rocksByName = Object.fromEntries(previousBigRocks.map(r => [r.name, r]))
  const optimistic = orderedNames.map((name, idx) => ({ ...rocksByName[name], priority: idx + 1 }))
  updateBigRocksInPlace(optimistic)

  try {
    const result = await reorderBigRocks(selectedVersion.value, orderedNames)
    if (result && result.bigRocks) {
      updateBigRocksInPlace(result.bigRocks)
    }
  } catch (err) {
    error.value = err.message || 'Reorder failed'
    updateBigRocksInPlace(previousBigRocks)
  }
}

// ─── New release handlers ───

function handleNewRelease() {
  newReleaseDialogOpen.value = true
}

async function handleReleaseCreated(result) {
  await loadReleases()
  if (result && result.version) {
    selectedVersion.value = result.version
  }
}

// ─── Seed handler ───

async function handleSeedFixture() {
  seeding.value = true
  error.value = null
  try {
    const result = await seedFromFixture()
    await loadReleases()
    if (result.seeded && result.seeded.length > 0) {
      selectedVersion.value = result.seeded[0].version
    }
  } catch (err) {
    error.value = err.message || 'Failed to load fixture data'
  } finally {
    seeding.value = false
  }
}

watch(selectedVersion, function(newVersion) {
  error.value = null
  if (newVersion) {
    loadCandidates(newVersion)
    loadHealth(newVersion)
  }
})

watch(activeTab, function() {
  error.value = null
})

function handleClickOutside() {
  exportMenuOpen.value = false
}

onMounted(async function() {
  document.addEventListener('click', handleClickOutside)
  loadPermissions()
  await loadReleases()
  if (releases.value.length > 0) {
    selectedVersion.value = releases.value[0].version
  }
  if (moduleNav && moduleNav.params && moduleNav.params.value) {
    var p = moduleNav.params.value
    if (p.bigRock) {
      selectedRock.value = p.bigRock
      activeTab.value = 'features'
    }
  }
})

onUnmounted(function() {
  document.removeEventListener('click', handleClickOutside)
  stopRefreshPolling()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between flex-wrap gap-4">
      <div>
        <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">Big Rocks Planning Dashboard</h1>
        <p v-if="candidates && candidates.lastRefreshed" class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Data from {{ formatDate(candidates.lastRefreshed) }}
        </p>
      </div>
      <div class="flex items-center gap-3">
        <ReleaseSelector
          v-if="releases.length > 0"
          :releases="releases"
          v-model="selectedVersion"
          :canEdit="canEdit"
          @newRelease="handleNewRelease"
        />
        <button
          v-if="selectedVersion && !demoMode"
          @click="triggerRefresh(selectedVersion)"
          :disabled="refreshing"
          class="px-3 py-1.5 text-xs font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ refreshing ? 'Refreshing...' : 'Refresh' }}
        </button>
      </div>
    </div>

    <!-- Demo mode banner -->
    <div v-if="demoMode" class="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg px-4 py-2 text-sm text-amber-700 dark:text-amber-400">
      Demo mode -- displaying sample data. Configure Jira credentials for live data.
    </div>

    <!-- Warning -->
    <div v-if="warning" class="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 rounded-lg px-4 py-2 text-sm text-yellow-700 dark:text-yellow-400">
      {{ warning }}
    </div>

    <!-- Pipeline warnings -->
    <details v-if="pipelineWarnings.length > 0" class="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg text-sm text-amber-700 dark:text-amber-400">
      <summary class="px-4 py-2 cursor-pointer select-none">
        {{ pipelineWarnings.length }} pipeline warning{{ pipelineWarnings.length !== 1 ? 's' : '' }} — data may be incomplete
      </summary>
      <ul class="px-4 pb-2 ml-4 list-disc space-y-0.5">
        <li v-for="(w, i) in pipelineWarnings" :key="i">{{ w }}</li>
      </ul>
    </details>

    <!-- Cache stale indicator -->
    <div v-if="cacheStale && refreshing" role="status" class="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-lg px-4 py-2 text-sm text-blue-700 dark:text-blue-400">
      Refreshing data in the background...
    </div>

    <!-- Error -->
    <div v-if="error" role="alert" class="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg p-4 text-red-700 dark:text-red-400 text-sm">
      {{ error }}
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-12 text-gray-500">
      Loading release planning data...
    </div>

    <template v-else-if="candidates">
      <!-- Summary -->
      <SummaryCards :summary="summary" :healthSummary="healthSummary" />

      <!-- Recent Activity -->
      <RecentActivity :version="selectedVersion" />

      <!-- Tabs -->
      <div>
        <div class="flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
          <div role="tablist" aria-label="Release planning views" class="flex items-center gap-0 -mb-px">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              role="tab"
              :id="'tab-' + tab.id"
              :aria-selected="activeTab === tab.id"
              :aria-controls="'panel-' + tab.id"
              :tabindex="activeTab === tab.id ? 0 : -1"
              @click="activeTab = tab.id"
              class="px-4 py-2.5 text-xs font-medium transition-colors flex items-center gap-1.5 border-b-2"
              :class="activeTab === tab.id
                ? 'border-primary-600 dark:border-primary-400 text-primary-700 dark:text-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'"
            >
              {{ tab.label }}
              <span
                class="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold"
                :class="activeTab === tab.id
                  ? 'bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'"
              >{{ tabCount(tab.id) }}</span>
            </button>
          </div>
          <div class="relative pb-2" @click.stop @keydown.escape="closeExportMenu">
            <button
              @click="toggleExportMenu"
              :aria-expanded="exportMenuOpen"
              aria-haspopup="menu"
              aria-label="Export data"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div
              v-if="exportMenuOpen"
              role="menu"
              class="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-600 py-1 z-10"
            >
              <button
                role="menuitem"
                @click="handleExportMarkdown"
                class="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >Markdown (.md)</button>
              <button
                role="menuitem"
                @click="exportCsv"
                class="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >CSV (.csv)</button>
            </div>
          </div>
        </div>

        <!-- Filters -->
        <div class="pt-3">
          <FilterBar
            :filterOptions="filterOptions"
            :activeTab="activeTab"
            v-model:selectedPillar="selectedPillar"
            v-model:selectedRock="selectedRock"
            v-model:selectedStatus="selectedStatus"
            v-model:selectedPriority="selectedPriority"
            v-model:selectedTeams="selectedTeams"
            v-model:searchQuery="searchQuery"
            :hasActiveFilters="hasActiveFilters"
            @clearFilters="clearFilters"
          />
        </div>
      </div>

      <!-- Tab content -->
      <div v-if="activeTab === 'big-rocks'" id="panel-big-rocks" role="tabpanel" aria-labelledby="tab-big-rocks">
        <BigRocksTable
          :bigRocks="bigRocks"
          :jiraBaseUrl="jiraBaseUrl"
          :canEdit="canEdit"
          :healthByKey="healthByKey"
          :features="features"
          @editRock="handleEditRock"
          @addRock="handleAddRock"
          @deleteRock="handleDeleteRock"
          @reorder="handleReorder"
        />
      </div>
      <div v-if="activeTab === 'features'" id="panel-features" role="tabpanel" aria-labelledby="tab-features">
        <FeaturesTable
          :features="filteredFeatures"
          :bigRocks="bigRocks"
          :jiraBaseUrl="jiraBaseUrl"
          :summary="summary"
          :healthByKey="healthByKey"
        />
      </div>
      <div v-if="activeTab === 'rfes'" id="panel-rfes" role="tabpanel" aria-labelledby="tab-rfes">
        <RfesTable
          :rfes="filteredRfes"
          :bigRocks="bigRocks"
          :jiraBaseUrl="jiraBaseUrl"
          :summary="summary"
        />
      </div>
    </template>

    <!-- No releases configured -->
    <div v-else-if="!loading && releases.length === 0" class="text-center py-12">
      <p class="text-gray-500 dark:text-gray-400">No releases configured.</p>
      <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">Add Big Rocks configuration to get started.</p>
      <div class="flex items-center justify-center gap-3 mt-4">
        <button
          v-if="canEdit"
          @click="handleNewRelease"
          class="px-4 py-2 text-sm font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700"
        >
          New Release
        </button>
        <button
          v-if="canEdit"
          @click="handleSeedFixture"
          :disabled="seeding"
          class="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ seeding ? 'Loading...' : 'Load Fixture Data' }}
        </button>
      </div>
    </div>

    <!-- Edit panel -->
    <BigRockEditPanel
      @save="handleSave"
      @cancel="handleCancelEdit"
    />

    <!-- Delete confirmation dialog -->
    <BigRockDeleteDialog
      :open="deleteDialogOpen"
      :rockName="deleteTarget ? deleteTarget.name : ''"
      :deleting="deleting"
      @confirm="handleConfirmDelete"
      @cancel="handleCancelDelete"
    />

    <!-- New release dialog -->
    <NewReleaseDialog
      :open="newReleaseDialogOpen"
      :releases="releases"
      @created="handleReleaseCreated"
      @close="newReleaseDialogOpen = false"
    />

  </div>
</template>
