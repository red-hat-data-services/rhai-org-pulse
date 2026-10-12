export function hasJiraId(finding = {}) {
  return Boolean(String(finding.bug_key || '').trim())
}

export function isProductIssueCategory(category) {
  return ['PRODUCT_BUG', 'UX_DEFECT'].includes(String(category || '').toUpperCase())
}

export function isVisibleProductBug(finding = {}) {
  return isProductIssueCategory(finding.category) && hasJiraId(finding)
}

export function isVisibleFinding(finding = {}) {
  return !isProductIssueCategory(finding.category) || hasJiraId(finding)
}
