/**
 * Unit tests for PM Hub component lead map / lookup helpers.
 */
import { describe, it, expect } from 'vitest'
import {
  buildComponentLeadsMap,
  getComponentLeads,
} from '../../../client/composables/componentLeads'

var SAMPLE_CONFIG = {
  pillars: [
    {
      name: 'Agents',
      components: [
        { name: 'AgentDev', pmLead: 'Adel Zaalouk', engLead: 'Bill Murdock, Justin Sun' },
        { name: 'AgentOps', pmLead: 'Adel Zaalouk', engLead: 'Roland Huß, Dimitri Saridakis' },
      ],
    },
    {
      name: 'Data',
      components: [
        { name: 'Training', pmLead: 'PM Lead 3', engLead: 'Eng Lead 3' },
        'LegacyStringComponent',
      ],
    },
  ],
}

describe('buildComponentLeadsMap', function () {
  it('maps component names to pmLead / engLead (lowercase keys)', function () {
    var map = buildComponentLeadsMap(SAMPLE_CONFIG)
    expect(map.agentdev).toEqual({
      pmLead: 'Adel Zaalouk',
      engLead: 'Bill Murdock, Justin Sun',
    })
    expect(map.training).toEqual({ pmLead: 'PM Lead 3', engLead: 'Eng Lead 3' })
  })

  it('skips legacy string components and empty configs', function () {
    var map = buildComponentLeadsMap(SAMPLE_CONFIG)
    expect(map.legacystringcomponent).toBeUndefined()
    expect(buildComponentLeadsMap(null)).toEqual({})
    expect(buildComponentLeadsMap({})).toEqual({})
  })
})

describe('getComponentLeads', function () {
  var map = buildComponentLeadsMap(SAMPLE_CONFIG)

  it('matches exact component names case-insensitively', function () {
    expect(getComponentLeads(map, 'AgentDev').pmLead).toBe('Adel Zaalouk')
    expect(getComponentLeads(map, 'agentops').engLead).toContain('Roland')
  })

  it('falls back to substring fuzzy match', function () {
    // "Serving" ↔ "Model Serving" style match
    var withModel = buildComponentLeadsMap({
      pillars: [{
        name: 'Inference',
        components: [{ name: 'Model Serving', pmLead: 'PM S', engLead: 'Eng S' }],
      }],
    })
    expect(getComponentLeads(withModel, 'Serving').pmLead).toBe('PM S')
  })

  it('returns null when no match', function () {
    expect(getComponentLeads(map, 'Unknown Component')).toBeNull()
    expect(getComponentLeads(map, '')).toBeNull()
    expect(getComponentLeads(null, 'AgentDev')).toBeNull()
  })
})
