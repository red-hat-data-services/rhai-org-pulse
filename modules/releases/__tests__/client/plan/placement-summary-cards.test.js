import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PlacementSummaryCards from '../../../client/plan/components/PlacementSummaryCards.vue'

describe('PlacementSummaryCards', () => {
  it('renders four cards with the given counts when no recommendedCount is passed', () => {
    const wrapper = mount(PlacementSummaryCards, { props: { counts: { EA1: 2, EA2: 1, GA: 4, No: 3 } } })
    expect(wrapper.findAll('.grid > div')).toHaveLength(4)
    expect(wrapper.text()).toContain('2')
    expect(wrapper.text()).toContain('EA1')
  })

  it('renders a fifth card when recommendedCount is a number', () => {
    const wrapper = mount(PlacementSummaryCards, {
      props: { counts: { EA1: 0, EA2: 0, GA: 0, No: 0 }, recommendedCount: 5 }
    })
    expect(wrapper.findAll('.grid > div')).toHaveLength(5)
    expect(wrapper.text()).toContain('PM+DO Recommended')
  })
})
