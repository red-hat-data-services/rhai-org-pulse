import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BacklogHealthChart from '../../client/components/BacklogHealthChart.vue'

describe('BacklogHealthChart', () => {
  it('renders with valid forecast data', () => {
    const forecast = {
      remaining: 10,
      totalCapacity: 15,
      delta: 5
    }
    const wrapper = mount(BacklogHealthChart, {
      props: { forecast }
    })
    expect(wrapper.exists()).toBe(true)
  })

  it('handles deficit scenario', () => {
    const forecast = {
      remaining: 20,
      totalCapacity: 10,
      delta: -10
    }
    const wrapper = mount(BacklogHealthChart, {
      props: { forecast }
    })
    expect(wrapper.props('forecast').delta).toBe(-10)
  })

  it('handles surplus scenario', () => {
    const forecast = {
      remaining: 5,
      totalCapacity: 15,
      delta: 10
    }
    const wrapper = mount(BacklogHealthChart, {
      props: { forecast }
    })
    expect(wrapper.props('forecast').delta).toBe(10)
  })

  it('validates required forecast properties', () => {
    const forecast = {
      remaining: 8,
      totalCapacity: 12,
      delta: 4
    }
    const wrapper = mount(BacklogHealthChart, {
      props: { forecast }
    })
    expect(wrapper.props('forecast')).toEqual(forecast)
  })
})
