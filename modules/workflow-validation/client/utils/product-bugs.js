export function hasJiraId(finding = {}) {
  return Boolean(String(finding.bug_key || '').trim())
}

export function isHiddenIssueCategory(category) {
  return ['ENVIRONMENT', 'CREDENTIAL_EXPOSURE'].includes(String(category || '').toUpperCase())
}

export function isVisibleJiraIssue(finding = {}) {
  return !isHiddenIssueCategory(finding.category) && hasJiraId(finding)
}

export function isVisibleFinding(finding = {}) {
  return !isHiddenIssueCategory(finding.category)
}
