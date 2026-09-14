import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ScheduleHubView from '../../client/views/ScheduleHubView.vue'

vi.mock('../../client/views/ScheduleView.vue', () => ({
  default: { emits: ['show-aipcc'], template: '<div>Standard schedule content<button class="aipcc-pill" @click="$emit(\'show-aipcc\')">AIPCC</button></div>' }
}))
vi.mock('../../client/views/AipccMilestonesView.vue', () => ({
  default: { emits: ['show-schedule'], template: '<div>AIPCC milestone content<button class="schedule-back" @click="$emit(\'show-schedule\')">Release Schedule</button></div>' }
}))

describe('ScheduleHubView', () => {
  it('keeps the release schedule as the default without a top milestones tab', async () => {
    const wrapper = mount(ScheduleHubView)
    await flushPromises()

    expect(wrapper.text()).toContain('Standard schedule content')
    expect(wrapper.text()).not.toContain('AIPCC milestone content')

    expect(wrapper.findAll('button')).toHaveLength(1)
  })

  it('opens AIPCC milestones from the schedule pill', async () => {
    const wrapper = mount(ScheduleHubView)
    await flushPromises()

    await wrapper.find('.aipcc-pill').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('AIPCC milestone content')
  })

  it('returns from milestones to the release schedule', async () => {
    const wrapper = mount(ScheduleHubView)
    await flushPromises()
    await wrapper.find('.aipcc-pill').trigger('click')
    await flushPromises()

    await wrapper.find('.schedule-back').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Standard schedule content')
  })
})
