import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SprintStatusBadge from '../../client/components/SprintStatusBadge.vue'
import MetricCard from '../../client/components/MetricCard.vue'
import LoadingOverlay from '@shared/client/components/LoadingOverlay.vue'
import MethodologyInfo from '../../client/components/MethodologyInfo.vue'

describe('SprintStatusBadge', () => {
  it('renders active state with green styling', () => {
    const wrapper = mount(SprintStatusBadge, { props: { state: 'active' } })
    expect(wrapper.text()).toBe('Active')
    expect(wrapper.classes()).toContain('bg-green-100')
  })

  it('renders closed state with gray styling', () => {
    const wrapper = mount(SprintStatusBadge, { props: { state: 'closed' } })
    expect(wrapper.text()).toBe('Closed')
    expect(wrapper.classes()).toContain('bg-gray-100')
  })
})

describe('MetricCard', () => {
  it('displays label and value', () => {
    const wrapper = mount(MetricCard, {
      props: { label: 'Velocity', value: 42 }
    })
    expect(wrapper.text()).toContain('Velocity')
    expect(wrapper.text()).toContain('42')
  })

  it('displays -- for null value', () => {
    const wrapper = mount(MetricCard, {
      props: { label: 'Velocity', value: null }
    })
    expect(wrapper.text()).toContain('--')
  })

  it('displays unit', () => {
    const wrapper = mount(MetricCard, {
      props: { label: 'Velocity', value: 42, unit: 'pts' }
    })
    expect(wrapper.text()).toContain('pts')
  })

  it('emits click event when clickable', async () => {
    const wrapper = mount(MetricCard, {
      props: { label: 'Velocity', value: 42, clickable: true }
    })
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('applies green color for good threshold', () => {
    const wrapper = mount(MetricCard, {
      props: {
        label: 'Reliability',
        value: 90,
        colorThresholds: { good: 80, warn: 60 }
      }
    })
    expect(wrapper.find('.text-green-600').exists()).toBe(true)
  })

  it('applies amber color for warn threshold', () => {
    const wrapper = mount(MetricCard, {
      props: {
        label: 'Reliability',
        value: 70,
        colorThresholds: { good: 80, warn: 60 }
      }
    })
    expect(wrapper.find('.text-amber-600').exists()).toBe(true)
  })

  it('applies red color below warn threshold', () => {
    const wrapper = mount(MetricCard, {
      props: {
        label: 'Reliability',
        value: 40,
        colorThresholds: { good: 80, warn: 60 }
      }
    })
    expect(wrapper.find('.text-red-600').exists()).toBe(true)
  })
})

describe('LoadingOverlay', () => {
  it('renders with default message', () => {
    const wrapper = mount(LoadingOverlay)
    expect(wrapper.text()).toContain('Loading...')
  })

  it('renders with custom message', () => {
    const wrapper = mount(LoadingOverlay, { props: { message: 'Refreshing data...' } })
    expect(wrapper.text()).toContain('Refreshing data...')
  })
})

describe('MethodologyInfo', () => {
  it('renders info icon', () => {
    const wrapper = mount(MethodologyInfo, { props: { text: 'Some explanation' } })
    expect(wrapper.find('button').exists()).toBe(true)
    expect(wrapper.find('svg').exists()).toBe(true)
  })

  it('does not show tooltip by default', () => {
    const wrapper = mount(MethodologyInfo, { props: { text: 'Some explanation' } })
    expect(wrapper.text()).not.toContain('Some explanation')
  })

  it('shows tooltip on click', async () => {
    const wrapper = mount(MethodologyInfo, { props: { text: 'Some explanation' } })
    await wrapper.find('button').trigger('click')
    expect(wrapper.text()).toContain('Some explanation')
  })
})
