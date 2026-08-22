/**
 * Shared PM Hub component lead helpers.
 * Source: releases/pm-hub/pillar-config.json (pmLead / engLead per component name).
 */

/**
 * Build a lowercase-name → { pmLead, engLead } map from pillar-config JSON.
 * @param {{ pillars?: Array<{ components?: Array<string|{ name?: string, pmLead?: string, engLead?: string }> }> }} pillarConfig
 * @returns {Record<string, { pmLead: string, engLead: string }>}
 */
export function buildComponentLeadsMap(pillarConfig) {
  var map = {}
  var pillars = (pillarConfig && pillarConfig.pillars) || []
  for (var pi = 0; pi < pillars.length; pi++) {
    var comps = pillars[pi].components || []
    for (var ci = 0; ci < comps.length; ci++) {
      var c = comps[ci]
      if (typeof c === 'object' && c !== null && c.name) {
        map[String(c.name).toLowerCase()] = {
          pmLead: c.pmLead || '',
          engLead: c.engLead || '',
        }
      }
    }
  }
  return map
}

/**
 * Look up leads for a component name (exact lowercase, then substring fuzzy).
 * Mirrors PM Hub ComponentReleaseLoadTable matching.
 * @param {Record<string, { pmLead: string, engLead: string }>} leadsMap
 * @param {string} componentName
 * @returns {{ pmLead: string, engLead: string }|null}
 */
export function getComponentLeads(leadsMap, componentName) {
  if (!leadsMap) return null
  var lower = (componentName || '').toLowerCase()
  if (!lower) return null
  if (leadsMap[lower]) return leadsMap[lower]
  var keys = Object.keys(leadsMap)
  for (var i = 0; i < keys.length; i++) {
    if (lower.includes(keys[i]) || keys[i].includes(lower)) return leadsMap[keys[i]]
  }
  return null
}
