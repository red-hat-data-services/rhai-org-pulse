import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import RequestsView from '../../client/views/RequestsView.vue'

vi.mock('@shared/client/services/api', () => ({
  apiRequest: vi.fn()
}))

vi.mock('@shared/client/composables/useAuth', () => ({
  useAuth: () => ({
    user: { value: { email: 'jane@redhat.com', displayName: 'Jane Doe' } }
  })
}))

const { apiRequest } = await import('@shared/client/services/api')

function createNav(params = {}) {
  const nav = {
    params: ref(params),
    navigateTo: vi.fn(),
    goBack: vi.fn(),
    updateParams: vi.fn((updates) => {
      const next = { ...nav.params.value }
      for (const [k, v] of Object.entries(updates)) {
        if (v === undefined || v === null) delete next[k]
        else next[k] = v
      }
      nav.params.value = next
    })
  }
  return nav
}

async function mountView(params = {}) {
  const nav = createNav(params)
  const wrapper = mount(RequestsView, { global: { provide: { moduleNav: nav } } })
  await flushPromises()
  return { wrapper, nav }
}

describe('RequestsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiRequest.mockImplementation(async (url) => {
      if (url.includes('/channels')) return { channels: [] }
      return [{ value: 'Platform', label: 'Platform' }]
    })
  })

  it('shows the AIPCC-E Requests landing page with the Python package and channel request types', async () => {
    const { wrapper } = await mountView()
    expect(wrapper.find('h1').text()).toBe('AIPCC-E Requests')
    expect(wrapper.text()).toContain('Jane Doe')
    const cards = wrapper.findAll('[data-testid^="request-card-"]')
    expect(cards.map(card => card.find('h2').text())).toEqual([
      'Python Package Requests',
      'Channel Requests'
    ])
    expect(wrapper.find('#requests-help').text()).toContain('#forum-aipcc')
    expect(wrapper.find('#requests-help').text()).toContain('@aipcc-support')
    expect(wrapper.find('#req-package-name').exists()).toBe(false)
  })

  it('gives every card a description, prerequisites and turnaround', async () => {
    const { wrapper } = await mountView()
    const turnaround = id => wrapper.find(`[data-testid="request-card-${id}"] [data-testid="card-turnaround"]`).text()
    for (const id of ['python', 'channel']) {
      const card = wrapper.find(`[data-testid="request-card-${id}"]`)
      expect(card.find('[data-testid="card-description"]').text()).not.toBe('')
      expect(card.findAll('[data-testid="card-prerequisites"] li').length).toBeGreaterThan(0)
    }
    expect(turnaround('python')).toBe('10 business day SLA')
    expect(turnaround('channel')).toBe('Triaged by AIPCC')
    expect(wrapper.find('[data-testid="request-card-python"]').text()).not.toMatch(/RPM/)
    expect(wrapper.find('[data-testid="request-card-channel"]').text()).toContain('A link to your prior discussion with AIPCC')
  })

  it('never describes channel delivery as an SLA', async () => {
    const { wrapper } = await mountView()
    expect(wrapper.find('[data-testid="request-card-channel"]').text()).not.toMatch(/SLA|business days/i)
  })

  it('opens a form from a landing card and records the tab in the URL', async () => {
    const { wrapper, nav } = await mountView()
    await wrapper.find('[data-testid="request-card-channel"]').trigger('click')
    await flushPromises()
    expect(nav.updateParams).toHaveBeenCalledWith({ tab: 'channel' })
    expect(wrapper.find('#chan-torch-version').exists()).toBe(true)
  })

  it.each([
    ['python', '#req-package-name'],
    ['channel', '#chan-torch-version']
  ])('renders the %s form from the tab parameter', async (tab, selector) => {
    const { wrapper } = await mountView({ tab })
    expect(wrapper.find(selector).exists()).toBe(true)
    expect(wrapper.find(`[data-testid="request-tab-${tab}"]`).attributes('aria-selected')).toBe('true')
  })

  it('keeps a half-filled form when visiting Overview and coming back', async () => {
    const { wrapper } = await mountView({ tab: 'channel' })
    await wrapper.find('#chan-torch-version').setValue('2.12')
    await wrapper.findAll('[role="tab"]')[0].trigger('click')
    await flushPromises()
    expect(wrapper.find('#chan-torch-version').exists()).toBe(false)
    await wrapper.find('[data-testid="request-tab-channel"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('#chan-torch-version').element.value).toBe('2.12')
  })

  it('hides paused RPM requests from the cards, tabs and tab parameter', async () => {
    const { wrapper } = await mountView({ tab: 'rpm' })
    expect(wrapper.find('#rpm-name').exists()).toBe(false)
    expect(wrapper.find('[data-testid="request-card-rpm"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="request-tab-rpm"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="request-card-python"]').exists()).toBe(true)
    expect(wrapper.text()).not.toMatch(/RPM/)
  })

  it.each(['constructor', 'toString'])('ignores the inherited %s key as a tab', async (tab) => {
    const { wrapper } = await mountView({ tab })
    expect(wrapper.find('[data-testid="request-card-python"]').exists()).toBe(true)
  })

  it('falls back to the landing page for an unknown tab and returns to it from Overview', async () => {
    const { wrapper, nav } = await mountView({ tab: 'nope' })
    expect(wrapper.find('[data-testid="request-card-python"]').exists()).toBe(true)
    await wrapper.find('[data-testid="request-tab-channel"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('#chan-disclaimer').exists()).toBe(true)
    await wrapper.findAll('[role="tab"]')[0].trigger('click')
    await flushPromises()
    expect(nav.updateParams).toHaveBeenLastCalledWith({ tab: undefined })
    expect(wrapper.find('[data-testid="request-card-python"]').exists()).toBe(true)
  })
})
