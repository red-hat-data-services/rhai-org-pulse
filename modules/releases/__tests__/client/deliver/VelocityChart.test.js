import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import VelocityChart from '../../client/components/VelocityChart.vue'

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
  Title: 'Title'
}))

describe('VelocityChart', () => {
  it('renders the Bar component', () => {
    const wrapper = mount(VelocityChart, {
      props: { velocity: 4.5 }
    })
    expect(wrapper.find('[data-testid="bar-canvas"]').exists()).toBe(true)
  })

  it('passes correct data to chart', () => {
    const wrapper = mount(VelocityChart, {
      props: { velocity: 4.5 }
    })
    const bar = wrapper.findComponent({ name: 'Bar' })
    const chartData = bar.props('data')

    expect(chartData.labels).toEqual(['6-Month Avg'])
    expect(chartData.datasets[0].data).toEqual([4.5])
    expect(chartData.datasets[0].label).toBe('Issues per 14 days')
  })

  it('applies correct styling', () => {
    const wrapper = mount(VelocityChart, {
      props: { velocity: 3.2 }
    })
    const bar = wrapper.findComponent({ name: 'Bar' })
    const chartData = bar.props('data')

    expect(chartData.datasets[0].backgroundColor).toBe('rgba(99, 102, 241, 0.8)')
    expect(chartData.datasets[0].borderRadius).toBe(4)
    expect(chartData.datasets[0].barPercentage).toBe(0.5)
  })

  it('handles zero velocity', () => {
    const wrapper = mount(VelocityChart, {
      props: { velocity: 0 }
    })
    const bar = wrapper.findComponent({ name: 'Bar' })
    const chartData = bar.props('data')

    expect(chartData.datasets[0].data).toEqual([0])
  })

  it('configures title correctly', () => {
    const wrapper = mount(VelocityChart, {
      props: { velocity: 2.5 }
    })
    const bar = wrapper.findComponent({ name: 'Bar' })
    const options = bar.props('options')

    expect(options.plugins.title.display).toBe(true)
    expect(options.plugins.title.text).toBe('Feature Velocity')
  })

  it('configures y-axis to start at zero', () => {
    const wrapper = mount(VelocityChart, {
      props: { velocity: 5.5 }
    })
    const bar = wrapper.findComponent({ name: 'Bar' })
    const options = bar.props('options')

    expect(options.scales.y.beginAtZero).toBe(true)
    expect(options.scales.y.title.text).toBe('Issues / 14 days')
  })

  it('formats tooltip label correctly', () => {
    const wrapper = mount(VelocityChart, {
      props: { velocity: 3.7 }
    })
    const bar = wrapper.findComponent({ name: 'Bar' })
    const options = bar.props('options')

    const label = options.plugins.tooltip.callbacks.label({ parsed: { y: 3.7 } })
    expect(label).toBe('3.7 issues / 14d')
  })

})
