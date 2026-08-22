import { apiRequest } from '@shared/client/services/api.js'

const MODULE_PREFIX = '/modules/pm-pipeline'

export async function fetchPipeline(pmDisplayName, release) {
  const params = new URLSearchParams({ pm: pmDisplayName, release })
  return apiRequest(`${MODULE_PREFIX}/pipeline?${params}`)
}

export async function fetchResources() {
  return apiRequest(`${MODULE_PREFIX}/resources`)
}

export async function fetchPmRoster() {
  return apiRequest(`${MODULE_PREFIX}/pm-roster`)
}
