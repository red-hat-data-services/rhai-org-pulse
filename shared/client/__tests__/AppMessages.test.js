import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AppMessages from '../components/AppMessages.vue'

describe('AppMessages', () => {
  it('renders nothing when messages array is empty', () => {
    const wrapper = mount(AppMessages, { props: { messages: [] } })
    expect(wrapper.find('div').exists()).toBe(false)
  })

  it('renders one banner per message', () => {
    const messages = [
      { id: '1', type: 'info', text: 'Info message', link: null },
      { id: '2', type: 'warning', text: 'Warning message', link: null }
    ]
    const wrapper = mount(AppMessages, { props: { messages } })
    const banners = wrapper.findAll('[class*="border-l-4"]')
    expect(banners).toHaveLength(2)
  })

  it('applies correct CSS classes for warning type', () => {
    const messages = [{ id: '1', type: 'warning', text: 'warn', link: null }]
    const wrapper = mount(AppMessages, { props: { messages } })
    const banner = wrapper.find('[class*="border-l-4"]')
    expect(banner.classes()).toContain('bg-amber-900')
    expect(banner.classes()).toContain('border-amber-400')
  })

  it('applies correct CSS classes for info type', () => {
    const messages = [{ id: '1', type: 'info', text: 'info', link: null }]
    const wrapper = mount(AppMessages, { props: { messages } })
    const banner = wrapper.find('[class*="border-l-4"]')
    expect(banner.classes()).toContain('bg-blue-900')
    expect(banner.classes()).toContain('border-blue-400')
  })

  it('applies correct CSS classes for error type', () => {
    const messages = [{ id: '1', type: 'error', text: 'err', link: null }]
    const wrapper = mount(AppMessages, { props: { messages } })
    const banner = wrapper.find('[class*="border-l-4"]')
    expect(banner.classes()).toContain('bg-red-900')
    expect(banner.classes()).toContain('border-red-400')
  })

  it('dismiss button emits dismiss event with message ID', async () => {
    const messages = [{ id: 'msg-1', type: 'info', text: 'Hello', link: null }]
    const wrapper = mount(AppMessages, { props: { messages } })
    const dismissBtn = wrapper.find('button[aria-label="Dismiss"]')
    await dismissBtn.trigger('click')
    expect(wrapper.emitted('dismiss')).toBeTruthy()
    expect(wrapper.emitted('dismiss')[0]).toEqual(['msg-1'])
  })

  it('renders link as <a> when present', () => {
    const messages = [{
      id: '1', type: 'info', text: 'msg',
      link: { label: 'Go', href: '#/somewhere' }
    }]
    const wrapper = mount(AppMessages, { props: { messages } })
    const link = wrapper.find('a')
    expect(link.exists()).toBe(true)
    expect(link.text()).toBe('Go')
    expect(link.attributes('href')).toBe('#/somewhere')
  })

  it('does not render link when link is null', () => {
    const messages = [{ id: '1', type: 'info', text: 'msg', link: null }]
    const wrapper = mount(AppMessages, { props: { messages } })
    expect(wrapper.find('a').exists()).toBe(false)
  })

  it('renders correct icon for each type', () => {
    // We verify by checking that the component renders an SVG for each type
    // (lucide icons render as SVGs)
    const types = ['warning', 'info', 'error']
    for (const type of types) {
      const messages = [{ id: '1', type, text: 'msg', link: null }]
      const wrapper = mount(AppMessages, { props: { messages } })
      // Each banner should have at least 2 SVGs: the type icon and the X close icon
      const svgs = wrapper.findAll('svg')
      expect(svgs.length).toBeGreaterThanOrEqual(2)
    }
  })
})
