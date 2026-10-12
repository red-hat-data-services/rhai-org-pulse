import { describe, expect, it } from 'vitest'
import { hasJiraId, isVisibleFinding, isVisibleProductBug } from '../../client/utils/product-bugs'

describe('product bug visibility', () => {
  it('shows product bugs only when a Jira ID is present', () => {
    const linked = { category: 'PRODUCT_BUG', bug_key: 'RHOAIENG-123' }
    const unlinked = { category: 'PRODUCT_BUG' }

    expect(hasJiraId(linked)).toBe(true)
    expect(isVisibleProductBug(linked)).toBe(true)
    expect(isVisibleProductBug(unlinked)).toBe(false)
    expect(isVisibleFinding(unlinked)).toBe(false)
  })

  it('treats linked UX defects as stakeholder-visible issues', () => {
    expect(isVisibleProductBug({ category: 'UX_DEFECT', bug_key: 'RHOAIENG-99762' })).toBe(true)
    expect(isVisibleProductBug({ category: 'UX_DEFECT' })).toBe(false)
    expect(isVisibleFinding({ category: 'UX_DEFECT' })).toBe(false)
  })

  it('does not hide non-product findings', () => {
    expect(isVisibleFinding({ category: 'ENVIRONMENT' })).toBe(true)
  })
})
