import { describe, it, expect, beforeEach, vi } from 'vitest'

const STORAGE_KEY = 'orgpulse_sotu_layout'

let useSotuLayout, _resetForTesting

describe('useSotuLayout', () => {
  beforeEach(async () => {
    localStorage.clear()
    vi.resetModules()
    const mod = await import('../composables/useSotuLayout.js')
    useSotuLayout = mod.useSotuLayout
    _resetForTesting = mod._resetForTesting
    _resetForTesting()
  })

  it('returns null layout on first visit (no localStorage)', () => {
    const { layout, isFirstVisit } = useSotuLayout()
    expect(layout.value).toBeNull()
    expect(isFirstVisit.value).toBe(true)
  })

  it('initializes with defaults from available widgets', () => {
    const { layout, isFirstVisit, initWithDefaults } = useSotuLayout()
    initWithDefaults([
      { qualifiedId: 'mod:w1', defaultSize: 'half' },
      { qualifiedId: 'mod:w2', defaultSize: 'full' }
    ])
    expect(layout.value).toEqual([
      { widgetId: 'mod:w1', size: 'half' },
      { widgetId: 'mod:w2', size: 'full' }
    ])
    expect(isFirstVisit.value).toBe(false)
  })

  it('does not reinitialize if layout already exists', () => {
    const { layout, initWithDefaults } = useSotuLayout()
    initWithDefaults([{ qualifiedId: 'mod:w1', defaultSize: 'half' }])
    initWithDefaults([{ qualifiedId: 'mod:other', defaultSize: 'full' }])
    expect(layout.value).toEqual([{ widgetId: 'mod:w1', size: 'half' }])
  })

  it('adds a widget', () => {
    const { layout, initWithDefaults, addWidget } = useSotuLayout()
    initWithDefaults([])
    addWidget('mod:w1', 'full')
    expect(layout.value).toEqual([{ widgetId: 'mod:w1', size: 'full' }])
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(stored).toEqual([{ widgetId: 'mod:w1', size: 'full' }])
  })

  it('does not add duplicate widget', () => {
    const { initWithDefaults, addWidget, layout } = useSotuLayout()
    initWithDefaults([])
    addWidget('mod:w1', 'half')
    addWidget('mod:w1', 'half')
    expect(layout.value.length).toBe(1)
  })

  it('removes a widget', () => {
    const { initWithDefaults, addWidget, removeWidget, layout } = useSotuLayout()
    initWithDefaults([])
    addWidget('mod:w1', 'half')
    addWidget('mod:w2', 'full')
    removeWidget('mod:w1')
    expect(layout.value).toEqual([{ widgetId: 'mod:w2', size: 'full' }])
  })

  it('moves a widget', () => {
    const { initWithDefaults, addWidget, moveWidget, layout } = useSotuLayout()
    initWithDefaults([])
    addWidget('mod:w1', 'half')
    addWidget('mod:w2', 'full')
    addWidget('mod:w3', 'half')
    moveWidget(2, 0)
    expect(layout.value.map(i => i.widgetId)).toEqual(['mod:w3', 'mod:w1', 'mod:w2'])
  })

  it('resizes a widget', () => {
    const { initWithDefaults, addWidget, resizeWidget, layout } = useSotuLayout()
    initWithDefaults([])
    addWidget('mod:w1', 'half')
    resizeWidget('mod:w1', 'full')
    expect(layout.value[0].size).toBe('full')
  })

  it('checks if widget exists', () => {
    const { initWithDefaults, addWidget, hasWidget } = useSotuLayout()
    initWithDefaults([])
    addWidget('mod:w1', 'half')
    expect(hasWidget('mod:w1')).toBe(true)
    expect(hasWidget('mod:w2')).toBe(false)
  })

  it('prunes stale widgets', () => {
    const { initWithDefaults, addWidget, pruneStaleWidgets, layout } = useSotuLayout()
    initWithDefaults([])
    addWidget('mod:w1', 'half')
    addWidget('mod:w2', 'full')
    pruneStaleWidgets(['mod:w1'])
    expect(layout.value).toEqual([{ widgetId: 'mod:w1', size: 'half' }])
  })

  it('round-trips through localStorage', async () => {
    const { initWithDefaults, addWidget } = useSotuLayout()
    initWithDefaults([])
    addWidget('mod:w1', 'half')
    addWidget('mod:w2', 'full')

    // Re-import to simulate page reload
    vi.resetModules()
    const mod2 = await import('../composables/useSotuLayout.js')
    const { layout: layout2 } = mod2.useSotuLayout()
    expect(layout2.value).toEqual([
      { widgetId: 'mod:w1', size: 'half' },
      { widgetId: 'mod:w2', size: 'full' }
    ])
  })

  it('handles corrupted localStorage gracefully', async () => {
    localStorage.setItem(STORAGE_KEY, 'not-json{{{')
    vi.resetModules()
    const mod = await import('../composables/useSotuLayout.js')
    const { layout } = mod.useSotuLayout()
    expect(layout.value).toBeNull()
  })

  it('handles non-array localStorage gracefully', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ not: 'array' }))
    vi.resetModules()
    const mod = await import('../composables/useSotuLayout.js')
    const { layout } = mod.useSotuLayout()
    expect(layout.value).toBeNull()
  })
})
