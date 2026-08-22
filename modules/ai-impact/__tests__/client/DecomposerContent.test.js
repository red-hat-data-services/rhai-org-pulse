import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import DecomposerContent from '../../client/components/DecomposerContent.vue';

// Mock chart.js so canvases don't blow up in jsdom
vi.mock('vue-chartjs', () => ({
  Bar: { template: '<div class="mock-bar" />' },
  Line: { template: '<div class="mock-line" />' }
}));
vi.mock('chart.js', () => ({
  Chart: { register: vi.fn() },
  CategoryScale: {}, LinearScale: {}, PointElement: {}, LineElement: {},
  BarElement: {}, Filler: {}, Title: {}, Tooltip: {}, Legend: {}
}));
// Mock the mermaid renderer (dynamically imports 'mermaid' on mount)
vi.mock('../../client/components/MermaidDiagram.vue', () => ({
  default: { template: '<div class="mock-mermaid" />', props: ['chart'] }
}));

function makeSnapshot() {
  return {
    generatedAt: '2026-07-24T00:00:00Z',
    counts: { runs: 1, strategies: 2 },
    aggregates: {
      unique_strategies: 2,
      total_epics: 9,
      pass_rate: 100,
      avg_epics_per_strategy: 4.5,
      avg_critical_path: 3,
      investigation_epic_count: 1,
      strats_with_investigations: 1,
      implementability_distribution: { High: 5, Medium: 2, Low: 0 },
      recovered_strategies: 0,
      failed_strategies: 0,
      failed_ids: [],
      component_distribution: { MLflow: 5, Documentation: 4 }
    },
    runs: [{ run_id: 'r1', started: '2026-07-20T00:00:00Z', submitted_epics: 9, total: 2 }],
    strategies: [
      { strat_id: 'RHAISTRAT-1', title: 'GenAI Studio MCP Discovery', priority: 'Major', epic_count: 4, critical_path_length: 3, revised: false, mermaid_dag: 'graph TD', review: { score: 14, pass: true, recommendation: 'accept' }, epics: [], run_history: [] },
      { strat_id: 'RHAISTRAT-2', title: 'Other unrelated work', priority: 'Minor', epic_count: 5, critical_path_length: 2, revised: false, mermaid_dag: '', review: { score: 10, pass: false, recommendation: 'revise' }, epics: [], run_history: [] }
    ],
    jiraHost: 'https://redhat.atlassian.net'
  };
}

describe('DecomposerContent', () => {
  it('shows loading state', () => {
    const wrapper = mount(DecomposerContent, { props: { loading: true, snapshot: null } });
    expect(wrapper.text()).toContain('Loading decomposer data');
  });

  it('shows error state with retry', async () => {
    const wrapper = mount(DecomposerContent, { props: { error: 'boom', snapshot: null } });
    expect(wrapper.text()).toContain('boom');
    await wrapper.find('button').trigger('click');
    expect(wrapper.emitted('retry')).toBeTruthy();
  });

  it('shows empty state when no aggregates/runs', () => {
    const wrapper = mount(DecomposerContent, { props: { snapshot: { aggregates: null, runs: [] } } });
    expect(wrapper.text()).toContain('Decomposer data will appear here');
  });

  it('defaults the Showing filter to This Month', () => {
    const wrapper = mount(DecomposerContent, { props: { snapshot: makeSnapshot() } });
    expect(wrapper.find('#decomposer-showing').element.value).toBe('month');
  });

  it('renders KPIs, the Showing filter and the strategy list', async () => {
    const wrapper = mount(DecomposerContent, { props: { snapshot: makeSnapshot() } });
    expect(wrapper.text()).toContain('Strategies Decomposed');
    // "Showing:" date filter present
    expect(wrapper.find('#decomposer-showing').exists()).toBe(true);
    const opts = wrapper.findAll('#decomposer-showing option').map(o => o.text());
    expect(opts).toContain('All time');
    expect(opts).toContain('This Week');
    // search box present
    expect(wrapper.find('input[type="text"]').exists()).toBe(true);
    // fixture strategies have no run dates → view "All time" to see the list
    await wrapper.find('#decomposer-showing').setValue('all');
    expect(wrapper.text()).toContain('RHAISTRAT-1');
    expect(wrapper.text()).toContain('GenAI Studio MCP Discovery');
  });

  it('links strategy ids to Jira using jiraHost', async () => {
    const wrapper = mount(DecomposerContent, { props: { snapshot: makeSnapshot() } });
    await wrapper.find('#decomposer-showing').setValue('all');
    const link = wrapper.findAll('a').find(a => a.text() === 'RHAISTRAT-1');
    expect(link.attributes('href')).toBe('https://redhat.atlassian.net/browse/RHAISTRAT-1');
    expect(link.attributes('target')).toBe('_blank');
  });

  it('filters the strategy list by search query', async () => {
    const wrapper = mount(DecomposerContent, { props: { snapshot: makeSnapshot() } });
    await wrapper.find('#decomposer-showing').setValue('all');
    expect(wrapper.text()).toContain('Other unrelated work');
    await wrapper.find('input[type="text"]').setValue('GenAI');
    expect(wrapper.text()).toContain('GenAI Studio MCP Discovery');
    expect(wrapper.text()).not.toContain('Other unrelated work');
    expect(wrapper.text()).toContain('1 of 2');
  });
});
