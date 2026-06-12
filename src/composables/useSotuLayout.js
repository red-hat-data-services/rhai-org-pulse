import { ref, computed } from 'vue'

const STORAGE_KEY = 'orgpulse_sotu_layout'

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    return parsed.filter(
      (item) => item && typeof item.widgetId === 'string' && typeof item.size === 'string'
    )
  } catch {
    return null
  }
}

function saveToStorage(layout) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
  } catch {
    // silently ignore quota/private-browsing errors
  }
}

const layout = ref(loadFromStorage())
const hasUserLayout = computed(() => layout.value !== null)
const isFirstVisit = computed(() => !hasUserLayout.value)

function initWithDefaults(availableWidgets) {
  if (layout.value !== null) return
  const defaults = []
  for (const w of availableWidgets) {
    defaults.push({ widgetId: w.qualifiedId, size: w.defaultSize || 'half' })
  }
  layout.value = defaults
}

function pruneStaleWidgets(validIds) {
  if (!layout.value) return
  const validSet = new Set(validIds)
  const pruned = layout.value.filter((item) => validSet.has(item.widgetId))
  if (pruned.length !== layout.value.length) {
    layout.value = pruned
    saveToStorage(pruned)
  }
}

function addWidget(widgetId, defaultSize = 'half') {
  if (!layout.value) layout.value = []
  if (layout.value.some((item) => item.widgetId === widgetId)) return
  layout.value = [...layout.value, { widgetId, size: defaultSize }]
  saveToStorage(layout.value)
}

function removeWidget(widgetId) {
  if (!layout.value) return
  layout.value = layout.value.filter((item) => item.widgetId !== widgetId)
  saveToStorage(layout.value)
}

function moveWidget(fromIndex, toIndex) {
  if (!layout.value) return
  const arr = [...layout.value]
  const [item] = arr.splice(fromIndex, 1)
  arr.splice(toIndex, 0, item)
  layout.value = arr
  saveToStorage(arr)
}

function resizeWidget(widgetId, newSize) {
  if (!layout.value) return
  layout.value = layout.value.map((item) =>
    item.widgetId === widgetId ? { ...item, size: newSize } : item
  )
  saveToStorage(layout.value)
}

function hasWidget(widgetId) {
  if (!layout.value) return false
  return layout.value.some((item) => item.widgetId === widgetId)
}

export function useSotuLayout() {
  return {
    layout,
    isFirstVisit,
    initWithDefaults,
    pruneStaleWidgets,
    addWidget,
    removeWidget,
    moveWidget,
    resizeWidget,
    hasWidget
  }
}

export function _resetForTesting() {
  layout.value = loadFromStorage()
}
