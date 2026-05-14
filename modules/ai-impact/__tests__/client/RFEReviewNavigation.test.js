import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all dependencies before imports
const mockApiRequest = vi.fn();
vi.mock('@shared/client/services/api.js', () => ({
  apiRequest: (...args) => mockApiRequest(...args)
}));

vi.mock('vue-chartjs', () => ({
  Bar: { template: '<div />' },
  Line: { template: '<div />' }
}));
vi.mock('chart.js', () => ({
  Chart: { register: vi.fn() },
  CategoryScale: {},
  LinearScale: {},
  BarElement: {},
  PointElement: {},
  LineElement: {},
  Title: {},
  Tooltip: {},
  Legend: {}
}));

// Track cross-module navigation calls
const mockCrossNavigate = vi.fn();
vi.mock('@shared/client/composables/useModuleLink.js', () => ({
  useModuleLink: () => ({
    navigateTo: mockCrossNavigate,
    linkTo: vi.fn()
  })
}));

// Mock LoadingOverlay
vi.mock('@shared/client/components/LoadingOverlay.vue', () => ({
  default: { template: '<div><slot /></div>', props: ['message'] }
}));

import { mount } from '@vue/test-utils';
import { ref, nextTick, defineComponent } from 'vue';
import RFEReviewView from '../../client/views/RFEReviewView.vue';

// Mock composables
vi.mock('../../client/composables/useAIImpact.js', () => ({
  useAIImpact: () => ({
    rfeData: ref({ issues: [
      { key: 'RHAIRFE-1', summary: 'RFE with feature', created: '2026-01-01', aiInvolvement: 'created', creatorDisplayName: 'Alice', priority: 'Major', status: 'New' },
      { key: 'RHAIRFE-2', summary: 'RFE without feature', created: '2026-01-01', aiInvolvement: 'none', creatorDisplayName: 'Bob', priority: 'Minor', status: 'New' }
    ], jiraHost: 'https://jira.example.com', fetchedAt: '2026-01-01' }),
    loading: ref(false),
    error: ref(null),
    load: vi.fn()
  })
}));

vi.mock('../../client/composables/useAssessments.js', () => ({
  useAssessments: () => ({
    assessments: ref({}),
    loadAssessments: vi.fn(),
    loadAssessmentDetail: vi.fn()
  })
}));

vi.mock('../../client/composables/useFeatures.js', () => ({
  useFeatures: () => ({
    features: ref({
      'RHAISTRAT-10': { key: 'RHAISTRAT-10', title: 'Linked Feature', sourceRfe: 'RHAIRFE-1', status: 'In Progress' }
    }),
    loadFeatures: vi.fn()
  })
}));

const PhaseContentStub = defineComponent({
  name: 'PhaseContent',
  template: '<div class="phase-content"><slot /></div>',
  props: ['phase', 'loading', 'error', 'rfeData', 'metrics', 'trendData', 'breakdown', 'filteredRFEs', 'timeWindow', 'filter', 'searchQuery', 'chartExpanded', 'assessments', 'filteredAssessments', 'sortBy', 'passFailFilter', 'priorityFilter', 'statusFilter', 'selectedRFE', 'rfeToFeature'],
  emits: ['selectRFE', 'retry', 'update:timeWindow', 'update:filter', 'update:searchQuery', 'update:chartExpanded', 'update:sortBy', 'update:passFailFilter', 'update:priorityFilter', 'update:statusFilter']
});

describe('RFEReviewView navigation', () => {
  const moduleNav = {
    navigateTo: vi.fn(),
    params: ref({})
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mountView() {
    return mount(RFEReviewView, {
      global: {
        provide: { moduleNav },
        stubs: {
          PhaseContent: PhaseContentStub,
          RFEDetailModal: { template: '<div class="rfe-modal" />', props: ['show', 'rfe', 'phases', 'jiraHost', 'assessment', 'loadAssessmentDetail'] },
          AIImpactGuide: { template: '<div />' }
        }
      }
    });
  }

  it('opens modal when RFE has linked feature', async () => {
    const wrapper = mountView();
    const phaseContent = wrapper.findComponent(PhaseContentStub);

    phaseContent.vm.$emit('selectRFE', { key: 'RHAIRFE-1', summary: 'RFE with feature' });
    await nextTick();

    expect(mockCrossNavigate).not.toHaveBeenCalled();
    expect(moduleNav.navigateTo).toHaveBeenCalledWith('rfe-review', { select: 'RHAIRFE-1' });
  });

  it('opens modal when RFE has no linked feature', async () => {
    const wrapper = mountView();
    const phaseContent = wrapper.findComponent(PhaseContentStub);

    phaseContent.vm.$emit('selectRFE', { key: 'RHAIRFE-2', summary: 'RFE without feature' });
    await nextTick();

    expect(mockCrossNavigate).not.toHaveBeenCalled();
    expect(moduleNav.navigateTo).toHaveBeenCalledWith('rfe-review', { select: 'RHAIRFE-2' });
  });

  it('passes rfeToFeature prop to PhaseContent', () => {
    const wrapper = mountView();
    const phaseContent = wrapper.findComponent(PhaseContentStub);

    expect(phaseContent.props('rfeToFeature')).toEqual({
      'RHAIRFE-1': { key: 'RHAISTRAT-10', summary: 'Linked Feature', status: 'In Progress', fixVersions: [] }
    });
  });
});
