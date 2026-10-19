import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductBugStatus from '../../client/components/ProductBugStatus.vue'

describe('ProductBugStatus', () => {
  it.each(['PASS', 'SKIP', 'FAIL', 'ERROR'])('shows a neutral dash for %s without a recorded product or UX issue', (verdict) => {
    const wrapper = mount(ProductBugStatus, { props: { verdict, findings: [] } })
    const indicator = wrapper.get('[role="img"]')

    expect(wrapper.text()).toBe('—')
    expect(indicator.attributes('aria-label')).toBe('No product or UX issue recorded.')
    expect(indicator.attributes('tabindex')).toBe('0')
    expect(indicator.attributes('title')).toBe(['FAIL', 'ERROR'].includes(verdict)
      ? 'The test failed or was terminated due to a problem in the test execution environment. No product bug or UX defect was observed.'
      : 'No product or UX issue recorded.')
    wrapper.unmount()
  })

  it.each([
    ['PRODUCT_BUG', 'FILED', 'New product bug opened.'],
    ['PRODUCT_BUG', 'EXISTING', 'Pre-existing product bug detected.'],
    ['UX_DEFECT', 'FILED', 'New UX defect opened.'],
    ['UX_DEFECT', 'EXISTING', 'Pre-existing UX defect detected.'],
  ])('keeps the Jira link and explanation for a %s with action %s', (category, action, description) => {
    const wrapper = mount(ProductBugStatus, { props: {
      verdict: 'FAIL', findings: [{
        id: 'bug-1', category, action, bug_key: 'RHOAIENG-123',
        jira_url: 'https://redhat.atlassian.net/browse/RHOAIENG-123',
      }],
    } })

    const link = wrapper.get('a')
    expect(link.text()).toBe('RHOAIENG-123')
    expect(link.attributes('href')).toBe('https://redhat.atlassian.net/browse/RHOAIENG-123')
    expect(wrapper.text()).toContain(description)
    expect(wrapper.find('[role="img"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
