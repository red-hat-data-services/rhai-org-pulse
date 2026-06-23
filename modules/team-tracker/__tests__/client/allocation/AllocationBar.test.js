import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import AllocationBar from '../../../client/components/allocation/AllocationBar.vue'

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

describe('AllocationBar', () => {
  const mockBuckets = {
    'tech-debt-quality': { points: 40, count: 5 },
    'new-features': { points: 50, count: 8 },
    'learning-enablement': { points: 0, count: 0 },
    'uncategorized': { points: 0, count: 0 }
  }

  it('renders segments with correct widths proportional to points', () => {
    const wrapper = mount(AllocationBar, {
      props: { buckets: mockBuckets, totalPoints: 90 }
    })
    const techDebtSegment = wrapper.find('[data-testid="segment-tech-debt-quality"]')
    expect(techDebtSegment.exists()).toBe(true)
    expect(techDebtSegment.attributes('style')).toContain('width: 44%')
    const featureSegment = wrapper.find('[data-testid="segment-new-features"]')
    expect(featureSegment.exists()).toBe(true)
    expect(featureSegment.attributes('style')).toContain('width: 56%')
  })

  it('shows inline percentage labels on segments >= 10%', () => {
    const wrapper = mount(AllocationBar, {
      props: { buckets: mockBuckets, totalPoints: 90 }
    })
    const techDebtSegment = wrapper.find('[data-testid="segment-tech-debt-quality"]')
    expect(techDebtSegment.text()).toContain('44%')
    const featureSegment = wrapper.find('[data-testid="segment-new-features"]')
    expect(featureSegment.text()).toContain('56%')
  })

  it('hides inline percentage labels on segments < 10%', () => {
    const smallBuckets = {
      'tech-debt-quality': { points: 5, count: 1 },
      'new-features': { points: 90, count: 10 },
      'learning-enablement': { points: 5, count: 1 },
      'uncategorized': { points: 0, count: 0 }
    }
    const wrapper = mount(AllocationBar, {
      props: { buckets: smallBuckets, totalPoints: 100 }
    })
    const techDebtSegment = wrapper.find('[data-testid="segment-tech-debt-quality"]')
    const spans = techDebtSegment.findAll('span')
    expect(spans).toHaveLength(0)
  })

  it('shows hover tooltip with name and percentage on each segment', () => {
    const wrapper = mount(AllocationBar, {
      props: { buckets: mockBuckets, totalPoints: 90 }
    })
    const techDebtTooltip = wrapper.find('[data-testid="segment-tech-debt-quality"] [data-testid="tooltip"]')
    expect(techDebtTooltip.text()).toContain('Tech Debt & Quality: 44%')
    const featureTooltip = wrapper.find('[data-testid="segment-new-features"] [data-testid="tooltip"]')
    expect(featureTooltip.text()).toContain('New Features: 56%')
  })

  it('shows hover tooltip even on small segments', () => {
    const smallBuckets = {
      'tech-debt-quality': { points: 5, count: 1 },
      'new-features': { points: 90, count: 10 },
      'learning-enablement': { points: 5, count: 1 },
      'uncategorized': { points: 0, count: 0 }
    }
    const wrapper = mount(AllocationBar, {
      props: { buckets: smallBuckets, totalPoints: 100 }
    })
    const techDebtTooltip = wrapper.find('[data-testid="segment-tech-debt-quality"] [data-testid="tooltip"]')
    expect(techDebtTooltip.exists()).toBe(true)
    expect(techDebtTooltip.text()).toContain('Tech Debt & Quality: 5%')
  })

  it('handles 0 total points gracefully', () => {
    const zeroBuckets = {
      'tech-debt-quality': { points: 0, count: 0 },
      'new-features': { points: 0, count: 0 },
      'learning-enablement': { points: 0, count: 0 },
      'uncategorized': { points: 0, count: 0 }
    }
    const wrapper = mount(AllocationBar, {
      props: { buckets: zeroBuckets, totalPoints: 0 }
    })
    expect(wrapper.find('[data-testid="no-data"]').exists()).toBe(true)
  })

  it('renders target marker lines', () => {
    const wrapper = mount(AllocationBar, {
      props: { buckets: mockBuckets, totalPoints: 90 }
    })
    const markers = wrapper.findAll('[data-testid="target-marker"]')
    expect(markers.length).toBe(2)
  })

  it('shows title attribute with bucket name, points, and percentage', () => {
    const wrapper = mount(AllocationBar, {
      props: { buckets: mockBuckets, totalPoints: 90 }
    })
    const techDebtSegment = wrapper.find('[data-testid="segment-tech-debt-quality"]')
    expect(techDebtSegment.attributes('title')).toBe('Tech Debt & Quality: 40 pts (44%)')
    const featureSegment = wrapper.find('[data-testid="segment-new-features"]')
    expect(featureSegment.attributes('title')).toBe('New Features: 50 pts (56%)')
  })

  it('shows tooltip for learning segment when present', () => {
    const withLearning = {
      'tech-debt-quality': { points: 40, count: 5 },
      'new-features': { points: 40, count: 5 },
      'learning-enablement': { points: 20, count: 3 },
      'uncategorized': { points: 0, count: 0 }
    }
    const wrapper = mount(AllocationBar, {
      props: { buckets: withLearning, totalPoints: 100 }
    })
    const learningSegment = wrapper.find('[data-testid="segment-learning-enablement"]')
    expect(learningSegment.attributes('title')).toBe('Learning & Enablement: 20 pts (20%)')
    const learningTooltip = wrapper.find('[data-testid="segment-learning-enablement"] [data-testid="tooltip"]')
    expect(learningTooltip.text()).toContain('Learning & Enablement: 20%')
  })
})
