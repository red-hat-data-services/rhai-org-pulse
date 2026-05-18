import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UnestimatedPanel from '../../../client/components/allocation/UnestimatedPanel.vue'
import IssueList from '../../../client/components/allocation/IssueList.vue'

describe('UnestimatedPanel', () => {
  const mockUnestimatedIssues = [
    { key: 'RHOAIENG-200', summary: 'New task without estimate', url: 'https://issues.redhat.com/browse/RHOAIENG-200', storyPoints: null, status: 'To Do', completed: false },
    { key: 'RHOAIENG-201', summary: 'Another unestimated issue', url: 'https://issues.redhat.com/browse/RHOAIENG-201', storyPoints: null, status: 'In Progress', completed: false }
  ]

  it('renders nothing when issues array is empty', () => {
    const wrapper = mount(UnestimatedPanel, { props: { issues: [] } })
    expect(wrapper.html()).toBe('<!--v-if-->')
  })

  it('renders amber warning banner when there are unestimated issues', () => {
    const wrapper = mount(UnestimatedPanel, { props: { issues: mockUnestimatedIssues } })
    const panel = wrapper.find('[data-testid="unestimated-panel"]')
    expect(panel.exists()).toBe(true)
    expect(panel.classes()).toContain('bg-amber-50')
    expect(panel.classes()).toContain('border-amber-200')
  })

  it('shows warning icon', () => {
    const wrapper = mount(UnestimatedPanel, { props: { issues: mockUnestimatedIssues } })
    expect(wrapper.find('[data-testid="warning-icon"]').exists()).toBe(true)
  })

  it('shows count of unestimated issues', () => {
    const wrapper = mount(UnestimatedPanel, { props: { issues: mockUnestimatedIssues } })
    expect(wrapper.text()).toContain('2 unestimated')
  })

  it('contains an expandable IssueList', () => {
    const wrapper = mount(UnestimatedPanel, { props: { issues: mockUnestimatedIssues } })
    const issueList = wrapper.findComponent(IssueList)
    expect(issueList.exists()).toBe(true)
    expect(issueList.props('issues')).toHaveLength(2)
    expect(issueList.props('expandable')).toBe(true)
  })
})
