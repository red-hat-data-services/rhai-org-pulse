import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import BacklogHealthChart from '../../client/components/BacklogHealthChart.vue'

vi.mock('vue-chartjs', () => ({
  Bar: {
    name: 'Bar',
    props: ['data', 'options'],
    template: '<canvas data-testid="bar-canvas"></canvas>'
  }
}))

vi.mock('chart.js', () => ({
  Chart: { register: vi.fn() },
  CategoryScale: 'CategoryScale',
  LinearScale: 'LinearScale',
  BarElement: 'BarElement',
  Tooltip: 'Tooltip',
  Title: 'Title',
  Legend: 'Legend'
}))

describe('BacklogHealthChart', () => {
  it('renders the Bar component', () => {
    const forecast = { remaining: 10, totalCapacity: 15, delta: 5 }
    const wrapper = mount(BacklogHealthChart, {
      props: { forecast }
    })
    expect(wrapper.find('[data-testid="bar-canvas"]').exists()).toBe(true)
  })

  it('passes correct data to chart', () => {
    const forecast = { remaining: 10, totalCapacity: 15, delta: 5 }
    const wrapper = mount(BacklogHealthChart, {
      props: { forecast }
    })
    const bar = wrapper.findComponent({ name: 'Bar' })
    const chartData = bar.props('data')

    expect(chartData.labels).toEqual(['Capacity vs Demand'])
    expect(chartData.datasets).toHaveLength(2)
    expect(chartData.datasets[0].label).toBe('Remaining Issues')
    expect(chartData.datasets[0].data).toEqual([10])
    expect(chartData.datasets[1].label).toBe('Projected Capacity')
    expect(chartData.datasets[1].data).toEqual([15])
  })

  it('applies green color when on track (surplus)', () => {
    const forecast = { remaining: 10, totalCapacity: 15, delta: 5 }
    const wrapper = mount(BacklogHealthChart, {
      props: { forecast }
    })
    const bar = wrapper.findComponent({ name: 'Bar' })
    const chartData = bar.props('data')

    expect(chartData.datasets[1].backgroundColor).toBe('rgba(16, 185, 129, 0.8)') // emerald-500
  })

  it('applies orange color when at risk (deficit)', () => {
    const forecast = { remaining: 20, totalCapacity: 10, delta: -10 }
    const wrapper = mount(BacklogHealthChart, {
      props: { forecast }
    })
    const bar = wrapper.findComponent({ name: 'Bar' })
    const chartData = bar.props('data')

    expect(chartData.datasets[1].backgroundColor).toBe('rgba(251, 146, 60, 0.8)') // orange-400
  })

  it('handles zero delta correctly', () => {
    const forecast = { remaining: 10, totalCapacity: 10, delta: 0 }
    const wrapper = mount(BacklogHealthChart, {
      props: { forecast }
    })
    const bar = wrapper.findComponent({ name: 'Bar' })
    const chartData = bar.props('data')

    expect(chartData.datasets[1].backgroundColor).toBe('rgba(16, 185, 129, 0.8)') // on track (>= 0)
  })

  it('configures title and legend correctly', () => {
    const forecast = { remaining: 8, totalCapacity: 12, delta: 4 }
    const wrapper = mount(BacklogHealthChart, {
      props: { forecast }
    })
    const bar = wrapper.findComponent({ name: 'Bar' })
    const options = bar.props('options')

    expect(options.plugins.title.display).toBe(true)
    expect(options.plugins.title.text).toBe('Backlog Health')
    expect(options.plugins.legend.position).toBe('bottom')
  })

  it('configures y-axis to start at zero', () => {
    const forecast = { remaining: 5, totalCapacity: 15, delta: 10 }
    const wrapper = mount(BacklogHealthChart, {
      props: { forecast }
    })
    const bar = wrapper.findComponent({ name: 'Bar' })
    const options = bar.props('options')

    expect(options.scales.y.beginAtZero).toBe(true)
    expect(options.scales.y.title.text).toBe('Issues')
  })

  it('formats tooltip with delta information for surplus', () => {
    const forecast = { remaining: 10, totalCapacity: 15, delta: 5 }
    const wrapper = mount(BacklogHealthChart, {
      props: { forecast }
    })
    const bar = wrapper.findComponent({ name: 'Bar' })
    const options = bar.props('options')

    const afterBody = options.plugins.tooltip.callbacks.afterBody()
    expect(afterBody).toContain('Surplus: +5')
  })

  it('formats tooltip with delta information for deficit', () => {
    const forecast = { remaining: 20, totalCapacity: 10, delta: -10 }
    const wrapper = mount(BacklogHealthChart, {
      props: { forecast }
    })
    const bar = wrapper.findComponent({ name: 'Bar' })
    const options = bar.props('options')

    const afterBody = options.plugins.tooltip.callbacks.afterBody()
    expect(afterBody).toContain('Deficit: -10')
  })

  it('handles large deficit values', () => {
    const forecast = { remaining: 100, totalCapacity: 10, delta: -90 }
    const wrapper = mount(BacklogHealthChart, {
      props: { forecast }
    })
    const bar = wrapper.findComponent({ name: 'Bar' })
    const chartData = bar.props('data')

    expect(chartData.datasets[0].data).toEqual([100])
    expect(chartData.datasets[1].data).toEqual([10])
  })

  it('handles zero remaining issues', () => {
    const forecast = { remaining: 0, totalCapacity: 15, delta: 15 }
    const wrapper = mount(BacklogHealthChart, {
      props: { forecast }
    })
    const bar = wrapper.findComponent({ name: 'Bar' })
    const chartData = bar.props('data')

    expect(chartData.datasets[0].data).toEqual([0])
  })
})
