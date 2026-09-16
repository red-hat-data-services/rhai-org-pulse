import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import Board from '../../client/views/Board.vue'

vi.mock('@shared/client/services/api', () => ({
  apiRequest: vi.fn()
}))

import { apiRequest } from '@shared/client/services/api'

describe('Board', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state initially', () => {
    apiRequest.mockReturnValue(new Promise(() => {}))
    const wrapper = mount(Board, {
      global: {
        provide: {
          moduleNav: {
            navigateTo: vi.fn(),
            goBack: vi.fn(),
            params: { value: {} }
          }
        }
      }
    })
    expect(wrapper.find('.animate-pulse').exists()).toBe(true)
  })

  it('renders header text', () => {
    apiRequest.mockReturnValue(new Promise(() => {}))
    const wrapper = mount(Board, {
      global: {
        provide: {
          moduleNav: {
            navigateTo: vi.fn(),
            goBack: vi.fn(),
            params: { value: {} }
          }
        }
      }
    })
    expect(wrapper.text()).toContain('Monthly Board')
  })

  it('shows empty state when no candidates', async () => {
    apiRequest
      .mockResolvedValueOnce({ boards: [{ month: '2026-06', candidateCount: 0 }] })
      .mockResolvedValueOnce({ candidates: [], total: 0, month: '2026-06', filtered: 0 })

    const wrapper = mount(Board, {
      global: {
        provide: {
          moduleNav: {
            navigateTo: vi.fn(),
            goBack: vi.fn(),
            params: { value: {} }
          }
        }
      }
    })

    await flushPromises()
    expect(wrapper.text()).toContain('No candidates found')
  })

  it('renders categories from the board pillar registry', async () => {
    apiRequest
      .mockResolvedValueOnce({ boards: [{ month: '2026-09', candidateCount: 1 }] })
      .mockResolvedValueOnce({
        candidates: [{ uniqueId: 'data-1', title: 'Data Project', category: 'data-science-engineering' }],
        pillars: [{
          pillarKey: 'data-science-engineering',
          title: 'Data Science & Engineering',
          shortTitle: 'Data Science',
          color: '#06b6d4'
        }],
        total: 1
      })

    const wrapper = mount(Board, {
      global: {
        provide: {
          moduleNav: {
            navigateTo: vi.fn(),
            goBack: vi.fn(),
            params: { value: {} }
          }
        }
      }
    })

    await flushPromises()
    expect(wrapper.text()).toContain('Data Science')
  })
})
