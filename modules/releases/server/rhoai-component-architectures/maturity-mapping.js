'use strict'

const MATURITY_URL = 'https://gitlab.cee.redhat.com/api/v4/projects/data-hub%2Fcomponent-maturity/jobs/artifacts/main/raw/artifacts/maturity-report.json?job=maturity-evaluation'

let _fetch = globalThis.fetch

function _setFetch(fn) {
  _fetch = fn
}

async function fetchMaturityMapping(token) {
  const options = { signal: AbortSignal.timeout(30000) }
  if (token) {
    options.headers = { 'Authorization': `Bearer ${token}` }
  }
  const response = await _fetch(MATURITY_URL, options)

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

    // Map from the component-level `images` array. This is the authoritative
    // superset: the maturity tool accepts images at the component level even
    // when they are not wired to a specific deliverable (it flags these with a
    // "evaluation-target-not-in-deliverable / accepted at component level"
    // info-level mapping_problem). Reading only `deliverables[].images[]` would
    // miss those component-level-only images (e.g. odh-cli-rhel9 under
    // "AI Core Platform"), leaving their Konflux components unmatched.
    const images = Array.isArray(component.images)
      ? component.images
      : []
    for (const image of images) {
      if (typeof image !== 'string') continue
      const shortName = image.split('/').pop()
      if (shortName) {
        mapping[shortName] = component.name
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
