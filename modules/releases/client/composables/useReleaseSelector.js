import { ref, reactive, computed, onMounted, onUnmounted, inject } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'

const PHASE_ORDER = ['EA1', 'EA2', 'GA']

// Z-stream releases (e.g. rhoai-3.6.z) are intentionally excluded — they are
// separate registry entries with distinct schedules and should not appear in the
// family/version/phase selector alongside standard milestones.
function parseReleaseId(id) {
  const match = id.match(/^([a-z]+)-(\d+\.\d+)(?:\.(ea\d?))?$/i)
  if (!match) return null
  return { family: match[1].toLowerCase(), version: match[2], phase: match[3] ? match[3].toUpperCase() : 'GA' }
}

/**
 * Shared composable for the registry-based release selector modal used by
 * program-level reports (Capacity Commitment, Program Hygiene, etc.).
 *
 * Manages: registry fetch, release parsing, draft/apply modal state, family/
 * version/phase selection, URL param + localStorage persistence, narrative
 * text, and escape-key handling.
 *
 * @param {object} options
 * @param {string} options.storageKey  localStorage key for persisting selection
 */
export function useReleaseSelector({ storageKey }) {
  const nav = inject('moduleNav')

  const releases = ref([])
  const modalOpen = ref(false)
  const selection = reactive({ version: '', families: new Set(), phases: new Set() })
  const draft = reactive({ version: '', families: new Set(), phases: new Set() })

  // ── Registry parsing ──

  const parsedReleases = computed(() => {
    return releases.value
      .filter(r => r.state === 'active')
      .map(r => ({ ...r, ...parseReleaseId(r.id) }))
      .filter(r => r.family)
  })

  const availableFamilies = computed(() => {
    return [...new Set(parsedReleases.value.map(r => r.family))].sort()
  })

  const draftVersions = computed(() => {
    if (draft.families.size === 0) return []
    const filtered = parsedReleases.value.filter(r => draft.families.has(r.family))
    return [...new Set(filtered.map(r => r.version))].sort()
  })

  const draftPhases = computed(() => {
    if (!draft.version || draft.families.size === 0) return []
    const filtered = parsedReleases.value.filter(r =>
      r.version === draft.version && draft.families.has(r.family)
    )
    return [...new Set(filtered.map(r => r.phase))].sort((a, b) => PHASE_ORDER.indexOf(a) - PHASE_ORDER.indexOf(b))
  })

  const isAllFamiliesDraft = computed(() =>
    availableFamilies.value.length > 0 && draft.families.size === availableFamilies.value.length
  )

  const hasSelection = computed(() =>
    selection.version && selection.families.size > 0 && selection.phases.size > 0
  )

  const canApply = computed(() =>
    draft.version && draft.families.size > 0 && draft.phases.size > 0
  )

  // ── Data loading ──

  async function fetchRegistry() {
    const data = await apiRequest('/modules/releases/registry')
    releases.value = data.releases || []
  }

  // ── Selection management ──

  function restoreSelection() {
    const params = nav?.params?.value || {}
    if (params.version) {
      const families = params.families
        ? params.families.split(',').filter(f => availableFamilies.value.includes(f))
        : [...availableFamilies.value]
      const phases = params.phases
        ? params.phases.split(',').filter(p => PHASE_ORDER.includes(p.toUpperCase())).map(p => p.toUpperCase())
        : ['GA']

      if (families.length > 0 && phases.length > 0) {
        applySelection(params.version, new Set(families), new Set(phases))
        return
      }
    }

    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.version && parsed.families?.length && parsed.phases?.length) {
          const validFamilies = parsed.families.filter(f => availableFamilies.value.includes(f))
          const validPhases = parsed.phases.filter(p => PHASE_ORDER.includes(p))
          if (validFamilies.length > 0 && validPhases.length > 0) {
            applySelection(parsed.version, new Set(validFamilies), new Set(validPhases))
            return
          }
        }
      }
    } catch { /* ignore */ }

    if (availableFamilies.value.length > 0) {
      const allVersions = [...new Set(parsedReleases.value.map(r => r.version))].sort()
      const latestVersion = pickDefaultVersion(allVersions)
      if (latestVersion) {
        applySelection(latestVersion, new Set(availableFamilies.value), new Set(['GA']))
      }
    }
  }

  function pickDefaultVersion(versions) {
    const now = Date.now()
    let best = null
    let bestDelta = Infinity

    for (const v of versions) {
      const gaReleases = parsedReleases.value.filter(r => r.version === v && r.phase === 'GA' && r.milestones?.ga)
      for (const r of gaReleases) {
        const ts = new Date(r.milestones.ga).getTime()
        const delta = ts - now
        if (delta >= 0 && delta < bestDelta) {
          bestDelta = delta
          best = v
        }
      }
    }

    return best || versions[versions.length - 1] || null
  }

  function applySelection(version, families, phases) {
    selection.version = version
    selection.families = families
    selection.phases = phases
    persistSelection()
  }

  function persistSelection() {
    const data = {
      version: selection.version,
      families: [...selection.families],
      phases: [...selection.phases]
    }
    localStorage.setItem(storageKey, JSON.stringify(data))
    nav.updateParams({
      version: selection.version,
      families: [...selection.families].join(','),
      phases: [...selection.phases].map(p => p.toLowerCase()).join(',')
    })
  }

  // ── Modal logic ──

  function openModal() {
    draft.version = selection.version
    draft.families = new Set(selection.families.size > 0 ? selection.families : availableFamilies.value)
    draft.phases = new Set(selection.phases.size > 0 ? selection.phases : ['GA'])
    modalOpen.value = true
  }

  function cancelModal() {
    modalOpen.value = false
  }

  function applyModal() {
    if (!canApply.value) return
    applySelection(draft.version, new Set(draft.families), new Set(draft.phases))
    modalOpen.value = false
  }

  function toggleAllFamilies() {
    draft.families = new Set(availableFamilies.value)
    reconcileDraftVersion()
  }

  function toggleFamily(family) {
    const next = new Set(draft.families)
    if (isAllFamiliesDraft.value) {
      next.clear()
      next.add(family)
    } else if (next.has(family) && next.size > 1) {
      next.delete(family)
    } else {
      next.add(family)
    }
    draft.families = next
    reconcileDraftVersion()
  }

  function selectVersionDraft(version) {
    draft.version = version
    reconcileDraftPhases()
  }

  function togglePhase(phase) {
    const next = new Set(draft.phases)
    if (next.has(phase) && next.size > 1) {
      next.delete(phase)
    } else {
      next.add(phase)
    }
    draft.phases = next
  }

  function reconcileDraftVersion() {
    if (draft.version && !draftVersions.value.includes(draft.version)) {
      draft.version = ''
      draft.phases = new Set()
    } else {
      reconcileDraftPhases()
    }
  }

  function reconcileDraftPhases() {
    const available = draftPhases.value
    const next = new Set([...draft.phases].filter(p => available.includes(p)))
    if (next.size === 0 && available.includes('GA')) next.add('GA')
    else if (next.size === 0 && available.length > 0) next.add(available[0])
    draft.phases = next
  }

  // ── Narrative ──

  const familyNarrative = computed(() => {
    if (selection.families.size === availableFamilies.value.length) return 'all product families'
    const names = [...selection.families].sort().map(f => f.toUpperCase())
    if (names.length === 1) return names[0]
    if (names.length === 2) return names[0] + ' and ' + names[1]
    return names.slice(0, -1).join(', ') + ', and ' + names[names.length - 1]
  })

  const phaseNarrative = computed(() => {
    const sorted = [...selection.phases].sort((a, b) => PHASE_ORDER.indexOf(a) - PHASE_ORDER.indexOf(b))
    if (sorted.length === PHASE_ORDER.length) return 'EA1, EA2, and GA'
    if (sorted.length === 1) return sorted[0]
    if (sorted.length === 2) return sorted[0] + ' and ' + sorted[1]
    return sorted.slice(0, -1).join(', ') + ', and ' + sorted[sorted.length - 1]
  })

  // ── Escape handler ──

  function handleEscape(e) {
    if (e.key === 'Escape' && modalOpen.value) cancelModal()
  }
  onMounted(() => document.addEventListener('keydown', handleEscape))
  onUnmounted(() => document.removeEventListener('keydown', handleEscape))

  // ── Registry ID matching ──

  function selectedRegistryIdSet() {
    if (!hasSelection.value) return new Set()
    return new Set(
      parsedReleases.value
        .filter(r => selection.families.has(r.family) &&
          r.version === selection.version &&
          selection.phases.has(r.phase))
        .map(r => r.id)
    )
  }

  return {
    releases,
    modalOpen,
    selection,
    draft,
    parsedReleases,
    availableFamilies,
    draftVersions,
    draftPhases,
    isAllFamiliesDraft,
    hasSelection,
    canApply,
    fetchRegistry,
    restoreSelection,
    applySelection,
    openModal,
    cancelModal,
    applyModal,
    toggleAllFamilies,
    toggleFamily,
    selectVersionDraft,
    togglePhase,
    familyNarrative,
    phaseNarrative,
    selectedRegistryIdSet,
    PHASE_ORDER
  }
}
