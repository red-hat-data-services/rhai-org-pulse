import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import IssueCountChart from '../../client/components/IssueCountChart.vue'

vi.mock('vue-chartjs', () => ({
  Doughnut: {
    name: 'Doughnut',
    props: ['data', 'options'],
    template: '<canvas data-testid="doughnut-canvas"></canvas>'
  }
}))

vi.mock('chart.js', () => ({
  Chart: { register: vi.fn() },
  ArcElement: 'ArcElement',
  Tooltip: 'Tooltip',
  Legend: 'Legend'
}))

describe('IssueCountChart', () => {
  const defaultCounts = { done: 10, doing: 5, to_do: 3 }

  it('renders the Doughnut component', () => {
    const wrapper = mount(IssueCountChart, {
      props: { counts: defaultCounts }
    })
    expect(wrapper.find('[data-testid="doughnut-canvas"]').exists()).toBe(true)
  })

  it('passes correct data to chart', () => {
    const wrapper = mount(IssueCountChart, {
      props: { counts: defaultCounts }
    })
    const doughnut = wrapper.findComponent({ name: 'Doughnut' })
    const chartData = doughnut.props('data')

    expect(chartData.labels).toEqual(['Done', 'In Progress', 'To Do'])
    expect(chartData.datasets[0].data).toEqual([10, 5, 3])
  })

  it('applies correct colors', () => {
    const wrapper = mount(IssueCountChart, {
      props: { counts: defaultCounts }
    })
    const doughnut = wrapper.findComponent({ name: 'Doughnut' })
    const chartData = doughnut.props('data')

    expect(chartData.datasets[0].backgroundColor).toEqual([
      'rgba(16, 185, 129, 0.8)',  // emerald-500
      'rgba(59, 130, 246, 0.8)',  // blue-500
      'rgba(156, 163, 175, 0.8)'  // gray-400
    ])
    expect(chartData.datasets[0].borderWidth).toBe(2)
  })

  it('handles zero counts', () => {
    const zeroCounts = { done: 0, doing: 0, to_do: 0 }
    const wrapper = mount(IssueCountChart, {
      props: { counts: zeroCounts }
    })
    const doughnut = wrapper.findComponent({ name: 'Doughnut' })
    const chartData = doughnut.props('data')

    expect(chartData.datasets[0].data).toEqual([0, 0, 0])
  })

  it('configures legend at bottom', () => {
    const wrapper = mount(IssueCountChart, {
      props: { counts: defaultCounts }
    })
    const doughnut = wrapper.findComponent({ name: 'Doughnut' })
    const options = doughnut.props('options')

    expect(options.plugins.legend.position).toBe('bottom')
    expect(options.plugins.legend.labels.usePointStyle).toBe(true)
  })

  it('formats tooltip with percentage', () => {
    const wrapper = mount(IssueCountChart, {
      props: { counts: defaultCounts }
    })
    const doughnut = wrapper.findComponent({ name: 'Doughnut' })
    const options = doughnut.props('options')

    const tooltipLabel = options.plugins.tooltip.callbacks.label({
      label: 'Done',
      parsed: 10
    })

    expect(tooltipLabel).toContain('Done')
    expect(tooltipLabel).toContain('10')
    expect(tooltipLabel).toContain('55.6%') // 10 / (10+5+3) * 100
  })

  it('handles single non-zero value correctly', () => {
    const singleCounts = { done: 5, doing: 0, to_do: 0 }
    const wrapper = mount(IssueCountChart, {
      props: { counts: singleCounts }
    })
    const doughnut = wrapper.findComponent({ name: 'Doughnut' })
    const options = doughnut.props('options')

    const tooltipLabel = options.plugins.tooltip.callbacks.label({
      label: 'Done',
      parsed: 5
    })

    expect(tooltipLabel).toContain('100.0%')
  })
})
