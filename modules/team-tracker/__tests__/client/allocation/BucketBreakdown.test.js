import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BucketBreakdown from '../../../client/components/allocation/BucketBreakdown.vue'
import IssueList from '../../../client/components/allocation/IssueList.vue'

describe('BucketBreakdown', () => {
  const defaultProps = {
    name: 'Tech Debt & Quality',
    bucketKey: 'tech-debt-quality',
    points: 20,
    percentage: 44,
    targetPercentage: 40,
    completedPoints: 10,
    color: 'amber',
    issues: [
      { key: 'RHOAIENG-100', summary: 'Fix crash on login', url: 'https://issues.redhat.com/browse/RHOAIENG-100', storyPoints: 5, status: 'Done', completed: true },
      { key: 'RHOAIENG-101', summary: 'Resolve timeout errors', url: 'https://issues.redhat.com/browse/RHOAIENG-101', storyPoints: 3, status: 'In Progress', completed: false }
    ]
  }

  it('renders bucket name', () => {
    const wrapper = mount(BucketBreakdown, { props: defaultProps })
    expect(wrapper.text()).toContain('Tech Debt & Quality')
  })

  it('shows points and percentage', () => {
    const wrapper = mount(BucketBreakdown, { props: defaultProps })
    expect(wrapper.text()).toContain('20 pts')
    expect(wrapper.text()).toContain('44%')
  })

  it('shows target percentage', () => {
    const wrapper = mount(BucketBreakdown, { props: defaultProps })
    expect(wrapper.text()).toContain('Target: 40%')
  })

  it('has color-coded left border', () => {
    const wrapper = mount(BucketBreakdown, { props: defaultProps })
    const card = wrapper.find('[data-testid="bucket-card"]')
    expect(card.classes()).toContain('border-l-4')
    expect(card.classes()).toContain('border-l-amber-400')
  })

  it('renders blue border for new-features', () => {
    const wrapper = mount(BucketBreakdown, {
      props: { ...defaultProps, color: 'blue', name: 'New Features', bucketKey: 'new-features' }
    })
    const card = wrapper.find('[data-testid="bucket-card"]')
    expect(card.classes()).toContain('border-l-blue-400')
  })

  it('renders green border for learning-enablement', () => {
    const wrapper = mount(BucketBreakdown, {
      props: { ...defaultProps, color: 'green', name: 'Learning & Enablement', bucketKey: 'learning-enablement' }
    })
    const card = wrapper.find('[data-testid="bucket-card"]')
    expect(card.classes()).toContain('border-l-green-400')
  })

  it('renders gray border for uncategorized', () => {
    const wrapper = mount(BucketBreakdown, {
      props: { ...defaultProps, color: 'gray', name: 'Uncategorized', bucketKey: 'uncategorized' }
    })
    const card = wrapper.find('[data-testid="bucket-card"]')
    expect(card.classes()).toContain('border-l-gray-400')
  })

  it('shows "over" variance when percentage exceeds target by more than 5', () => {
    const wrapper = mount(BucketBreakdown, {
      props: { ...defaultProps, percentage: 50, targetPercentage: 40 }
    })
    expect(wrapper.text()).toContain('+10%')
    expect(wrapper.find('[data-testid="variance"]').text()).toContain('over')
  })

  it('shows "under" variance when percentage is below target by more than 5', () => {
    const wrapper = mount(BucketBreakdown, {
      props: { ...defaultProps, percentage: 30, targetPercentage: 40 }
    })
    expect(wrapper.text()).toContain('-10%')
    expect(wrapper.find('[data-testid="variance"]').text()).toContain('under')
  })

  it('shows "on target" when within +/-5% threshold', () => {
    const wrapper = mount(BucketBreakdown, {
      props: { ...defaultProps, percentage: 42, targetPercentage: 40 }
    })
    expect(wrapper.find('[data-testid="variance"]').text()).toContain('on target')
  })

  it('contains an expandable IssueList', () => {
    const wrapper = mount(BucketBreakdown, { props: defaultProps })
    const issueList = wrapper.findComponent(IssueList)
    expect(issueList.exists()).toBe(true)
    expect(issueList.props('issues')).toHaveLength(2)
    expect(issueList.props('expandable')).toBe(true)
  })

  it('shows issue count', () => {
    const wrapper = mount(BucketBreakdown, { props: defaultProps })
    expect(wrapper.text()).toContain('2 issues')
  })

  it('shows completed points', () => {
    const wrapper = mount(BucketBreakdown, { props: defaultProps })
    expect(wrapper.text()).toContain('10 completed')
  })
})
