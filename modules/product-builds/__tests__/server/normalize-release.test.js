import { describe, it, expect } from 'vitest'

const { normalizeRelease } = require('../../lib/normalize-release')

describe('normalizeRelease', () => {
  it('strips RHAI prefix', () => {
    expect(normalizeRelease('RHAI 3.5')).toBe('3.5')
    expect(normalizeRelease('RHAI 3.4 EA1')).toBe('3.4 EA1')
  })

  it('normalizes GA suffix', () => {
    expect(normalizeRelease('3.5 GA')).toBe('3.5 GA')
    expect(normalizeRelease('3.4 GA')).toBe('3.4 GA')
  })

  it('normalizes EA with hyphen', () => {
    expect(normalizeRelease('3.5-EA2')).toBe('3.5 EA2')
  })

  it('normalizes EA stuck to version', () => {
    expect(normalizeRelease('3.5EA1')).toBe('3.5 EA1')
  })

  it('normalizes EA with hyphen after', () => {
    expect(normalizeRelease('3.5EA-1')).toBe('3.5 EA1')
  })

  it('handles full RHAI prefix with EA', () => {
    expect(normalizeRelease('RHAI 3.5 EA1')).toBe('3.5 EA1')
    expect(normalizeRelease('RHAI 3.5 EA2')).toBe('3.5 EA2')
  })

  it('handles stray dot before space', () => {
    expect(normalizeRelease('RHAI 3.4. EA2')).toBe('3.4 EA2')
  })

  it('passes through bare version', () => {
    expect(normalizeRelease('3.4')).toBe('3.4')
  })
})
