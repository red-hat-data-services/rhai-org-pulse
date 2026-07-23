import { computed, ref } from 'vue'
import { apiRequest } from '@shared/client/services/api'
import {
  ADMIN,
  PLACEMENTS,
  emptyEditorState,
  normalizeDraft,
  viewRow,
  applyMove,
  applyDescope,
  clearDescope,
  setApproved,
  freezeEvent,
  unfreezeEvent,
  unfreezePlan,
  finalGaFreeze,
  resetToBase,
  loadBarsByComponent,
  summaryCounts,
  isAdmin,
  isFinalFrozen,
  eventFrozen
} from '../utils/draft-plan-model.js'

var API_BASE = '/modules/releases/draft-plans'

var draft = ref(null)
var ceilings = ref({})
var editor = ref(emptyEditorState())
var loading = ref(false)
var saving = ref(false)
var error = ref(null)
var dirty = ref(false)
var pendingCapacity = ref(null)
var selectedProduct = ref('') // '' = all products in the plan
var selectedVersion = ref('3.6')
var availableProducts = ref(['RHOAI', 'RHAII'])
var availableCycles = ref([])
var filterEvent = ref('')
var filterDecision = ref('')
var filterPriority = ref('')
var filterComponent = ref('')
var filterAssignee = ref('')
var filterFamily = ref('')
var filterReady = ref('')
var filterBigRock = ref('')
var filterPm = ref('')
var filterText = ref('')
var session = ref(null)

export function useDraftPlans() {
  var candidates = computed(function() {
    return draft.value && draft.value.candidates ? draft.value.candidates : []
  })

  var cycleLabel = computed(function() {
    var ver = (draft.value && draft.value.version) || selectedVersion.value || ''
    var prod = selectedProduct.value
    if (!ver) return prod || 'Draft Plan'
    if (!prod) return 'RHOAI + RHAII ' + ver
    return prod + ' ' + ver
  })

  var activeCycleMeta = computed(function() {
    var ver = selectedVersion.value
    var list = availableCycles.value || []
    for (var i = 0; i < list.length; i++) {
      if (list[i].version === ver) return list[i]
    }
    return null
  })

  var viewRows = computed(function() {
    var rows = []
    var list = candidates.value
    for (var i = 0; i < list.length; i++) {
      rows.push(viewRow(list[i], editor.value.edits, editor.value.meta))
    }
    rows.sort(function(a, b) {
      if (a.eventRank !== b.eventRank) return a.eventRank - b.eventRank
      return String(a.key).localeCompare(String(b.key))
    })
    return rows
  })

  var productScopedRows = computed(function() {
    var prod = selectedProduct.value
    if (!prod) return viewRows.value
    return viewRows.value.filter(function(row) {
      return row.productFamily === prod
    })
  })

  var filteredRows = computed(function() {
    var q = String(filterText.value || '').trim().toLowerCase()
    var ev = filterEvent.value
    var decision = filterDecision.value
    // Acting-as only changes permissions (see canEditRow/ownsRow in
    // draft-plan-model.js) — it never hides rows. Everyone sees the full
    // product-scoped table; only per-row editability differs.
    return productScopedRows.value.filter(function(row) {
      if (ev === '__scheduled__') {
        if (!(row.event === 'EA1' || row.event === 'EA2' || row.event === 'GA')) return false
      } else if (ev === '__changed__') {
        if (!row.changed) return false
      } else if (ev === '__approved__') {
        if (!row.approved) return false
      } else if (ev && row.event !== ev) {
        return false
      }

      if (decision === 'unset') {
        if (row.decision && row.decision !== 'unset') return false
      } else if (decision && row.decision !== decision) {
        return false
      }

      if (filterPriority.value && row.priority !== filterPriority.value) return false
      if (filterComponent.value && row.component !== filterComponent.value) return false
      if (filterAssignee.value && row.assignee !== filterAssignee.value) return false
      if (filterFamily.value && row.productFamily !== filterFamily.value) return false
      if (filterReady.value && row.ready !== filterReady.value) return false
      if (filterBigRock.value === '__none__') {
        if (row.bigRock) return false
      } else if (filterBigRock.value && row.bigRock !== filterBigRock.value) {
        return false
      }
      if (filterPm.value === '__none__') {
        if (row.pm && row.pm !== '—') return false
      } else if (filterPm.value && row.pm !== filterPm.value) {
        return false
      }

      if (!q) return true
      var hay = [
        row.key,
        row.summary,
        row.component,
        row.assignee,
        row.pm,
        row.bigRock,
        row.outcomeKey,
        row.currentTV,
        row.ready,
        row.priority,
        row.event,
        row.productFamily,
        row.proposedFixVersion,
        row.decision,
        String(row.cycleBudget)
      ].join(' ').toLowerCase()
      return hay.indexOf(q) !== -1
    })
  })

  var components = computed(function() {
    var set = {}
    var list = productScopedRows.value
    for (var i = 0; i < list.length; i++) {
      if (list[i].component) set[list[i].component] = true
    }
    return Object.keys(set).sort()
  })

  var assignees = computed(function() {
    var set = {}
    var list = productScopedRows.value
    for (var i = 0; i < list.length; i++) {
      if (list[i].assignee && list[i].assignee !== '—') set[list[i].assignee] = true
    }
    return Object.keys(set).sort()
  })

  var priorities = computed(function() {
    var set = {}
    var list = productScopedRows.value
    for (var i = 0; i < list.length; i++) {
      if (list[i].priority) set[list[i].priority] = true
    }
    return Object.keys(set).sort()
  })

  var bigRocks = computed(function() {
    var set = {}
    var list = productScopedRows.value
    for (var i = 0; i < list.length; i++) {
      if (list[i].bigRock) set[list[i].bigRock] = true
    }
    return Object.keys(set).sort()
  })

  var pms = computed(function() {
    var set = {}
    var list = productScopedRows.value
    for (var i = 0; i < list.length; i++) {
      if (list[i].pm && list[i].pm !== '—') set[list[i].pm] = true
    }
    return Object.keys(set).sort()
  })

  var planAdminNames = computed(function() {
    var fromSession =
      session.value && Array.isArray(session.value.planAdminNames)
        ? session.value.planAdminNames
        : []
    if (fromSession.length) return fromSession.slice()
    // Fallback when session has not loaded yet (matches server defaults)
    return ['Emarion', 'Tiffany Rozell']
  })

  /** Acting-as options: assignees ∪ PMs (plan admins listed separately in the view). */
  var actorOptions = computed(function() {
    var adminSet = {}
    var admins = planAdminNames.value
    for (var a = 0; a < admins.length; a++) {
      adminSet[String(admins[a] || '').toLowerCase()] = true
    }
    var set = {}
    var list = productScopedRows.value
    for (var i = 0; i < list.length; i++) {
      var row = list[i]
      if (row.assignee && row.assignee !== '—') set[row.assignee] = true
      if (row.pm && row.pm !== '—') set[row.pm] = true
    }
    return Object.keys(set)
      .filter(function(name) {
        return !adminSet[String(name).toLowerCase()]
      })
      .sort()
  })

  function nameIsPlanAdmin(name) {
    var names = planAdminNames.value
    var target = String(name || '')
      .trim()
      .toLowerCase()
    if (!target) return false
    for (var i = 0; i < names.length; i++) {
      if (
        String(names[i] || '')
          .trim()
          .toLowerCase() === target
      ) {
        return true
      }
    }
    return false
  }

  var counts = computed(function() {
    var c = { EA1: 0, EA2: 0, GA: 0, 'Below cut': 0, Descope: 0 }
    var rows = productScopedRows.value
    for (var i = 0; i < rows.length; i++) {
      var ev = rows[i].event
      if (c[ev] != null) c[ev] += 1
    }
    return c
  })

  // Top-level stat bar (mirrors red-pen editor): all counts except "showing" are
  // computed over the product-scoped set, unaffected by event/component/search filters.
  var summary = computed(function() {
    var s = summaryCounts(productScopedRows.value)
    s.showing = filteredRows.value.length
    return s
  })

  var admin = computed(function() {
    return isAdmin(editor.value.meta)
  })

  var finalFrozen = computed(function() {
    return isFinalFrozen(editor.value.meta)
  })

  function scopedCandidates() {
    var prod = selectedProduct.value
    if (!prod) return candidates.value
    return candidates.value.filter(function(row) {
      return row.productFamily === prod
    })
  }

  function eventLoadBars(eventName) {
    return loadBarsByComponent(scopedCandidates(), editor.value.edits, ceilings.value, eventName)
  }

  async function loadCycles(product) {
    // Cycles are version-scoped; product query is for catalog lookup (default RHOAI storage)
    var prod = product || 'RHOAI'
    try {
      var data = await apiRequest(API_BASE + '/cycles?product=' + encodeURIComponent(prod))
      availableProducts.value = data.products && data.products.length ? data.products : ['RHOAI', 'RHAII']
      availableCycles.value = Array.isArray(data.cycles) ? data.cycles : []
      if (!selectedVersion.value && data.defaultVersion) {
        selectedVersion.value = data.defaultVersion
      } else if (selectedVersion.value) {
        var found = false
        for (var i = 0; i < availableCycles.value.length; i++) {
          if (availableCycles.value[i].version === selectedVersion.value) {
            found = true
            break
          }
        }
        if (!found && data.defaultVersion) selectedVersion.value = data.defaultVersion
      } else if (data.defaultVersion) {
        selectedVersion.value = data.defaultVersion
      }
      return data
    } catch (err) {
      availableCycles.value = []
      throw err
    }
  }

  async function loadEditor(version) {
    loading.value = true
    error.value = null
    pendingCapacity.value = null
    try {
      var ver = version || selectedVersion.value || '3.6'
      selectedVersion.value = ver
      // Shared cycle draft storage key (RHOAI namespace); product UI filters within the plan
      var data = await apiRequest(
        API_BASE + '/editor/' + encodeURIComponent(ver) + '?product=RHOAI'
      )
      var normalized = normalizeDraft(data.draft || data)
      draft.value = normalized
      ceilings.value = data.ceilingsByComponent || normalized.ceilingsByComponent || {}
      var state = emptyEditorState(normalized.version, normalized.generatedAt)
      if (data.edits && typeof data.edits === 'object') state.edits = data.edits
      if (data.meta && typeof data.meta === 'object') {
        state.meta = Object.assign({}, state.meta, data.meta)
      }
      if (Array.isArray(data.audit)) state.audit = data.audit
      if (data.session && typeof data.session === 'object') {
        session.value = data.session
      } else {
        session.value = {
          actor: state.meta.currentUser || ADMIN,
          canImpersonate: true,
          isPlanAdmin: state.meta.isPlanAdmin !== false,
          demoMode: !!(normalized && normalized.demoMode)
        }
      }
      if (session.value.canImpersonate) {
        var admins = session.value.planAdminNames || planAdminNames.value
        if (
          !state.meta.currentUser ||
          state.meta.currentUser === ADMIN ||
          state.meta.currentUser === 'Admin'
        ) {
          state.meta.currentUser =
            (session.value.isPlanAdmin && session.value.actor) ||
            admins[0] ||
            session.value.actor ||
            'Emarion'
        }
        state.meta.isPlanAdmin =
          nameIsPlanAdmin(state.meta.currentUser) ||
          (String(state.meta.currentUser || '').toLowerCase() ===
            String(session.value.actor || '').toLowerCase() &&
            session.value.isPlanAdmin === true)
      } else {
        state.meta.currentUser = session.value.actor || state.meta.currentUser || 'unknown'
        state.meta.isPlanAdmin = session.value.isPlanAdmin === true
      }
      editor.value = state
      dirty.value = false
    } catch (err) {
      error.value = err.message || 'Failed to load draft plan'
      draft.value = null
    } finally {
      loading.value = false
    }
  }

  async function persist() {
    if (!draft.value || !draft.value.version) return
    saving.value = true
    try {
      await apiRequest(
        API_BASE +
          '/editor/' +
          encodeURIComponent(draft.value.version) +
          '?product=RHOAI',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            edits: editor.value.edits,
            meta: editor.value.meta,
            audit: editor.value.audit
          })
        }
      )
      dirty.value = false
    } catch (err) {
      error.value = err.message || 'Failed to save editor state'
      throw err
    } finally {
      saving.value = false
    }
  }

  function markDirty() {
    dirty.value = true
    editor.value = {
      edits: editor.value.edits,
      meta: editor.value.meta,
      audit: editor.value.audit.slice()
    }
  }

  function findBase(key) {
    var list = candidates.value
    for (var i = 0; i < list.length; i++) {
      if (list[i].key === key) return list[i]
    }
    return null
  }

  function moveFeature(key, placement, opts) {
    var row = findBase(key)
    if (!row) return { ok: false }
    var result = applyMove(editor.value, candidates.value, ceilings.value, row, placement, opts || {})
    if (result.ok) {
      pendingCapacity.value = null
      markDirty()
    } else if (result.reason === 'capacity') {
      pendingCapacity.value = result
    }
    return result
  }

  function confirmCapacityMove() {
    if (!pendingCapacity.value || !pendingCapacity.value.pending) return { ok: false }
    var p = pendingCapacity.value.pending
    return moveFeature(p.key, p.placement, { skipCapacity: true, capacityOverride: true })
  }

  function cancelCapacityMove() {
    pendingCapacity.value = null
  }

  function descopeFeature(key) {
    var row = findBase(key)
    if (!row) return { ok: false }
    var result = applyDescope(editor.value, row)
    if (result.ok && !result.noop) markDirty()
    return result
  }

  function undescopeFeature(key) {
    var row = findBase(key)
    if (!row) return { ok: false }
    var result = clearDescope(editor.value, row)
    if (result.ok && !result.noop) markDirty()
    return result
  }

  function approveFeature(key, approved) {
    var row = findBase(key)
    if (!row) return { ok: false }
    var result = setApproved(editor.value, row, approved)
    if (result.ok && !result.noop) markDirty()
    return result
  }

  function freeze(eventName) {
    var result = freezeEvent(editor.value, candidates.value, eventName)
    if (result.ok) markDirty()
    return result
  }

  function unfreeze(eventName) {
    var result = unfreezeEvent(editor.value, candidates.value, eventName)
    if (result.ok) markDirty()
    return result
  }

  function unfreezeAll() {
    var result = unfreezePlan(editor.value, candidates.value)
    if (result.ok) markDirty()
    return result
  }

  function freezeFinalGa() {
    var result = finalGaFreeze(editor.value, candidates.value)
    if (result.ok) markDirty()
    return result
  }

  function reset() {
    if (!draft.value) return { ok: false }
    var result = resetToBase(editor.value, draft.value.version, draft.value.generatedAt)
    if (result.ok) markDirty()
    return result
  }

  function setCurrentUser(user) {
    if (session.value && session.value.canImpersonate === false) {
      return
    }
    var admins = planAdminNames.value
    var next =
      user ||
      (session.value && session.value.isPlanAdmin && session.value.actor) ||
      (admins && admins[0]) ||
      (session.value && session.value.actor) ||
      'Emarion'
    editor.value.meta.currentUser = next
    editor.value.meta.isPlanAdmin =
      nameIsPlanAdmin(next) ||
      (session.value &&
        String(next).toLowerCase() === String(session.value.actor || '').toLowerCase() &&
        session.value.isPlanAdmin === true)
    markDirty()
  }

  function setProductFilter(product) {
    selectedProduct.value = product || ''
  }

  return {
    ADMIN,
    PLACEMENTS,
    draft,
    ceilings,
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
    filterDecision,
    filterPriority,
    filterComponent,
    filterAssignee,
    filterFamily,
    filterReady,
    filterBigRock,
    filterPm,
    filterText,
    candidates,
    viewRows,
    productScopedRows,
    filteredRows,
    components,
    assignees,
    priorities,
    bigRocks,
    pms,
    actorOptions,
    planAdminNames,
    counts,
    summary,
    admin,
    session,
    finalFrozen,
    eventFrozen: function(ev) {
      return eventFrozen(editor.value.meta, ev)
    },
    eventLoadBars,
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
  }
}

/** Test-only: reset module-level singleton state between cases. */
export function _resetDraftPlansForTests() {
  draft.value = null
  ceilings.value = {}
  editor.value = emptyEditorState()
  loading.value = false
  saving.value = false
  error.value = null
  dirty.value = false
  pendingCapacity.value = null
  selectedProduct.value = ''
  selectedVersion.value = '3.6'
  availableProducts.value = ['RHOAI', 'RHAII']
  availableCycles.value = []
  filterEvent.value = ''
  filterDecision.value = ''
  filterPriority.value = ''
  filterComponent.value = ''
  filterAssignee.value = ''
  filterFamily.value = ''
  filterReady.value = ''
  filterBigRock.value = ''
  filterPm.value = ''
  filterText.value = ''
  session.value = null
}
