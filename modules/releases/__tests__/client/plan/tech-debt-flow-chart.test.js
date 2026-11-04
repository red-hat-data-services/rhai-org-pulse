import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('chart.js', function () {
  return {
    Chart: { register: vi.fn() },
    BarElement: {},
    CategoryScale: {},
    LineElement: {},
    LinearScale: {},
    PointElement: {},
    Tooltip: {}
  }
})

vi.mock('vue-chartjs', function () {
  const chartStub = function (testId) {
    return {
      props: ['data', 'options'],
      computed: {
        labels: function () {
          return this.data.datasets.map(function (dataset) { return dataset.label + ':' + (dataset.stack || 'line') }).join('|')
        }
      },
      template: `<div data-testid="${testId}">{{ labels }}</div>`
    }
  }
  return {
    Bar: chartStub('bar-stub'),
    Line: chartStub('line-stub')
  }
})

import TechDebtFlowChart from '../../../client/plan/components/TechDebtFlowChart.vue'

describe('TechDebtFlowChart', function () {
  const chartProps = {
    categories: [
      { code: 'vulnerability', label: 'CVE / Vulnerability', color: '#a21caf' },
      { code: 'component-team', label: 'Component-team/unclassified', color: '#64748b' }
    ],
    panel: {
      component: 'AI Gateway',
      totals: { received: 3, resolved: 2 },
      months: [{
        month: '2026-10',
        received: { total: 3, categories: { vulnerability: 1, 'component-team': 2 } },
        resolved: { total: 2, categories: { vulnerability: 1, 'component-team': 1 } }
      }]
    }
  }

  it('shows only total Received and Closed bars by default', function () {
    const wrapper = mount(TechDebtFlowChart, {
      props: chartProps
    })

    const datasets = wrapper.get('[data-testid="line-stub"]').text()
    expect(datasets).toBe('Received:line|Closed:line')
    expect(wrapper.find('[data-testid="bar-stub"]').exists()).toBe(false)
  })

  it('builds separate Received and Closed stacks for every category on request', function () {
    const wrapper = mount(TechDebtFlowChart, {
      props: { ...chartProps, showIssueTypes: true }
    })

    const datasets = wrapper.get('[data-testid="bar-stub"]').text()
    expect(datasets).toContain('CVE / Vulnerability · Received:received')
    expect(datasets).toContain('CVE / Vulnerability · Closed:closed')
    expect(datasets).toContain('Component-team/unclassified · Received:received')
    expect(datasets).toContain('Component-team/unclassified · Closed:closed')
  })

  it('shows a component-level empty state when no events exist', function () {
    const wrapper = mount(TechDebtFlowChart, {
      props: {
        categories: [],
        panel: { component: 'AI Gateway', totals: { received: 0, resolved: 0 }, months: [] }
      }
    })
    expect(wrapper.text()).toContain('No received or closed issues')
    expect(wrapper.find('[data-testid="bar-stub"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="line-stub"]').exists()).toBe(false)
  })
})
