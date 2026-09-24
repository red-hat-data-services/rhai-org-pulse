import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('@shared/client/services/api.js', () => ({
  apiRequest: vi.fn()
}))

import { apiRequest } from '@shared/client/services/api.js'
import ScheduleView from '../../client/views/ScheduleView.vue'

function localDateStr(date) {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0')
}
const ReleaseTimelineStub = { template: '<div class="timeline-stub"></div>', props: ['releases', 'focusReleaseIds'] }

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
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 1, 12))
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
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
    const dateStr = localDateStr(futureDate)

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

  it('product pills support multi-select with Clear button', async () => {
    apiRequest.mockResolvedValue({
      releases: [
        makeRelease('rhoai-3.5', { shortname: 'rhoai', ga: '2026-09-15' }),
        makeRelease('rhelai-1.0', { shortname: 'rhelai', displayName: 'RHELAI-1.0', ga: '2026-10-01' }),
        makeRelease('rhaii-1.0', { shortname: 'rhaii', displayName: 'RHAII-1.0', ga: '2026-11-01' })
      ]
    })
    const wrapper = mount(ScheduleView, { global: { stubs: { ReleaseTimeline: ReleaseTimelineStub } } })
    await flushPromises()

    var buttons = wrapper.findAll('button')
    var rhoaiBtn = buttons.find(b => b.text() === 'rhoai')
    var rhelaiBtn = buttons.find(b => b.text() === 'rhelai')
    await rhoaiBtn.trigger('click')
    await rhelaiBtn.trigger('click')

    expect(wrapper.text()).toContain('RHOAI-3.5')
    expect(wrapper.text()).toContain('RHELAI-1.0')
    expect(wrapper.text()).not.toContain('RHAII-1.0')

    var clearBtn = wrapper.findAll('button').find(b => b.text() === 'Clear')
    expect(clearBtn).toBeTruthy()
    await clearBtn.trigger('click')

    expect(wrapper.text()).toContain('RHOAI-3.5')
    expect(wrapper.text()).toContain('RHELAI-1.0')
    expect(wrapper.text()).toContain('RHAII-1.0')
  })

  it('shows filter controls and empty message when filters produce no results', async () => {
    apiRequest.mockResolvedValue({
      releases: [
        makeRelease('rhoai-3.5', { shortname: 'rhoai', ga: '2024-01-01' }),
        makeRelease('rhelai-1.0', { shortname: 'rhelai', displayName: 'RHELAI-1.0', ga: '2024-02-01' })
      ]
    })
    const wrapper = mount(ScheduleView, { global: { stubs: { ReleaseTimeline: ReleaseTimelineStub } } })
    await flushPromises()

    var rhoaiBtn = wrapper.findAll('button').find(b => b.text() === 'rhoai')
    await rhoaiBtn.trigger('click')

    expect(wrapper.text()).toContain('No releases match the current filters')
    expect(wrapper.text()).toContain('rhoai')
    expect(wrapper.text()).toContain('rhelai')
    expect(wrapper.findAll('button').find(b => b.text() === 'Clear')).toBeTruthy()
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
    const dateStr = localDateStr(tomorrow)

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
    const dateStr = localDateStr(today)

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
    const dateStr = localDateStr(past)

    apiRequest.mockResolvedValue({
      releases: [
        makeRelease('rhoai-3.5', { planningFreeze: dateStr, ga: '2028-12-01' })
      ]
    })
    const wrapper = mount(ScheduleView, { global: { stubs: { ReleaseTimeline: ReleaseTimelineStub } } })
    await flushPromises()

    expect(wrapper.text()).toContain('3d ago')
  })

  it('keeps milestone tiles visible for an already-released version (past milestone fallback)', async () => {
    const past = new Date()
    past.setDate(past.getDate() - 5)
    const dateStr = localDateStr(past)

    apiRequest.mockResolvedValue({
      releases: [
        makeRelease('rhoai-3.5-ea1', {
          displayName: '3.5 EA1 RHOAI RELEASE', shortname: 'rhoai', ga: dateStr
        })
      ]
    })
    const wrapper = mount(ScheduleView, {
      props: {},
      global: { stubs: { ReleaseTimeline: ReleaseTimelineStub } }
    })
    await flushPromises()

    // Show released rows so the past-only version is present.
    const hideReleased = wrapper.find('input[type="checkbox"]')
    await hideReleased.setValue(false)
    await flushPromises()

    const cards = wrapper.findAll('[data-testid="milestone-countdown-card"]')
    expect(cards.length).toBeGreaterThan(0)
    expect(wrapper.text()).toContain('days ago')
    expect(wrapper.text()).toContain('5')
  })

  it('auto-unticks "Hide released" when a released version pill is selected', async () => {
    const past = new Date()
    past.setDate(past.getDate() - 5)
    const pastStr = localDateStr(past)
    const future = new Date()
    future.setDate(future.getDate() + 30)
    const futureStr = localDateStr(future)

    apiRequest.mockResolvedValue({
      releases: [
        makeRelease('rhoai-3.5-ea1', {
          displayName: '3.5 EA1 RHOAI RELEASE', shortname: 'rhoai', ga: pastStr
        }),
        makeRelease('rhoai-3.6-ea1', {
          displayName: '3.6 EA1 RHOAI RELEASE', shortname: 'rhoai', ga: futureStr
        })
      ]
    })
    const wrapper = mount(ScheduleView, { global: { stubs: { ReleaseTimeline: ReleaseTimelineStub } } })
    await flushPromises()

    // "Hide released" is on by default.
    const hideReleased = wrapper.find('input[type="checkbox"]')
    expect(hideReleased.element.checked).toBe(true)

    // Selecting the released version pill should untick it and keep the view populated.
    const ea1 = wrapper.findAll('button').find(b => b.text().trim() === '3.5 EA1')
    expect(ea1).toBeTruthy()
    await ea1.trigger('click')
    await flushPromises()

    expect(hideReleased.element.checked).toBe(false)
    expect(wrapper.text()).not.toContain('No releases match the current filters')
    const rows = getReleaseRows(wrapper)
    expect(rows.length).toBe(1)
    expect(wrapper.text()).toContain('3.5 EA1 RHOAI RELEASE')
    expect(wrapper.findAll('[data-testid="milestone-countdown-card"]').length).toBeGreaterThan(0)
  })

  it('does not untick "Hide released" when the selected version is unreleased', async () => {
    const future = new Date()
    future.setDate(future.getDate() + 30)
    const futureStr = localDateStr(future)

    apiRequest.mockResolvedValue({
      releases: [
        makeRelease('rhoai-3.6-ea1', {
          displayName: '3.6 EA1 RHOAI RELEASE', shortname: 'rhoai', ga: futureStr
        }),
        makeRelease('rhoai-3.7-ea1', {
          displayName: '3.7 EA1 RHOAI RELEASE', shortname: 'rhoai', ga: '2028-06-10'
        })
      ]
    })
    const wrapper = mount(ScheduleView, { global: { stubs: { ReleaseTimeline: ReleaseTimelineStub } } })
    await flushPromises()

    const hideReleased = wrapper.find('input[type="checkbox"]')
    expect(hideReleased.element.checked).toBe(true)

    const ea1 = wrapper.findAll('button').find(b => b.text().trim() === '3.6 EA1')
    await ea1.trigger('click')
    await flushPromises()

    // Unreleased selection leaves the toggle untouched.
    expect(hideReleased.element.checked).toBe(true)
  })

  it('shows an N/A tile when a release has no dated milestones', async () => {
    apiRequest.mockResolvedValue({
      releases: [
        makeRelease('rhoai-3.5', {})
      ]
    })
    const wrapper = mount(ScheduleView, { global: { stubs: { ReleaseTimeline: ReleaseTimelineStub } } })
    await flushPromises()

    const cards = wrapper.findAll('[data-testid="milestone-countdown-card"]')
    expect(cards.length).toBe(1)
    expect(cards[0].text()).toContain('N/A')
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

  it('passes focusReleaseIds to the timeline when the newest selected version is released', async () => {
    const past = new Date()
    past.setDate(past.getDate() - 30)
    const pastStr = localDateStr(past)
    const future = new Date()
    future.setDate(future.getDate() + 60)
    const futureStr = localDateStr(future)

    apiRequest.mockResolvedValue({
      releases: [
        makeRelease('rhoai-3.5-ea1', {
          displayName: '3.5 EA1 RHOAI RELEASE', shortname: 'rhoai', ga: pastStr
        }),
        makeRelease('rhoai-3.6-ea1', {
          displayName: '3.6 EA1 RHOAI RELEASE', shortname: 'rhoai', ga: futureStr
        })
      ]
    })
    const wrapper = mount(ScheduleView, { global: { stubs: { ReleaseTimeline: ReleaseTimelineStub } } })
    await flushPromises()

    const ea1 = wrapper.findAll('button').find(b => b.text().trim() === '3.5 EA1')
    await ea1.trigger('click')
    await flushPromises()

    const timeline = wrapper.findComponent(ReleaseTimelineStub)
    expect(timeline.props('focusReleaseIds')).toEqual(['rhoai-3.5-ea1'])
  })

  it('passes focusReleaseIds for an upcoming newest selected version too', async () => {
    const past = new Date()
    past.setDate(past.getDate() - 30)
    const pastStr = localDateStr(past)
    const future = new Date()
    future.setDate(future.getDate() + 60)
    const futureStr = localDateStr(future)

    apiRequest.mockResolvedValue({
      releases: [
        makeRelease('rhoai-3.5-ea1', {
          displayName: '3.5 EA1 RHOAI RELEASE', shortname: 'rhoai', ga: pastStr
        }),
        makeRelease('rhoai-3.6-ea1', {
          displayName: '3.6 EA1 RHOAI RELEASE', shortname: 'rhoai', ga: futureStr
        })
      ]
    })
    const wrapper = mount(ScheduleView, { global: { stubs: { ReleaseTimeline: ReleaseTimelineStub } } })
    await flushPromises()

    // Select both: the newest selected version overall (3.6, upcoming) drives the fit —
    // its future milestones sit off-screen to the right, so the timeline should focus it.
    const ea1 = wrapper.findAll('button').find(b => b.text().trim() === '3.5 EA1')
    await ea1.trigger('click')
    const ea6 = wrapper.findAll('button').find(b => b.text().trim() === '3.6 EA1')
    await ea6.trigger('click')
    await flushPromises()

    const timeline = wrapper.findComponent(ReleaseTimelineStub)
    expect(timeline.props('focusReleaseIds')).toEqual(['rhoai-3.6-ea1'])
  })

  it('focusReleaseIds is empty when no version is selected', async () => {
    apiRequest.mockResolvedValue({
      releases: [
        makeRelease('rhoai-3.5-ea1', {
          displayName: '3.5 EA1 RHOAI RELEASE', shortname: 'rhoai', ga: '2020-06-10'
        }),
        makeRelease('rhoai-3.6-ea1', {
          displayName: '3.6 EA1 RHOAI RELEASE', shortname: 'rhoai', ga: '2028-09-15'
        })
      ]
    })
    const wrapper = mount(ScheduleView, { global: { stubs: { ReleaseTimeline: ReleaseTimelineStub } } })
    await flushPromises()

    const timeline = wrapper.findComponent(ReleaseTimelineStub)
    expect(timeline.props('focusReleaseIds')).toEqual([])
  })

  it('does not re-fit (clears focusReleaseIds) when the newest selected version is deselected', async () => {
    const past1 = new Date()
    past1.setDate(past1.getDate() - 60)
    const past2 = new Date()
    past2.setDate(past2.getDate() - 30)

    apiRequest.mockResolvedValue({
      releases: [
        makeRelease('rhoai-3.5-ea1', {
          displayName: '3.5 EA1 RHOAI RELEASE', shortname: 'rhoai', ga: localDateStr(past1)
        }),
        makeRelease('rhoai-3.6-ea1', {
          displayName: '3.6 EA1 RHOAI RELEASE', shortname: 'rhoai', ga: localDateStr(past2)
        })
      ]
    })
    const wrapper = mount(ScheduleView, { global: { stubs: { ReleaseTimeline: ReleaseTimelineStub } } })
    await flushPromises()

    // Select both released versions; newest (3.6) drives the focus.
    const ea1 = wrapper.findAll('button').find(b => b.text().trim() === '3.5 EA1')
    await ea1.trigger('click')
    const ea6 = wrapper.findAll('button').find(b => b.text().trim() === '3.6 EA1')
    await ea6.trigger('click')
    await flushPromises()
    const timeline = wrapper.findComponent(ReleaseTimelineStub)
    expect(timeline.props('focusReleaseIds')).toEqual(['rhoai-3.6-ea1'])

    // Deselect the newest — a deselection must NOT re-fit, even though 3.5 (older,
    // released) is still selected. Leaves focus empty so the view stays put.
    const ea6Again = wrapper.findAll('button').find(b => b.text().trim() === '3.6 EA1')
    await ea6Again.trigger('click')
    await flushPromises()
    expect(timeline.props('focusReleaseIds')).toEqual([])
  })
})
