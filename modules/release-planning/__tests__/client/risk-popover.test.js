import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import RiskPopover from '../../client/components/RiskPopover.vue'
import BigRockHealthPopover from '../../client/components/BigRockHealthPopover.vue'

// ─── RiskPopover ───

describe('RiskPopover', function() {
  it('renders slot content', function() {
    var wrapper = mount(RiskPopover, {
      props: { level: 'green', flags: [], flagCount: 0 },
      slots: { default: '<span class="trigger">dot</span>' }
    })
    expect(wrapper.find('.trigger').exists()).toBe(true)
    expect(wrapper.text()).toContain('dot')
  })

  it('does not show popover by default', function() {
    var wrapper = mount(RiskPopover, {
      props: { level: 'green', flags: [], flagCount: 0 },
      slots: { default: '<span>dot</span>' }
    })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('does not show popover for green level with no flags', async function() {
    var wrapper = mount(RiskPopover, {
      props: { level: 'green', flags: [], flagCount: 0 },
      slots: { default: '<span>dot</span>' },
      attachTo: document.body
    })
    await wrapper.find('[role="button"]').trigger('click')
    await nextTick()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows popover for green level with override', async function() {
    var override = { riskOverride: 'green', reason: 'Manually reviewed' }
    var wrapper = mount(RiskPopover, {
      props: { level: 'green', flags: [], flagCount: 0, override: override },
      slots: { default: '<span>dot</span>' },
      attachTo: document.body
    })
    await wrapper.find('[role="button"]').trigger('click')
    await nextTick()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Override: green')
    wrapper.unmount()
  })

  it('shows red level with flags', async function() {
    var flags = [
      { category: 'MILESTONE_MISS', severity: 'high', message: 'Behind EA1 FREEZE' },
      { category: 'VELOCITY_LAG', severity: 'medium', message: '12% complete' }
    ]
    var wrapper = mount(RiskPopover, {
      props: { level: 'red', flags: flags, flagCount: 2 },
      slots: { default: '<span>dot</span>' },
      attachTo: document.body
    })
    await wrapper.find('[role="button"]').trigger('click')
    await nextTick()
    expect(wrapper.text()).toContain('Risk: Red')
    expect(wrapper.text()).toContain('2 flags')
    expect(wrapper.text()).toContain('MILESTONE_MISS')
    expect(wrapper.text()).toContain('(high)')
    expect(wrapper.text()).toContain('Behind EA1 FREEZE')
    expect(wrapper.text()).toContain('VELOCITY_LAG')
    expect(wrapper.text()).toContain('(medium)')
    wrapper.unmount()
  })

  it('shows 1 flag without plural', async function() {
    var flags = [{ category: 'VELOCITY_LAG', severity: 'medium', message: '45% complete' }]
    var wrapper = mount(RiskPopover, {
      props: { level: 'yellow', flags: flags, flagCount: 1 },
      slots: { default: '<span>dot</span>' },
      attachTo: document.body
    })
    await wrapper.find('[role="button"]').trigger('click')
    await nextTick()
    expect(wrapper.text()).toContain('1 flag)')
    expect(wrapper.text()).not.toContain('1 flags')
    wrapper.unmount()
  })

  it('shows override section when present', async function() {
    var override = {
      riskOverride: 'yellow',
      reason: 'PM discussed with eng',
      updatedBy: 'jsmith@redhat.com',
      updatedAt: '2026-04-28T00:00:00.000Z'
    }
    var wrapper = mount(RiskPopover, {
      props: { level: 'red', flags: [{ category: 'BLOCKED', severity: 'high', message: 'Blocked' }], flagCount: 1, override: override },
      slots: { default: '<span>dot</span>' },
      attachTo: document.body
    })
    await wrapper.find('[role="button"]').trigger('click')
    await nextTick()
    expect(wrapper.text()).toContain('Override: yellow')
    expect(wrapper.text()).toContain('PM discussed with eng')
    expect(wrapper.text()).toContain('jsmith@redhat.com')
    wrapper.unmount()
  })

  it('does not show override section when null', async function() {
    var wrapper = mount(RiskPopover, {
      props: { level: 'red', flags: [{ category: 'BLOCKED', severity: 'high', message: 'Blocked' }], flagCount: 1, override: null },
      slots: { default: '<span>dot</span>' },
      attachTo: document.body
    })
    await wrapper.find('[role="button"]').trigger('click')
    await nextTick()
    expect(wrapper.text()).not.toContain('Override:')
    wrapper.unmount()
  })

  it('shows planning status in full variant', async function() {
    var dod = { gate: 'dod', passed: false, checks: [
      { id: 'DoD-1', label: 'Owner Assigned', passed: true },
      { id: 'DoD-2', label: 'Fix Version Set', passed: false }
    ] }
    var flags = [{ category: 'MILESTONE_MISS', severity: 'medium', message: 'Behind deadline' }]
    var wrapper = mount(RiskPopover, {
      props: { level: 'yellow', flags: flags, flagCount: 1, dod: dod, planningStatus: 'in-planning', variant: 'full' },
      slots: { default: '<span>dot</span>' },
      attachTo: document.body
    })
    await wrapper.find('[role="button"]').trigger('click')
    await nextTick()
    expect(wrapper.text()).toContain('Planning: In Planning')
    expect(wrapper.text()).toContain('1 DoD check remaining')
    wrapper.unmount()
  })

  it('does not show planning status in compact variant', async function() {
    var flags = [{ category: 'MILESTONE_MISS', severity: 'medium', message: 'Behind deadline' }]
    var wrapper = mount(RiskPopover, {
      props: { level: 'yellow', flags: flags, flagCount: 1, planningStatus: 'in-planning', variant: 'compact' },
      slots: { default: '<span>dot</span>' },
      attachTo: document.body
    })
    await wrapper.find('[role="button"]').trigger('click')
    await nextTick()
    expect(wrapper.text()).not.toContain('Planning:')
    wrapper.unmount()
  })

  it('displays override level in header when override present', async function() {
    var override = { riskOverride: 'green', reason: 'test' }
    var wrapper = mount(RiskPopover, {
      props: { level: 'red', flags: [], flagCount: 0, override: override },
      slots: { default: '<span>dot</span>' },
      attachTo: document.body
    })
    await wrapper.find('[role="button"]').trigger('click')
    await nextTick()
    expect(wrapper.text()).toContain('Risk: Green')
    wrapper.unmount()
  })

  it('shows close button only when pinned', async function() {
    var flags = [{ category: 'BLOCKED', severity: 'high', message: 'Blocked' }]
    var wrapper = mount(RiskPopover, {
      props: { level: 'red', flags: flags, flagCount: 1 },
      slots: { default: '<span>dot</span>' },
      attachTo: document.body
    })
    await wrapper.find('[role="button"]').trigger('click')
    await nextTick()
    var closeBtn = wrapper.find('[aria-label="Close popover"]')
    expect(closeBtn.exists()).toBe(true)
    wrapper.unmount()
  })

  it('has aria-expanded attribute on trigger', function() {
    var wrapper = mount(RiskPopover, {
      props: { level: 'green', flags: [], flagCount: 0 },
      slots: { default: '<span>dot</span>' }
    })
    expect(wrapper.find('[aria-expanded]').exists()).toBe(true)
  })

  it('uses role="dialog" on popover', async function() {
    var flags = [{ category: 'BLOCKED', severity: 'high', message: 'Blocked' }]
    var wrapper = mount(RiskPopover, {
      props: { level: 'red', flags: flags, flagCount: 1 },
      slots: { default: '<span>dot</span>' },
      attachTo: document.body
    })
    await wrapper.find('[role="button"]').trigger('click')
    await nextTick()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    wrapper.unmount()
  })
})

// ─── BigRockHealthPopover ───

describe('BigRockHealthPopover', function() {
  it('renders slot content', function() {
    var wrapper = mount(BigRockHealthPopover, {
      props: { worstLevel: 'green', features: [], totalFlags: 0 },
      slots: { default: '<span class="badge">OK</span>' }
    })
    expect(wrapper.find('.badge').exists()).toBe(true)
  })

  it('shows per-feature breakdown when pinned (only flagged features)', async function() {
    var features = [
      { key: 'RHOAI-1234', level: 'red', flagCount: 2, flagCategories: ['MILESTONE_MISS', 'VELOCITY_LAG'] },
      { key: 'RHOAI-5678', level: 'yellow', flagCount: 1, flagCategories: ['VELOCITY_LAG'] },
      { key: 'RHOAI-9012', level: 'green', flagCount: 0, flagCategories: [] }
    ]
    var wrapper = mount(BigRockHealthPopover, {
      props: { worstLevel: 'red', features: features, totalFlags: 3 },
      slots: { default: '<span>Critical</span>' },
      attachTo: document.body
    })
    await wrapper.find('[role="button"]').trigger('click')
    await nextTick()
    expect(wrapper.text()).toContain('Health: Critical')
    expect(wrapper.text()).toContain('2 features')
    expect(wrapper.text()).toContain('RHOAI-1234')
    expect(wrapper.text()).toContain('Red')
    expect(wrapper.text()).toContain('2 flags')
    expect(wrapper.text()).toContain('MILESTONE_MISS, VELOCITY_LAG')
    expect(wrapper.text()).toContain('RHOAI-5678')
    expect(wrapper.text()).not.toContain('RHOAI-9012')
    wrapper.unmount()
  })

  it('shows +N more for >10 flagged features', async function() {
    var features = []
    for (var i = 0; i < 12; i++) {
      features.push({ key: 'F-' + (i + 1), level: 'yellow', flagCount: 1, flagCategories: ['DOR'] })
    }
    var wrapper = mount(BigRockHealthPopover, {
      props: { worstLevel: 'yellow', features: features, totalFlags: 12 },
      slots: { default: '<span>At Risk</span>' },
      attachTo: document.body
    })
    await wrapper.find('[role="button"]').trigger('click')
    await nextTick()
    expect(wrapper.text()).toContain('+2 more features')
    expect(wrapper.text()).toContain('F-1')
    expect(wrapper.text()).toContain('F-10')
    expect(wrapper.text()).not.toContain('F-11')
    wrapper.unmount()
  })

  it('does not show popover when all features are green', async function() {
    var features = [
      { key: 'F-1', level: 'green', flagCount: 0, flagCategories: [] }
    ]
    var wrapper = mount(BigRockHealthPopover, {
      props: { worstLevel: 'green', features: features, totalFlags: 0 },
      slots: { default: '<span>OK</span>' },
      attachTo: document.body
    })
    await wrapper.find('[role="button"]').trigger('click')
    await nextTick()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows correct label for yellow level', async function() {
    var wrapper = mount(BigRockHealthPopover, {
      props: { worstLevel: 'yellow', features: [{ key: 'F-1', level: 'yellow', flagCount: 1, flagCategories: ['DOR'] }], totalFlags: 1 },
      slots: { default: '<span>At Risk</span>' },
      attachTo: document.body
    })
    await wrapper.find('[role="button"]').trigger('click')
    await nextTick()
    expect(wrapper.text()).toContain('Health: At Risk')
    wrapper.unmount()
  })

  it('shows singular "feature" for 1 flagged feature', async function() {
    var wrapper = mount(BigRockHealthPopover, {
      props: { worstLevel: 'yellow', features: [{ key: 'F-1', level: 'yellow', flagCount: 1, flagCategories: ['DOR'] }], totalFlags: 1 },
      slots: { default: '<span>At Risk</span>' },
      attachTo: document.body
    })
    await wrapper.find('[role="button"]').trigger('click')
    await nextTick()
    expect(wrapper.text()).toContain('1 feature)')
    expect(wrapper.text()).not.toContain('1 features')
    wrapper.unmount()
  })
})
