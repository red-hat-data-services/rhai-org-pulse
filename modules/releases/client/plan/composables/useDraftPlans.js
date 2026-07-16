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
var filterComponent = ref('')
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
    return productScopedRows.value.filter(function(row) {
      if (filterEvent.value && row.event !== filterEvent.value) return false
      if (filterComponent.value && row.component !== filterComponent.value) return false
      if (!q) return true
      return (
        String(row.key).toLowerCase().indexOf(q) !== -1 ||
        String(row.summary).toLowerCase().indexOf(q) !== -1 ||
        String(row.assignee).toLowerCase().indexOf(q) !== -1
      )
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

  var counts = computed(function() {
    var c = { EA1: 0, EA2: 0, GA: 0, 'Below cut': 0, Descope: 0 }
    var rows = productScopedRows.value
    for (var i = 0; i < rows.length; i++) {
      var ev = rows[i].event
      if (c[ev] != null) c[ev] += 1
    }
    return c
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
        if (!state.meta.currentUser) state.meta.currentUser = ADMIN
        state.meta.isPlanAdmin =
          state.meta.currentUser === ADMIN || session.value.isPlanAdmin === true
      } else {
        state.meta.currentUser = session.value.actor || state.meta.currentUser || ADMIN
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
    var next = user || ADMIN
    editor.value.meta.currentUser = next
    editor.value.meta.isPlanAdmin =
      next === ADMIN || !!(session.value && session.value.isPlanAdmin)
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
    filterComponent,
    filterText,
    candidates,
    viewRows,
    productScopedRows,
    filteredRows,
    components,
    assignees,
    counts,
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
  filterComponent.value = ''
  filterText.value = ''
  session.value = null
}
