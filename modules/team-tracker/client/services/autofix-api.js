import { cachedRequest } from '@shared/client/services/api.js'

export function fetchAutofixData(onData, { components } = {}) {
  /* eslint-disable-next-line org-pulse/no-cross-module-imports -- approved cross-module API call; guarded by enabledBuiltInSlugs check */
  let path = '/modules/ai-impact/autofix-data'
  let cacheKey = 'autofix-data'
  if (components && components.length > 0) {
    const sorted = [...components].sort()
    path += '?components=' + encodeURIComponent(sorted.join(','))
    cacheKey = 'autofix-data:' + sorted.join(',')
  }
  return cachedRequest(cacheKey, path, onData)
}
