import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FeatureSchedulingFilterBar from '../../../client/plan/components/FeatureSchedulingFilterBar.vue'

function baseFilters(overrides) {
  return Object.assign({
    rel: '', read: '', place: '', outcome: '', tv: [], comp: [], team: [],
    pri: '', fail: '', assign: '', pm: '', bigRockOnly: false, selectedBR: null
  }, overrides)
}

var FILTER_META = {
  versions: ['3.6 EA1 RHOAI RELEASE', '3.6 GA'],
  teams: ['RHOAI AI Hub', 'RHAI Agentic API'],
  components: ['AI Hub', 'AI Core Platform'],
  priorities: ['Major', 'Critical'],
  outcomes: ['AI Hub'],
  pms: ['Jane PM', 'Other PM'],
  assignees: ['Someone']
}

describe('FeatureSchedulingFilterBar', () => {
  it('emits update:modelValue with the selected release', async () => {
    const wrapper = mount(FeatureSchedulingFilterBar, {
      props: { filterMeta: FILTER_META, modelValue: baseFilters() }
    })
    const selects = wrapper.findAll('select')
    const releaseSelect = selects[0]
    await releaseSelect.setValue('3.6 GA')
    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
    expect(emitted[emitted.length - 1][0].rel).toBe('3.6 GA')
  })

  it('emits update:modelValue with the selected PM', async () => {
    const wrapper = mount(FeatureSchedulingFilterBar, {
      props: { filterMeta: FILTER_META, modelValue: baseFilters() }
    })
    const pmSelect = wrapper.findAll('select').find(s => s.findAll('option').some(o => o.text() === 'Jane PM'))
    await pmSelect.setValue('Jane PM')
    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted[emitted.length - 1][0].pm).toBe('Jane PM')
  })

  it('toggles a component into the comp[] array via the multi-select dropdown', async () => {
    const wrapper = mount(FeatureSchedulingFilterBar, {
      props: { filterMeta: FILTER_META, modelValue: baseFilters() }
    })
    await wrapper.find('[aria-expanded]').trigger('click')
    const checkbox = wrapper.findAll('input[type="checkbox"]')[0]
    await checkbox.setValue(true)
    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted[emitted.length - 1][0].comp).toEqual(['AI Hub'])
  })

  it('shows "Clear filters" only when a filter is active, and emits clear on click', async () => {
    const wrapper = mount(FeatureSchedulingFilterBar, {
      props: { filterMeta: FILTER_META, modelValue: baseFilters() }
    })
    expect(wrapper.text()).not.toContain('Clear filters')

    await wrapper.setProps({ modelValue: baseFilters({ pm: 'Jane PM' }) })
    const clearBtn = wrapper.findAll('button').find(b => b.text().includes('Clear filters'))
    expect(clearBtn).toBeTruthy()
    await clearBtn.trigger('click')
    expect(wrapper.emitted('clear')).toBeTruthy()
  })
})
