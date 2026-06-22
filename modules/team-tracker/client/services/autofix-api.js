import { apiRequest } from '@shared/client/services/api.js'

export async function fetchAutofixData(onData, { components } = {}) {
  /* eslint-disable-next-line org-pulse/no-cross-module-imports -- approved cross-module API call; guarded by enabledBuiltInSlugs check */
  let path = '/modules/ai-impact/autofix-data'
  if (components && components.length > 0) {
    const sorted = [...components].sort()
    path += '?components=' + encodeURIComponent(sorted.join(','))
  }
  const data = await apiRequest(path)
  if (onData) onData(data)
  return data
}
