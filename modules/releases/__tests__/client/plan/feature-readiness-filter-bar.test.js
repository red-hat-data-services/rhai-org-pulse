import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FeatureReadinessFilterBar from '../../../client/plan/components/FeatureReadinessFilterBar.vue'

var FILTER_META = {
  bigRocks: ['AI Training', 'Model Management', 'AI Serving'],
  targetVersions: ['RHOAI 2.19', 'RHOAI 2.20'],
  fixVersions: ['RHOAI-2.19'],
  components: ['Dashboard', 'Model Serving', 'Pipelines'],
  priorities: ['Blocker', 'Critical', 'Major', 'Normal'],
  teams: ['DW Team', 'MR Team', 'Platform Team']
}

function defaultModelValue() {
  return {
    outcome: [],
    targetVersion: [],
    fixVersion: [],
    component: [],
    priority: [],
    team: [],
    readiness: null
  }
}

function findButtonByText(wrapper, text) {
  return wrapper.findAll('button').filter(function(b) { return b.text().includes(text) })
}

describe('FeatureReadinessFilterBar', function() {

  // ─── Rendering ───

  it('renders readiness single-select dropdown', function() {
    var wrapper = mount(FeatureReadinessFilterBar, {
      props: { filterMeta: FILTER_META, modelValue: defaultModelValue() }
    })
    var selects = wrapper.findAll('select')
    expect(selects.length).toBeGreaterThanOrEqual(1)
    var readinessSelect = selects[0]
    expect(readinessSelect.text()).toContain('All')
    expect(readinessSelect.text()).toContain('Ready')
    expect(readinessSelect.text()).toContain('Not Ready')
  })

  it('renders multi-select buttons for all 6 filter types', function() {
    var wrapper = mount(FeatureReadinessFilterBar, {
      props: { filterMeta: FILTER_META, modelValue: defaultModelValue() }
    })
    expect(wrapper.text()).toContain('All outcomes')
    expect(wrapper.text()).toContain('All versions')
    expect(wrapper.text()).toContain('All fix versions')
    expect(wrapper.text()).toContain('All components')
    expect(wrapper.text()).toContain('All teams')
    expect(wrapper.text()).toContain('All priorities')
  })

  it('hides filter buttons when filterMeta is empty', function() {
    var wrapper = mount(FeatureReadinessFilterBar, {
      props: { filterMeta: {}, modelValue: defaultModelValue() }
    })
    expect(wrapper.text()).not.toContain('All outcomes')
    expect(wrapper.text()).not.toContain('All components')
  })

  it('hides clear button when no filters active', function() {
    var wrapper = mount(FeatureReadinessFilterBar, {
      props: { filterMeta: FILTER_META, modelValue: defaultModelValue() }
    })
    var clearBtn = findButtonByText(wrapper, 'Clear filters')
    if (clearBtn.length > 0) {
      expect(clearBtn[0].isVisible()).toBe(false)
    }
  })

  // ─── Dropdown interaction ───

  it('opens outcome dropdown on click and shows options', async function() {
    var wrapper = mount(FeatureReadinessFilterBar, {
      props: { filterMeta: FILTER_META, modelValue: defaultModelValue() },
      attachTo: document.body
    })
    var outcomeBtn = findButtonByText(wrapper, 'All outcomes')
    expect(outcomeBtn.length).toBe(1)
    await outcomeBtn[0].trigger('click')
    expect(wrapper.text()).toContain('AI Training')
    expect(wrapper.text()).toContain('Model Management')
    expect(wrapper.text()).toContain('AI Serving')
    wrapper.unmount()
  })

  it('opens component dropdown on click and shows options', async function() {
    var wrapper = mount(FeatureReadinessFilterBar, {
      props: { filterMeta: FILTER_META, modelValue: defaultModelValue() },
      attachTo: document.body
    })
    var compBtn = findButtonByText(wrapper, 'All components')
    expect(compBtn.length).toBe(1)
    await compBtn[0].trigger('click')
    expect(wrapper.text()).toContain('Dashboard')
    expect(wrapper.text()).toContain('Model Serving')
    expect(wrapper.text()).toContain('Pipelines')
    wrapper.unmount()
  })

  it('closes one dropdown when another is opened', async function() {
    var wrapper = mount(FeatureReadinessFilterBar, {
      props: { filterMeta: FILTER_META, modelValue: defaultModelValue() },
      attachTo: document.body
    })
    var outcomeBtn = findButtonByText(wrapper, 'All outcomes')
    await outcomeBtn[0].trigger('click')
    expect(wrapper.text()).toContain('AI Training')

    var teamBtn = findButtonByText(wrapper, 'All teams')
    await teamBtn[0].trigger('click')
    expect(wrapper.text()).toContain('DW Team')

    var checkboxes = wrapper.findAll('input[type="checkbox"]')
    var outcomeCheckboxes = checkboxes.filter(function(cb) {
      var label = cb.element.closest('label')
      return label && label.textContent.includes('AI Training')
    })
    expect(outcomeCheckboxes.length).toBe(0)
    wrapper.unmount()
  })

  // ─── Filter value toggling ───

  it('emits update:modelValue when checkbox is toggled in outcome dropdown', async function() {
    var wrapper = mount(FeatureReadinessFilterBar, {
      props: { filterMeta: FILTER_META, modelValue: defaultModelValue() },
      attachTo: document.body
    })
    var outcomeBtn = findButtonByText(wrapper, 'All outcomes')
    await outcomeBtn[0].trigger('click')

    var checkboxes = wrapper.findAll('input[type="checkbox"]')
    expect(checkboxes.length).toBeGreaterThan(0)
    await checkboxes[0].setValue(true)

    var emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeDefined()
    expect(emitted[0][0].outcome).toContain('AI Training')
    wrapper.unmount()
  })

  it('emits update:modelValue when checkbox is toggled in priority dropdown', async function() {
    var wrapper = mount(FeatureReadinessFilterBar, {
      props: { filterMeta: FILTER_META, modelValue: defaultModelValue() },
      attachTo: document.body
    })
    var priorityBtn = findButtonByText(wrapper, 'All priorities')
    await priorityBtn[0].trigger('click')

    var checkboxes = wrapper.findAll('input[type="checkbox"]')
    expect(checkboxes.length).toBeGreaterThan(0)
    await checkboxes[0].setValue(true)

    var emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeDefined()
    expect(emitted[0][0].priority.length).toBe(1)
    wrapper.unmount()
  })

  it('emits update:modelValue when checkbox is toggled in team dropdown', async function() {
    var wrapper = mount(FeatureReadinessFilterBar, {
      props: { filterMeta: FILTER_META, modelValue: defaultModelValue() },
      attachTo: document.body
    })
    var teamBtn = findButtonByText(wrapper, 'All teams')
    await teamBtn[0].trigger('click')

    var checkboxes = wrapper.findAll('input[type="checkbox"]')
    await checkboxes[0].setValue(true)

    var emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeDefined()
    expect(emitted[0][0].team.length).toBe(1)
    wrapper.unmount()
  })

  // ─── Button labels ───

  it('shows single value when one item selected', function() {
    var mv = defaultModelValue()
    mv.outcome = ['AI Training']
    var wrapper = mount(FeatureReadinessFilterBar, {
      props: { filterMeta: FILTER_META, modelValue: mv }
    })
    expect(wrapper.text()).toContain('AI Training')
    expect(wrapper.text()).not.toContain('All outcomes')
  })

  it('shows count when multiple items selected', function() {
    var mv = defaultModelValue()
    mv.priority = ['Major', 'Critical']
    var wrapper = mount(FeatureReadinessFilterBar, {
      props: { filterMeta: FILTER_META, modelValue: mv }
    })
    expect(wrapper.text()).toContain('2 selected')
  })

  it('shows "All" label when no items selected', function() {
    var wrapper = mount(FeatureReadinessFilterBar, {
      props: { filterMeta: FILTER_META, modelValue: defaultModelValue() }
    })
    expect(wrapper.text()).toContain('All outcomes')
    expect(wrapper.text()).toContain('All versions')
    expect(wrapper.text()).toContain('All components')
  })

  // ─── Active filter styling ───

  it('shows clear button when filters are active', function() {
    var mv = defaultModelValue()
    mv.outcome = ['AI Training']
    var wrapper = mount(FeatureReadinessFilterBar, {
      props: { filterMeta: FILTER_META, modelValue: mv }
    })
    var clearBtn = findButtonByText(wrapper, 'Clear filters')
    expect(clearBtn.length).toBeGreaterThan(0)
  })

  it('shows clear button when readiness filter is set', function() {
    var mv = defaultModelValue()
    mv.readiness = 'ready'
    var wrapper = mount(FeatureReadinessFilterBar, {
      props: { filterMeta: FILTER_META, modelValue: mv }
    })
    var clearBtn = findButtonByText(wrapper, 'Clear filters')
    expect(clearBtn.length).toBeGreaterThan(0)
  })

  // ─── Clear filters ───

  it('emits cleared modelValue when clear button is clicked', async function() {
    var mv = defaultModelValue()
    mv.outcome = ['AI Training']
    mv.priority = ['Major']
    mv.readiness = 'ready'
    var wrapper = mount(FeatureReadinessFilterBar, {
      props: { filterMeta: FILTER_META, modelValue: mv }
    })
    var clearBtn = findButtonByText(wrapper, 'Clear filters')
    expect(clearBtn.length).toBeGreaterThan(0)
    await clearBtn[0].trigger('click')

    var emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeDefined()
    var cleared = emitted[emitted.length - 1][0]
    expect(cleared.outcome).toEqual([])
    expect(cleared.priority).toEqual([])
    expect(cleared.readiness).toBeNull()
    expect(cleared.targetVersion).toEqual([])
    expect(cleared.fixVersion).toEqual([])
    expect(cleared.component).toEqual([])
    expect(cleared.team).toEqual([])
  })

  // ─── Readiness single-select ───

  it('emits readiness update when select changes', async function() {
    var wrapper = mount(FeatureReadinessFilterBar, {
      props: { filterMeta: FILTER_META, modelValue: defaultModelValue() }
    })
    var selects = wrapper.findAll('select')
    await selects[0].setValue('ready')

    var emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeDefined()
    expect(emitted[0][0].readiness).toBe('ready')
  })

  it('emits null readiness when "All" is selected', async function() {
    var mv = defaultModelValue()
    mv.readiness = 'ready'
    var wrapper = mount(FeatureReadinessFilterBar, {
      props: { filterMeta: FILTER_META, modelValue: mv }
    })
    var selects = wrapper.findAll('select')
    await selects[0].setValue('')

    var emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeDefined()
    expect(emitted[0][0].readiness).toBeNull()
  })

  // ─── Checkbox state reflects modelValue ───

  it('shows checked checkboxes for already-selected values', async function() {
    var mv = defaultModelValue()
    mv.outcome = ['AI Training']
    var wrapper = mount(FeatureReadinessFilterBar, {
      props: { filterMeta: FILTER_META, modelValue: mv },
      attachTo: document.body
    })
    var outcomeBtn = findButtonByText(wrapper, 'AI Training')
    if (outcomeBtn.length > 0) {
      await outcomeBtn[0].trigger('click')
      var checkboxes = wrapper.findAll('input[type="checkbox"]')
      var checked = checkboxes.filter(function(cb) { return cb.element.checked })
      expect(checked.length).toBeGreaterThanOrEqual(1)
    }
    wrapper.unmount()
  })

  // ─── Unchecking removes value ───

  it('removes value from array when checkbox is unchecked', async function() {
    var mv = defaultModelValue()
    mv.component = ['Dashboard']
    var wrapper = mount(FeatureReadinessFilterBar, {
      props: { filterMeta: FILTER_META, modelValue: mv },
      attachTo: document.body
    })
    var compBtn = findButtonByText(wrapper, 'Dashboard')
    if (compBtn.length > 0) {
      await compBtn[0].trigger('click')
      var checkboxes = wrapper.findAll('input[type="checkbox"]')
      var dashboardCb = checkboxes.filter(function(cb) {
        var label = cb.element.closest('label')
        return label && label.textContent.includes('Dashboard')
      })
      if (dashboardCb.length > 0) {
        await dashboardCb[0].setValue(false)
        var emitted = wrapper.emitted('update:modelValue')
        expect(emitted).toBeDefined()
        var last = emitted[emitted.length - 1][0]
        expect(last.component).toEqual([])
      }
    }
    wrapper.unmount()
  })

  // ─── Active button styling ───

  it('applies active styling to button with selected values', function() {
    var mv = defaultModelValue()
    mv.outcome = ['AI Training']
    var wrapper = mount(FeatureReadinessFilterBar, {
      props: { filterMeta: FILTER_META, modelValue: mv }
    })
    var outcomeBtn = findButtonByText(wrapper, 'AI Training')
    expect(outcomeBtn.length).toBe(1)
    var classes = outcomeBtn[0].classes().join(' ')
    expect(classes).toContain('primary')
  })

  it('applies default styling to button with no selected values', function() {
    var wrapper = mount(FeatureReadinessFilterBar, {
      props: { filterMeta: FILTER_META, modelValue: defaultModelValue() }
    })
    var outcomeBtn = findButtonByText(wrapper, 'All outcomes')
    expect(outcomeBtn.length).toBe(1)
    var classes = outcomeBtn[0].classes().join(' ')
    expect(classes).toContain('border-gray-300')
    expect(classes).not.toContain('border-primary-400')
  })
})
