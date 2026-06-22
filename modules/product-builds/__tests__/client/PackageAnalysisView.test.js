import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import PackageAnalysisView from '../../client/views/PackageAnalysisView.vue'

vi.mock('@shared/client/services/api', () => ({
  apiRequest: vi.fn(),
}))

vi.mock('@shared/client/composables/useAuth', () => ({
  useAuth: () => ({ isAdmin: { value: true } }),
}))

const { apiRequest } = await import('@shared/client/services/api')

const SAMPLE_REPORTS = [
  {
    report_date: '2026-06-07',
    report_time: '2026-06-07T14:00:00Z',
    summary: {
      open_epics: 40,
      all_children_closed: 5,
      critical: 8,
      moderate: 12,
      active: 15,
      top_assignee: ['Alice', 6],
      status_distribution: { 'In Progress': 20 },
    },
  },
  {
    report_date: '2026-06-06',
    report_time: '2026-06-06T14:00:00Z',
    summary: {
      open_epics: 42,
      all_children_closed: 6,
      critical: 9,
      moderate: 11,
      active: 16,
    },
  },
]

const SAMPLE_ONBOARDED = {
  days: 7,
  count: 3,
  epics: [
    { key: 'AIPCC-100', summary: 'pkg-alpha', assignee: 'Alice', status: 'Closed', resolved_date: '2026-06-07' },
    { key: 'AIPCC-101', summary: 'pkg-beta', assignee: 'Bob', status: 'Closed', resolved_date: '2026-06-06' },
    { key: 'AIPCC-102', summary: 'pkg-gamma', assignee: 'Eve', status: 'Closed', resolved_date: '2026-06-06' },
  ],
}

describe('PackageAnalysisView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiRequest.mockImplementation((path) => {
      if (path.includes('/package-reports/onboarded')) return Promise.resolve(SAMPLE_ONBOARDED)
      if (path === '/modules/product-builds/package-reports') return Promise.resolve(SAMPLE_REPORTS)
      return Promise.resolve({})
    })
  })

  it('renders the page title', async () => {
    const wrapper = mount(PackageAnalysisView)
    await flushPromises()
    expect(wrapper.text()).toContain('Package Analysis')
  })

  it('shows last report date', async () => {
    const wrapper = mount(PackageAnalysisView)
    await flushPromises()
    expect(wrapper.text()).toContain('2026-06-07')
  })

  it('defaults to onboarded tab', async () => {
    const wrapper = mount(PackageAnalysisView)
    await flushPromises()
    expect(wrapper.text()).toContain('successfully onboarded')
    expect(wrapper.text()).toContain('pkg-alpha')
  })

  it('shows onboarded count in success banner', async () => {
    const wrapper = mount(PackageAnalysisView)
    await flushPromises()
    expect(wrapper.text()).toContain('3 packages successfully onboarded')
  })

  it('shows numbered rows in onboarded table', async () => {
    const wrapper = mount(PackageAnalysisView)
    await flushPromises()
    const rows = wrapper.findAll('tbody tr')
    expect(rows.length).toBe(3)
    expect(rows[0].text()).toContain('1')
    expect(rows[0].text()).toContain('AIPCC-100')
  })

  it('fetches reports and onboarded data on mount', async () => {
    mount(PackageAnalysisView)
    await flushPromises()
    expect(apiRequest).toHaveBeenCalledWith('/modules/product-builds/package-reports')
    expect(apiRequest).toHaveBeenCalledWith('/modules/product-builds/package-reports/onboarded?days=7')
  })
})
