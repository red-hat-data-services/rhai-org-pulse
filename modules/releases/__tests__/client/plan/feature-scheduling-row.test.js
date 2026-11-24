import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FeatureSchedulingRow from '../../../client/plan/components/FeatureSchedulingRow.vue'

function feature(overrides) {
  return Object.assign({
    'Key': 'RHAISTRAT-500',
    'Title': 'Example feature',
    'Components': 'AI Hub; AI Core Platform',
    'Outcome': 'AI Hub',
    'Target Versions': '3.6 EA1 RHOAI RELEASE',
    'Priority': 'Major',
    'FPDoR': '17/17',
    _wFPDoR: 100,
    _riskLevel: 'LOW',
    _conf: 82,
    _place: 'EA1'
  }, overrides)
}

describe('FeatureSchedulingRow', () => {
  it('renders key, title, placement badge, and confidence', () => {
    const wrapper = mount(FeatureSchedulingRow, {
      props: { feature: feature() }
    })
    expect(wrapper.text()).toContain('RHAISTRAT-500')
    expect(wrapper.text()).toContain('Example feature')
    expect(wrapper.text()).toContain('EA1')
    expect(wrapper.text()).toContain('82%')
  })

  it('splits the semicolon-joined Components field into chips, overflowing past two', () => {
    const wrapper = mount(FeatureSchedulingRow, {
      props: { feature: feature({ Components: 'A; B; C' }) }
    })
    expect(wrapper.text()).toContain('A')
    expect(wrapper.text()).toContain('B')
    expect(wrapper.text()).toContain('+1')
    expect(wrapper.text()).not.toContain('C')
  })

  it('emits toggle-approval with the feature key and role when a checkbox changes', async () => {
    const wrapper = mount(FeatureSchedulingRow, {
      props: { feature: feature(), approval: { pm: false, do: false } }
    })
    const pmCheckbox = wrapper.find('[data-approval-pm]')
    await pmCheckbox.setValue(true)
    expect(wrapper.emitted('toggle-approval')[0]).toEqual(['RHAISTRAT-500', 'pm'])

    const doCheckbox = wrapper.find('[data-approval-do]')
    await doCheckbox.setValue(true)
    expect(wrapper.emitted('toggle-approval')[1]).toEqual(['RHAISTRAT-500', 'do'])
  })

  it('highlights the row green once both PM and DO approvals are checked', () => {
    const wrapper = mount(FeatureSchedulingRow, {
      props: { feature: feature(), approval: { pm: true, do: true } }
    })
    // Nov 24 2026: Classes now in :class binding array
    const classes = wrapper.find('tr').classes().join(' ')
    expect(classes).toContain('bg-green-50')
  })

  it('shows the FPDoR tier breakdown as a hover tooltip, not permanent inline pills (PR #1877)', () => {
    const wrapper = mount(FeatureSchedulingRow, {
      props: { feature: feature({ FPDoR: '15/17', _wFPDoR: 85, _failedItems: ['Priority'] }) }
    })
    expect(wrapper.find('.fd-item').exists()).toBe(false)
    // Nov 24 2026: Tooltip now rendered as a visual hover element via group-hover
    const tooltipDiv = wrapper.find('.group-hover\\:block')
    expect(tooltipDiv.exists()).toBe(true)
  })
})
