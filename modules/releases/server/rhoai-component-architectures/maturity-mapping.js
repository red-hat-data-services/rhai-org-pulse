'use strict'

const MATURITY_URL = 'https://gitlab.cee.redhat.com/api/v4/projects/data-hub%2Fcomponent-maturity/jobs/artifacts/main/raw/artifacts/maturity-report.json?job=maturity-evaluation'

let _fetch = globalThis.fetch

function _setFetch(fn) {
  _fetch = fn
}

async function fetchMaturityMapping(token) {
  const response = await _fetch(MATURITY_URL, {
    headers: { 'Authorization': `Bearer ${token}` },
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('GitLab API authentication failed (401). Check your GITLAB_CEE_TOKEN.')
    }
    if (response.status === 404) {
      throw new Error('Maturity report artifact not found (404). The CI job may not have run recently.')
    }
    throw new Error(`GitLab API returned ${response.status}`)
  }

  const data = await response.json()

  if (!Array.isArray(data.components)) {
    throw new Error('Unexpected maturity report format: missing components array')
  }

  const mapping = {}
  const componentInfo = new Map()

  for (const component of data.components) {
    if (!component.name) continue
    if (!componentInfo.has(component.name)) {
      componentInfo.set(component.name, {
        name: component.name,
        owner: component.owner || null,
        team: component.team || null
      })
    }

    if (!Array.isArray(component.deliverables)) continue
    for (const deliverable of component.deliverables) {
      if (!Array.isArray(deliverable.images)) continue
      for (const image of deliverable.images) {
        if (typeof image !== 'string') continue
        const shortName = image.split('/').pop()
        if (shortName) {
          mapping[shortName] = component.name
        }
      }
    }
  }

  const allProductComponents = [...componentInfo.values()].sort((a, b) => a.name.localeCompare(b.name))

  return { mapping, allProductComponents }
}

function applyMaturityMapping(branchData, mapping) {
  if (!branchData || !Array.isArray(branchData.components)) return branchData
  for (const comp of branchData.components) {
    comp.productComponent = (comp.imageName && mapping[comp.imageName]) || null
  }
  return branchData
}

module.exports = {
  fetchMaturityMapping,
  applyMaturityMapping,
  _setFetch,
  MATURITY_URL
}
