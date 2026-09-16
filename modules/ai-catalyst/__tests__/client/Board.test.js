import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import Board from '../../client/views/Board.vue'

vi.mock('@shared/client/services/api', () => ({
  apiRequest: vi.fn()
}))

import { apiRequest } from '@shared/client/services/api'

describe('Board', () => {
  beforeEach(() => {
    vi.resetAllMocks()
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

  it('does not issue a duplicate initial candidate request', async () => {
    apiRequest
      .mockResolvedValueOnce({ boards: [{ month: '2026-09', candidateCount: 1 }] })
      .mockResolvedValueOnce({ candidates: [], pillars: [], total: 0 })

    mount(Board, {
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
    expect(apiRequest).toHaveBeenCalledTimes(2)
  })

  it('ignores a stale month response and clears the previous category filter', async () => {
    const requests = []
    apiRequest.mockImplementation((url) => {
      if (url.endsWith('/boards')) {
        return Promise.resolve({
          boards: [
            { month: '2026-09', candidateCount: 1 },
            { month: '2026-08', candidateCount: 1 }
          ]
        })
      }
      let resolve
      const promise = new Promise((res) => { resolve = res })
      requests.push({ url, resolve })
      return promise
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
    expect(requests).toHaveLength(1)
    requests[0].resolve({
      candidates: [{ uniqueId: 'newest', title: 'September project', category: 'model-inference' }],
      pillars: [{ pillarKey: 'model-inference', shortTitle: 'Inference', color: '#3b82f6' }],
      total: 1
    })
    await flushPromises()

    const categoryButton = wrapper.findAll('button').find(button => button.text() === 'Inference')
    await categoryButton.trigger('click')
    await flushPromises()
    expect(requests).toHaveLength(2)
    expect(wrapper.text()).toContain('Inference')

    await wrapper.find('select').setValue('2026-08')
    await flushPromises()
    expect(requests).toHaveLength(3)
    expect(requests[2].url).toBe('/modules/ai-catalyst/boards/2026-08?sort=impact')

    requests[2].resolve({
      candidates: [{ uniqueId: 'august', title: 'August project', category: 'data-science-engineering' }],
      pillars: [{ pillarKey: 'data-science-engineering', shortTitle: 'Data Science', color: '#06b6d4' }],
      total: 1
    })
    await flushPromises()
    requests[1].resolve({
      candidates: [{ uniqueId: 'stale', title: 'Stale project', category: 'model-inference' }],
      pillars: [{ pillarKey: 'model-inference', shortTitle: 'Inference', color: '#3b82f6' }],
      total: 1
    })
    await flushPromises()

    expect(wrapper.text()).toContain('August project')
    expect(wrapper.text()).not.toContain('Stale project')
    expect(wrapper.text()).toContain('Data Science')
  })
})
