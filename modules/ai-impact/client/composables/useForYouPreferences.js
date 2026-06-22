import { ref } from 'vue'

const STORAGE_KEY = 'ai_impact_foryou_prefs'
const DEFAULTS = { mode: 'auto', manualComponents: [], wizardSeen: false, activeTab: 'actions' }

function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw)
    if (typeof parsed.mode !== 'string') return { ...DEFAULTS }
    if (!Array.isArray(parsed.manualComponents)) return { ...DEFAULTS }
    return {
      mode: parsed.mode,
      manualComponents: parsed.manualComponents,
      wizardSeen: !!parsed.wizardSeen,
      activeTab: parsed.activeTab || DEFAULTS.activeTab
    }
  } catch {
    return { ...DEFAULTS }
  }
}

function savePrefs(prefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // silently ignore quota/private-browsing errors
  }
}

export function sanitizeComponents(stored, allowed) {
  if (!allowed || allowed.length === 0) return stored
  const allowedSet = new Set(allowed)
  return stored.filter(c => allowedSet.has(c))
}

// Singleton refs — same reactive state returned on every call
const initial = loadPrefs()
const mode = ref(initial.mode)
const manualComponents = ref(initial.manualComponents)
const wizardSeen = ref(initial.wizardSeen)
const activeTab = ref(initial.activeTab)

function persist() {
  savePrefs({
    mode: mode.value,
    manualComponents: manualComponents.value,
    wizardSeen: wizardSeen.value,
    activeTab: activeTab.value
  })
}

function setMode(val) {
  mode.value = val
  persist()
}

function setManualComponents(components) {
  manualComponents.value = components
  persist()
}

function markWizardSeen() {
  wizardSeen.value = true
  persist()
}

function setActiveTab(tab) {
  activeTab.value = tab
  persist()
}

function resetPreferences() {
  mode.value = DEFAULTS.mode
  manualComponents.value = [...DEFAULTS.manualComponents]
  wizardSeen.value = DEFAULTS.wizardSeen
  activeTab.value = DEFAULTS.activeTab
  persist()
}

export function useForYouPreferences() {
  return {
    mode,
    manualComponents,
    wizardSeen,
    activeTab,
    setMode,
    setManualComponents,
    markWizardSeen,
    setActiveTab,
    resetPreferences
  }
}

export function _resetForTesting() {
  const fresh = loadPrefs()
  mode.value = fresh.mode
  manualComponents.value = fresh.manualComponents
  wizardSeen.value = fresh.wizardSeen
  activeTab.value = fresh.activeTab
}
