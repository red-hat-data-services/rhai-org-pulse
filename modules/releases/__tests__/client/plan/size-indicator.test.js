import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SizeIndicator from '../../../client/plan/components/SizeIndicator.vue'

describe('SizeIndicator', function() {
  it('renders epic and item counts', function() {
    var wrapper = mount(SizeIndicator, { props: { epicCount: 3, issueCount: 12 } })
    expect(wrapper.text()).toContain('3 epics')
    expect(wrapper.text()).toContain('12 items')
  })

  it('uses singular form for 1 epic and 1 item', function() {
    var wrapper = mount(SizeIndicator, { props: { epicCount: 1, issueCount: 1 } })
    expect(wrapper.text()).toContain('1 epic')
    expect(wrapper.text()).toContain('1 item')
    expect(wrapper.text()).not.toContain('epics')
    expect(wrapper.text()).not.toContain('items')
  })

  it('shows only epics when issueCount is 0', function() {
    var wrapper = mount(SizeIndicator, { props: { epicCount: 5, issueCount: 0 } })
    expect(wrapper.text()).toContain('5 epics')
    expect(wrapper.text()).not.toContain('items')
  })

  it('shows only items when epicCount is 0', function() {
    var wrapper = mount(SizeIndicator, { props: { epicCount: 0, issueCount: 8 } })
    expect(wrapper.text()).toContain('8 items')
    expect(wrapper.text()).not.toContain('epic')
  })

  it('renders RICE badge when rice is a number', function() {
    var wrapper = mount(SizeIndicator, { props: { epicCount: 1, issueCount: 1, rice: 42 } })
    expect(wrapper.text()).toContain('RICE 42')
  })

  it('renders RICE badge when rice is an object with score', function() {
    var wrapper = mount(SizeIndicator, { props: { epicCount: 1, issueCount: 1, rice: { score: 99 } } })
    expect(wrapper.text()).toContain('RICE 99')
  })

  it('does not render RICE badge when rice is null', function() {
    var wrapper = mount(SizeIndicator, { props: { epicCount: 2, issueCount: 3 } })
    expect(wrapper.text()).not.toContain('RICE')
  })

  it('renders green bar when completionPct >= 80', function() {
    var wrapper = mount(SizeIndicator, { props: { epicCount: 1, issueCount: 1, completionPct: 85 } })
    var bar = wrapper.find('.bg-green-500')
    expect(bar.exists()).toBe(true)
  })

  it('renders yellow bar when completionPct is between 50 and 79', function() {
    var wrapper = mount(SizeIndicator, { props: { epicCount: 1, issueCount: 1, completionPct: 60 } })
    var bar = wrapper.find('.bg-yellow-500')
    expect(bar.exists()).toBe(true)
  })

  it('renders nothing when totalItems is 0', function() {
    var wrapper = mount(SizeIndicator, { props: { epicCount: 0, issueCount: 0 } })
    expect(wrapper.text()).toBe('')
  })
})
