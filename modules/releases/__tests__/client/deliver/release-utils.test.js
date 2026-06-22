import { describe, it, expect } from 'vitest'
import {
  extractProduct,
  extractVersion,
  normalizeVersionKey,
  KNOWN_PRODUCTS
} from '../../../client/deliver/composables/release-utils.js'

describe('KNOWN_PRODUCTS', () => {
  it('includes all expected products', () => {
    expect(KNOWN_PRODUCTS).toContain('rhoai')
    expect(KNOWN_PRODUCTS).toContain('rhel-ai')
    expect(KNOWN_PRODUCTS).toContain('rhaii')
    expect(KNOWN_PRODUCTS).toContain('base-images')
  })
})

describe('extractProduct', () => {
  it('returns empty string for falsy input', () => {
    expect(extractProduct(null)).toBe('')
    expect(extractProduct('')).toBe('')
    expect(extractProduct(undefined)).toBe('')
  })

  it('extracts single-segment products', () => {
    expect(extractProduct('rhoai-3.4')).toBe('rhoai')
    expect(extractProduct('rhaii-3.4')).toBe('rhaii')
  })

  it('extracts multi-dash products', () => {
    expect(extractProduct('rhel-ai-3.4')).toBe('rhel-ai')
    expect(extractProduct('base-images-3.4')).toBe('base-images')
  })

  it('is case-insensitive', () => {
    expect(extractProduct('RHOAI-3.4')).toBe('rhoai')
    expect(extractProduct('Rhel-AI-3.4')).toBe('rhel-ai')
    expect(extractProduct('Base-Images-3.4')).toBe('base-images')
  })

  it('handles z-stream versions', () => {
    expect(extractProduct('rhoai-3.3.2')).toBe('rhoai')
    expect(extractProduct('rhel-ai-3.4.1')).toBe('rhel-ai')
  })

  it('falls back to regex for unknown products', () => {
    expect(extractProduct('openshift-4.16')).toBe('openshift')
    expect(extractProduct('some-product-2.0')).toBe('some-product')
  })

  it('returns empty for bare versions', () => {
    expect(extractProduct('3.4')).toBe('')
    expect(extractProduct('1.0')).toBe('')
  })
})

describe('extractVersion', () => {
  it('returns input for falsy input', () => {
    expect(extractVersion(null)).toBe('')
    expect(extractVersion('')).toBe('')
  })

  it('extracts version from single-segment products', () => {
    expect(extractVersion('rhoai-3.4')).toBe('3.4')
    expect(extractVersion('rhaii-3.4')).toBe('3.4')
  })

  it('extracts version from multi-dash products', () => {
    expect(extractVersion('rhel-ai-3.4')).toBe('3.4')
    expect(extractVersion('base-images-3.4')).toBe('3.4')
  })

  it('preserves z-stream and EA suffixes', () => {
    expect(extractVersion('rhoai-3.3.2')).toBe('3.3.2')
    expect(extractVersion('rhoai-3.5-ea1')).toBe('3.5-ea1')
  })

  it('returns input when no product prefix found', () => {
    expect(extractVersion('3.4')).toBe('3.4')
    expect(extractVersion('3.0')).toBe('3.0')
  })
})

describe('normalizeVersionKey', () => {
  it('lowercases and normalizes dots/spaces', () => {
    expect(normalizeVersionKey('3.4')).toBe('3.4')
    expect(normalizeVersionKey('3 4')).toBe('3.4')
    expect(normalizeVersionKey('3..4')).toBe('3.4')
  })
})
