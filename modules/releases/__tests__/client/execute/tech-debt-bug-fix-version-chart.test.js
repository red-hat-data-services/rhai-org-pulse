import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

const captured = vi.hoisted(function () {
  return { data: null, options: null }
})

vi.mock('chart.js', function () {
  return {
    ArcElement: {},
    Chart: { register: vi.fn() },
    Tooltip: {}
  }
})

vi.mock('vue-chartjs', function () {
  return {
    Pie: {
      props: ['data', 'options'],
      created: function () {
        captured.data = this.data
        captured.options = this.options
      },
      updated: function () {
        captured.data = this.data
        captured.options = this.options
      },
      template: '<canvas data-testid="pie-chart-stub" />'
    }
  }
})

import TechDebtBugFixVersionChart from '../../../client/execute/components/TechDebtBugFixVersionChart.vue'

const distribution = {
  sourceField: 'fixVersions',
  assignment: 'one-bucket-per-issue',
  total: 45,
  versions: [
    { version: '3.7 GA', count: 9 },
    { version: '3.6 GA', count: 8 },
    { version: '3.5 GA', count: 7 },
    { version: '3.4 GA', count: 6 },
    { version: '3.3 GA', count: 5 },
    { version: 'No Fix Version', count: 4 },
    { version: 'Multiple Fix Versions', count: 3 },
    { version: '3.2 GA', count: 2 },
    { version: '3.1 GA', count: 1 }
  ]
}

const affectsDistribution = {
  sourceField: 'versions',
  assignment: 'one-bucket-per-issue',
  total: 45,
  versions: [
    { version: '3.7 EA', count: 9 },
    { version: '3.6 EA', count: 8 },
    { version: '3.5 EA', count: 7 },
    { version: '3.4 EA', count: 6 },
    { version: '3.3 EA', count: 5 },
    { version: 'No Affects Version', count: 4 },
    { version: 'Multiple Affects Versions', count: 3 },
    { version: '3.2 EA', count: 2 },
    { version: '3.1 EA', count: 1 }
  ]
}

describe('TechDebtBugFixVersionChart', function () {
  beforeEach(function () {
    captured.data = null
    captured.options = null
  })

  it('shows unique Bug counts and groups the long tail into Other Fix Versions', function () {
    const wrapper = mount(TechDebtBugFixVersionChart, {
      props: {
        fixVersionDistribution: distribution,
        affectsVersionDistribution: affectsDistribution
      }
    })

    expect(wrapper.text()).toContain('Bugs by Fix Version')
    expect(wrapper.text()).toContain('Each Bug is counted once')
    expect(wrapper.text()).toContain('3.7 GA (9 · 20.0%)')
    expect(wrapper.text()).toContain('Other Fix Versions (3 · 6.67%)')
    expect(wrapper.text()).toContain('45 Bugs · Issues by Fix Version')
    expect(wrapper.get('[data-testid="tech-debt-fix-version-toggle"]').attributes('aria-pressed')).toBe('true')
    expect(captured.data.labels).toHaveLength(8)
    expect(captured.data.labels.at(-1)).toBe('Other Fix Versions')
    expect(captured.data.datasets[0].data.at(-1)).toBe(3)
  })

  it('toggles to the Affects Version distribution from the same dataset', async function () {
    const wrapper = mount(TechDebtBugFixVersionChart, {
      props: {
        fixVersionDistribution: distribution,
        affectsVersionDistribution: affectsDistribution
      }
    })

    await wrapper.get('[data-testid="tech-debt-affects-version-toggle"]').trigger('click')

    expect(wrapper.get('[data-testid="tech-debt-affects-version-toggle"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.text()).toContain('Bugs by Affects Version')
    expect(wrapper.text()).toContain('3.7 EA (9 · 20.0%)')
    expect(wrapper.text()).toContain('Other Affects Versions (3 · 6.67%)')
    expect(wrapper.text()).toContain('45 Bugs · Issues by Affects Version')
    expect(captured.data.labels.at(-1)).toBe('Other Affects Versions')
  })

  it('uses count and percentage in the pie tooltip', function () {
    mount(TechDebtBugFixVersionChart, {
      props: {
        fixVersionDistribution: distribution,
        affectsVersionDistribution: affectsDistribution
      }
    })

    expect(captured.options.plugins.legend.display).toBe(false)
    expect(captured.options.plugins.tooltip.callbacks.label({
      label: '3.7 GA',
      formattedValue: '9',
      raw: 9
    })).toBe('3.7 GA: 9 Bugs (20.0%)')
  })

  it('shows a refresh state when the selected legacy distribution is unavailable', async function () {
    const wrapper = mount(TechDebtBugFixVersionChart, {
      props: {
        fixVersionDistribution: distribution,
        affectsVersionDistribution: null
      }
    })

    await wrapper.get('[data-testid="tech-debt-affects-version-toggle"]').trigger('click')

    expect(wrapper.get('[data-testid="tech-debt-selected-version-unavailable"]').text()).toContain('Affects Version')
    expect(wrapper.find('[data-testid="pie-chart-stub"]').exists()).toBe(false)
  })
})
