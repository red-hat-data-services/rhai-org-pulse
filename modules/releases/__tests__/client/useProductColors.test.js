import { describe, it, expect } from 'vitest'
import { PRODUCT_COLORS, DEFAULT_COLORS, PRODUCT_HEX, DEFAULT_HEX, productColors } from '../../client/composables/useProductColors.js'

describe('useProductColors', () => {
  it('exports PRODUCT_COLORS with known products', () => {
    expect(PRODUCT_COLORS).toHaveProperty('rhoai')
    expect(PRODUCT_COLORS).toHaveProperty('rhelai')
    expect(PRODUCT_COLORS).toHaveProperty('rhaii')
  })

  it('each product has bg, border, badge, dot keys', () => {
    var keys = ['bg', 'border', 'badge', 'dot']
    for (var product of Object.keys(PRODUCT_COLORS)) {
      for (var key of keys) {
        expect(PRODUCT_COLORS[product]).toHaveProperty(key)
        expect(typeof PRODUCT_COLORS[product][key]).toBe('string')
      }
    }
  })

  it('returns known colors for rhoai', () => {
    var colors = productColors('rhoai')
    expect(colors).toBe(PRODUCT_COLORS.rhoai)
    expect(colors.dot).toContain('violet')
  })

  it('returns known colors for rhelai', () => {
    var colors = productColors('rhelai')
    expect(colors).toBe(PRODUCT_COLORS.rhelai)
    expect(colors.dot).toContain('emerald')
  })

  it('returns known colors for rhaii', () => {
    var colors = productColors('rhaii')
    expect(colors).toBe(PRODUCT_COLORS.rhaii)
    expect(colors.dot).toContain('pink')
  })

  it('returns known colors for rhai', () => {
    var c = productColors('rhai')
    expect(c.bg).toContain('amber')
    expect(c.border).toContain('amber')
  })

  it('PRODUCT_HEX includes rhai with correct hex color', () => {
    expect(PRODUCT_HEX.rhai).toBe('#f59e0b')
  })

  it('returns DEFAULT_COLORS for unknown product', () => {
    expect(productColors('unknown')).toBe(DEFAULT_COLORS)
    expect(productColors('somethingelse')).toBe(DEFAULT_COLORS)
  })

  it('DEFAULT_COLORS has required keys', () => {
    expect(DEFAULT_COLORS).toHaveProperty('bg')
    expect(DEFAULT_COLORS).toHaveProperty('border')
    expect(DEFAULT_COLORS).toHaveProperty('badge')
    expect(DEFAULT_COLORS).toHaveProperty('dot')
  })

  it('PRODUCT_HEX has same keys as PRODUCT_COLORS', () => {
    var tailwindKeys = Object.keys(PRODUCT_COLORS).sort()
    var hexKeys = Object.keys(PRODUCT_HEX).sort()
    expect(hexKeys).toEqual(tailwindKeys)
    for (var key of hexKeys) {
      expect(PRODUCT_HEX[key]).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('DEFAULT_HEX is a valid hex color', () => {
    expect(typeof DEFAULT_HEX).toBe('string')
    expect(DEFAULT_HEX).toMatch(/^#[0-9a-f]{6}$/i)
  })
})
