import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import CompletionSummary from '../../../client/components/allocation/CompletionSummary.vue'

vi.mock('../../../client/composables/useAllocationStrategy', () => ({
  useAllocationStrategy: () => ({
    categories: {
      value: [
        { key: 'tech-debt-quality', name: 'Tech Debt & Quality', color: 'amber', target: 40 },
        { key: 'new-features', name: 'New Features', color: 'blue', target: 40 },
        { key: 'learning-enablement', name: 'Learning & Enablement', color: 'green', target: 20 }
      ]
    }
  })
}))

describe('CompletionSummary', () => {
  const mockSummary = {
    totalPoints: 50,
    completedPoints: 35,
    buckets: {
      'tech-debt-quality': { points: 20, completedPoints: 15 },
      'new-features': { points: 25, completedPoints: 20 },
      'learning-enablement': { points: 5, completedPoints: 0 },
      'uncategorized': { points: 0, completedPoints: 0 }
    }
  }

  it('renders nothing when sprintState is not closed', () => {
    const wrapper = mount(CompletionSummary, {
      props: { summary: mockSummary, sprintState: 'active' }
    })
    expect(wrapper.html()).toBe('<!--v-if-->')
  })

  it('renders nothing when sprintState is future', () => {
    const wrapper = mount(CompletionSummary, {
      props: { summary: mockSummary, sprintState: 'future' }
    })
    expect(wrapper.html()).toBe('<!--v-if-->')
  })

  it('renders completion stats when sprintState is closed', () => {
    const wrapper = mount(CompletionSummary, {
      props: { summary: mockSummary, sprintState: 'closed' }
    })
    expect(wrapper.text()).toContain('Sprint Completion')
    expect(wrapper.text()).toContain('35')
    expect(wrapper.text()).toContain('50')
    expect(wrapper.text()).toContain('70%')
  })

  it('renders a green completion bar', () => {
    const wrapper = mount(CompletionSummary, {
      props: { summary: mockSummary, sprintState: 'closed' }
    })
    const bar = wrapper.find('[data-testid="completion-bar"]')
    expect(bar.exists()).toBe(true)
    expect(bar.attributes('style')).toContain('width: 70%')
  })

  it('shows per-bucket breakdown', () => {
    const wrapper = mount(CompletionSummary, {
      props: { summary: mockSummary, sprintState: 'closed' }
    })
    expect(wrapper.text()).toContain('Tech Debt & Quality')
    expect(wrapper.text()).toContain('15/20')
    expect(wrapper.text()).toContain('New Features')
    expect(wrapper.text()).toContain('20/25')
  })

  it('skips buckets with 0 total points', () => {
    const summaryWithZero = {
      totalPoints: 45, completedPoints: 35,
      buckets: {
        'tech-debt-quality': { points: 20, completedPoints: 15 },
        'new-features': { points: 25, completedPoints: 20 },
        'learning-enablement': { points: 0, completedPoints: 0 },
        'uncategorized': { points: 0, completedPoints: 0 }
      }
    }
    const wrapper = mount(CompletionSummary, {
      props: { summary: summaryWithZero, sprintState: 'closed' }
    })
    expect(wrapper.text()).not.toContain('Learning & Enablement')
  })

  it('handles 100% completion', () => {
    const fullSummary = {
      totalPoints: 30, completedPoints: 30,
      buckets: {
        'tech-debt-quality': { points: 15, completedPoints: 15 },
        'new-features': { points: 15, completedPoints: 15 },
        'learning-enablement': { points: 0, completedPoints: 0 },
        'uncategorized': { points: 0, completedPoints: 0 }
      }
    }
    const wrapper = mount(CompletionSummary, {
      props: { summary: fullSummary, sprintState: 'closed' }
    })
    expect(wrapper.text()).toContain('100%')
  })
})
