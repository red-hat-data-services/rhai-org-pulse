import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useForYouPreferences, sanitizeComponents, _resetForTesting } from '../../client/composables/useForYouPreferences.js'

const STORAGE_KEY = 'ai_impact_foryou_prefs'

describe('useForYouPreferences', () => {
  beforeEach(() => {
    localStorage.clear()
    _resetForTesting()
  })

  it('returns defaults when no stored data', () => {
    const { mode, manualComponents, wizardSeen, activeTab } = useForYouPreferences()
    expect(mode.value).toBe('auto')
    expect(manualComponents.value).toEqual([])
    expect(wizardSeen.value).toBe(false)
    expect(activeTab.value).toBe('actions')
  })

  it('reads stored preferences from localStorage', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      mode: 'manual',
      manualComponents: ['Comp A', 'Comp B'],
      wizardSeen: true
    }))
    _resetForTesting()
    const { mode, manualComponents, wizardSeen } = useForYouPreferences()
    expect(mode.value).toBe('manual')
    expect(manualComponents.value).toEqual(['Comp A', 'Comp B'])
    expect(wizardSeen.value).toBe(true)
  })

  it('falls back to defaults on corrupted JSON', () => {
    localStorage.setItem(STORAGE_KEY, 'not-json{{{')
    _resetForTesting()
    const { mode, manualComponents, wizardSeen } = useForYouPreferences()
    expect(mode.value).toBe('auto')
    expect(manualComponents.value).toEqual([])
    expect(wizardSeen.value).toBe(false)
  })

  it('falls back to defaults when mode is not a string', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      mode: 42,
      manualComponents: [],
      wizardSeen: false
    }))
    _resetForTesting()
    const { mode } = useForYouPreferences()
    expect(mode.value).toBe('auto')
  })

  it('falls back to defaults when manualComponents is not an array', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      mode: 'manual',
      manualComponents: 'not-an-array',
      wizardSeen: false
    }))
    _resetForTesting()
    const { manualComponents } = useForYouPreferences()
    expect(manualComponents.value).toEqual([])
  })

  it('persists mode via setMode', () => {
    const { setMode } = useForYouPreferences()
    setMode('manual')
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(stored.mode).toBe('manual')
  })

  it('persists components via setManualComponents', () => {
    const { setManualComponents } = useForYouPreferences()
    setManualComponents(['X', 'Y'])
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(stored.manualComponents).toEqual(['X', 'Y'])
  })

  it('persists wizardSeen via markWizardSeen', () => {
    const { markWizardSeen } = useForYouPreferences()
    markWizardSeen()
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(stored.wizardSeen).toBe(true)
  })

  it('persists activeTab via setActiveTab', () => {
    const { setActiveTab, activeTab } = useForYouPreferences()
    setActiveTab('board')
    expect(activeTab.value).toBe('board')
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(stored.activeTab).toBe('board')
  })

  it('defaults activeTab when loading prefs without it', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      mode: 'manual',
      manualComponents: ['Comp A'],
      wizardSeen: true
    }))
    _resetForTesting()
    const { activeTab, mode } = useForYouPreferences()
    expect(mode.value).toBe('manual')
    expect(activeTab.value).toBe('actions')
  })

  it('resets to defaults via resetPreferences', () => {
    const { setMode, setManualComponents, markWizardSeen, resetPreferences, mode, manualComponents, wizardSeen } = useForYouPreferences()
    setMode('manual')
    setManualComponents(['Z'])
    markWizardSeen()
    resetPreferences()
    expect(mode.value).toBe('auto')
    expect(manualComponents.value).toEqual([])
    expect(wizardSeen.value).toBe(false)
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(stored.mode).toBe('auto')
  })

  it('silently handles write errors (private browsing)', () => {
    const orig = localStorage.setItem
    localStorage.setItem = vi.fn(() => { throw new Error('QuotaExceededError') })
    const { setMode, mode } = useForYouPreferences()
    expect(() => setMode('manual')).not.toThrow()
    expect(mode.value).toBe('manual')
    localStorage.setItem = orig
  })
})

describe('sanitizeComponents', () => {
  it('prunes stored values not in allowed list', () => {
    const result = sanitizeComponents(['A', 'B', 'C'], ['B', 'D'])
    expect(result).toEqual(['B'])
  })

  it('returns all stored when all are allowed', () => {
    const result = sanitizeComponents(['A', 'B'], ['A', 'B', 'C'])
    expect(result).toEqual(['A', 'B'])
  })

  it('returns stored unchanged when allowed is empty', () => {
    const result = sanitizeComponents(['A', 'B'], [])
    expect(result).toEqual(['A', 'B'])
  })

  it('returns empty when stored is empty', () => {
    const result = sanitizeComponents([], ['A', 'B'])
    expect(result).toEqual([])
  })
})
