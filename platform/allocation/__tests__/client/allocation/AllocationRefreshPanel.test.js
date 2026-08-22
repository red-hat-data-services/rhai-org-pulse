import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AllocationRefreshPanel from '../../../client/allocation/AllocationRefreshPanel.vue'

describe('AllocationRefreshPanel', () => {
  it('renders title and description', () => {
    const wrapper = mount(AllocationRefreshPanel, {
      props: { title: 'Never synced', description: 'Pull it in.' }
    })
    expect(wrapper.text()).toContain('Never synced')
    expect(wrapper.text()).toContain('Pull it in.')
  })

  it('shows the refresh button when canRefresh is true and emits on click', async () => {
    const wrapper = mount(AllocationRefreshPanel, {
      props: { title: 'x', canRefresh: true, buttonLabel: 'Refresh this team\'s data' }
    })
    const btn = wrapper.get('[data-testid="allocation-refresh-button"]')
    expect(btn.text()).toContain("Refresh this team's data")
    await btn.trigger('click')
    expect(wrapper.emitted('refresh')).toBeTruthy()
  })

  it('shows a spinner and "Refreshing…" while refreshing', () => {
    const wrapper = mount(AllocationRefreshPanel, {
      props: { title: 'x', canRefresh: true, refreshing: true }
    })
    const btn = wrapper.get('[data-testid="allocation-refresh-button"]')
    expect(btn.text()).toContain('Refreshing…')
    expect(btn.attributes('disabled')).toBeDefined()
    expect(wrapper.find('svg.animate-spin').exists()).toBe(true)
  })

  it('hides the button and shows the hint when canRefresh is false', () => {
    const wrapper = mount(AllocationRefreshPanel, {
      props: { title: 'x', canRefresh: false, hint: 'Ask an admin.' }
    })
    expect(wrapper.find('[data-testid="allocation-refresh-button"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Ask an admin.')
  })

  it('renders a formatted last-synced timestamp when provided', () => {
    const wrapper = mount(AllocationRefreshPanel, {
      props: { title: 'x', lastUpdated: '2026-08-14T15:15:38.649Z' }
    })
    expect(wrapper.text()).toContain('Last synced')
  })

  it('surfaces the status message', () => {
    const wrapper = mount(AllocationRefreshPanel, {
      props: { title: 'x', canRefresh: true, message: 'Fetching from Jira…' }
    })
    expect(wrapper.get('[data-testid="allocation-refresh-message"]').text()).toBe('Fetching from Jira…')
  })
})
