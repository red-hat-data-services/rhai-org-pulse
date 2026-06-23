import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import AllocationTeamCard from '../../../client/components/allocation/AllocationTeamCard.vue'

vi.mock('../../../client/composables/useAllocationStrategy', () => ({
  useAllocationStrategy: () => ({
    categories: {
      value: [
        { key: 'tech-debt-quality', name: 'Tech Debt', color: 'amber', target: 40 },
        { key: 'new-features', name: 'Features', color: 'blue', target: 40 },
        { key: 'learning-enablement', name: 'Learning', color: 'green', target: 20 }
      ]
    }
  })
}))

describe('AllocationTeamCard', () => {
  const defaultProps = {
    teamName: 'Model Serving',
    totalPoints: 90,
    totalCount: 12,
    boardCount: 2,
    percentages: {
      'tech-debt-quality': 40,
      'new-features': 45,
      'learning-enablement': 10,
      'uncategorized': 5
    },
    buckets: {
      'tech-debt-quality': { points: 36, count: 5 },
      'new-features': { points: 40, count: 5 },
      'learning-enablement': { points: 9, count: 1 },
      'uncategorized': { points: 5, count: 1 }
    }
  }

  it('renders team name', () => {
    const wrapper = mount(AllocationTeamCard, { props: defaultProps })
    expect(wrapper.find('h3').text()).toBe('Model Serving')
  })

  it('renders AllocationBar component', () => {
    const wrapper = mount(AllocationTeamCard, { props: defaultProps })
    expect(wrapper.findComponent({ name: 'AllocationBar' }).exists()).toBe(true)
  })

  it('shows bucket percentage labels', () => {
    const wrapper = mount(AllocationTeamCard, { props: defaultProps })
    const text = wrapper.text()
    expect(text).toContain('Tech Debt 40%')
    expect(text).toContain('Features 45%')
    expect(text).toContain('Learning 10%')
  })

  it('hides uncategorized label when percentage is 0', () => {
    const props = {
      ...defaultProps,
      percentages: { ...defaultProps.percentages, uncategorized: 0 }
    }
    const wrapper = mount(AllocationTeamCard, { props })
    expect(wrapper.text()).not.toContain('Uncat.')
  })

  it('shows total points in footer by default', () => {
    const wrapper = mount(AllocationTeamCard, { props: defaultProps })
    expect(wrapper.text()).toContain('90 pts')
    expect(wrapper.text()).toContain('2 boards')
  })

  it('shows total issues in footer when metricMode is counts', () => {
    const wrapper = mount(AllocationTeamCard, { props: { ...defaultProps, metricMode: 'counts' } })
    expect(wrapper.text()).toContain('12 issues')
  })

  it('shows singular board label for 1 board', () => {
    const wrapper = mount(AllocationTeamCard, { props: { ...defaultProps, boardCount: 1 } })
    expect(wrapper.text()).toContain('1 board')
    expect(wrapper.text()).not.toContain('boards')
  })

  it('emits click event when card is clicked', async () => {
    const wrapper = mount(AllocationTeamCard, { props: defaultProps })
    await wrapper.find('[data-testid="allocation-team-card"]').trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('renders with empty/zero data without errors', () => {
    const wrapper = mount(AllocationTeamCard, {
      props: { teamName: 'Empty Team' }
    })
    expect(wrapper.find('h3').text()).toBe('Empty Team')
    expect(wrapper.text()).toContain('0 pts')
    expect(wrapper.text()).toContain('0 boards')
  })
})
