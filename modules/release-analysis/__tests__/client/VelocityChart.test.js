import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import VelocityChart from '../../client/components/VelocityChart.vue'

describe('VelocityChart', () => {
  it('renders with valid velocity', () => {
    const wrapper = mount(VelocityChart, {
      props: { velocity: 4.5 }
    })
    expect(wrapper.exists()).toBe(true)
  })

  it('renders with component name', () => {
    const wrapper = mount(VelocityChart, {
      props: { velocity: 3.2, componentName: 'Test Component' }
    })
    expect(wrapper.props('componentName')).toBe('Test Component')
  })

  it('handles zero velocity', () => {
    const wrapper = mount(VelocityChart, {
      props: { velocity: 0 }
    })
    expect(wrapper.exists()).toBe(true)
  })

  it('uses default component name when not provided', () => {
    const wrapper = mount(VelocityChart, {
      props: { velocity: 2.5 }
    })
    expect(wrapper.props('componentName')).toBe('Component')
  })
})
