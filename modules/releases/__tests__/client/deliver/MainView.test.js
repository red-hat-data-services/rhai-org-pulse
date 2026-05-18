import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import MainView from '../../../client/deliver/views/MainView.vue'

const mockApiRequest = vi.fn()

vi.mock('@shared/client/services/api', () => ({
  apiRequest: (...args) => mockApiRequest(...args),
  SESSION_CACHE_PREFIX: 'tt_cache:session:'
}))

const minimalAnalysis = {
  generatedAt: new Date().toISOString(),
  baselineDays: 180,
  capacityMode: 'p90',
  releases: [],
  riskThresholds: { issuesPerDayGreenMax: 1, issuesPerDayYellowMax: 10 }
}

describe('MainView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    try {
      sessionStorage.clear()
    } catch {
      /* ignore */
    }
  })

  it('renders the module title after analysis loads', async () => {
    mockApiRequest.mockResolvedValueOnce({ ...minimalAnalysis })
    const wrapper = mount(MainView)
    await flushPromises()
    expect(wrapper.text()).toContain('Release Analysis')
    expect(mockApiRequest).toHaveBeenCalledWith('/modules/releases/delivery/analysis')
  })

  it('shows error state when the analysis request fails', async () => {
    mockApiRequest.mockRejectedValueOnce(new Error('Jira unavailable'))
    const wrapper = mount(MainView)
    await flushPromises()
    expect(wrapper.text()).toContain('Jira unavailable')
  })

  it('renders release data from a successful response', async () => {
    mockApiRequest.mockResolvedValueOnce({
      ...minimalAnalysis,
      releases: [
        {
          releaseNumber: 'rhelai-9.9',
          productName: 'Example product',
          dueDate: '2030-06-01',
          daysRemaining: 400,
          risk: 'green',
          totals: { issues_to_do: 2, issues_doing: 1, issues_done: 3 },
          teams: {
            PROJ: {
              projectKey: 'PROJ',
              issues_to_do: 2,
              issues_doing: 1,
              issues_done: 3,
              risk: 'green',
              to_do: 1,
              doing: 1,
              done: 1,
              remaining: 2,
              total: 5
            }
          },
          issues: []
        }
      ]
    })
    const wrapper = mount(MainView)
    await flushPromises()
    expect(wrapper.text()).toContain('rhelai-9.9')
    expect(wrapper.text()).toContain('Example product')
    expect(wrapper.text()).toMatch(/6\s+issues in scope/)
  })
})
