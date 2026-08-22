import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import SearchResultsView from '../../client/views/SearchResultsView.vue'
import { SEARCH_LIMIT } from '../../client/composables/useSearch'

vi.mock('@shared/client/services/api', () => ({
  apiRequest: vi.fn(),
}))

const { apiRequest } = await import('@shared/client/services/api')

const SAMPLE_RESULTS = {
  query: 'vllm',
  drops: [
    { key: 'rhaiis-3.2.3', name: '3.2.3', product_key: 'rhaiis', created_at: '2026-06-07T00:00:00Z' }
  ],
  artifacts: {
    containers: [
      {
        key: 'registry.redhat.io/rhaiis/vllm-cuda-rhel9:3.2.3',
        commit: 'abc123def456',
        variant: 'cuda-ubi9',
        environments: ['production'],
        product_key: 'rhaiis',
        created_at: '2026-06-07T00:00:00Z'
      }
    ]
  },
  total_results: 2,
  page: 1,
  page_size: 200,
  total_pages: 1
}

function createNav(params = {}) {
  return {
    params: ref(params),
    navigateTo: vi.fn(),
    updateParams: vi.fn(),
    goBack: vi.fn()
  }
}

function mountView(navParams = {}) {
  const nav = createNav(navParams)
  const wrapper = mount(SearchResultsView, {
    global: { provide: { moduleNav: nav } }
  })
  return { wrapper, nav }
}

describe('SearchResultsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiRequest.mockImplementation((path) => {
      if (path.includes('/search/filters')) {
        return Promise.resolve({ artifact_types: ['containers'], environments: ['production'], architectures: ['x86_64'], accelerators: ['cuda'] })
      }
      if (path.includes('/search?')) {
        return Promise.resolve(SAMPLE_RESULTS)
      }
      return Promise.resolve({})
    })
  })

  it('shows empty state when no query is present', async () => {
    const { wrapper } = mountView({})
    await flushPromises()
    expect(wrapper.text()).toContain('Enter a search query')
    expect(apiRequest).not.toHaveBeenCalledWith(expect.stringContaining('/search?'))
  })

  it('reads q param from URL on mount and runs the search', async () => {
    const { wrapper } = mountView({ q: 'vllm' })
    await flushPromises()

    const input = wrapper.find('input[type="text"]')
    expect(input.element.value).toBe('vllm')
    expect(apiRequest).toHaveBeenCalledWith(expect.stringContaining('q=vllm'))
    expect(wrapper.text()).toContain('Found 2 results')
  })

  it('groups results into drops and artifact-type sections', async () => {
    const { wrapper } = mountView({ q: 'vllm' })
    await flushPromises()

    expect(wrapper.text()).toContain('Drops (1)')
    expect(wrapper.text()).toContain('Containers (1)')
    expect(wrapper.text()).toContain('rhaiis-3.2.3')
    expect(wrapper.text()).toContain('registry.redhat.io/rhaiis/vllm-cuda-rhel9:3.2.3')
  })

  it('re-runs the search when the q param changes externally', async () => {
    const { wrapper, nav } = mountView({})
    await flushPromises()

    nav.params.value = { q: 'torch' }
    await nextTick()
    await nextTick()
    await flushPromises()

    const input = wrapper.find('input[type="text"]')
    expect(input.element.value).toBe('torch')
    expect(apiRequest).toHaveBeenCalledWith(expect.stringContaining('q=torch'))
  })

  it('navigates to drop-detail when a drop row is clicked', async () => {
    const { wrapper, nav } = mountView({ q: 'vllm' })
    await flushPromises()

    await wrapper.find('tbody tr').trigger('click')
    expect(nav.navigateTo).toHaveBeenCalledWith('drop-detail', { key: 'rhaiis-3.2.3', product: 'rhaiis' })
  })

  it('shows a truncation notice when the API caps results, using the actual body count over the unreliable total_results', async () => {
    const cappedDrops = Array.from({ length: SEARCH_LIMIT }, (_, i) => ({
      key: `rhaiis-${i}`, name: `${i}`, product_key: 'rhaiis', created_at: '2026-06-07T00:00:00Z'
    }))
    apiRequest.mockImplementation((path) => {
      if (path.includes('/search/filters')) return Promise.resolve({})
      if (path.includes('/search?')) {
        return Promise.resolve({ query: 'rhel', drops: cappedDrops, artifacts: {}, total_results: 400 })
      }
      return Promise.resolve({})
    })
    const { wrapper } = mountView({ q: 'rhel' })
    await flushPromises()

    expect(wrapper.text()).toContain(`Showing the first ${SEARCH_LIMIT} results`)
    expect(wrapper.text()).not.toContain('Found 400 results')
    expect(wrapper.text()).not.toContain(`Found ${SEARCH_LIMIT} results`)
  })

  it('shows a no-results message when the search returns nothing', async () => {
    apiRequest.mockImplementation((path) => {
      if (path.includes('/search/filters')) return Promise.resolve({})
      if (path.includes('/search?')) return Promise.resolve({ query: 'zzz', drops: [], artifacts: {}, total_results: 0 })
      return Promise.resolve({})
    })
    const { wrapper } = mountView({ q: 'zzz' })
    await flushPromises()

    expect(wrapper.text()).toContain('No drops or artifacts match')
  })
})
