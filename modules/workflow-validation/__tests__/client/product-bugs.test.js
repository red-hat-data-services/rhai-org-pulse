import { describe, expect, it } from 'vitest'
import { hasJiraId, isHiddenIssueCategory, isVisibleFinding, isVisibleJiraIssue } from '../../client/utils/product-bugs'

describe('issue visibility', () => {
  it('shows Jira-linked issues of current and future categories', () => {
    const linked = { category: 'PRODUCT_BUG', bug_key: 'RHOAIENG-123' }
    const unlinked = { category: 'PRODUCT_BUG' }

    expect(hasJiraId(linked)).toBe(true)
    expect(isVisibleJiraIssue(linked)).toBe(true)
    expect(isVisibleJiraIssue(unlinked)).toBe(false)
    expect(isVisibleJiraIssue({ category: 'RFE', bug_key: 'RHAIRFE-123' })).toBe(true)
    expect(isVisibleJiraIssue({ category: 'FUTURE_CATEGORY', bug_key: 'RHOAIENG-234' })).toBe(true)
    expect(isVisibleFinding(unlinked)).toBe(true)
  })

  it('hides environment and credential exposure findings', () => {
    for (const category of ['ENVIRONMENT', 'CREDENTIAL_EXPOSURE']) {
      const finding = { category, bug_key: 'RHOAIENG-456' }
      expect(isHiddenIssueCategory(category)).toBe(true)
      expect(isVisibleJiraIssue(finding)).toBe(false)
      expect(isVisibleFinding(finding)).toBe(false)
    }
  })

  it('retains non-Jira diagnostic findings in other categories', () => {
    expect(isVisibleFinding({ category: 'AUTOMATION_BUG' })).toBe(true)
    expect(isVisibleJiraIssue({ category: 'AUTOMATION_BUG' })).toBe(false)
  })
})
