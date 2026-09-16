import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

vi.mock('@shared/client/services/api.js', () => ({ apiRequest: vi.fn() }))
vi.mock('@shared/client/composables/useAuth', () => ({
  useAuth: () => ({ isAdmin: { value: true } })
}))

import { apiRequest } from '@shared/client/services/api.js'
import AipccMilestonesView from '../../client/views/AipccMilestonesView.vue'

const response = {
  fetchedAt: '2026-09-14T09:00:00.000Z',
  cacheStatus: 'fresh',
  source: { url: 'https://docs.google.com/spreadsheets/d/example/edit' },
  releases: [
    {
      name: 'RH AI 3.6 EA1',
      type: 'ea',
      phases: [{
        name: 'Release',
        milestones: [
          { name: 'Push to stage', startDate: null, targetDate: '2026-09-15' },
          { name: 'Early access', startDate: null, targetDate: '2026-09-17' }
        ]
      }]
    },
    {
      name: 'RH AI 3.6 GA',
      type: 'ga',
      phases: [{ name: 'Release', milestones: [{ name: 'General availability', startDate: null, targetDate: '2026-09-15' }] }]
    }
  ]
}

describe('AipccMilestonesView', () => {
  const originalScrollTo = HTMLElement.prototype.scrollTo
  const scrollTo = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-14T12:00:00'))
    apiRequest.mockResolvedValue(response)
    global.ResizeObserver = class {
      observe() {}
      disconnect() {}
    }
    HTMLElement.prototype.scrollTo = scrollTo
  })

  afterEach(() => {
    HTMLElement.prototype.scrollTo = originalScrollTo
    vi.useRealTimers()
  })

  it('opens the timeline at today after the initial render', async () => {
    const wrapper = mount(AipccMilestonesView)
    await flushPromises()

    expect(wrapper.find('input[type="date"]').element.value).toBe('2026-09-14')
    expect(wrapper.find('[aria-label^="Selected date:"]').attributes('aria-label')).toContain('Sep 14, 2026')
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }))
  })

  it('renders the milestone dashboard with a one-day upcoming default', async () => {
    const wrapper = mount(AipccMilestonesView)
    await flushPromises()

    expect(wrapper.text()).toContain('AIPCC Release Milestones')
    expect(wrapper.text()).toContain('Upcoming Milestones')
    expect(wrapper.text()).toContain('Timeline')
    expect(wrapper.find('select').element.value).toBe('1')
    const upcomingCard = wrapper.findAll('article')[2]
    expect(upcomingCard.text()).toContain('Push to stage')
    expect(upcomingCard.text()).not.toContain('Early access')
    const nextCard = wrapper.findAll('article')[1]
    expect(nextCard.text()).toContain('Push to stage')
    expect(nextCard.text()).toContain('General availability')
  })

  it('updates upcoming milestones when the day range changes', async () => {
    const wrapper = mount(AipccMilestonesView)
    await flushPromises()

    await wrapper.find('select').setValue('3')
    expect(wrapper.findAll('article')[2].text()).toContain('Early access')
  })

  it('refreshes from the milestone refresh endpoint', async () => {
    const wrapper = mount(AipccMilestonesView)
    await flushPromises()

    await wrapper.findAll('button').find(button => button.text().includes('Refresh data')).trigger('click')
    await flushPromises()
    expect(apiRequest).toHaveBeenCalledWith('/modules/releases/aipcc-milestones/refresh', { method: 'POST' })
  })
})
