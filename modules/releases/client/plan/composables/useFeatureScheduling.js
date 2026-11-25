import { ref, computed } from 'vue'
import { apiRequest } from '@shared/client/services/api'
import {
  schedule,
  mapApiFeatureToRow,
  filterFeatures,
  sortFeatures,
  assignNoTier,
  applyPlacementGrouping,
  aggregateRoadmapGrid,
  aggregateBigRockStats,
  computeDeliveryConfidenceSummary,
  computeWorkMix,
  computeComponentCapacityUsage,
  computeTeamCapacityUsage,
  computeExclusionBreakdown,
  computeFpdorFieldBreakdown
} from '../ai-planner/core.js'

const API_PATH = '/modules/releases/planning/ai-planner'
const OUTCOMES_API_PATH = '/modules/releases/planning/ai-planner/outcomes'

// Same localStorage key index.html's iframe already uses (toggleApproval/_loadApprovals/
// _saveApprovals, index.html lines 3183-3223) -- kept for continuity so approvals made in
// either surface are visible in the other, and so nothing here invents a second format.
const APPROVALS_STORAGE_KEY = '_feat_approvals'

function loadApprovalsFromStorage() {
  try {
    return JSON.parse(localStorage.getItem(APPROVALS_STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

function defaultFilters() {
  return {
    rel: '',
    read: '',
    place: '',
    outcome: '',
    tv: [],
    comp: [],
    team: [],
    pri: '',
    fail: '',
    assign: '',
    pm: '',
    bigRockOnly: false,
    selectedBR: null
  }
}

// Module-level refs -- singleton pattern so all components share state (same
// convention as useFeatureReadiness.js / useReleasePlanning.js).
const scheduledRows = ref([])
const loading = ref(false)
const error = ref(null)
const lastSyncedAt = ref(null)
// 'live' | 'demo' | 'none' -- mirrors index.html's `dataSource` flag (line 2916),
// which is surfaced next to the feature count so a stale/fixture dataset is never
// mistaken for a live one.
const dataSource = ref('none')

// Live ~22-outcome list (index.html's `outcomeData`, fetched via fetchOutcomes()
// from the same endpoint). null until a successful fetch; the Executive
// outcomes table falls back to BIG_ROCKS only while this is null/empty, same
// as renderBigRocks()'s own fallback condition.
const outcomeData = ref(null)

const filters = ref(defaultFilters())
const sortCol = ref('OutcomeNumber')
const sortAsc = ref(true)
const urgentFilterKeys = ref(null)
// { name, phase, feats } | null -- replaces window._drilldownMap + the floating
// popover from showRoadmapDrilldown() (index.html lines 3355-3383) with reactive state.
const roadmapDrilldown = ref(null)
const approvals = ref(loadApprovalsFromStorage())

function saveApprovals() {
  localStorage.setItem(APPROVALS_STORAGE_KEY, JSON.stringify(approvals.value))
}

export function useFeatureScheduling() {
  async function loadFeatures() {
    loading.value = true
    error.value = null
    try {
      const snapshot = await apiRequest(API_PATH)
      const mapped = (snapshot.features || []).map(mapApiFeatureToRow)
      // schedule() mutates each row in place (adds _place, _conf, _wFPDoR, etc.) --
      // same call shape as index.html line 2991.
      schedule(mapped)
      scheduledRows.value = mapped
      dataSource.value = mapped.length ? ((snapshot.metadata && snapshot.metadata.source) || 'demo') : 'none'
      lastSyncedAt.value = snapshot.lastSyncedAt || null
    } catch (err) {
      error.value = err.message || 'Failed to load AI Planner data'
    } finally {
      loading.value = false
    }
  }

  // Source: index.html's fetchOutcomes() (lines 4236-4258). Independent, non-
  // blocking fetch -- a failure here must not blank the Executive tab, same as
  // the original's try/catch-and-warn.
  async function loadOutcomes() {
    try {
      const data = await apiRequest(OUTCOMES_API_PATH)
      if (data && Array.isArray(data.outcomes)) {
        outcomeData.value = data
      }
    } catch {
      // non-blocking -- Executive falls back to the BIG_ROCKS-derived table
    }
  }

  function resetFilters() {
    filters.value = defaultFilters()
  }

  function setSort(col) {
    if (sortCol.value === col) sortAsc.value = !sortAsc.value
    else {
      sortCol.value = col
      sortAsc.value = true
    }
  }

  function toggleApproval(key, role) {
    const current = approvals.value[key] || { pm: false, do: false }
    approvals.value = {
      ...approvals.value,
      [key]: { ...current, [role]: !current[role] }
    }
    saveApprovals()
  }

  function applyUrgentFilter() {
    const keys = pmReviewStatus.value.urgentKeys
    urgentFilterKeys.value = keys.length ? keys : null
  }

  function clearUrgentFilter() {
    urgentFilterKeys.value = null
  }

  // Filtered + sorted + grouped rows for the table -- mirrors run()'s pipeline
  // (index.html lines 3465-3542): filterFeatures -> urgent post-filter (line
  // 3488-3490) -> sortFeatures -> assignNoTier -> applyPlacementGrouping.
  const displayRows = computed(() => {
    let rows = filterFeatures(scheduledRows.value, filters.value)
    if (urgentFilterKeys.value && urgentFilterKeys.value.length) {
      rows = rows.filter(r => urgentFilterKeys.value.includes(r['Key']))
    }
    rows = sortFeatures(rows, sortCol.value, sortAsc.value)
    assignNoTier(rows)
    rows = applyPlacementGrouping(rows, sortCol.value)
    return rows
  })

  // Placement summary cards -- counted across ALL scheduled rows, not the
  // filtered view. index.html's run() calls `renderCards(allData)` (line 3550)
  // with the full dataset, not the filtered `rows` -- the EA1/EA2/GA/No counts
  // are a global snapshot, independent of the active filters. Preserved as-is.
  const placementCounts = computed(() => {
    const c = { EA1: 0, EA2: 0, GA: 0, No: 0 }
    scheduledRows.value.forEach(r => { c[r._place] = (c[r._place] || 0) + 1 })
    return c
  })

  // Dropdown options for the filter bar, derived from the current dataset.
  const filterMeta = computed(() => {
    const versions = new Set()
    const teams = new Set()
    const components = new Set()
    const priorities = new Set()
    const outcomes = new Set()
    const pms = new Set()
    const assignees = new Set()
    scheduledRows.value.forEach(r => {
      const tv = (r['Target Versions'] || '').trim()
      // Filter: only include "Unreleased" or future releases (not archived/released versions)
      // Heuristic: exclude versions that look like past releases (3.6, 3.5, etc.)
      // Keep only: Unreleased, future versions (3.8+), EA/GA labels without archive indicators
      if (tv && isUnreleasedVersion(tv)) versions.add(tv)
      const fv = (r['Fix Version'] || '').trim()
      if (fv && isUnreleasedVersion(fv)) versions.add(fv)
      ;(r['Team'] || '').split(';').map(s => s.trim()).filter(Boolean).forEach(t => teams.add(t))
      ;(r['Components'] || '').split(';').map(s => s.trim()).filter(Boolean).forEach(c => components.add(c))
      if (r['Priority']) priorities.add(r['Priority'])
      if (r['Outcome']) outcomes.add(r['Outcome'])
      if ((r['PM'] || '').trim()) pms.add(r['PM'].trim())
      if ((r['Assignee'] || '').trim()) assignees.add(r['Assignee'].trim())
    })
    return {
      versions: [...versions].sort(),
      teams: [...teams].sort(),
      components: [...components].sort(),
      priorities: [...priorities].sort(),
      outcomes: [...outcomes].sort(),
      pms: [...pms].sort(),
      assignees: [...assignees].sort()
    }
  })

  // Filter out archived/released versions. Keep only "Unreleased" and active/future versions.
  // Heuristic: 3.8+ are future, 3.7 EA1+ are in-progress, exclude 3.6 and older (released/archived).
  // This prevents archived releases from cluttering the release filter dropdown.
  function isUnreleasedVersion(version) {
    if (!version) return false
    const v = version.toLowerCase()
    // Explicitly include Unreleased marker
    if (v.includes('unreleased')) return true
    // Exclude past/released versions
    if (v.includes('3.6')) return false  // 3.6 is released (all variants: EA2, GA, etc.)
    if (v.includes('3.5')) return false  // 3.5 is released
    if (v.includes('3.4')) return false  // 3.4 is released
    if (v.includes('3.3')) return false  // 3.3 is released
    // Keep 3.7+, 3.8+, and anything unrecognized (might be future versions)
    return true
  }

  // Executive tab summary -- unlike placementCounts above, this honors the shared
  // filter bar (index.html lines 4364-4366, Nov 3 fix: "previously this always
  // summarized every feature regardless of filters"), so it's built off
  // displayRows rather than scheduledRows.
  const filteredPlacementCounts = computed(() => {
    const c = { EA1: 0, EA2: 0, GA: 0, No: 0 }
    displayRows.value.forEach(r => { c[r._place] = (c[r._place] || 0) + 1 })
    return c
  })
  const deliveryConfidenceSummary = computed(() => computeDeliveryConfidenceSummary(displayRows.value))
  const workMix = computed(() => computeWorkMix(displayRows.value))
  const outcomesStats = computed(() => aggregateBigRockStats(displayRows.value))

  // Source: renderBigRocks()'s live path (index.html lines 4083-4096) -- when
  // the live outcomes API returned a non-empty list, that's the real source of
  // truth, filtered by the selected release via substring match on
  // linkedVersions. null when the live list is unavailable/empty, signaling
  // callers (ExecutivePreview.vue) to fall back to outcomesStats/BIG_ROCKS,
  // same fallback condition index.html itself uses.
  const liveOutcomes = computed(() => {
    const outcomes = outcomeData.value && Array.isArray(outcomeData.value.outcomes) ? outcomeData.value.outcomes : []
    return outcomes.length ? outcomes : null
  })
  const visibleLiveOutcomes = computed(() => {
    if (!liveOutcomes.value) return null
    const rawRelease = filters.value.rel || ''
    if (!rawRelease) return liveOutcomes.value
    return liveOutcomes.value.filter(o => o.linkedVersions && o.linkedVersions.some(v => v.toLowerCase().includes(rawRelease.toLowerCase())))
  })

  // Data Appendix tab -- like placementCounts, index.html calls
  // renderAppendix(allData) with the full unfiltered dataset (line 3550), not
  // the active filter set, so these are built off scheduledRows.
  const componentCapacityUsage = computed(() => computeComponentCapacityUsage(scheduledRows.value))
  const teamCapacityUsage = computed(() => computeTeamCapacityUsage(scheduledRows.value))
  const exclusionBreakdown = computed(() => computeExclusionBreakdown(scheduledRows.value))
  const fpdorFieldBreakdown = computed(() => computeFpdorFieldBreakdown(scheduledRows.value))

  const recommendedCount = computed(() => Object.values(approvals.value).filter(v => v.pm && v.do).length)
  const pendingRiskCount = computed(() => Object.values(approvals.value).filter(v => v.pendingRisk).length)

  // PM banner "urgent" rollup -- mirrors renderPmBanner() (index.html lines
  // 3616-3632): among in-plan features for the selected PM that still need a PM
  // rec, split into high-risk (HIGH/CRITICAL) and swing (50-69% confidence).
  const pmReviewStatus = computed(() => {
    const pmSel = filters.value.pm || ''
    const allInPlan = scheduledRows.value.filter(r => r._place !== 'No' && (pmSel ? (r['PM'] || '').trim() === pmSel : true))
    const needReview = allInPlan.filter(r => !(approvals.value[r['Key']] || {}).pm)
    const highRisk = needReview.filter(r => r._riskLevel === 'HIGH' || r._riskLevel === 'CRITICAL')
    const swingUnchecked = needReview.filter(r => r._conf >= 50 && r._conf < 70 && highRisk.indexOf(r) === -1)
    return {
      allInPlanCount: allInPlan.length,
      needReviewCount: needReview.length,
      urgentCount: highRisk.length + swingUnchecked.length,
      urgentKeys: [...highRisk, ...swingUnchecked].map(r => r['Key'])
    }
  })

  // Roadmap tab (Outcome x EA1/EA2/GA/No grid) -- see aggregateRoadmapGrid() for the
  // "no live outcomes API" caveat; this always uses its BIG_ROCKS fallback shape.
  const roadmapRows = computed(() => aggregateRoadmapGrid(scheduledRows.value))

  function showRoadmapDrilldown(name, phase) {
    const row = roadmapRows.value.find(r => r.name === name)
    const feats = row ? row.phases[phase].feats : []
    if (!feats.length) {
      roadmapDrilldown.value = null
      return
    }
    // Clicking the same cell again closes it, same as index.html's toggle behavior.
    if (roadmapDrilldown.value && roadmapDrilldown.value.name === name && roadmapDrilldown.value.phase === phase) {
      roadmapDrilldown.value = null
      return
    }
    roadmapDrilldown.value = { name, phase, feats }
  }

  function clearRoadmapDrilldown() {
    roadmapDrilldown.value = null
  }

  return {
    scheduledRows,
    displayRows,
    loading,
    error,
    lastSyncedAt,
    dataSource,
    filters,
    filterMeta,
    sortCol,
    sortAsc,
    setSort,
    resetFilters,
    approvals,
    toggleApproval,
    placementCounts,
    filteredPlacementCounts,
    deliveryConfidenceSummary,
    workMix,
    outcomesStats,
    outcomeData,
    liveOutcomes,
    visibleLiveOutcomes,
    componentCapacityUsage,
    teamCapacityUsage,
    exclusionBreakdown,
    fpdorFieldBreakdown,
    recommendedCount,
    pendingRiskCount,
    pmReviewStatus,
    urgentFilterKeys,
    applyUrgentFilter,
    clearUrgentFilter,
    roadmapRows,
    roadmapDrilldown,
    showRoadmapDrilldown,
    clearRoadmapDrilldown,
    loadFeatures,
    loadOutcomes
  }
}

/** Test-only: reset module-level singleton state between cases. */
export function _resetFeatureSchedulingForTests() {
  scheduledRows.value = []
  loading.value = false
  error.value = null
  lastSyncedAt.value = null
  dataSource.value = 'none'
  outcomeData.value = null
  filters.value = defaultFilters()
  sortCol.value = 'OutcomeNumber'
  sortAsc.value = true
  urgentFilterKeys.value = null
  roadmapDrilldown.value = null
  approvals.value = {}
  localStorage.removeItem(APPROVALS_STORAGE_KEY)
}
