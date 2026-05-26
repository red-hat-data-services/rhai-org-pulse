import { describe, it, expect } from 'vitest'

const { loadConfig, saveConfig, getDefaults } = require('../../../server/hygiene/config')

function createMockStorage() {
  var store = {}
  return {
    readFromStorage: function (key) { return store[key] || null },
    writeToStorage: function (key, data) { store[key] = data },
    _store: store
  }
}

// ─── getDefaults ─────────────────────────────────────────────────────

describe('getDefaults', function () {
  it('returns an object with rules, projects, and issueTypes', function () {
    var defaults = getDefaults()
    expect(defaults).toHaveProperty('rules')
    expect(defaults).toHaveProperty('projects')
    expect(defaults).toHaveProperty('issueTypes')
  })

  it('projects defaults to RHAISTRAT and RHOAIENG', function () {
    var defaults = getDefaults()
    expect(defaults.projects).toEqual(['RHAISTRAT', 'RHOAIENG'])
  })

  it('issueTypes defaults to Feature and Initiative', function () {
    var defaults = getDefaults()
    expect(defaults.issueTypes).toEqual(['Feature', 'Initiative'])
  })

  it('rules object has entries for all hygiene rules', function () {
    var defaults = getDefaults()
    var ruleIds = Object.keys(defaults.rules)
    expect(ruleIds.length).toBeGreaterThanOrEqual(12)
    expect(ruleIds).toContain('missing-assignee')
    expect(ruleIds).toContain('missing-rice-score')
  })

  it('returns fresh copies on each call', function () {
    var a = getDefaults()
    var b = getDefaults()
    expect(a).not.toBe(b)
    expect(a.projects).not.toBe(b.projects)
  })
})

// ─── loadConfig ──────────────────────────────────────────────────────

describe('loadConfig', function () {
  it('returns defaults when nothing is stored', function () {
    var storage = createMockStorage()
    var config = loadConfig(storage)
    var defaults = getDefaults()
    expect(config).toEqual(defaults)
  })

  it('returns defaults when stored value is null', function () {
    var storage = createMockStorage()
    storage._store['releases/hygiene-config.json'] = null
    var config = loadConfig(storage)
    expect(config).toEqual(getDefaults())
  })

  it('returns defaults when stored value is not an object', function () {
    var storage = createMockStorage()
    storage._store['releases/hygiene-config.json'] = 'not-an-object'
    var config = loadConfig(storage)
    expect(config).toEqual(getDefaults())
  })

  it('merges stored rules with defaults', function () {
    var storage = createMockStorage()
    storage._store['releases/hygiene-config.json'] = {
      rules: {
        'missing-team': { enabled: false, threshold: 30 }
      }
    }
    var config = loadConfig(storage)

    // Stored override applied
    expect(config.rules['missing-team'].enabled).toBe(false)
    expect(config.rules['missing-team'].threshold).toBe(30)

    // Other rules still have defaults
    expect(config.rules['missing-assignee'].enabled).toBe(true)
  })

  it('preserves stored projects array', function () {
    var storage = createMockStorage()
    storage._store['releases/hygiene-config.json'] = {
      projects: ['MYPROJECT']
    }
    var config = loadConfig(storage)
    expect(config.projects).toEqual(['MYPROJECT'])
  })

  it('preserves stored issueTypes array', function () {
    var storage = createMockStorage()
    storage._store['releases/hygiene-config.json'] = {
      issueTypes: ['Bug']
    }
    var config = loadConfig(storage)
    expect(config.issueTypes).toEqual(['Bug'])
  })

  it('falls back to default projects if stored projects is not an array', function () {
    var storage = createMockStorage()
    storage._store['releases/hygiene-config.json'] = {
      projects: 'not-an-array'
    }
    var config = loadConfig(storage)
    expect(config.projects).toEqual(['RHAISTRAT', 'RHOAIENG'])
  })

  it('falls back to default issueTypes if stored issueTypes is not an array', function () {
    var storage = createMockStorage()
    storage._store['releases/hygiene-config.json'] = {
      issueTypes: null
    }
    var config = loadConfig(storage)
    expect(config.issueTypes).toEqual(['Feature', 'Initiative'])
  })

  it('includes new rules not present in stored config', function () {
    var storage = createMockStorage()
    storage._store['releases/hygiene-config.json'] = {
      rules: {
        'missing-assignee': { enabled: false }
      }
    }
    var config = loadConfig(storage)
    // New rules from defaults should be present
    expect(config.rules).toHaveProperty('missing-team')
    expect(config.rules['missing-team'].enabled).toBe(true)
    // Stored override still applies
    expect(config.rules['missing-assignee'].enabled).toBe(false)
  })
})

// ─── saveConfig ──────────────────────────────────────────────────────

describe('saveConfig', function () {
  it('writes config to the correct storage key', function () {
    var storage = createMockStorage()
    var config = {
      rules: { 'missing-team': { enabled: false } },
      projects: ['TESTPROJ'],
      issueTypes: ['Feature']
    }
    saveConfig(storage, config)
    var stored = storage._store['releases/hygiene-config.json']
    expect(stored).toBeTruthy()
    expect(stored.rules['missing-team'].enabled).toBe(false)
    expect(stored.projects).toEqual(['TESTPROJ'])
    expect(stored.issueTypes).toEqual(['Feature'])
  })

  it('defaults projects if not provided as array', function () {
    var storage = createMockStorage()
    saveConfig(storage, { rules: {} })
    var stored = storage._store['releases/hygiene-config.json']
    expect(stored.projects).toEqual(['RHAISTRAT', 'RHOAIENG'])
    expect(stored.issueTypes).toEqual(['Feature', 'Initiative'])
  })

  it('defaults rules to empty object if not provided', function () {
    var storage = createMockStorage()
    saveConfig(storage, {})
    var stored = storage._store['releases/hygiene-config.json']
    expect(stored.rules).toEqual({})
  })

  it('throws when config is not an object', function () {
    var storage = createMockStorage()
    expect(function () { saveConfig(storage, null) }).toThrow('Config must be an object')
    expect(function () { saveConfig(storage, 'bad') }).toThrow('Config must be an object')
  })

  it('roundtrips with loadConfig', function () {
    var storage = createMockStorage()
    var config = {
      rules: { 'missing-team': { enabled: false } },
      projects: ['MYPROJ'],
      issueTypes: ['Bug', 'Feature']
    }
    saveConfig(storage, config)
    var loaded = loadConfig(storage)
    expect(loaded.projects).toEqual(['MYPROJ'])
    expect(loaded.issueTypes).toEqual(['Bug', 'Feature'])
    expect(loaded.rules['missing-team'].enabled).toBe(false)
    // Defaults are merged in
    expect(loaded.rules['missing-assignee'].enabled).toBe(true)
  })
})
