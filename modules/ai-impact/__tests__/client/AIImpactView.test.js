import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PhaseSidebar from '../../client/components/PhaseSidebar.vue'
import ComingSoonPlaceholder from '../../client/components/ComingSoonPlaceholder.vue'
import MetricsRow from '../../client/components/MetricsRow.vue'

const phases = [
  { id: 'rfe-review', name: 'RFE Review', order: 1, status: 'active' },
  { id: 'feature-review', name: 'Feature Review', order: 2, status: 'active' },
  { id: 'implementation', name: 'Implementation', order: 3, status: 'coming-soon' },
  { id: 'qe-validation', name: 'QE / Validation', order: 4, status: 'coming-soon' },
  { id: 'security', name: 'Security Review', order: 5, status: 'coming-soon' },
  { id: 'documentation', name: 'Documentation', order: 6, status: 'coming-soon' },
  { id: 'build-release', name: 'Build & Release', order: 7, status: 'coming-soon' },
]

describe('PhaseSidebar', () => {
  it('renders sidebar with 7 phases', () => {
    const wrapper = mount(PhaseSidebar, {
      props: { phases, selectedPhase: 'rfe-review' }
    })
    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(7)
  })

  it('shows phase names', () => {
    const wrapper = mount(PhaseSidebar, {
      props: { phases, selectedPhase: 'rfe-review' }
    })
    expect(wrapper.text()).toContain('RFE Review')
    expect(wrapper.text()).toContain('Feature Review')
    expect(wrapper.text()).toContain('Build & Release')
  })

  it('disables coming-soon phases', () => {
    const wrapper = mount(PhaseSidebar, {
      props: { phases, selectedPhase: 'rfe-review' }
    })
    const buttons = wrapper.findAll('button')
    // First button (RFE Review) should not be disabled
    expect(buttons[0].attributes('disabled')).toBeUndefined()
    // Second button (Feature Review) should not be disabled (now active)
    expect(buttons[1].attributes('disabled')).toBeUndefined()
    // Third button (Implementation) should be disabled
    expect(buttons[2].attributes('disabled')).toBeDefined()
  })

  it('emits select when active phase is clicked', async () => {
    const wrapper = mount(PhaseSidebar, {
      props: { phases, selectedPhase: 'rfe-review' }
    })
    await wrapper.findAll('button')[0].trigger('click')
    expect(wrapper.emitted('select')).toBeTruthy()
  })
})

describe('ComingSoonPlaceholder', () => {
  it('shows "Coming Soon" for inactive phases', () => {
    const wrapper = mount(ComingSoonPlaceholder, {
      props: { phaseName: 'Implementation' }
    })
    expect(wrapper.text()).toContain('Coming Soon')
    expect(wrapper.text()).toContain('Implementation')
  })
})

describe('MetricsRow', () => {
  it('renders metrics when data is loaded', () => {
    const metrics = {
      createdPct: 77,
      createdChange: 5,
      trend: 'growing',
      revisedCount: 14,
      priorRevisedCount: 11,
      windowTotal: 20,
      totalRFEs: 62
    }
    const wrapper = mount(MetricsRow, { props: { metrics } })
    expect(wrapper.text()).toContain('77%')
    expect(wrapper.text()).toContain('14')
    expect(wrapper.text()).toContain('11 prev period')
    expect(wrapper.text()).toContain('20')
    expect(wrapper.text()).toContain('growing')
  })

  it('renders nothing when metrics is null', () => {
    const wrapper = mount(MetricsRow, { props: { metrics: null } })
    expect(wrapper.text()).toBe('')
  })
})
