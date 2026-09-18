export function hasJiraId(finding = {}) {
  return Boolean(String(finding.bug_key || '').trim())
}

export function isVisibleProductBug(finding = {}) {
  return finding.category === 'PRODUCT_BUG' && hasJiraId(finding)
}

export function isVisibleFinding(finding = {}) {
  return finding.category !== 'PRODUCT_BUG' || hasJiraId(finding)
}
