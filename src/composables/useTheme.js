import { ref, watch, readonly } from 'vue'

const STORAGE_KEY = 'tt_theme'
const VALID_MODES = ['light', 'dark', 'system']

const mode = ref(loadMode())
const isDark = ref(resolveDark(mode.value))

function loadMode() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (VALID_MODES.includes(stored)) return stored
  } catch { /* ignore */ }
  return 'system'
}

function resolveDark(m) {
  return m === 'dark' || (m === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
}

function applyTheme(m) {
  isDark.value = resolveDark(m)
  document.documentElement.classList.toggle('dark', isDark.value)
}

// React to OS preference changes when in system mode
const mql = window.matchMedia('(prefers-color-scheme: dark)')
mql.addEventListener('change', () => {
  if (mode.value === 'system') applyTheme('system')
})

watch(mode, (m) => {
  localStorage.setItem(STORAGE_KEY, m)
  applyTheme(m)
}, { immediate: true })

export function useTheme() {
  function setMode(m) {
    if (VALID_MODES.includes(m)) mode.value = m
  }

  function cycle() {
    const order = ['light', 'dark', 'system']
    const idx = order.indexOf(mode.value)
    mode.value = order[(idx + 1) % order.length]
  }

  return {
    mode: readonly(mode),
    isDark: readonly(isDark),
    setMode,
    cycle
  }
}
