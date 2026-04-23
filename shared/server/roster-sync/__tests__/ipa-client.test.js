import { describe, it, expect } from 'vitest'

const { escapeLdapFilter } = require('../ipa-client')

describe('escapeLdapFilter', () => {
  it('returns empty string for falsy input', () => {
    expect(escapeLdapFilter(null)).toBe('')
    expect(escapeLdapFilter(undefined)).toBe('')
    expect(escapeLdapFilter('')).toBe('')
  })

  it('passes through safe strings unchanged', () => {
    expect(escapeLdapFilter('jdoe')).toBe('jdoe')
    expect(escapeLdapFilter('jane.doe')).toBe('jane.doe')
    expect(escapeLdapFilter('user123')).toBe('user123')
  })

  it('escapes backslash', () => {
    expect(escapeLdapFilter('a\\b')).toBe('a\\5cb')
  })

  it('escapes asterisk', () => {
    expect(escapeLdapFilter('a*b')).toBe('a\\2ab')
  })

  it('escapes parentheses', () => {
    expect(escapeLdapFilter('a(b)c')).toBe('a\\28b\\29c')
  })

  it('escapes NUL byte', () => {
    expect(escapeLdapFilter('a\x00b')).toBe('a\\00b')
  })

  it('escapes multiple special chars', () => {
    expect(escapeLdapFilter('*()\\\x00')).toBe('\\2a\\28\\29\\5c\\00')
  })

  it('converts non-string input to string', () => {
    expect(escapeLdapFilter(42)).toBe('42')
  })
})
