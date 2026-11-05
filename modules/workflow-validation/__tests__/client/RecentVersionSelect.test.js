import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RecentVersionSelect from '../../client/components/RecentVersionSelect.vue'
describe('Recent Runs version selector', () => {
  it('shows sorted unique choices, selects several, and clears to All versions', async () => {
    const wrapper = mount(RecentVersionSelect, { props: { options: ['3.6.0-ea.1', '3.5.2', '3.6.0', '3.6.0 EA1', '3.6'], modelValue: [] } })
    await wrapper.get('button').trigger('click')
    expect(wrapper.findAll('label').slice(1).map(label => label.text())).toEqual(['All versions', '3.6.0', '3.6.0-ea.1', '3.6 (release unspecified)', '3.5.2'])
    const inputs = wrapper.findAll('input')
    await inputs[1].setValue(true)
    await wrapper.setProps({ modelValue: wrapper.emitted('update:modelValue').at(-1)[0] })
    await inputs[4].setValue(true)
    expect(wrapper.emitted('update:modelValue').at(-1)[0]).toEqual(['3.6.0', '3.5.2'])
    await wrapper.setProps({ modelValue: ['3.6.0', '3.5.2'] })
    await inputs[0].setValue(true)
    expect(wrapper.emitted('update:modelValue').at(-1)[0]).toEqual([])
    wrapper.unmount()
  })
  it('opens with ArrowDown and closes with Escape or outside focus', async () => {
    const wrapper = mount(RecentVersionSelect, { attachTo: document.body, props: { options: ['3.6.0'] } })
    await wrapper.get('button').trigger('keydown.down')
    expect(document.activeElement).toBe(wrapper.get('input').element)
    await wrapper.get('input').trigger('keydown.esc')
    expect(wrapper.get('button').attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(wrapper.get('button').element)
    await wrapper.get('button').trigger('click')
    document.body.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('input').exists()).toBe(false)
    wrapper.unmount()
  })
})
