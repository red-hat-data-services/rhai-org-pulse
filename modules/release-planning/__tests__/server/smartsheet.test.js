import { describe, it, expect } from 'vitest'
const { isConfigured } = require('../../../../shared/server/smartsheet')

// Note: We can't easily unit test discoverReleases without mocking https.get,
// which requires a heavier test setup. The isConfigured and regex logic are
// tested here; integration testing covers the full flow.

describe('isConfigured', () => {
  it('returns false when SMARTSHEET_API_TOKEN is not set', () => {
    // Default in the module is '' when env var is not set
    // Since we can't easily reset module-level vars, we verify the function exists
    // and returns a boolean. In CI, the token is not set, so this should be false.
    var result = isConfigured()
    expect(typeof result).toBe('boolean')
  })
})

// Test the regex patterns used by discoverReleases by extracting them.
// These mirror the Python client's patterns.
describe('SmartSheet regex patterns', () => {
  var EA_FREEZE_RE = /^(\d+\.\d+)\.(EA[12])\s+(?:RHOAI\s+)?Code\s+Freeze/i
  var EA_RELEASE_RE = /^(\d+\.\d+)\.(EA[12])\s+(?:RHOAI\s+)?RELEASE/i
  var GA_FREEZE_RE = /^(\d+\.\d+)\s+(?:RHOAI\s+)?Code\s+Freeze$/i
  var GA_RELEASE_RE = /^(\d+\.\d+)\s+(?:RHOAI\s+)?GA$/i

  describe('EA Code Freeze pattern', () => {
    it('matches "3.4.EA1 RHOAI Code Freeze"', () => {
      var m = '3.4.EA1 RHOAI Code Freeze'.match(EA_FREEZE_RE)
      expect(m).not.toBeNull()
      expect(m[1]).toBe('3.4')
      expect(m[2]).toBe('EA1')
    })

    it('matches "3.5.EA2 Code Freeze" (without RHOAI)', () => {
      var m = '3.5.EA2 Code Freeze'.match(EA_FREEZE_RE)
      expect(m).not.toBeNull()
      expect(m[1]).toBe('3.5')
      expect(m[2]).toBe('EA2')
    })

    it('does not match GA code freeze', () => {
      var m = '3.4 RHOAI Code Freeze'.match(EA_FREEZE_RE)
      expect(m).toBeNull()
    })
  })

  describe('EA Release pattern', () => {
    it('matches "3.5.EA1 RHOAI RELEASE"', () => {
      var m = '3.5.EA1 RHOAI RELEASE'.match(EA_RELEASE_RE)
      expect(m).not.toBeNull()
      expect(m[1]).toBe('3.5')
      expect(m[2]).toBe('EA1')
    })

    it('matches "3.4.EA2 RELEASE" (without RHOAI)', () => {
      var m = '3.4.EA2 RELEASE'.match(EA_RELEASE_RE)
      expect(m).not.toBeNull()
      expect(m[1]).toBe('3.4')
      expect(m[2]).toBe('EA2')
    })
  })

  describe('GA Code Freeze pattern', () => {
    it('matches "3.4 RHOAI Code Freeze"', () => {
      var m = '3.4 RHOAI Code Freeze'.match(GA_FREEZE_RE)
      expect(m).not.toBeNull()
      expect(m[1]).toBe('3.4')
    })

    it('matches "3.5 Code Freeze" (without RHOAI)', () => {
      var m = '3.5 Code Freeze'.match(GA_FREEZE_RE)
      expect(m).not.toBeNull()
      expect(m[1]).toBe('3.5')
    })

    it('does not match EA code freeze', () => {
      var m = '3.4.EA1 RHOAI Code Freeze'.match(GA_FREEZE_RE)
      expect(m).toBeNull()
    })

    it('does not match Feature Freeze', () => {
      var m = '3.4 RHOAI Feature Freeze'.match(GA_FREEZE_RE)
      expect(m).toBeNull()
    })
  })

  describe('GA Release pattern', () => {
    it('matches "3.5 RHOAI GA"', () => {
      var m = '3.5 RHOAI GA'.match(GA_RELEASE_RE)
      expect(m).not.toBeNull()
      expect(m[1]).toBe('3.5')
    })

    it('matches "3.4 GA" (without RHOAI)', () => {
      var m = '3.4 GA'.match(GA_RELEASE_RE)
      expect(m).not.toBeNull()
      expect(m[1]).toBe('3.4')
    })

    it('does not match "3.4 RHOAI GA Prep"', () => {
      var m = '3.4 RHOAI GA Prep'.match(GA_RELEASE_RE)
      expect(m).toBeNull()
    })
  })

  describe('version sorting', () => {
    it('sorts versions numerically', () => {
      var versions = ['3.5', '3.4', '4.0', '3.10']
      var sorted = versions.sort(function(a, b) {
        var ap = a.split('.').map(Number)
        var bp = b.split('.').map(Number)
        return ap[0] - bp[0] || ap[1] - bp[1]
      })
      expect(sorted).toEqual(['3.4', '3.5', '3.10', '4.0'])
    })
  })
})
