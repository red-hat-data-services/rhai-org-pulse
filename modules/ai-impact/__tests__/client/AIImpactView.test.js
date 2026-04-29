import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ComingSoonPlaceholder from '../../client/components/ComingSoonPlaceholder.vue'
import MetricsRow from '../../client/components/MetricsRow.vue'

describe('ComingSoonPlaceholder', () => {
  it('shows "Coming Soon" with phase name', () => {
    const wrapper = mount(ComingSoonPlaceholder, {
      props: { phaseName: 'Implementation' }
    })
    expect(wrapper.text()).toContain('Coming Soon')
    expect(wrapper.text()).toContain('Implementation')
  })

  it('shows default text when no phaseName given', () => {
    const wrapper = mount(ComingSoonPlaceholder)
    expect(wrapper.text()).toContain('Coming Soon')
    expect(wrapper.text()).toContain('this phase')
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
