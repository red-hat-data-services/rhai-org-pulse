<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useReleaseHealth } from '../composables/useReleaseHealth'
import { useDorChecklist } from '../composables/useDorChecklist'
import { useReleases } from '../composables/useReleasePlanning'
import { useAuth } from '@shared/client'
import { passesPhaseFilter } from '../utils/phase-filter'
import ReleaseSelector from '../components/ReleaseSelector.vue'
import MilestoneTimeline from '../components/MilestoneTimeline.vue'
import HealthSummaryCards from '../components/HealthSummaryCards.vue'
import HealthFilterBar from '../components/HealthFilterBar.vue'
import FeatureHealthTable from '../components/FeatureHealthTable.vue'

var {
  healthData, healthLoading, healthError, healthRefreshing, healthCacheStale,
  loadHealth, triggerHealthRefresh, checkHealthRefreshStatus,
  removeRiskOverride: removeRiskOverrideApi
} = useReleaseHealth()

var { toggleItem, updateNotes, cancelAll: cancelDorPending } = useDorChecklist()
var { releases, loadReleases } = useReleases()
var { isAdmin } = useAuth()

var selectedVersion = ref('')

// Phase tabs
var activePhase = ref('all')

// Filter state
var riskFilter = ref('')
var dorFilter = ref('')
var bigRockFilter = ref('')
var componentFilter = ref('')
var tierFilter = ref('')
var searchQuery = ref('')

// Export menu
var exportMenuOpen = ref(false)

// Refresh polling
var refreshPollTimer = null

// ─── Permissions ───

var canEdit = computed(function() {
  if (healthData.value && healthData.value.demoMode) return false
  return isAdmin.value
})

var demoMode = computed(function() {
  return healthData.value ? !!healthData.value.demoMode : false
})

// ─── Derived data ───

var features = computed(function() {
  return healthData.value ? healthData.value.features || [] : []
})

var milestones = computed(function() {
  return healthData.value ? healthData.value.milestones : null
})

var planningFreezes = computed(function() {
  return healthData.value ? healthData.value.planningFreezes : null
})

var warning = computed(function() {
  return healthData.value ? healthData.value.warning : null
})

var jiraBaseUrl = computed(function() {
  return 'https://redhat.atlassian.net/browse'
})

var enrichmentStatus = computed(function() {
  return healthData.value ? healthData.value.enrichmentStatus : null
})

// ─── Phase tabs ───

var phaseTabs = computed(function() {
  var tabs = [{ id: 'all', label: 'All Features' }]
  var ms = milestones.value
  if (!ms) return tabs
  if (ms.ea1Freeze || ms.ea1Target) tabs.push({ id: 'EA1', label: 'EA1' })
  if (ms.ea2Freeze || ms.ea2Target) tabs.push({ id: 'EA2', label: 'EA2' })
  if (ms.gaFreeze || ms.gaTarget) tabs.push({ id: 'GA', label: 'GA' })
  return tabs
})

// ─── Phase-filtered features ───

var phasedFeatures = computed(function() {
  if (activePhase.value === 'all') return features.value
  return features.value.filter(function(f) {
    return passesPhaseFilter(f, selectedVersion.value, activePhase.value)
  })
})

// ─── Card counts (computed client-side from phasedFeatures) ───

var cardCounts = computed(function() {
  var feats = phasedFeatures.value
  var total = feats.length
  var ownerAssigned = 0
  var scopeEstimated = 0
  var riceComplete = 0
  var dorComplete = 0

  for (var i = 0; i < feats.length; i++) {
    var f = feats[i]
    if (f.deliveryOwner) ownerAssigned++
    if (f.storyPoints) scopeEstimated++
    if (f.rice && f.rice.score != null) riceComplete++
    if (f.dor && f.dor.completionPct >= 80) dorComplete++
  }

  return {
    total: total,
    ownerAssigned: ownerAssigned,
    scopeEstimated: scopeEstimated,
    riceComplete: riceComplete,
    dorComplete: dorComplete
  }
})

// ─── Planning deadline (client-side for "all" tab) ───

function daysUntil(dateStr, todayStr) {
  var d = new Date(dateStr + 'T00:00:00Z')
  var t = new Date(todayStr + 'T00:00:00Z')
  return Math.ceil((d - t) / (1000 * 60 * 60 * 24))
}

var activePlanningDeadline = computed(function() {
  var pf = planningFreezes.value
  if (!pf) return null

  var todayStr = new Date().toISOString().split('T')[0]

  if (activePhase.value !== 'all') {
    var phaseKey = activePhase.value.toLowerCase()
    var dateStr = pf[phaseKey]
    if (!dateStr) return null
    return { date: dateStr, daysRemaining: daysUntil(dateStr, todayStr) }
  }

  var nearest = null
  var phases = ['ea1', 'ea2', 'ga']
  for (var i = 0; i < phases.length; i++) {
    var ds = pf[phases[i]]
    if (!ds || ds < todayStr) continue
    if (!nearest || ds < nearest.date) {
      nearest = { date: ds, daysRemaining: daysUntil(ds, todayStr) }
    }
  }

  return nearest
})

// ─── Tab feature counts ───

function phaseFeatureCount(tabId) {
  if (tabId === 'all') return features.value.length
  return features.value.filter(function(f) {
    return passesPhaseFilter(f, selectedVersion.value, tabId)
  }).length
}

// ─── Filter options ───

var bigRockOptions = computed(function() {
  var rocks = {}
  for (var i = 0; i < features.value.length; i++) {
    var rock = features.value[i].bigRock
    if (rock) rocks[rock] = true
  }
  return Object.keys(rocks).sort()
})

var componentOptions = computed(function() {
  var comps = {}
  for (var i = 0; i < features.value.length; i++) {
    var comp = features.value[i].components
    if (comp) comps[comp] = true
  }
  return Object.keys(comps).sort()
})

// ─── Filtered features (applied on top of phasedFeatures) ───

var filteredFeatures = computed(function() {
  var list = phasedFeatures.value
  if (!list || list.length === 0) return []

  return list.filter(function(f) {
    // Risk filter
    if (riskFilter.value) {
      var featureRisk = f.risk ? f.risk.level : 'green'
      if (f.risk && f.risk.override) featureRisk = f.risk.override.riskOverride || featureRisk
      if (featureRisk !== riskFilter.value) return false
    }

    // DoR filter
    if (dorFilter.value) {
      var dorPct = f.dor ? f.dor.completionPct : 0
      if (dorFilter.value === 'complete' && dorPct < 80) return false
      if (dorFilter.value === 'partial' && (dorPct < 50 || dorPct >= 80)) return false
      if (dorFilter.value === 'incomplete' && dorPct >= 50) return false
    }

    // Big Rock filter
    if (bigRockFilter.value && f.bigRock !== bigRockFilter.value) return false

    // Component filter
    if (componentFilter.value && f.components !== componentFilter.value) return false

    // Tier filter
    if (tierFilter.value && String(f.tier) !== tierFilter.value) return false

    // Search
    if (searchQuery.value) {
      var q = searchQuery.value.toLowerCase()
      var searchFields = [f.key, f.summary, f.status, f.pm, f.deliveryOwner, f.components, f.bigRock].join(' ').toLowerCase()
      if (searchFields.indexOf(q) === -1) return false
    }

    return true
  })
})

var hasActiveFilters = computed(function() {
  return !!(riskFilter.value || dorFilter.value || bigRockFilter.value || componentFilter.value || tierFilter.value || searchQuery.value)
})

function clearFilters() {
  riskFilter.value = ''
  dorFilter.value = ''
  bigRockFilter.value = ''
  componentFilter.value = ''
  tierFilter.value = ''
  searchQuery.value = ''
}

// ─── Data refresh ───

function startRefreshPolling() {
  stopRefreshPolling()
  refreshPollTimer = setInterval(async function() {
    try {
      var status = await checkHealthRefreshStatus(selectedVersion.value)
      if (!status.running) {
        stopRefreshPolling()
        if (selectedVersion.value) {
          loadHealth(selectedVersion.value)
        }
      }
    } catch {
      stopRefreshPolling()
    }
  }, 3000)
}

function stopRefreshPolling() {
  if (refreshPollTimer) {
    clearInterval(refreshPollTimer)
    refreshPollTimer = null
  }
}

watch(healthRefreshing, function(isRefreshing) {
  if (isRefreshing) {
    startRefreshPolling()
  }
})

function handleRefresh() {
  if (selectedVersion.value && !demoMode.value) {
    triggerHealthRefresh(selectedVersion.value)
  }
}

// ─── DoR interactions ───

function handleDorToggle(featureKey, itemId, checked) {
  // Optimistic UI update
  if (healthData.value && healthData.value.features) {
    for (var i = 0; i < healthData.value.features.length; i++) {
      if (healthData.value.features[i].key === featureKey && healthData.value.features[i].dor) {
        var items = healthData.value.features[i].dor.items
        for (var j = 0; j < items.length; j++) {
          if (items[j].id === itemId) {
            items[j].checked = checked
            break
          }
        }
        // Recount
        var checkedCount = 0
        for (var k = 0; k < items.length; k++) {
          if (items[k].checked) checkedCount++
        }
        healthData.value.features[i].dor.checkedCount = checkedCount
        healthData.value.features[i].dor.completionPct = items.length > 0
          ? Math.round((checkedCount / items.length) * 100) : 0
        break
      }
    }
  }

  // Debounced save
  toggleItem(selectedVersion.value, featureKey, itemId, checked)
}

function handleNotesUpdate(featureKey, notes) {
  updateNotes(selectedVersion.value, featureKey, notes)
}

function handleRemoveOverride(featureKey) {
  removeRiskOverrideApi(selectedVersion.value, featureKey).then(function() {
    loadHealth(selectedVersion.value)
  }).catch(function(err) {
    healthError.value = err.message || 'Failed to remove override'
  })
}

// ─── Export ───

function escapeCsv(val) {
  var s = String(val)
  if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1 || s.indexOf('\r') !== -1) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

function exportCsv() {
  exportMenuOpen.value = false
  var rows = []
  rows.push(['Feature', 'Summary', 'Status', 'Risk', 'DoR %', 'RICE', 'Component', 'Phase', 'Tier', 'PM', 'Owner', 'Epics', 'Issues', 'Completion %', 'Blockers'])

  for (var i = 0; i < filteredFeatures.value.length; i++) {
    var f = filteredFeatures.value[i]
    rows.push([
      f.key || '',
      f.summary || '',
      f.status || '',
      f.risk ? f.risk.level : '',
      f.dor ? f.dor.completionPct : '',
      f.rice && f.rice.score != null ? f.rice.score : '',
      f.components || '',
      f.phase || '',
      f.tier || '',
      f.pm || '',
      f.deliveryOwner || '',
      f.epicCount != null ? f.epicCount : '',
      f.issueCount != null ? f.issueCount : '',
      f.completionPct != null ? f.completionPct : '',
      f.blockerCount != null ? f.blockerCount : ''
    ])
  }

  var csv = rows.map(function(row) { return row.map(escapeCsv).join(',') }).join('\n')
  var blob = new Blob([csv + '\n'], { type: 'text/csv' })
  var url = URL.createObjectURL(blob)
  var a = document.createElement('a')
  a.href = url
  a.download = 'plan-health-' + selectedVersion.value + '-' + (activePhase.value || 'all') + '.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function escapeCell(val) {
  return String(val).replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

function exportMarkdown() {
  exportMenuOpen.value = false
  var lines = []
  lines.push('# Release Plan Health - ' + selectedVersion.value + (activePhase.value !== 'all' ? ' ' + activePhase.value : ''))
  lines.push('')
  lines.push('| **Feature** | **Summary** | **Status** | **Risk** | **DoR %** | **RICE** | **Component** | **Phase** |')
  lines.push('|---------|---------|--------|------|-------|------|-----------|-------|')

  for (var i = 0; i < filteredFeatures.value.length; i++) {
    var f = filteredFeatures.value[i]
    lines.push('| ' + [
      f.key || '-',
      escapeCell(f.summary || '-'),
      escapeCell(f.status || '-'),
      f.risk ? f.risk.level : '-',
      f.dor ? f.dor.completionPct + '%' : '-',
      f.rice && f.rice.score != null ? f.rice.score : '-',
      escapeCell(f.components || '-'),
      f.phase || '-'
    ].join(' | ') + ' |')
  }

  var blob = new Blob([lines.join('\n') + '\n'], { type: 'text/markdown' })
  var url = URL.createObjectURL(blob)
  var a = document.createElement('a')
  a.href = url
  a.download = 'plan-health-' + selectedVersion.value + '-' + (activePhase.value !== 'all' ? activePhase.value : 'all') + '.md'
  a.click()
  URL.revokeObjectURL(url)
}

function toggleExportMenu() {
  exportMenuOpen.value = !exportMenuOpen.value
}

function closeExportMenu() {
  exportMenuOpen.value = false
}

function handleClickOutside() {
  exportMenuOpen.value = false
}

// ─── Format helpers ───

function formatDate(iso) {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleString()
}

// ─── Lifecycle ───

watch(selectedVersion, function(newVersion) {
  healthError.value = null
  activePhase.value = 'all'
  clearFilters()
  if (newVersion) {
    loadHealth(newVersion)
  }
})

onMounted(async function() {
  document.addEventListener('click', handleClickOutside)
  await loadReleases()
  if (releases.value.length > 0) {
    selectedVersion.value = releases.value[0].version
  }
})

onUnmounted(function() {
  document.removeEventListener('click', handleClickOutside)
  stopRefreshPolling()
  cancelDorPending()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between flex-wrap gap-4">
      <div>
        <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">Release Plan Health</h1>
        <p v-if="healthData && healthData.cachedAt" class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Data from {{ formatDate(healthData.cachedAt) }}
        </p>
      </div>
      <div class="flex items-center gap-3">
        <ReleaseSelector
          v-if="releases.length > 0"
          :releases="releases"
          v-model="selectedVersion"
        />
        <button
          v-if="selectedVersion && !demoMode"
          @click="handleRefresh"
          :disabled="healthRefreshing"
          class="px-3 py-1.5 text-xs font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ healthRefreshing ? 'Refreshing...' : 'Refresh' }}
        </button>
        <div class="relative" @click.stop @keydown.escape="closeExportMenu">
          <button
            v-if="features.length > 0"
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
          </button>
          <div
            v-if="exportMenuOpen"
            role="menu"
            class="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-600 py-1 z-10"
          >
            <button
              role="menuitem"
              @click="exportMarkdown"
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
    </div>

    <!-- Demo mode banner -->
    <div v-if="demoMode" class="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg px-4 py-2 text-sm text-amber-700 dark:text-amber-400">
      Demo mode -- displaying sample health data. Configure Jira credentials and run a health refresh for live data.
    </div>

    <!-- Warning -->
    <div v-if="warning" class="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 rounded-lg px-4 py-2 text-sm text-yellow-700 dark:text-yellow-400">
      {{ warning }}
    </div>

    <!-- Cache stale / refreshing indicator -->
    <div v-if="healthCacheStale && healthRefreshing" role="status" class="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-lg px-4 py-2 text-sm text-blue-700 dark:text-blue-400">
      Refreshing health data in the background...
    </div>

    <!-- Enrichment status -->
    <details v-if="enrichmentStatus && enrichmentStatus.warnings && enrichmentStatus.warnings.length > 0" class="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg text-sm text-amber-700 dark:text-amber-400">
      <summary class="px-4 py-2 cursor-pointer select-none">
        {{ enrichmentStatus.warnings.length }} enrichment warning{{ enrichmentStatus.warnings.length !== 1 ? 's' : '' }} -- data may be incomplete
      </summary>
      <ul class="px-4 pb-2 ml-4 list-disc space-y-0.5">
        <li v-for="(w, i) in enrichmentStatus.warnings" :key="i">{{ w }}</li>
      </ul>
    </details>

    <!-- Error -->
    <div v-if="healthError" role="alert" class="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg p-4 text-red-700 dark:text-red-400 text-sm">
      {{ healthError }}
    </div>

    <!-- Loading -->
    <div v-if="healthLoading && !healthData" class="text-center py-12 text-gray-500">
      Loading release health data...
    </div>

    <template v-else-if="healthData && features.length > 0">
      <!-- Milestone Timeline -->
      <MilestoneTimeline :milestones="milestones" :planningFreezes="planningFreezes" />

      <!-- Phase Tabs -->
      <div>
        <div class="flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
          <div role="tablist" aria-label="Release phase views" class="flex items-center gap-0 -mb-px">
            <button
              v-for="tab in phaseTabs"
              :key="tab.id"
              role="tab"
              :id="'tab-' + tab.id"
              :aria-selected="activePhase === tab.id"
              :aria-controls="'panel-' + tab.id"
              :tabindex="activePhase === tab.id ? 0 : -1"
              @click="activePhase = tab.id"
              class="px-4 py-2.5 text-xs font-medium transition-colors flex items-center gap-1.5 border-b-2"
              :class="activePhase === tab.id
                ? 'border-primary-600 dark:border-primary-400 text-primary-700 dark:text-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'"
            >
              {{ tab.label }}
              <span
                class="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold"
                :class="activePhase === tab.id
                  ? 'bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'"
              >{{ phaseFeatureCount(tab.id) }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Summary Cards -->
      <HealthSummaryCards :cardCounts="cardCounts" :planningDeadline="activePlanningDeadline" />

      <!-- Filters -->
      <HealthFilterBar
        v-model:riskFilter="riskFilter"
        v-model:dorFilter="dorFilter"
        v-model:bigRockFilter="bigRockFilter"
        v-model:componentFilter="componentFilter"
        v-model:tierFilter="tierFilter"
        v-model:searchQuery="searchQuery"
        :bigRocks="bigRockOptions"
        :components="componentOptions"
        :hasActiveFilters="hasActiveFilters"
        @clearFilters="clearFilters"
      />

      <!-- Feature Health Table -->
      <FeatureHealthTable
        :features="filteredFeatures"
        :canEdit="canEdit"
        :jiraBaseUrl="jiraBaseUrl"
        @toggleDorItem="handleDorToggle"
        @updateNotes="handleNotesUpdate"
        @removeOverride="handleRemoveOverride"
      />
    </template>

    <!-- Empty state: data exists but no features -->
    <template v-else-if="healthData && features.length === 0 && !healthData._noCache">
      <div class="text-center py-12">
        <p class="text-gray-500 dark:text-gray-400">No features found in the health data for this release.</p>
        <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">This may mean the Big Rocks candidates cache is empty. Try running a Big Rocks refresh first.</p>
      </div>
    </template>

    <!-- No cache state: first load -->
    <template v-else-if="healthData && healthData._noCache">
      <div class="text-center py-12">
        <div class="inline-flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-4">
          <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Health pipeline is running...</span>
        </div>
        <p class="text-sm text-gray-400 dark:text-gray-500">This may take several minutes on the first run. The page will update automatically when ready.</p>
      </div>
    </template>

    <!-- No releases configured -->
    <div v-else-if="!healthLoading && releases.length === 0" class="text-center py-12">
      <p class="text-gray-500 dark:text-gray-400">No releases configured.</p>
      <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">Configure releases in the Big Rocks Planning view first.</p>
    </div>

    <!-- No data yet, not loading -->
    <div v-else-if="!healthLoading && selectedVersion && !healthData" class="text-center py-12">
      <p class="text-gray-500 dark:text-gray-400">No health data available for this release.</p>
      <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">Click "Refresh" to generate a health assessment.</p>
    </div>
  </div>
</template>
