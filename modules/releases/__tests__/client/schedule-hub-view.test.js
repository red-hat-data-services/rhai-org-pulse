import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ScheduleHubView from '../../client/views/ScheduleHubView.vue'

vi.mock('../../client/views/ScheduleView.vue', () => ({
  default: {
    props: ['initialProducts'],
    emits: ['products-change', 'show-aipcc'],
    template: '<div>Standard schedule content<span class="products">{{ initialProducts.join(\',\') }}</span><button class="rhoai-pill" @click="$emit(\'products-change\', [\'rhoai\'])">rhoai</button><button class="aipcc-pill" @click="$emit(\'show-aipcc\')">AIPCC</button></div>'
  }
}))
vi.mock('../../client/views/AipccMilestonesView.vue', () => ({
  default: { emits: ['show-schedule'], template: '<div>AIPCC milestone content<button class="schedule-back" @click="$emit(\'show-schedule\')">Release Schedule</button></div>' }
}))

describe('ScheduleHubView', () => {
  beforeEach(() => {
    window.location.hash = '#/releases/schedule'
  })

  afterEach(() => {
    window.location.hash = ''
  })

  it('keeps the release schedule as the default without a top milestones tab', async () => {
    const wrapper = mount(ScheduleHubView)
    await flushPromises()

    expect(wrapper.text()).toContain('Standard schedule content')
    expect(wrapper.text()).not.toContain('AIPCC milestone content')

    expect(wrapper.findAll('button')).toHaveLength(2)
  })

  it('opens AIPCC milestones from the schedule pill', async () => {
    const wrapper = mount(ScheduleHubView)
    await flushPromises()

    await wrapper.find('.aipcc-pill').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('AIPCC milestone content')
    expect(window.location.hash).toBe('#/releases/schedule/aipcc')
  })

  it('opens AIPCC milestones from a direct link', async () => {
    window.location.hash = '#/releases/schedule/aipcc'

    const wrapper = mount(ScheduleHubView)
    await flushPromises()

    expect(wrapper.text()).toContain('AIPCC milestone content')
  })

  it('derives the nested route from the current hash and preserves its query', async () => {
    window.location.hash = '#/releases/schedule?range=7'
    const wrapper = mount(ScheduleHubView)
    await flushPromises()

    await wrapper.find('.aipcc-pill').trigger('click')
    await flushPromises()

    expect(window.location.hash).toBe('#/releases/schedule/aipcc?range=7')
  })

  it('derives product URLs from the selected pills', async () => {
    const wrapper = mount(ScheduleHubView)
    await wrapper.find('.rhoai-pill').trigger('click')
    await flushPromises()

    expect(window.location.hash).toBe('#/releases/schedule/rhoai')
    expect(wrapper.find('.products').text()).toBe('rhoai')
  })

  it('returns from milestones to the release schedule', async () => {
    const wrapper = mount(ScheduleHubView)
    await flushPromises()
    await wrapper.find('.aipcc-pill').trigger('click')
    await flushPromises()

    await wrapper.find('.schedule-back').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Standard schedule content')
    expect(window.location.hash).toBe('#/releases/schedule')
  })

  it('follows browser hash navigation', async () => {
    window.location.hash = '#/releases/schedule/aipcc'
    const wrapper = mount(ScheduleHubView)
    await flushPromises()

    window.location.hash = '#/releases/schedule'
    window.dispatchEvent(new Event('hashchange'))
    await flushPromises()

    expect(wrapper.text()).toContain('Standard schedule content')
  })
})
