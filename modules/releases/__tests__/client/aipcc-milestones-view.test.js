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

  it('starts with no release selected and opens a selected timeline at today', async () => {
    const wrapper = mount(AipccMilestonesView)
    await flushPromises()

    expect(wrapper.find('input[type="date"]').element.value).toBe('2026-09-14')
    expect(wrapper.find('[data-testid="timeline-empty-selection"]').text()).toContain('Click on a release to view schedule')
    const releaseFilters = wrapper.findAll('[data-testid="timeline-release-filter"]')
    expect(releaseFilters.every(filter => filter.attributes('aria-pressed') === 'false')).toBe(true)

    await releaseFilters[0].trigger('click')
    await flushPromises()
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

  it('overlays releases and combines same-day milestone colors and details', async () => {
    const wrapper = mount(AipccMilestonesView, { global: { stubs: { Teleport: true } } })
    await flushPromises()
    for (const releaseFilter of wrapper.findAll('[data-testid="timeline-release-filter"]')) {
      await releaseFilter.trigger('click')
    }
    await flushPromises()

    const timeline = wrapper.find('[data-testid="aipcc-overlap-timeline"]')
    expect(timeline.exists()).toBe(true)
    const rows = wrapper.findAll('[data-testid="timeline-event-row"]')
    expect(rows).toHaveLength(3)
    expect(rows[0].classes()).toContain('h-8')
    expect(timeline.text()).not.toContain('Push to stage')
    expect(timeline.text()).toContain('RH AI 3.6 EA1')
    const releaseLabels = timeline.findAll('[data-testid="timeline-release-label"]')
    expect(releaseLabels).toHaveLength(2)
    expect(releaseLabels.map(label => label.text())).toEqual(['RH AI 3.6 EA1', 'RH AI 3.6 GA'])
    expect(rows[0].find('.sticky.left-0').exists()).toBe(true)
    const sameDayEvents = wrapper.findAll('[data-testid="timeline-date-event"][data-event-count="2"]')
    expect(sameDayEvents).toHaveLength(2)
    const sameDayEvent = sameDayEvents[0]
    expect(sameDayEvent.exists()).toBe(true)
    expect(sameDayEvent.attributes('data-multi-release')).toBe('true')
    expect(sameDayEvent.attributes('style')).toContain('conic-gradient')
    expect(sameDayEvent.attributes('style')).toContain('rgb(42, 120, 214)')
    expect(sameDayEvent.attributes('style')).toContain('rgb(27, 175, 122)')

    await sameDayEvent.trigger('pointerenter')
    const tooltip = wrapper.find('[role="tooltip"]')
    expect(tooltip.exists()).toBe(true)
    expect(tooltip.findAll('[data-testid="timeline-tooltip-event"]')).toHaveLength(2)
    expect(tooltip.text()).toContain('RH AI 3.6 EA1')
    expect(tooltip.text()).toContain('Push to stage')
    expect(tooltip.text()).toContain('RH AI 3.6 GA')
    expect(tooltip.text()).toContain('General availability')
    expect(tooltip.text()).toContain('Release · Sep 15')
  })

  it('updates upcoming milestones when the day range changes', async () => {
    const wrapper = mount(AipccMilestonesView)
    await flushPromises()

    await wrapper.find('select').setValue('3')
    expect(wrapper.findAll('article')[2].text()).toContain('Early access')
  })

  it('jumps vertically to the selected date event rows', async () => {
    const wrapper = mount(AipccMilestonesView)
    await flushPromises()
    for (const releaseFilter of wrapper.findAll('[data-testid="timeline-release-filter"]')) {
      await releaseFilter.trigger('click')
    }
    await flushPromises()

    await wrapper.find('input[type="date"]').setValue('2026-09-15')
    await wrapper.findAll('button').find(button => button.text() === 'Go').trigger('click')
    await flushPromises()

    const focusButton = wrapper.find('[data-testid="focus-timeline-date"]')
    expect(focusButton.text()).toContain('Show Sep 15 events')
    expect(focusButton.text()).toContain('2')
    expect(wrapper.findAll('[data-selected-date="true"]')).toHaveLength(2)

    scrollTo.mockClear()
    await focusButton.trigger('click')
    await flushPromises()
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: expect.any(Number) }))
  })

  it('refreshes from the milestone refresh endpoint', async () => {
    const wrapper = mount(AipccMilestonesView)
    await flushPromises()

    await wrapper.findAll('button').find(button => button.text().includes('Refresh data')).trigger('click')
    await flushPromises()
    expect(apiRequest).toHaveBeenCalledWith('/modules/releases/aipcc-milestones/refresh', { method: 'POST' })
  })
})
