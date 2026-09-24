import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CveIssueListModal from '../../client/reports/components/CveIssueListModal.vue'
import { applySecurityOwnerDisplayOverride } from '../../client/reports/utils/cve-owner-display.js'

function makeIssue(overrides) {
  return Object.assign({
    key: 'RHAIENG-1001',
    summary: 'CVE issue',
    component: 'Model Serving',
    components: ['Model Serving'],
    versions: ['rhoai-3.5'],
    status: 'New',
    assignee: 'Alice',
    duedate: '2026-09-30'
  }, overrides || {})
}

function mountModal(issues) {
  return mount(CveIssueListModal, {
    props: {
      visible: true,
      title: 'CVEs',
      issues: issues
    },
    global: {
      stubs: { Teleport: true }
    }
  })
}

describe('CveIssueListModal', function() {
  it('replaces the owner display for an issue whose primary component is Security', function() {
    const issue = makeIssue({ component: 'Security', components: ['Security'] })
    const wrapper = mountModal([issue])
    const owner = wrapper.get('[data-testid="cve-owner-RHAIENG-1001"]')
    const component = wrapper.get('[data-testid="cve-component-RHAIENG-1001"]')
    const componentLabel = wrapper.get('[data-testid="cve-component-label-RHAIENG-1001"]')

    expect(owner.text()).toContain('No Owner')
    expect(owner.text()).toContain('(Coming from Security Component)')
    expect(owner.text()).not.toContain('Alice')
    expect(component.text()).toContain('No Owner')
    expect(component.text()).toContain('(Coming from Security Component)')
    expect(componentLabel.text()).toBe('No Owner')
    expect(issue.assignee).toBe('Alice')
    expect(issue.component).toBe('Security')
  })

  it('recognizes Security in the complete component list', function() {
    const issue = makeIssue({ components: ['Model Serving', 'Security'] })
    const wrapper = mountModal([issue])
    const owner = wrapper.get('[data-testid="cve-owner-RHAIENG-1001"]')

    expect(owner.text()).toContain('No Owner')
    expect(owner.text()).toContain('(Coming from Security Component)')
  })

  it('creates a display copy without changing the backend issue record', function() {
    const issue = makeIssue({ component: 'Security', components: ['Security'] })
    const displayedIssue = applySecurityOwnerDisplayOverride(issue)

    expect(displayedIssue.assignee).toBe('No Owner')
    expect(displayedIssue).not.toBe(issue)
    expect(issue.assignee).toBe('Alice')
  })

  it('continues to display the backend assignee for other components', function() {
    const wrapper = mountModal([makeIssue()])
    const owner = wrapper.get('[data-testid="cve-owner-RHAIENG-1001"]')
    const component = wrapper.get('[data-testid="cve-component-RHAIENG-1001"]')

    expect(owner.text()).toBe('Alice')
    expect(owner.text()).not.toContain('Coming from Security Component')
    expect(component.text()).toBe('Model Serving')
  })
})
