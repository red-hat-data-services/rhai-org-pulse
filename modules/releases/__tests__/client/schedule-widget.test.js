import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('@shared/client/services/api.js', () => ({
  apiRequest: vi.fn()
}))

vi.mock('@shared/client/composables/useModuleLink.js', () => ({
  useModuleLink: () => ({
    navigateTo: vi.fn(),
    linkTo: vi.fn()
  })
}))

import { apiRequest } from '@shared/client/services/api.js'
import ScheduleWidget from '../../client/widgets/ScheduleWidget.vue'

function makeRelease(id, opts = {}) {
  return {
    id,
    displayName: opts.displayName || id.toUpperCase(),
    state: opts.state || 'active',
    productPagesShortname: opts.shortname || 'rhoai',
    milestones: {
      ga: opts.ga || null,
      codeFreeze: opts.codeFreeze || null,
      planningFreeze: opts.planningFreeze || null
    }
  }
}

function futureDate(daysFromNow) {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d.toISOString().split('T')[0]
}

describe('ScheduleWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading skeleton initially', () => {
    apiRequest.mockReturnValue(new Promise(() => {}))
    const wrapper = mount(ScheduleWidget)
    expect(wrapper.findAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('renders empty state when no upcoming milestones', async () => {
    apiRequest.mockResolvedValue({ releases: [] })
    const wrapper = mount(ScheduleWidget)
    await flushPromises()
    expect(wrapper.text()).toContain('No upcoming milestones')
  })

  it('calls the correct API endpoint', async () => {
    apiRequest.mockResolvedValue({ releases: [] })
    mount(ScheduleWidget)
    await flushPromises()
    expect(apiRequest).toHaveBeenCalledWith('/modules/releases/registry')
  })

  it('shows upcoming milestones sorted by soonest first', async () => {
    apiRequest.mockResolvedValue({
      releases: [
        makeRelease('rhoai-3.5', {
          planningFreeze: futureDate(20),
          codeFreeze: futureDate(40),
          ga: futureDate(60)
        }),
        makeRelease('rhoai-3.4', {
          planningFreeze: futureDate(5),
          ga: futureDate(30)
        })
      ]
    })
    const wrapper = mount(ScheduleWidget)
    await flushPromises()

    const items = wrapper.findAll('[class*="px-5 py-2"]')
    expect(items.length).toBeGreaterThanOrEqual(2)
    expect(items[0].text()).toContain('RHOAI-3.4')
    expect(items[0].text()).toContain('5d')
  })

  it('only shows active releases', async () => {
    apiRequest.mockResolvedValue({
      releases: [
        makeRelease('rhoai-3.5', { state: 'active', ga: futureDate(30) }),
        makeRelease('rhoai-3.4', { state: 'archived', ga: futureDate(10) })
      ]
    })
    const wrapper = mount(ScheduleWidget)
    await flushPromises()
    expect(wrapper.text()).toContain('RHOAI-3.5')
    expect(wrapper.text()).not.toContain('RHOAI-3.4')
  })

  it('excludes past milestones', async () => {
    const past = new Date()
    past.setDate(past.getDate() - 5)
    const pastStr = past.toISOString().split('T')[0]

    apiRequest.mockResolvedValue({
      releases: [
        makeRelease('rhoai-3.5', {
          planningFreeze: pastStr,
          ga: futureDate(30)
        })
      ]
    })
    const wrapper = mount(ScheduleWidget)
    await flushPromises()
    expect(wrapper.text()).not.toContain('Plan Freeze')
    expect(wrapper.text()).toContain('Release')
  })

  it('limits to 6 milestones maximum', async () => {
    apiRequest.mockResolvedValue({
      releases: [
        makeRelease('rhoai-3.4', {
          planningFreeze: futureDate(1),
          codeFreeze: futureDate(10),
          ga: futureDate(20)
        }),
        makeRelease('rhoai-3.5', {
          planningFreeze: futureDate(25),
          codeFreeze: futureDate(35),
          ga: futureDate(45)
        }),
        makeRelease('rhoai-3.6', {
          planningFreeze: futureDate(50),
          codeFreeze: futureDate(60),
          ga: futureDate(70)
        })
      ]
    })
    const wrapper = mount(ScheduleWidget)
    await flushPromises()

    const items = wrapper.findAll('[class*="px-5 py-2"]')
    expect(items).toHaveLength(6)
  })

  it('shows "Today" for milestones due today', async () => {
    const today = new Date().toISOString().split('T')[0]
    apiRequest.mockResolvedValue({
      releases: [makeRelease('rhoai-3.5', { ga: today })]
    })
    const wrapper = mount(ScheduleWidget)
    await flushPromises()
    expect(wrapper.text()).toContain('Today')
  })

  it('has a "View all" link', async () => {
    apiRequest.mockResolvedValue({
      releases: [makeRelease('rhoai-3.5', { ga: futureDate(10) })]
    })
    const wrapper = mount(ScheduleWidget)
    await flushPromises()
    const viewAll = wrapper.findAll('button').find(b => b.text() === 'View all')
    expect(viewAll).toBeTruthy()
  })

  it('shows error state with retry button', async () => {
    apiRequest.mockRejectedValue(new Error('Network fail'))
    const wrapper = mount(ScheduleWidget)
    await flushPromises()
    expect(wrapper.text()).toContain('Network fail')
    expect(wrapper.text()).toContain('Retry')
  })

  it('accepts a size prop', () => {
    apiRequest.mockReturnValue(new Promise(() => {}))
    const wrapper = mount(ScheduleWidget, { props: { size: 'full' } })
    expect(wrapper.props('size')).toBe('full')
  })

  it('shows widget title "Release Schedule"', async () => {
    apiRequest.mockResolvedValue({ releases: [] })
    const wrapper = mount(ScheduleWidget)
    await flushPromises()
    expect(wrapper.text()).toContain('Release Schedule')
  })

  describe('product filter', () => {
    function multiProductPayload() {
      return {
        releases: [
          makeRelease('rhoai-3.5', { shortname: 'rhoai', ga: futureDate(30) }),
          makeRelease('rhelai-1.0', { shortname: 'rhelai', displayName: 'RHELAI-1.0', ga: futureDate(20) }),
          makeRelease('rhaii-1.0', { shortname: 'RHAII', displayName: 'RHAII-1.0', ga: futureDate(10) })
        ]
      }
    }

    it('shows product dropdown when multiple products exist', async () => {
      apiRequest.mockResolvedValue(multiProductPayload())
      const wrapper = mount(ScheduleWidget)
      await flushPromises()
      expect(wrapper.find('select').exists()).toBe(true)
    })

    it('does not show product dropdown with single product', async () => {
      apiRequest.mockResolvedValue({
        releases: [
          makeRelease('rhoai-3.5', { shortname: 'rhoai', ga: futureDate(30) }),
          makeRelease('rhoai-3.4', { shortname: 'rhoai', ga: futureDate(10) })
        ]
      })
      const wrapper = mount(ScheduleWidget)
      await flushPromises()
      expect(wrapper.find('select').exists()).toBe(false)
    })

    it('defaults to showing all products', async () => {
      apiRequest.mockResolvedValue(multiProductPayload())
      const wrapper = mount(ScheduleWidget)
      await flushPromises()
      expect(wrapper.text()).toContain('RHOAI-3.5')
      expect(wrapper.text()).toContain('RHELAI-1.0')
      expect(wrapper.text()).toContain('RHAII-1.0')
    })

    it('filters milestones when a product is selected', async () => {
      apiRequest.mockResolvedValue(multiProductPayload())
      const wrapper = mount(ScheduleWidget)
      await flushPromises()

      await wrapper.find('select').setValue('rhoai')
      expect(wrapper.text()).toContain('RHOAI-3.5')
      expect(wrapper.text()).not.toContain('RHELAI-1.0')
      expect(wrapper.text()).not.toContain('RHAII-1.0')
    })

    it('shows all milestones again when filter is reset', async () => {
      apiRequest.mockResolvedValue(multiProductPayload())
      const wrapper = mount(ScheduleWidget)
      await flushPromises()

      await wrapper.find('select').setValue('rhoai')
      await wrapper.find('select').setValue('')
      expect(wrapper.text()).toContain('RHOAI-3.5')
      expect(wrapper.text()).toContain('RHELAI-1.0')
    })
  })
})
