// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { validateAction, sanitizeTarget, sanitizeString, VALID_ACTIONS } from '../../server/sanitize.js'

describe('validateAction', () => {
  it('accepts all valid actions', () => {
    for (const action of VALID_ACTIONS) {
      expect(validateAction(action)).toBe(action)
    }
  })

  it('rejects unknown actions', () => {
    expect(validateAction('invalid')).toBeNull()
    expect(validateAction('click')).toBeNull()
    expect(validateAction('')).toBeNull()
  })

  it('rejects non-string values', () => {
    expect(validateAction(null)).toBeNull()
    expect(validateAction(undefined)).toBeNull()
    expect(validateAction(42)).toBeNull()
  })
})

describe('sanitizeTarget', () => {
  it('returns null for null/undefined', () => {
    expect(sanitizeTarget(null)).toBeNull()
    expect(sanitizeTarget(undefined)).toBeNull()
  })

  it('returns null for empty strings', () => {
    expect(sanitizeTarget('')).toBeNull()
    expect(sanitizeTarget('   ')).toBeNull()
  })

  it('passes through valid targets', () => {
    expect(sanitizeTarget('refresh')).toBe('refresh')
    expect(sanitizeTarget('jira')).toBe('jira')
  })

  it('truncates targets exceeding 100 chars', () => {
    const long = 'a'.repeat(150)
    expect(sanitizeTarget(long)).toHaveLength(100)
  })

  it('converts non-string values to string', () => {
    expect(sanitizeTarget(42)).toBe('42')
  })
})

describe('sanitizeString', () => {
  it('returns null for non-strings', () => {
    expect(sanitizeString(null)).toBeNull()
    expect(sanitizeString(42)).toBeNull()
  })

  it('trims whitespace', () => {
    expect(sanitizeString('  hello  ')).toBe('hello')
  })

  it('returns null for empty strings after trim', () => {
    expect(sanitizeString('   ')).toBeNull()
  })

  it('truncates long strings', () => {
    const long = 'x'.repeat(200)
    expect(sanitizeString(long)).toHaveLength(100)
  })
})
