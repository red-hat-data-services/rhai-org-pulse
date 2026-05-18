import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import IssueList from '../../../client/components/allocation/IssueList.vue'

describe('IssueList', () => {
  const mockIssues = [
    { key: 'RHOAIENG-123', summary: 'Fix login bug that prevents users from accessing dashboard', url: 'https://issues.redhat.com/browse/RHOAIENG-123', storyPoints: 5, status: 'In Progress', completed: false },
    { key: 'RHOAIENG-456', summary: 'Add unit tests for auth module', url: 'https://issues.redhat.com/browse/RHOAIENG-456', storyPoints: 3, status: 'Done', completed: true },
    { key: 'RHOAIENG-789', summary: 'Unestimated task without story points', url: 'https://issues.redhat.com/browse/RHOAIENG-789', storyPoints: null, status: 'To Do', completed: false }
  ]

  describe('expandable mode (default)', () => {
    it('is collapsed by default', () => {
      const wrapper = mount(IssueList, { props: { issues: mockIssues } })
      const toggle = wrapper.find('[data-testid="toggle-button"]')
      expect(toggle.exists()).toBe(true)
      expect(toggle.text()).toContain('Show 3 issues')
      const rows = wrapper.findAll('[data-testid="issue-row"]')
      expect(rows.length).toBe(0)
    })

    it('expands when toggle button is clicked', async () => {
      const wrapper = mount(IssueList, { props: { issues: mockIssues } })
      await wrapper.find('[data-testid="toggle-button"]').trigger('click')
      const rows = wrapper.findAll('[data-testid="issue-row"]')
      expect(rows.length).toBe(3)
      const toggle = wrapper.find('[data-testid="toggle-button"]')
      expect(toggle.text()).toContain('Hide issues')
    })

    it('collapses when toggle is clicked again', async () => {
      const wrapper = mount(IssueList, { props: { issues: mockIssues } })
      await wrapper.find('[data-testid="toggle-button"]').trigger('click')
      await wrapper.find('[data-testid="toggle-button"]').trigger('click')
      const rows = wrapper.findAll('[data-testid="issue-row"]')
      expect(rows.length).toBe(0)
    })
  })

  describe('non-expandable mode', () => {
    it('shows all issues immediately when expandable=false', () => {
      const wrapper = mount(IssueList, { props: { issues: mockIssues, expandable: false } })
      const rows = wrapper.findAll('[data-testid="issue-row"]')
      expect(rows.length).toBe(3)
      const toggle = wrapper.find('[data-testid="toggle-button"]')
      expect(toggle.exists()).toBe(false)
    })
  })

  describe('issue row rendering', () => {
    it('shows completed checkmark for completed issues', async () => {
      const wrapper = mount(IssueList, { props: { issues: mockIssues, expandable: false } })
      const rows = wrapper.findAll('[data-testid="issue-row"]')
      const completedRow = rows[1]
      expect(completedRow.find('[data-testid="completed-check"]').exists()).toBe(true)
      const incompleteRow = rows[0]
      expect(incompleteRow.find('[data-testid="completed-check"]').exists()).toBe(false)
    })

    it('renders issue key as a link to Jira', async () => {
      const wrapper = mount(IssueList, { props: { issues: mockIssues, expandable: false } })
      const link = wrapper.find('a[href="https://issues.redhat.com/browse/RHOAIENG-123"]')
      expect(link.exists()).toBe(true)
      expect(link.text()).toBe('RHOAIENG-123')
      expect(link.attributes('target')).toBe('_blank')
    })

    it('shows issue summary', async () => {
      const wrapper = mount(IssueList, { props: { issues: mockIssues, expandable: false } })
      expect(wrapper.text()).toContain('Fix login bug')
    })

    it('shows story points badge', async () => {
      const wrapper = mount(IssueList, { props: { issues: mockIssues, expandable: false } })
      const rows = wrapper.findAll('[data-testid="issue-row"]')
      const pointsBadge = rows[0].find('[data-testid="points-badge"]')
      expect(pointsBadge.exists()).toBe(true)
      expect(pointsBadge.text()).toBe('5')
    })

    it('shows amber highlight for unestimated issues', async () => {
      const wrapper = mount(IssueList, { props: { issues: mockIssues, expandable: false } })
      const rows = wrapper.findAll('[data-testid="issue-row"]')
      const unestimatedRow = rows[2]
      expect(unestimatedRow.classes()).toContain('bg-amber-50')
      const pointsBadge = unestimatedRow.find('[data-testid="points-badge"]')
      expect(pointsBadge.text()).toBe('\u2014')
    })

    it('shows issue status', async () => {
      const wrapper = mount(IssueList, { props: { issues: mockIssues, expandable: false } })
      expect(wrapper.text()).toContain('In Progress')
      expect(wrapper.text()).toContain('Done')
      expect(wrapper.text()).toContain('To Do')
    })
  })

  it('handles empty issues array', () => {
    const wrapper = mount(IssueList, { props: { issues: [] } })
    const toggle = wrapper.find('[data-testid="toggle-button"]')
    expect(toggle.exists()).toBe(true)
    expect(toggle.text()).toContain('Show 0 issues')
  })
})
