import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('@shared/client/services/api.js', () => ({
  apiRequest: vi.fn()
}))

import { apiRequest } from '@shared/client/services/api.js'
import ScheduleView from '../../client/views/ScheduleView.vue'
const ReleaseTimelineStub = { template: '<div class="timeline-stub"></div>', props: ['releases'] }

function makeRelease(id, opts = {}) {
  return {
    id,
    displayName: opts.displayName || id.toUpperCase(),
    state: opts.state || 'active',
    productPagesShortname: opts.shortname || 'rhoai',
    milestones: {
      ga: opts.ga || null,
      featureFreeze: opts.featureFreeze || null,
      codeFreeze: opts.codeFreeze || null,
      planningFreeze: opts.planningFreeze || null
    }
  }
}

function getReleaseRows(wrapper) {
  return wrapper.findAll('tbody tr').filter(r => r.findAll('td').length > 1)
}

describe('ScheduleView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state initially', () => {
    apiRequest.mockReturnValue(new Promise(() => {}))
    const wrapper = mount(ScheduleView, { global: { stubs: { ReleaseTimeline: ReleaseTimelineStub } } })
    expect(wrapper.text()).toContain('Loading schedule...')
  })

  it('renders empty state when no releases', async () => {
    apiRequest.mockResolvedValue({ releases: [] })
    const wrapper = mount(ScheduleView, { global: { stubs: { ReleaseTimeline: ReleaseTimelineStub } } })
    await flushPromises()
    expect(wrapper.text()).toContain('No releases found')
  })

  it('renders releases table with milestone data', async () => {
    apiRequest.mockResolvedValue({
      releases: [
        makeRelease('rhoai-3.5', {
          ga: '2026-09-15',
          featureFreeze: '2026-08-01',
          codeFreeze: '2026-08-20',
          planningFreeze: '2026-07-10'
        })
      ]
    })
    const wrapper = mount(ScheduleView, { global: { stubs: { ReleaseTimeline: ReleaseTimelineStub } } })
    await flushPromises()

    expect(wrapper.find('table').exists()).toBe(true)
    expect(wrapper.text()).toContain('RHOAI-3.5')
    expect(wrapper.text()).toContain('Sep 15, 2026')
    expect(wrapper.text()).toContain('Aug 20, 2026')
    expect(wrapper.text()).toContain('Jul 10, 2026')
  })

  it('shows em-dash for missing milestone dates', async () => {
    apiRequest.mockResolvedValue({
      releases: [
        makeRelease('rhoai-3.5', { ga: '2026-09-15' })
      ]
    })
    const wrapper = mount(ScheduleView, { global: { stubs: { ReleaseTimeline: ReleaseTimelineStub } } })
    await flushPromises()

    const cells = wrapper.findAll('td')
    const cellTexts = cells.map(c => c.text())
    const dashCells = cellTexts.filter(t => t === '—')
    expect(dashCells.length).toBe(3)
  })

  it('sorts releases by GA date', async () => {
    apiRequest.mockResolvedValue({
      releases: [
        makeRelease('rhoai-3.6', { ga: '2026-12-01' }),
        makeRelease('rhoai-3.4', { ga: '2026-06-01' }),
        makeRelease('rhoai-3.5', { ga: '2026-09-15' })
      ]
    })
    const wrapper = mount(ScheduleView, { global: { stubs: { ReleaseTimeline: ReleaseTimelineStub } } })
    await flushPromises()

    await wrapper.find('input[type="checkbox"]').setValue(false)
    const rows = getReleaseRows(wrapper)
    expect(rows[0].text()).toContain('RHOAI-3.4')
    expect(rows[1].text()).toContain('RHOAI-3.5')
    expect(rows[2].text()).toContain('RHOAI-3.6')
  })

  it('filters by non-active state (only shows active)', async () => {
    apiRequest.mockResolvedValue({
      releases: [
        makeRelease('rhoai-3.5', { state: 'active', ga: '2026-09-15' }),
        makeRelease('rhoai-3.4', { state: 'archived', ga: '2026-06-01' })
      ]
    })
    const wrapper = mount(ScheduleView, { global: { stubs: { ReleaseTimeline: ReleaseTimelineStub } } })
    await flushPromises()

    const rows = getReleaseRows(wrapper)
    expect(rows).toHaveLength(1)
    expect(wrapper.text()).toContain('RHOAI-3.5')
    expect(wrapper.text()).not.toContain('RHOAI-3.4')
  })

  it('dims released rows (GA in the past)', async () => {
    apiRequest.mockResolvedValue({
      releases: [
        makeRelease('rhoai-3.4', { ga: '2024-01-01' }),
        makeRelease('rhoai-3.5', { ga: '2028-09-15' })
      ]
    })
    const wrapper = mount(ScheduleView, { global: { stubs: { ReleaseTimeline: ReleaseTimelineStub } } })
    await flushPromises()

    await wrapper.find('input[type="checkbox"]').setValue(false)
    const rows = getReleaseRows(wrapper)
    const pastRow = rows[0]
    expect(pastRow.classes()).toContain('opacity-50')
  })

  it('shows global next milestone banner', async () => {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 5)
    const dateStr = futureDate.toISOString().split('T')[0]

    apiRequest.mockResolvedValue({
      releases: [
        makeRelease('rhoai-3.5', { planningFreeze: dateStr, ga: '2028-12-01' })
      ]
    })
    const wrapper = mount(ScheduleView, { global: { stubs: { ReleaseTimeline: ReleaseTimelineStub } } })
    await flushPromises()

    expect(wrapper.text()).toContain('RHOAI-3.5')
    expect(wrapper.text()).toContain('Plan Freeze')
    expect(wrapper.text()).toContain('5d')
  })

  it('shows product filter pills when multiple products', async () => {
    apiRequest.mockResolvedValue({
      releases: [
        makeRelease('rhoai-3.5', { shortname: 'rhoai', ga: '2026-09-15' }),
        makeRelease('rhelai-1.0', { shortname: 'rhelai', displayName: 'RHELAI-1.0', ga: '2026-10-01' })
      ]
    })
    const wrapper = mount(ScheduleView, { global: { stubs: { ReleaseTimeline: ReleaseTimelineStub } } })
    await flushPromises()

    expect(wrapper.text()).toContain('All')
    expect(wrapper.text()).toContain('rhoai')
    expect(wrapper.text()).toContain('rhelai')
  })

  it('filters releases when product pill is clicked', async () => {
    apiRequest.mockResolvedValue({
      releases: [
        makeRelease('rhoai-3.5', { shortname: 'rhoai', ga: '2026-09-15' }),
        makeRelease('rhelai-1.0', { shortname: 'rhelai', displayName: 'RHELAI-1.0', ga: '2026-10-01' })
      ]
    })
    const wrapper = mount(ScheduleView, { global: { stubs: { ReleaseTimeline: ReleaseTimelineStub } } })
    await flushPromises()

    const buttons = wrapper.findAll('button')
    const rhoaiBtn = buttons.find(b => b.text() === 'rhoai')
    await rhoaiBtn.trigger('click')

    const rows = getReleaseRows(wrapper)
    expect(rows).toHaveLength(1)
    expect(wrapper.text()).toContain('RHOAI-3.5')
    expect(wrapper.text()).not.toContain('RHELAI-1.0')
  })

  it('calls the correct API endpoint', async () => {
    apiRequest.mockResolvedValue({ releases: [] })
    mount(ScheduleView, { global: { stubs: { ReleaseTimeline: ReleaseTimelineStub } } })
    await flushPromises()
    expect(apiRequest).toHaveBeenCalledWith('/modules/releases/registry')
  })

  it('shows countdown text for future milestones', async () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dateStr = tomorrow.toISOString().split('T')[0]

    apiRequest.mockResolvedValue({
      releases: [
        makeRelease('rhoai-3.5', { ga: dateStr })
      ]
    })
    const wrapper = mount(ScheduleView, { global: { stubs: { ReleaseTimeline: ReleaseTimelineStub } } })
    await flushPromises()

    expect(wrapper.text()).toContain('1d')
  })

  it('shows "Today" for milestones due today', async () => {
    const today = new Date()
    const dateStr = today.toISOString().split('T')[0]

    apiRequest.mockResolvedValue({
      releases: [
        makeRelease('rhoai-3.5', { ga: dateStr })
      ]
    })
    const wrapper = mount(ScheduleView, { global: { stubs: { ReleaseTimeline: ReleaseTimelineStub } } })
    await flushPromises()

    expect(wrapper.text()).toContain('Today')
  })

  it('shows "d ago" for past milestones', async () => {
    const past = new Date()
    past.setDate(past.getDate() - 3)
    const dateStr = past.toISOString().split('T')[0]

    apiRequest.mockResolvedValue({
      releases: [
        makeRelease('rhoai-3.5', { planningFreeze: dateStr, ga: '2028-12-01' })
      ]
    })
    const wrapper = mount(ScheduleView, { global: { stubs: { ReleaseTimeline: ReleaseTimelineStub } } })
    await flushPromises()

    expect(wrapper.text()).toContain('3d ago')
  })

  it('refresh button re-fetches registry', async () => {
    apiRequest.mockResolvedValue({ releases: [makeRelease('rhoai-3.5', { ga: '2026-09-15' })] })
    const wrapper = mount(ScheduleView, { global: { stubs: { ReleaseTimeline: ReleaseTimelineStub } } })
    await flushPromises()

    apiRequest.mockResolvedValue({ releases: [makeRelease('rhoai-3.5', { ga: '2026-09-20' })] })
    const refreshBtn = wrapper.findAll('button').find(b => b.text() === 'Refresh')
    await refreshBtn.trigger('click')
    await flushPromises()

    expect(apiRequest).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('Sep 20, 2026')
  })

  it('version filter pills appear when multiple versions exist', async () => {
    apiRequest.mockResolvedValue({
      releases: [
        makeRelease('rhoai-3.5-ea1', {
          displayName: '3.5 EA1 RHOAI RELEASE', shortname: 'rhoai', ga: '2028-06-10'
        }),
        makeRelease('rhoai-3.5-ga', {
          displayName: '3.5 GA RHOAI RELEASE', shortname: 'rhoai', ga: '2028-08-18'
        }),
        makeRelease('rhoai-3.6-ea1', {
          displayName: '3.6 EA1 RHOAI RELEASE', shortname: 'rhoai', ga: '2028-09-15'
        })
      ]
    })
    const wrapper = mount(ScheduleView, { global: { stubs: { ReleaseTimeline: ReleaseTimelineStub } } })
    await flushPromises()
    var buttons = wrapper.findAll('button').filter(b => /^\d+\.\d+\s+(EA\d+|GA)$/.test(b.text().trim()))
    expect(buttons.length).toBe(3)
  })

  it('version pills are sorted most-recent-first', async () => {
    apiRequest.mockResolvedValue({
      releases: [
        makeRelease('rhoai-3.5-ea1', {
          displayName: '3.5 EA1 RHOAI RELEASE', shortname: 'rhoai', ga: '2028-06-10'
        }),
        makeRelease('rhoai-3.5-ga', {
          displayName: '3.5 GA RHOAI RELEASE', shortname: 'rhoai', ga: '2028-08-18'
        }),
        makeRelease('rhoai-3.6-ea1', {
          displayName: '3.6 EA1 RHOAI RELEASE', shortname: 'rhoai', ga: '2028-09-15'
        })
      ]
    })
    const wrapper = mount(ScheduleView, { global: { stubs: { ReleaseTimeline: ReleaseTimelineStub } } })
    await flushPromises()
    var buttons = wrapper.findAll('button').filter(b => /^\d+\.\d+\s+(EA\d+|GA)$/.test(b.text().trim()))
    var labels = buttons.map(b => b.text().trim())
    expect(labels).toEqual(['3.6 EA1', '3.5 GA', '3.5 EA1'])
  })

  it('clicking a version pill filters the releases passed to timeline', async () => {
    apiRequest.mockResolvedValue({
      releases: [
        makeRelease('rhoai-3.5-ga', {
          displayName: '3.5 GA RHOAI RELEASE', shortname: 'rhoai', ga: '2028-08-18'
        }),
        makeRelease('rhoai-3.6-ea1', {
          displayName: '3.6 EA1 RHOAI RELEASE', shortname: 'rhoai', ga: '2028-09-15'
        })
      ]
    })
    const wrapper = mount(ScheduleView, { global: { stubs: { ReleaseTimeline: ReleaseTimelineStub } } })
    await flushPromises()
    var versionBtns = wrapper.findAll('button').filter(b => b.text().trim() === '3.5 GA')
    expect(versionBtns.length).toBe(1)
    await versionBtns[0].trigger('click')
    var timeline = wrapper.findComponent(ReleaseTimelineStub)
    expect(timeline.props('releases').length).toBe(1)
    expect(timeline.props('releases')[0].id).toBe('rhoai-3.5-ga')
  })

  it('multi-select: two version pills can be active simultaneously', async () => {
    apiRequest.mockResolvedValue({
      releases: [
        makeRelease('rhoai-3.5-ea1', {
          displayName: '3.5 EA1 RHOAI RELEASE', shortname: 'rhoai', ga: '2028-06-10'
        }),
        makeRelease('rhoai-3.5-ga', {
          displayName: '3.5 GA RHOAI RELEASE', shortname: 'rhoai', ga: '2028-08-18'
        }),
        makeRelease('rhoai-3.6-ea1', {
          displayName: '3.6 EA1 RHOAI RELEASE', shortname: 'rhoai', ga: '2028-09-15'
        })
      ]
    })
    const wrapper = mount(ScheduleView, { global: { stubs: { ReleaseTimeline: ReleaseTimelineStub } } })
    await flushPromises()
    var ea1Btn = wrapper.findAll('button').filter(b => b.text().trim() === '3.5 EA1')[0]
    var gaBtn = wrapper.findAll('button').filter(b => b.text().trim() === '3.5 GA')[0]
    await ea1Btn.trigger('click')
    await gaBtn.trigger('click')
    var timeline = wrapper.findComponent(ReleaseTimelineStub)
    expect(timeline.props('releases').length).toBe(2)
  })

  it('Clear button resets version filter', async () => {
    apiRequest.mockResolvedValue({
      releases: [
        makeRelease('rhoai-3.5-ga', {
          displayName: '3.5 GA RHOAI RELEASE', shortname: 'rhoai', ga: '2028-08-18'
        }),
        makeRelease('rhoai-3.6-ea1', {
          displayName: '3.6 EA1 RHOAI RELEASE', shortname: 'rhoai', ga: '2028-09-15'
        })
      ]
    })
    const wrapper = mount(ScheduleView, { global: { stubs: { ReleaseTimeline: ReleaseTimelineStub } } })
    await flushPromises()
    var versionBtn = wrapper.findAll('button').filter(b => b.text().trim() === '3.5 GA')[0]
    await versionBtn.trigger('click')
    var clearBtn = wrapper.findAll('button').filter(b => b.text().trim() === 'Clear')[0]
    expect(clearBtn).toBeTruthy()
    await clearBtn.trigger('click')
    var timeline = wrapper.findComponent(ReleaseTimelineStub)
    expect(timeline.props('releases').length).toBe(2)
  })
})
