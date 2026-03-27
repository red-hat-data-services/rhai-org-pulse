import { describe, it, expect, beforeEach, afterEach } from 'vitest'

// We need a fresh module for each test since install() is one-shot
let errorBuffer

function loadFreshModule() {
  // Clear module cache so we get a fresh install
  const modulePath = require.resolve('../error-buffer')
  delete require.cache[modulePath]
  return require('../error-buffer')
}

describe('error-buffer', () => {
  beforeEach(() => {
    errorBuffer = loadFreshModule()
  })

  afterEach(() => {
    // Restore console after each test by loading fresh module
    // (the original console methods are captured at install time)
  })

  it('getEntries returns empty array before install', () => {
    expect(errorBuffer.getEntries()).toEqual([])
  })

  it('captures console.error after install', () => {
    errorBuffer.install()
    console.error('test error message')
    const entries = errorBuffer.getEntries()
    expect(entries.length).toBe(1)
    expect(entries[0].level).toBe('error')
    expect(entries[0].message).toBe('test error message')
    expect(entries[0].at).toBeTruthy()
  })

  it('captures console.warn after install', () => {
    errorBuffer.install()
    console.warn('test warning')
    const entries = errorBuffer.getEntries()
    expect(entries.length).toBe(1)
    expect(entries[0].level).toBe('warn')
    expect(entries[0].message).toBe('test warning')
  })

  it('handles multiple arguments', () => {
    errorBuffer.install()
    console.error('error:', 'detail', 42)
    const entries = errorBuffer.getEntries()
    expect(entries[0].message).toBe('error: detail 42')
  })

  it('handles Error objects', () => {
    errorBuffer.install()
    console.error(new Error('boom'))
    const entries = errorBuffer.getEntries()
    expect(entries[0].message).toContain('boom')
  })

  it('respects capacity limit', () => {
    errorBuffer.install({ capacity: 3 })
    console.error('msg1')
    console.error('msg2')
    console.error('msg3')
    console.error('msg4')
    const entries = errorBuffer.getEntries()
    expect(entries.length).toBe(3)
    expect(entries[0].message).toBe('msg2')
    expect(entries[2].message).toBe('msg4')
  })

  it('clear removes all entries', () => {
    errorBuffer.install()
    console.error('test')
    expect(errorBuffer.getEntries().length).toBe(1)
    errorBuffer.clear()
    expect(errorBuffer.getEntries()).toEqual([])
  })

  it('getEntries returns a copy', () => {
    errorBuffer.install()
    console.error('test')
    const a = errorBuffer.getEntries()
    const b = errorBuffer.getEntries()
    expect(a).toEqual(b)
    expect(a).not.toBe(b)
  })
})
