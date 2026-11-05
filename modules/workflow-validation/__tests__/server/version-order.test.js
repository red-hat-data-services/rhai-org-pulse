import { describe, expect, it } from 'vitest'
import { compareVersions, normalizeVersion, normalizeVersions, versionLabel } from '../../lib/versions.js'
describe('Recent Runs version rules', () => {
  it('orders numeric releases and puts GA above prereleases of the same release', () => {
    expect(normalizeVersions(['3.5.2', '3.6.0-ea.1', '3.6.0', '3.6.0-ea.2', '3.10.0', '3.9.99']))
      .toEqual(['3.10.0', '3.9.99', '3.6.0', '3.6.0-ea.2', '3.6.0-ea.1', '3.5.2'])
    expect(compareVersions('3.6.0', '3.6.0-rc.2')).toBeGreaterThan(0)
    expect(compareVersions('3.6.0-ea.10', '3.6.0-ea.2')).toBeGreaterThan(0)
  })
  it('combines legacy 3.6 with 3.6.0 while keeping EA and other partial labels distinct', () => {
    expect(normalizeVersions(['3.6', '3.6.0', '03.06.00', '3.6.0 EA1', '3.6.0-ea.1']))
      .toEqual(['3.6.0', '3.6.0-ea.1'])
    expect(versionLabel('3.6')).toBe('3.6.0')
    expect(compareVersions('3.6', '3.6.0')).toBe(0)
    expect(compareVersions('3.6', '3.6.0-ea.2')).toBeGreaterThan(0)
    expect(versionLabel('3.4')).toBe('3.4 (release unspecified)')
    expect(versionLabel('3.6.0')).toBe('3.6.0')
    expect(normalizeVersion('custom build')).toBe('custom build')
  })
  it('is antisymmetric and deterministic for full, partial, missing, and unknown labels', () => {
    const values = ['3.6.0', '3.6.0 EA1', '3.6.0-ea.1', '3.6', '3.5.9', '', 'older']
    for (const a of values) for (const b of values) expect(Math.sign(compareVersions(a, b)) + Math.sign(compareVersions(b, a))).toBe(0)
  })
})
