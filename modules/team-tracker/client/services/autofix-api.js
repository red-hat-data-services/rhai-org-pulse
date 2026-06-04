import { cachedRequest } from '@shared/client/services/api.js'

export function fetchAutofixData(onData) {
  /* eslint-disable-next-line org-pulse/no-cross-module-imports -- approved cross-module API call; guarded by enabledBuiltInSlugs check */
  return cachedRequest('autofix-data', '/modules/ai-impact/autofix-data', onData)
}
