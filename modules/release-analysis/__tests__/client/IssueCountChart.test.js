import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import IssueCountChart from '../../client/components/IssueCountChart.vue'

describe('IssueCountChart', () => {
  it('renders with valid counts', () => {
    const counts = { done: 10, doing: 5, to_do: 3 }
    const wrapper = mount(IssueCountChart, {
      props: { counts }
    })
    expect(wrapper.exists()).toBe(true)
  })

  it('handles zero counts', () => {
    const counts = { done: 0, doing: 0, to_do: 0 }
    const wrapper = mount(IssueCountChart, {
      props: { counts }
    })
    expect(wrapper.exists()).toBe(true)
  })

  it('validates required props', () => {
    const counts = { done: 5, doing: 2, to_do: 1 }
    const wrapper = mount(IssueCountChart, {
      props: { counts }
    })
    expect(wrapper.props('counts')).toEqual(counts)
  })
})
