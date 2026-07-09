import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import JiraTaxonomyView from '../../client/JiraTaxonomyView.vue'

const mockApiRequest = vi.fn()
vi.mock('@shared/client/services/api', () => ({
  apiRequest: (...args) => mockApiRequest(...args)
}))

const sampleComponents = {
  fetchedAt: '2026-07-01T12:00:00.000Z',
  project: 'RHAI',
  source: 'jira',
  components: [
    { id: '1', name: 'Authorino', description: 'Auth service', lead: { displayName: 'Alice', emailAddress: 'alice@redhat.com' }, assigneeType: 'COMPONENT_LEAD' },
    { id: '2', name: 'CodeFlare', description: 'Distributed computing', lead: null, assigneeType: 'PROJECT_DEFAULT' },
    { id: '3', name: 'Dashboard', description: 'Web console', lead: { displayName: 'Charlie', emailAddress: 'charlie@redhat.com' }, assigneeType: 'COMPONENT_LEAD' }
  ]
}

function mountView() {
  return mount(JiraTaxonomyView, {
    global: {
      provide: {
        moduleNav: {
          params: ref({}),
          navigateTo: vi.fn(),
          updateParams: vi.fn()
        }
      }
    }
  })
}

beforeEach(() => {
  mockApiRequest.mockReset()
  mockApiRequest.mockResolvedValue(sampleComponents)
})

describe('JiraTaxonomyView', () => {
  it('renders component table with data', async () => {
    const wrapper = mountView()
    await flushPromises()
    expect(mockApiRequest).toHaveBeenCalledWith('/modules/team-tracker/jira-components')
    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(3)
    expect(wrapper.text()).toContain('Authorino')
    expect(wrapper.text()).toContain('CodeFlare')
    expect(wrapper.text()).toContain('Dashboard')
  })

  it('shows component count', async () => {
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).toContain('3 components')
  })

  it('filters components by search query', async () => {
    const wrapper = mountView()
    await flushPromises()
    const input = wrapper.find('input[type="text"][placeholder="Search by name, description, or lead..."]')
    await input.setValue('auth')
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
    expect(wrapper.text()).toContain('Authorino')
  })

  it('filters components by lead name', async () => {
    const wrapper = mountView()
    await flushPromises()
    const input = wrapper.find('input[type="text"][placeholder="Search by name, description, or lead..."]')
    await input.setValue('Alice')
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
    expect(wrapper.text()).toContain('Authorino')
  })

  it('shows no results message when search matches nothing', async () => {
    const wrapper = mountView()
    await flushPromises()
    const input = wrapper.find('input[type="text"][placeholder="Search by name, description, or lead..."]')
    await input.setValue('nonexistent')
    expect(wrapper.text()).toContain('No components match your search')
  })

  it('shows error state when API fails', async () => {
    mockApiRequest.mockRejectedValue(new Error('Network error'))
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).toContain('Network error')
  })

  it('shows empty state when no components exist', async () => {
    mockApiRequest.mockResolvedValue({ fetchedAt: null, project: null, components: [], source: null })
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).toContain('No components found')
  })

  it('displays project link and sync date', async () => {
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).toContain('RHAI')
    expect(wrapper.text()).toContain('Last synced')
  })

  it('shows dash for components without lead', async () => {
    const wrapper = mountView()
    await flushPromises()
    const rows = wrapper.findAll('tbody tr')
    // CodeFlare (index 1 in sorted order) has no lead
    const codeflareRow = rows.find(r => r.text().includes('CodeFlare'))
    expect(codeflareRow.text()).toContain('\u2014')
  })

  it('sorts components by name ascending by default', async () => {
    const wrapper = mountView()
    await flushPromises()
    const rows = wrapper.findAll('tbody tr')
    const names = rows.map(r => r.findAll('td')[0].text())
    expect(names).toEqual(['Authorino', 'CodeFlare', 'Dashboard'])
  })

  it('toggles sort direction on column click', async () => {
    const wrapper = mountView()
    await flushPromises()
    // Click Name header to toggle to descending
    const nameHeader = wrapper.findAll('th')[0]
    await nameHeader.trigger('click')
    const rows = wrapper.findAll('tbody tr')
    const names = rows.map(r => r.findAll('td')[0].text())
    expect(names).toEqual(['Dashboard', 'CodeFlare', 'Authorino'])
  })
})
