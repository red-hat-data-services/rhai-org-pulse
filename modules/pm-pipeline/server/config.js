const DEFAULT_RELEASE = '3.5'
const CACHE_TTL_MS = 15 * 60 * 1000

const RELEASE_FIX_VERSIONS = {
  '3.5': [
    '3.5 GA RHOAI RELEASE',
    '3.5 GA RHAII RELEASE',
    '3.5 GA RHELAI RELEASE'
  ],
  '3.6': [
    '3.6 GA RHOAI RELEASE',
    '3.6 GA RHAII RELEASE',
    '3.6 GA RHELAI RELEASE'
  ]
}

const SCOPE_LABELS = {
  '3.5': 'strat-creator-3.5',
  '3.6': 'strat-creator-3.6'
}

function getReleaseConfig(release) {
  const key = String(release || DEFAULT_RELEASE)
  return {
    release: key,
    fixVersions: RELEASE_FIX_VERSIONS[key] || RELEASE_FIX_VERSIONS['3.5'],
    scopeLabel: SCOPE_LABELS[key] || SCOPE_LABELS['3.5']
  }
}

module.exports = {
  DEFAULT_RELEASE,
  CACHE_TTL_MS,
  getReleaseConfig
}
