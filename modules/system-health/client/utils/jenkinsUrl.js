/**
 * Jenkins base URL helpers for Test Execution.
 *
 * Ingested data may still carry the legacy CSB host; rewrite to the current
 * Jenkins when rendering links so operators land on a working URL.
 */

export const JENKINS_BASE_URL = 'https://jenkins.rh-ods.com'

export const LEGACY_JENKINS_BASE_URLS = [
  'https://jenkins-csb-rhods-opendatascience.dno.corp.redhat.com'
]

/** Rewrite a legacy Jenkins host to https://jenkins.rh-ods.com (path preserved). */
export function rewriteJenkinsUrl(url) {
  if (!url || typeof url !== 'string') return url
  for (const legacy of LEGACY_JENKINS_BASE_URLS) {
    if (url.startsWith(legacy)) {
      return JENKINS_BASE_URL + url.slice(legacy.length)
    }
  }
  return url
}

/** Shorten a Jenkins build URL into a readable job/path label (host-agnostic). */
export function jenkinsLabel(url) {
  if (!url) return 'Run'
  return String(url)
    .replace(/^https?:\/\/[^/]+\/job\//, '')
    .replace(/\/$/, '')
    .replace(/\/job\//g, '/')
}

/**
 * Deep-link a Jenkins build to its testReport page.
 * Rewrites legacy hosts first, then appends testReport[/suite]/.
 */
export function testReportUrl(url, suite) {
  if (!url) return url
  const rewritten = rewriteJenkinsUrl(url)
  const base = rewritten.endsWith('/') ? rewritten : `${rewritten}/`
  if (!suite) return `${base}testReport/`
  return `${base}testReport/${encodeURIComponent(suite)}/`
}
