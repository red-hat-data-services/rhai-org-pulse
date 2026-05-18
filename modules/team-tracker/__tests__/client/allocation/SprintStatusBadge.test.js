import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SprintStatusBadge from '../../../client/components/allocation/SprintStatusBadge.vue'

describe('SprintStatusBadge', () => {
  it('renders green badge for active state', () => {
    const wrapper = mount(SprintStatusBadge, { props: { state: 'active' } })
    const badge = wrapper.find('span')
    expect(badge.classes()).toEqual(expect.arrayContaining([expect.stringContaining('green')]))
  })

  it('renders gray badge for closed state', () => {
    const wrapper = mount(SprintStatusBadge, { props: { state: 'closed' } })
    const badge = wrapper.find('span')
    expect(badge.classes()).toEqual(expect.arrayContaining([expect.stringContaining('gray')]))
  })

  it('renders blue badge for future state', () => {
    const wrapper = mount(SprintStatusBadge, { props: { state: 'future' } })
    const badge = wrapper.find('span')
    expect(badge.classes()).toEqual(expect.arrayContaining([expect.stringContaining('blue')]))
  })

  it('displays state text capitalized', () => {
    const wrapper = mount(SprintStatusBadge, { props: { state: 'active' } })
    expect(wrapper.text()).toBe('Active')
  })

  it('capitalizes closed state text', () => {
    const wrapper = mount(SprintStatusBadge, { props: { state: 'closed' } })
    expect(wrapper.text()).toBe('Closed')
  })

  it('capitalizes future state text', () => {
    const wrapper = mount(SprintStatusBadge, { props: { state: 'future' } })
    expect(wrapper.text()).toBe('Future')
  })
})
