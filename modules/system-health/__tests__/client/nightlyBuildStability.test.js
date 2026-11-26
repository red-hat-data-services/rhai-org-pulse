import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import NightlyHealthTable from '../../client/components/NightlyHealthTable.vue'
import FilterBar from '../../client/components/FilterBar.vue'
import { compareVersionRelease, parseVersionRelease } from '../../client/utils/versionFilter.js'
import {
  EMPTY_DAY_REASON,
  calendarDatesDesc,
  collectNightlyVersionReleases,
  emptyNightlyDayMessage,
  filterNightlyDayByVersionRelease,
  shiftDateWindow,
  useNightlyHealthMatrix
} from '../../client/composables/useNightlyHealthMatrix'

/** One nightly BVT run of an RHOAI build version. */
function run(id, rhoaiVersion, startedAt, state = 'ready') {
  return {
    run_id: id,
    build_number: Number(id.split(':')[1]),
    started_at: startedAt,
    promotion_gate: { rhoai_version: rhoaiVersion },
    gates: [{ id: 'operator-health', source_status: 'passed', state: 'ready' }],
    components: [{ id: 'dashboard', name: 'Dashboard', state }]
  }
}

/** Nov 24: 3.7-EA1 (newer) + 3.6 GA; Nov 23: 3.6 GA only; Nov 22: 3.7-EA1 only. */
const payload = {
  schema_version: 1,
  days: [
    {
      date: '2026-11-24',
      stream_key: 'rhoai-nightly-bvt',
      latest_run_id: 'bvt:12',
      runs: [
        run('bvt:11', '3.6.0', '2026-11-24T01:00:00Z', 'failed'),
        run('bvt:12', '3.7.0-ea.1', '2026-11-24T05:00:00Z')
      ]
    },
    {
      date: '2026-11-23',
      stream_key: 'rhoai-nightly-bvt',
      latest_run_id: 'bvt:10',
      runs: [run('bvt:10', '3.6.0', '2026-11-23T05:00:00Z')]
    },
    {
      date: '2026-11-22',
      stream_key: 'rhoai-nightly-bvt',
      latest_run_id: 'bvt:9',
      runs: [run('bvt:9', '3.7.0-ea.1', '2026-11-22T05:00:00Z')]
    }
  ]
}

describe('parseVersionRelease / compareVersionRelease', () => {
  it('maps build versions to the filter version and release', () => {
    expect(parseVersionRelease('3.7.0-ea.1')).toEqual({ version: '3.7', release: 'EA1' })
    expect(parseVersionRelease('v3.6.0-ea.2')).toEqual({ version: '3.6', release: 'EA2' })
    expect(parseVersionRelease('3.6.0')).toEqual({ version: '3.6', release: 'GA' })
    expect(parseVersionRelease('3.5.3')).toEqual({ version: '3.5.3', release: 'GA' })
    expect(parseVersionRelease('3.6')).toEqual({ version: '3.6', release: 'GA' })
    expect(parseVersionRelease('rhoai-nightly')).toBeNull()
    expect(parseVersionRelease(null)).toBeNull()
  })

  it('orders 3.x-EA1 < 3.x-EA2 < 3.x < 3.x.1 < 3.(x+1)-EA1', () => {
    const order = [
      { version: '3.6', release: 'EA1' },
      { version: '3.6', release: 'EA2' },
      { version: '3.6', release: 'GA' },
      { version: '3.6.1', release: 'GA' },
      { version: '3.7', release: 'EA1' }
    ]
    const shuffled = [order[3], order[0], order[4], order[2], order[1]]
    expect(shuffled.sort(compareVersionRelease)).toEqual(order)
  })
})

describe('nightly version and date window helpers', () => {
  it('collects version/release pairs newest first', () => {
    expect(collectNightlyVersionReleases(payload)).toEqual([
      { version: '3.7', release: 'EA1' },
      { version: '3.6', release: 'GA' }
    ])
    expect(collectNightlyVersionReleases(null)).toEqual([])
  })

  it('keeps only the matching runs of a day and re-selects the newest one', () => {
    const nov24 = payload.days[0]
    const ga = filterNightlyDayByVersionRelease(nov24, { version: '3.6', release: 'GA' })
    expect(ga.runs.map((r) => r.run_id)).toEqual(['bvt:11'])
    expect(ga.latest_run_id).toBe('bvt:11')

    const ea = filterNightlyDayByVersionRelease(nov24, { version: '3.7', release: 'EA1' })
    expect(ea.latest_run_id).toBe('bvt:12')

    expect(filterNightlyDayByVersionRelease(nov24, { version: '3.7', release: 'GA' })).toBeNull()
    expect(filterNightlyDayByVersionRelease(nov24, null)).toBe(nov24)
  })

  it('lists calendar dates newest first, inclusive', () => {
    expect(calendarDatesDesc('2026-11-20', '2026-11-24')).toEqual([
      '2026-11-24', '2026-11-23', '2026-11-22', '2026-11-21', '2026-11-20'
    ])
    expect(calendarDatesDesc('2026-11-28', '2026-12-01')).toEqual([
      '2026-12-01', '2026-11-30', '2026-11-29', '2026-11-28'
    ])
    expect(calendarDatesDesc('2026-11-24', '2026-11-20')).toEqual([])
    expect(calendarDatesDesc('bad', '2026-11-20')).toEqual([])
  })

  it('explains empty columns', () => {
    const filter = { version: '3.7', release: 'EA1' }
    expect(emptyNightlyDayMessage({ empty_reason: EMPTY_DAY_REASON.NO_RUNS }, filter)).toBe('No nightly run')
    expect(emptyNightlyDayMessage({ empty_reason: EMPTY_DAY_REASON.NO_MATCHING_RUNS }, filter))
      .toBe('No 3.7 EA1 run')
    expect(emptyNightlyDayMessage(payload.days[0], filter)).toBe('')
  })

  it('moves a date window by its length and stops newer at the max date', () => {
    const window = { from: '2026-11-16', to: '2026-11-20' }
    expect(shiftDateWindow(window, -1)).toEqual({ from: '2026-11-11', to: '2026-11-15' })
    expect(shiftDateWindow(window, 1, '2026-11-30')).toEqual({ from: '2026-11-21', to: '2026-11-25' })
    expect(shiftDateWindow(window, 1, '2026-11-23')).toEqual({ from: '2026-11-19', to: '2026-11-23' })
    expect(shiftDateWindow({ from: '2026-11-30', to: '2026-12-01' }, 1)).toEqual({ from: '2026-12-02', to: '2026-12-03' })
    expect(shiftDateWindow({ from: 'bad', to: '2026-11-20' }, 1)).toEqual({ from: 'bad', to: '2026-11-20' })
  })

  it('builds one column per date in the window, with placeholders', () => {
    const options = ref({
      versionFilter: { version: '3.6', release: 'GA' },
      dateWindow: { from: '2026-11-21', to: '2026-11-24' }
    })
    const { visibleDays } = useNightlyHealthMatrix(ref(payload), null, null, options)
    expect(visibleDays.value.map((d) => [d.date, d.latest_run_id, d.empty_reason ?? null])).toEqual([
      ['2026-11-24', 'bvt:11', null],
      ['2026-11-23', 'bvt:10', null],
      ['2026-11-22', null, EMPTY_DAY_REASON.NO_MATCHING_RUNS],
      ['2026-11-21', null, EMPTY_DAY_REASON.NO_RUNS]
    ])
  })

  it('keeps the snapshot pager when no date window is given', () => {
    const { visibleDays } = useNightlyHealthMatrix(ref(payload))
    expect(visibleDays.value.map((d) => d.date)).toEqual(['2026-11-24', '2026-11-23', '2026-11-22'])
  })

  it('still applies the version filter on the snapshot pager (From or To cleared)', () => {
    const options = ref({ versionFilter: { version: '3.7', release: 'EA1' }, dateWindow: null })
    const { visibleDays } = useNightlyHealthMatrix(ref(payload), null, null, options)
    expect(visibleDays.value.map((d) => [d.date, d.latest_run_id, d.empty_reason ?? null])).toEqual([
      ['2026-11-24', 'bvt:12', null],
      ['2026-11-23', null, EMPTY_DAY_REASON.NO_MATCHING_RUNS],
      ['2026-11-22', 'bvt:9', null]
    ])
  })
})

describe('NightlyHealthTable in Nightly Build Stability mode', () => {
  /** @type {import('@vue/test-utils').VueWrapper|null} */
  let wrapper = null

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  function mountTable(props = {}) {
    wrapper = mount(NightlyHealthTable, {
      props: {
        payload,
        versionFilter: { version: '3.7', release: 'EA1' },
        dateWindow: { from: '2026-11-21', to: '2026-11-24' },
        cellsOpenDayPanel: false,
        ...props
      },
      attachTo: document.body
    })
    return wrapper
  }

  it('shows a message on dates without a run for the selected version', async () => {
    mountTable()
    await nextTick()
    const headers = wrapper.findAll('th.date-header')
    expect(headers).toHaveLength(4)
    expect(headers[1].text()).toContain('No 3.7 EA1 run')
    expect(headers[3].text()).toContain('No nightly run')
    // Window pager only: no snapshot pager notice, hint or stream selector
    expect(wrapper.findAll('.pager-toolbar')).toHaveLength(1)
    expect(wrapper.find('.pager-job-select').exists()).toBe(false)
    expect(wrapper.find('.day-snapshot-hint').exists()).toBe(false)
  })

  it('opens the day panel from the date header only', async () => {
    mountTable()
    await nextTick()
    expect(wrapper.find('button.cell-btn').exists()).toBe(false)
    await wrapper.find('div.cell-btn').trigger('click')
    expect(document.body.querySelector('.nightly-day-popup')).toBeNull()

    await wrapper.find('.date-header-btn').trigger('click')
    await nextTick()
    const popup = document.body.querySelector('.nightly-day-popup')
    expect(popup?.textContent).toContain('Runs on 2026-11-24')
  })

  it('shows Newer / Older above the table and asks the parent to move the window', async () => {
    mountTable({ windowMaxDate: '2026-11-24' })
    await nextTick()
    const toolbar = wrapper.find('.pager-toolbar')
    expect(toolbar.text()).toContain('Nov 24 – Nov 21')
    const [newer, older] = toolbar.findAll('.pager-btn')
    expect(newer.text()).toContain('Newer 4 days')
    expect(newer.attributes('disabled')).toBeDefined()
    await older.trigger('click')
    expect(wrapper.emitted('step-window')).toEqual([[-1]])
  })

  it('highlights only the date header of the open day, not the column cells', async () => {
    mountTable()
    await nextTick()
    await wrapper.find('.date-header-btn').trigger('click')
    await nextTick()
    expect(wrapper.find('th.date-header--selected').exists()).toBe(true)
    expect(wrapper.find('td.data-cell--selected').exists()).toBe(false)
  })

  it('does not make a date without any run clickable', async () => {
    mountTable()
    await nextTick()
    const nov21 = wrapper.findAll('th.date-header')[3]
    expect(nov21.find('button').exists()).toBe(false)
  })

  it('keeps clickable cells by default (Promotion Gate tab)', async () => {
    wrapper = mount(NightlyHealthTable, { props: { payload }, attachTo: document.body })
    await nextTick()
    expect(wrapper.find('button.cell-btn').exists()).toBe(true)
  })
})

describe('FilterBar in Nightly Build Stability mode', () => {
  const filters = {
    product: 'RHOAI',
    version: '3.7',
    release: 'EA1',
    useDateRange: true,
    fromDate: '2026-11-16',
    toDate: '2026-11-20'
  }

  function mountBar(props = {}) {
    return mount(FilterBar, {
      props: {
        filters,
        versions: ['3.6', '3.7'],
        releases: ['EA1'],
        allowAll: false,
        showDateToggle: false,
        maxDate: '2026-11-25',
        ...props
      }
    })
  }

  it('offers RHOAI as the only product, no "All" and no date toggle', () => {
    const bar = mountBar()
    expect(bar.find('#te-filter-product').findAll('option').map((o) => o.text())).toEqual(['RHOAI'])
    expect(bar.text()).not.toContain('Environment')
    const releaseOptions = bar.findAll('select').at(1).findAll('option').map((o) => o.text())
    expect(releaseOptions).toEqual(['EA1'])
    expect(bar.find('.date-toggle-input').exists()).toBe(false)
    expect(bar.find('#te-filter-from').exists()).toBe(true)
    expect(bar.find('#te-filter-to').exists()).toBe(true)
  })

  it('does not fall back to "All" for an empty release when "All" is not allowed', () => {
    const bar = mountBar({ filters: { ...filters, release: null } })
    expect(bar.vm.$.setupState.localFilters.release).toBeNull()
  })

  it('keeps the default behavior for other views', () => {
    const bar = mount(FilterBar, { props: { filters: { ...filters, version: 'All', release: 'All' } } })
    expect(bar.find('.date-toggle-input').exists()).toBe(true)
    expect(bar.findAll('select').at(1).findAll('option').map((o) => o.text())).toContain('All')
  })
})
