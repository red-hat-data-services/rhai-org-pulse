import { describe, it, expect } from 'vitest'

const { validatePillarConfig, DEFAULT_PILLAR_CONFIG } = require('../../../server/pm-hub/routes')

describe('validatePillarConfig', function () {
  it('accepts valid config', function () {
    expect(validatePillarConfig({
      pillars: [
        { name: 'Inference', components: ['llm-d', 'vllm'] },
        { name: 'Data', components: ['SDG'] }
      ]
    })).toBe(null)
  })

  it('accepts empty pillars array', function () {
    expect(validatePillarConfig({ pillars: [] })).toBe(null)
  })

  it('rejects missing pillars field', function () {
    expect(validatePillarConfig({})).toMatch(/pillars must be an array/)
  })

  it('rejects null input', function () {
    expect(validatePillarConfig(null)).toMatch(/pillars must be an array/)
  })

  it('rejects pillar without name', function () {
    expect(validatePillarConfig({
      pillars: [{ components: ['a'] }]
    })).toMatch(/must have a name/)
  })

  it('rejects pillar with empty name', function () {
    expect(validatePillarConfig({
      pillars: [{ name: '', components: [] }]
    })).toMatch(/must have a name/)
  })

  it('rejects pillar without components array', function () {
    expect(validatePillarConfig({
      pillars: [{ name: 'Test', components: 'not-array' }]
    })).toMatch(/must have a components array/)
  })

  it('rejects non-string/non-object component entries', function () {
    expect(validatePillarConfig({
      pillars: [{ name: 'Test', components: [123] }]
    })).toMatch(/must be strings or objects/)
  })

  it('accepts object components with name, pmLead, engLead', function () {
    expect(validatePillarConfig({
      pillars: [{ name: 'Test', components: [
        { name: 'Comp A', pmLead: 'Alice', engLead: 'Bob' },
        { name: 'Comp B', pmLead: '', engLead: '' }
      ] }]
    })).toBe(null)
  })

  it('accepts mixed string and object components', function () {
    expect(validatePillarConfig({
      pillars: [{ name: 'Test', components: ['plain-string', { name: 'Obj Comp', pmLead: 'X', engLead: 'Y' }] }]
    })).toBe(null)
  })

  it('rejects object component without name', function () {
    expect(validatePillarConfig({
      pillars: [{ name: 'Test', components: [{ pmLead: 'Alice' }] }]
    })).toMatch(/must be strings or objects/)
  })
})

describe('DEFAULT_PILLAR_CONFIG', function () {
  it('has four pillars', function () {
    expect(DEFAULT_PILLAR_CONFIG.pillars).toHaveLength(4)
  })

  it('includes Inference, Data, Agents, Platform', function () {
    var names = DEFAULT_PILLAR_CONFIG.pillars.map(function (p) { return p.name })
    expect(names).toEqual(['Inference', 'Data', 'Agents', 'Platform'])
  })

  it('each pillar has at least one component', function () {
    for (var i = 0; i < DEFAULT_PILLAR_CONFIG.pillars.length; i++) {
      expect(DEFAULT_PILLAR_CONFIG.pillars[i].components.length).toBeGreaterThan(0)
    }
  })

  it('components have name, pmLead, and engLead fields', function () {
    var first = DEFAULT_PILLAR_CONFIG.pillars[0].components[0]
    expect(first).toHaveProperty('name')
    expect(first).toHaveProperty('pmLead')
    expect(first).toHaveProperty('engLead')
  })

  it('passes its own validation', function () {
    expect(validatePillarConfig(DEFAULT_PILLAR_CONFIG)).toBe(null)
  })
})
