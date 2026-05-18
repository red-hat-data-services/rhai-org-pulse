import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';

// Mock the composable
vi.mock('../../components/health-metrics/useMetricsDashboard.js', () => ({
  useMetricsDashboard: () => ({
    dashboardData: ref({
      totalViews: 1500,
      activePages: 8,
      topPages: [
        { pageId: 'team-tracker::home', views: 523, uniqueUsers: 34, byUserType: {}, byPermissionTier: {} },
        { pageId: 'team-tracker::org-dashboard', views: 342, uniqueUsers: 28, byUserType: {}, byPermissionTier: {} },
      ],
      userTypes: { Backend: 400, Frontend: 300, DevOps: 200 },
      daily: { '2026-05-01': { views: 50, uniqueUsers: 10 } },
    }),
    loading: ref(false),
    error: ref(null),
    fetchDashboard: vi.fn(),
    totalViews: ref(1500),
    uniqueUsers: ref(42),
    activePages: ref(8),
    topPages: ref([
      { pageId: 'team-tracker::home', views: 523, uniqueUsers: 34, byUserType: {}, byPermissionTier: {} },
    ]),
    userTypes: ref({ Backend: 400, Frontend: 300 }),
    daily: ref({}),
  }),
}));

// Mock chart components to avoid canvas issues in test
vi.mock('../../components/health-metrics/TopPagesChart.vue', () => ({
  default: { template: '<div class="mock-top-pages" />' },
}));
vi.mock('../../components/health-metrics/UsageTrendChart.vue', () => ({
  default: { template: '<div class="mock-trend" />' },
}));
vi.mock('../../components/health-metrics/UserTypeBreakdown.vue', () => ({
  default: { template: '<div class="mock-user-type" />' },
}));

import SiteUsageTab from '../../components/health-metrics/SiteUsageTab.vue';

describe('SiteUsageTab', () => {
  let wrapper;

  beforeEach(() => {
    wrapper = mount(SiteUsageTab);
  });

  it('renders the title', () => {
    expect(wrapper.text()).toContain('Site Usage');
  });

  it('displays summary cards', () => {
    expect(wrapper.text()).toContain('Unique Users');
    expect(wrapper.text()).toContain('42');
    expect(wrapper.text()).toContain('Total Views');
    expect(wrapper.text()).toContain('1,500');
    expect(wrapper.text()).toContain('Active Pages');
    expect(wrapper.text()).toContain('8');
  });

  it('renders chart sections', () => {
    expect(wrapper.text()).toContain('Top Pages');
    expect(wrapper.text()).toContain('Usage Trend');
    expect(wrapper.text()).toContain('User Type Breakdown');
  });

  it('renders pages table', () => {
    expect(wrapper.text()).toContain('All Pages');
    expect(wrapper.text()).toContain('team-tracker / home');
  });
});
