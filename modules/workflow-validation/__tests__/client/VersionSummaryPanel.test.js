import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import VersionSummaryPanel from '../../client/components/VersionSummaryPanel.vue'

const props = {
  summary: { suiteRuns: 1, workflows: 10, tasks: 29, passed: 19, failed: 4, skipped: 6, bugs: 3 }
}

describe('Version summary panel', () => {
  it('groups the task total with its three counts and keeps run and workflow counts separate', () => {
    const wrapper = mount(VersionSummaryPanel, { props })
    expect(wrapper.get('[data-testid="summary-tasks"]').text()).toBe('Total tasks 29')
    expect(wrapper.get('[aria-label="Task outcomes"]').findAll('dd').map(count => count.text())).toEqual(['19', '4', '6'])
    expect(wrapper.get('[data-testid="summary-suiteRuns"] dd').text()).toBe('1')
    expect(wrapper.get('[data-testid="summary-workflows"] dd').text()).toBe('10')
    expect(wrapper.get('[role="img"]').attributes('aria-label')).toBe('19 passed, 4 failed, 6 skipped tasks')
    expect(wrapper.text()).toContain('66% passed')
    wrapper.unmount()
  })

  it('links the verified bug count to Jira and explains partial counts on hover', () => {
    const bugUrl = 'https://jira.example.test/issues/?jql=key+IN+%28TEST-1%2C+TEST-2%2C+TEST-3%29'
    const wrapper = mount(VersionSummaryPanel, { props: { summary: { ...props.summary, bugUrl, bugsIncomplete: true } } })
    const bugs = wrapper.get('[data-testid="summary-bugs"]')
    expect(bugs.get('a').attributes()).toMatchObject({ href: bugUrl, target: '_blank', rel: 'noopener noreferrer' })
    expect(bugs.get('a').text()).toBe('3')
    expect(bugs.findAll('dd')).toHaveLength(1)
    expect(bugs.get('dd').attributes('title')).toBe('Some Jira issue references could not be verified.')
    wrapper.unmount()
  })

  it('renders the count without a link for unsafe URLs', () => {
    const wrapper = mount(VersionSummaryPanel, { props: { summary: { ...props.summary, bugUrl: 'javascript:alert(1)' } } })
    expect(wrapper.get('[data-testid="summary-bugs"] dd').text()).toBe('3')
    expect(wrapper.find('a').exists()).toBe(false)
    wrapper.unmount()
  })

  it('offers the full Jira query next to a short Jira link when the query is too long', () => {
    const bugJql = 'key IN (TEST-1, TEST-2, TEST-3)'
    const wrapper = mount(VersionSummaryPanel, { props: { summary: { ...props.summary, bugJql, bugUrl: 'https://jira.example.test/issues/' } } })
    expect(wrapper.get('[data-testid="summary-bugs"] a').text()).toBe('3')
    expect(wrapper.get('details textarea').element.value).toBe(bugJql)
    expect(wrapper.get('details textarea').element.readOnly).toBe(true)
    wrapper.unmount()
  })

  it('shows an empty summary without invalid percentages', () => {
    const wrapper = mount(VersionSummaryPanel, { props: { ...props,
      summary: { suiteRuns: 0, workflows: 0, tasks: 0, passed: 0, failed: 0, skipped: 0, bugs: 0 }
    } })
    expect(wrapper.text()).toContain('No tasks recorded')
    expect(wrapper.html()).not.toMatch(/NaN|Infinity/)
    expect(wrapper.get('[data-testid="summary-tasks"] dd').text()).toBe('0')
    expect(wrapper.get('[aria-label="Task outcomes"]').findAll('dd').map(count => count.text())).toEqual(['0', '0', '0'])
    expect(wrapper.find('[role="img"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows missing counters and bug totals as unavailable without a partial outcome chart', () => {
    const wrapper = mount(VersionSummaryPanel, { props: { ...props,
      summary: { ...props.summary, skipped: null, bugs: null }
    } })
    expect(wrapper.get('[data-testid="summary-skipped"] dd').text()).toContain('Count unavailable')
    expect(wrapper.get('[data-testid="summary-bugs"]').text()).toContain('Count unavailable')
    expect(wrapper.text()).toContain('Some task counts are unavailable.')
    expect(wrapper.find('[role="img"]').exists()).toBe(false)
    expect(wrapper.text()).not.toMatch(/NaN|Infinity|% passed/)
    wrapper.unmount()
  })

  it('retains the source totals and flags a breakdown that does not add up', () => {
    const wrapper = mount(VersionSummaryPanel, { props: { summary: { ...props.summary, tasks: 30 } } })
    expect(wrapper.get('[data-testid="summary-tasks"] dd').text()).toBe('30')
    expect(wrapper.get('[aria-label="Task outcomes"]').findAll('dd').map(count => count.text())).toEqual(['19', '4', '6'])
    expect(wrapper.text()).toContain('Task outcomes do not add up to Total tasks.')
    expect(wrapper.find('[role="img"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it.each([[999, '>99%'], [1, '<1%'], [1000, '100%'], [0, '0%']])('shows %i of 1000 accurately as %s', (passed, rate) => {
    const wrapper = mount(VersionSummaryPanel, { props: { summary: { ...props.summary, tasks: 1000, passed, failed: 1000 - passed, skipped: 0 } } })
    expect(wrapper.text()).toContain(`${rate} passed`)
    wrapper.unmount()
  })
})
