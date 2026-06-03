export function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

export function envBadgeClass(env) {
  if (env === 'production') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
  if (env === 'stage') return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
  return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
}

export const ARCH_COLORS = {
  x86_64: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  aarch64: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  ppc64le: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  s390x: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
}

export function archBadgeClass(arch) {
  return ARCH_COLORS[arch?.toLowerCase()] || 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
}

export function konfluxStateBadgeClass(state) {
  const s = (state || '').toLowerCase()
  if (s === 'succeeded') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
  if (s === 'failed') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  if (s === 'running') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
  if (s === 'pending') return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
  return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
}

export const TEST_STATUS_MAP = {
  testpassed: { label: 'Passed', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  testfail: { label: 'Failed', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  inprogress: { label: 'Running', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  pending: { label: 'Pending', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
}

export function testStatusBadgeClass(status) {
  return TEST_STATUS_MAP[status?.toLowerCase()]?.cls || 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
}

export function testStatusLabel(status) {
  return TEST_STATUS_MAP[status?.toLowerCase()]?.label || status
}

export function formatDuration(start, end) {
  const ms = new Date(end) - new Date(start)
  if (ms < 0) return null
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export function getCommitUrl(artifact) {
  const commit = artifact?.commit || artifact?.labels?.['git.commit'] || artifact?.labels?.['org.opencontainers.image.revision'] || artifact?.labels?.['vcs-ref']
  if (!commit) return null

  let repoUrl = null
  if (artifact.git_repository) {
    repoUrl = typeof artifact.git_repository === 'string' ? artifact.git_repository : artifact.git_repository?.url
  }
  if (!repoUrl) {
    const labels = artifact.labels || {}
    repoUrl = labels['git.url'] || labels['org.opencontainers.image.source'] || labels['url'] || null
  }
  if (!repoUrl || typeof repoUrl !== 'string') return null

  const baseUrl = repoUrl.replace(/\.git$/, '').replace(/\/$/, '')
  return `${baseUrl}/-/commit/${commit}`
}

export function getAcceleratorInfo(art) {
  const labels = art?.labels || {}
  let accel = art?.variant ? art.variant.split('-')[0] : null
  let runtime = null
  if (accel) {
    runtime = labels[`com.redhat.aiplatform.${accel}_version`] || null
  }
  return {
    accel,
    runtime,
    python: labels['com.redhat.aiplatform.python'] || null,
    baseImage: labels['com.redhat.aiplatform.image'] || null
  }
}
