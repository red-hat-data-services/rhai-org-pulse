import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import AIReviewSection from '../../../client/execute/components/AIReviewSection.vue';

// Mock chart.js to avoid canvas errors in tests
vi.mock('vue-chartjs', () => ({
  Line: { template: '<div class="mock-line-chart" />' }
}));
vi.mock('chart.js', () => ({
  Chart: { register: vi.fn() },
  CategoryScale: {},
  LinearScale: {},
  PointElement: {},
  LineElement: {},
  Tooltip: {}
}));

describe('AIReviewSection', () => {
  it('shows loading state', () => {
    const wrapper = mount(AIReviewSection, {
      props: { loading: true }
    });
    expect(wrapper.text()).toContain('Loading AI review data');
  });

  it('shows error state', () => {
    const wrapper = mount(AIReviewSection, {
      props: { error: 'Server error' }
    });
    expect(wrapper.text()).toContain('Server error');
  });

  it('shows empty state when no feature review data', () => {
    const wrapper = mount(AIReviewSection, {
      props: { featureReview: null }
    });
    expect(wrapper.text()).toContain('No AI review data available for this feature');
  });

  it('renders feature review data', () => {
    const wrapper = mount(AIReviewSection, {
      props: {
        featureReview: {
          latest: {
            recommendation: 'approve',
            humanReviewStatus: 'approved',
            approvedBy: 'Jane Doe',
            approvedAt: '2026-05-01T00:00:00Z',
            scores: { total: 7, feasibility: 2, testability: 2, scope: 2, architecture: 1 },
            reviewers: { feasibility: 'approve', testability: 'approve', scope: 'approve', architecture: 'revise' },
            priority: 'Major',
            size: 'L',
            status: 'New'
          },
          history: []
        }
      }
    });
    expect(wrapper.text()).toContain('AI Review');
    expect(wrapper.text()).toContain('Approve');
    expect(wrapper.text()).toContain('Approved');
    expect(wrapper.text()).toContain('7/8');
    expect(wrapper.text()).toContain('Major');
    expect(wrapper.text()).toContain('Jane Doe');
    // Dimension scores
    expect(wrapper.text()).toContain('feasibility');
    expect(wrapper.text()).toContain('testability');
  });

  it('renders feature review history', () => {
    const wrapper = mount(AIReviewSection, {
      props: {
        featureReview: {
          latest: {
            recommendation: 'approve',
            scores: { total: 7 },
            reviewers: {}
          },
          history: [
            { reviewedAt: '2026-04-01T00:00:00Z', scores: { total: 5 }, recommendation: 'revise' },
            { reviewedAt: '2026-03-01T00:00:00Z', scores: { total: 3 }, recommendation: 'reject' }
          ]
        }
      }
    });
    expect(wrapper.text()).toContain('Score History');
    expect(wrapper.text()).toContain('5/8');
    expect(wrapper.text()).toContain('3/8');
  });

});
