import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

const captured = vi.hoisted(function () {
  return { options: null }
})

vi.mock('chart.js', function () {
  return {
    Chart: { register: vi.fn() },
    CategoryScale: {},
    Legend: {},
    LineElement: {},
    LinearScale: {},
    PointElement: {},
    Tooltip: {}
  }
})

vi.mock('vue-chartjs', function () {
  return {
    Line: {
      props: ['data', 'options'],
      created: function () { captured.options = this.options },
      template: '<canvas data-testid="line-chart-stub" />'
    }
  }
})

import TechDebtWeeklyBugChart from '../../../client/execute/components/TechDebtWeeklyBugChart.vue'

const weeks = [
  { week: '2026-W46', startDate: '2026-11-09', created: 8, resolved: 5 },
  { week: '2026-W47', startDate: '2026-11-16', created: 10, resolved: 7 }
]

describe('TechDebtWeeklyBugChart', function () {
  beforeEach(function () {
    captured.options = null
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get: function () { return this.getAttribute('data-testid') === 'tech-debt-weekly-chart-scroller' ? 1200 : 0 }
    })
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: function () { return this.getAttribute('data-testid') === 'tech-debt-weekly-chart-scroller' ? 400 : 0 }
    })
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get: function () { return this.dataset.techDebtWeeklyTooltip ? 200 : 0 }
    })
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get: function () { return this.dataset.techDebtWeeklyTooltip ? 80 : 0 }
    })
  })

  afterEach(function () {
    document.querySelectorAll('[data-tech-debt-weekly-tooltip]').forEach(function (element) { element.remove() })
  })

  it('uses explicit line-style legend keys and starts at the newest weeks', async function () {
    const wrapper = mount(TechDebtWeeklyBugChart, { props: { weeks } })
    await nextTick()
    await nextTick()

    expect(wrapper.text()).toContain('Created Bugs')
    expect(wrapper.text()).toContain('Resolved Bugs')
    expect(captured.options.plugins.legend.display).toBe(false)
    expect(wrapper.get('[data-testid="tech-debt-weekly-chart-scroller"]').element.scrollLeft).toBe(800)
    expect(captured.options.layout.padding.left).toBe(64)
    expect(wrapper.get('[data-testid="tech-debt-weekly-sticky-axis"]').text()).toContain('Bugs')
    wrapper.unmount()
  })

  it('pins a DOM Bugs axis to the scroller and shares a fixed scale with Chart.js', async function () {
    const wrapper = mount(TechDebtWeeklyBugChart, { props: { weeks } })
    await nextTick()
    await nextTick()

    const axis = wrapper.get('[data-testid="tech-debt-weekly-sticky-axis"]')
    expect(axis.classes()).toContain('sticky')
    expect(axis.classes()).toContain('left-0')
    expect(captured.options.scales.y.max).toBe(10)
    expect(captured.options.scales.y.ticks.stepSize).toBe(2)
    expect(axis.text()).toContain('10')
    expect(axis.text()).toContain('0')
    wrapper.unmount()
  })

  it('renders an unclipped viewport-aware tooltip and removes it on unmount', function () {
    const wrapper = mount(TechDebtWeeklyBugChart, { props: { weeks } })
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 600 })

    captured.options.plugins.tooltip.external({
      chart: { canvas: { getBoundingClientRect: function () { return { left: 550, top: 100 } } } },
      tooltip: {
        opacity: 1,
        caretX: 40,
        caretY: 120,
        dataPoints: [
          { dataIndex: 1, dataset: { label: 'Created' }, formattedValue: '10' },
          { dataIndex: 1, dataset: { label: 'Resolved' }, formattedValue: '7' }
        ]
      }
    })

    const tooltip = document.querySelector('[data-tech-debt-weekly-tooltip]')
    expect(tooltip.textContent).toContain('2026-W47')
    expect(tooltip.textContent).toContain('Created: 10')
    expect(tooltip.textContent).toContain('Resolved: 7')
    expect(tooltip.style.left).toBe('492px')
    expect(tooltip.style.position).toBe('fixed')

    wrapper.unmount()
    expect(document.querySelector('[data-tech-debt-weekly-tooltip]')).toBeNull()
  })
})
