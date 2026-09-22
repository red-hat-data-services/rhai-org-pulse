import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ReleaseStatusView from '../../client/views/ReleaseStatusView.vue'

vi.mock('@shared/client/services/api', () => ({
  apiRequest: vi.fn(),
}))

const { apiRequest } = await import('@shared/client/services/api')

describe('ReleaseStatusView', () => {
  function response(epics) {
    return {
      total: epics.length,
      groups: [
        { key: 'rhaiis', label: 'RHAII', epics },
        { key: 'rhel-ai', label: 'RHEL AI', epics: [] },
        { key: 'base-images', label: 'Base images', epics: [] },
      ],
    }
  }

  it('renders the grouped epic tree and hides technical labels', async () => {
    apiRequest.mockResolvedValue({
      ...response([{
        key: 'AIPCC-100',
        summary: 'RHAII release',
        status: { name: 'In Progress', category: 'indeterminate' },
        labels: ['release-automation'],
        updated: '2026-09-22T10:00:00Z',
        details: { version: '3.5', target: 'prod' },
        children: [{
          key: 'AIPCC-101',
          summary: 'Production card',
          status: { name: 'Ready', category: 'indeterminate' },
          labels: ['ready', 'customer-facing'],
          updated: '2026-09-22T10:00:00Z',
        }],
      }]),
    })

    const wrapper = mount(ReleaseStatusView)
    await flushPromises()

    expect(apiRequest).toHaveBeenCalledWith('/modules/product-builds/release-status')
    expect(wrapper.text()).toContain('Release status')
    expect(wrapper.text()).toContain('AIPCC-100')
    expect(wrapper.text()).toContain('AIPCC-101')
    expect(wrapper.text()).not.toContain('release-automation')
    expect(wrapper.text()).toContain('customer-facing')
    expect(wrapper.text()).toContain('ready')
    expect(wrapper.get('[aria-label="Status legend"]').text()).toContain('Triggered / in progress')
    expect(wrapper.get('[data-tree-root="AIPCC-100"]')).toBeTruthy()
    expect(wrapper.get('[data-tree-branch]')).toBeTruthy()
    expect(wrapper.get('[data-tree-child="AIPCC-101"]').text()).toContain('Production card')
    expect(wrapper.get('[data-status-badge="AIPCC-100"]').classes()).toContain('bg-emerald-50')
    expect(wrapper.get('[data-status-badge="AIPCC-101"]').classes()).toContain('bg-blue-50')
    expect(wrapper.get('[data-tree-child="AIPCC-101"] a').attributes('href')).toBe('https://redhat.atlassian.net/browse/AIPCC-101')
  })

  it('uses lifecycle labels before Jira status and maps each lifecycle color', async () => {
    const states = [
      ['planned', 'Done', 'bg-amber-50'],
      ['triggered', 'To Do', 'bg-emerald-50'],
       ['released', 'Done', 'bg-violet-50'],
      ['failed', 'Done', 'bg-red-50'],
       ['skip', 'In Progress', 'bg-gray-100'],
    ]
    apiRequest.mockResolvedValue(response([{
      key: 'AIPCC-200',
      summary: 'Lifecycle release',
      status: { name: 'In Progress', category: 'indeterminate' },
      labels: ['ready', 'release-automation'],
      details: {},
      children: states.map(([label, jiraStatus], index) => ({
        key: `AIPCC-${201 + index}`,
        summary: `${label} card`,
        status: { name: jiraStatus, category: 'indeterminate' },
        labels: [label],
        updated: null,
      })),
    }]))

    const wrapper = mount(ReleaseStatusView)
    await flushPromises()

    expect(wrapper.get('[data-status-badge="AIPCC-200"]').classes()).toContain('bg-blue-50')
    expect(wrapper.get('[data-tree-child="AIPCC-203"]').attributes('data-completed')).toBe('true')
    for (const [label, , expectedClass] of states) {
      const key = `AIPCC-${201 + states.findIndex(([state]) => state === label)}`
       expect(wrapper.get(`[data-tree-child="${key}"]`).attributes('data-status-state')).toBe(label === 'skip' ? 'skipped' : label)
      expect(wrapper.get(`[data-status-badge="${key}"]`).classes()).toContain(expectedClass)
    }
  })

  it('uses readiness-detector precedence for conflicting lifecycle labels', async () => {
    apiRequest.mockResolvedValue(response([{
      key: 'AIPCC-400',
      summary: 'Conflicting labels',
      status: { name: 'Done', category: 'done' },
      labels: [],
      details: {},
      children: [{
        key: 'AIPCC-401',
        summary: 'Planned and ready card',
        status: { name: 'Done', category: 'done' },
        labels: ['ready', 'planned'],
        updated: null,
      }],
    }]))

    const wrapper = mount(ReleaseStatusView)
    await flushPromises()

    expect(wrapper.get('[data-tree-child="AIPCC-401"]').attributes('data-status-state')).toBe('planned')
  })

  it('falls back to Jira status when no lifecycle label is present', async () => {
    apiRequest.mockResolvedValue(response([{
      key: 'AIPCC-300',
      summary: 'Fallback release',
      status: { name: 'Ready', category: 'new' },
      labels: [],
      details: {},
      children: [],
    }]))

    const wrapper = mount(ReleaseStatusView)
    await flushPromises()

    expect(wrapper.get('[data-tree-root="AIPCC-300"]').attributes('data-status-state')).toBe('ready')
    expect(wrapper.get('[data-status-badge="AIPCC-300"]').classes()).toContain('bg-blue-50')
  })
})
