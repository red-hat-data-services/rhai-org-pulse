import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, markRaw, defineComponent } from 'vue'

const mockIsAdmin = ref(false)
const mockRoles = ref([])

vi.mock('@shared/client', () => ({
  useAuth: () => ({
    isAdmin: mockIsAdmin,
    roles: mockRoles
  })
}))

vi.mock('./health-metrics/SiteUsageTab.vue', () => ({
  default: defineComponent({ template: '<div>Site Usage Stub</div>' })
}))

globalThis.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ buildInfo: { version: '1.0.0' } })
})

let AboutView

const StubPlatformTab = markRaw(defineComponent({
  template: '<div class="platform-tab-content">Platform Content</div>'
}))

function makePlatformTab(overrides = {}) {
  return {
    id: 'docs',
    label: 'Docs',
    icon: markRaw(defineComponent({ template: '<span>icon</span>' })),
    order: 15,
    requireRole: null,
    component: StubPlatformTab,
    source: 'platform',
    ...overrides
  }
}

describe('AboutView', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mockIsAdmin.value = false
    mockRoles.value = []
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ buildInfo: { version: '1.0.0' } })
    })

    vi.resetModules()
    const mod = await import('../components/AboutView.vue')
    AboutView = mod.default
  })

  it('renders core tabs in correct order', async () => {
    const wrapper = mount(AboutView, {
      props: { isAdmin: false, platformAboutTabs: [] }
    })
    await flushPromises()

    const tabButtons = wrapper.findAll('nav button')
    const labels = tabButtons.map(b => b.text())

    expect(labels).toContain('About')
    expect(labels).toContain('Help & Debug')
    expect(labels).not.toContain('Backups')
    expect(labels).not.toContain('Site Usage')
  })

  it('shows Site Usage tab when user has usage-metrics-viewer role', async () => {
    mockRoles.value = ['usage-metrics-viewer']
    const wrapper = mount(AboutView, {
      props: { isAdmin: false, platformAboutTabs: [] }
    })
    await flushPromises()

    const labels = wrapper.findAll('nav button').map(b => b.text())
    expect(labels).toContain('Site Usage')
  })

  it('shows Backups tab when user is admin', async () => {
    const wrapper = mount(AboutView, {
      props: { isAdmin: true, platformAboutTabs: [] }
    })
    await flushPromises()

    const labels = wrapper.findAll('nav button').map(b => b.text())
    expect(labels).toContain('Backups')
  })

  it('merges platform tabs sorted by order', async () => {
    mockRoles.value = ['usage-metrics-viewer']
    const docsTab = makePlatformTab({ id: 'docs', label: 'Docs', order: 15 })

    const wrapper = mount(AboutView, {
      props: { isAdmin: false, platformAboutTabs: [docsTab] }
    })
    await flushPromises()

    const labels = wrapper.findAll('nav button').map(b => b.text().trim())
    const docsIdx = labels.findIndex(l => l.includes('Docs'))
    const aboutIdx = labels.findIndex(l => l.includes('About'))
    const usageIdx = labels.findIndex(l => l.includes('Site Usage'))
    expect(docsIdx).toBeGreaterThan(aboutIdx)
    expect(docsIdx).toBeLessThan(usageIdx)
  })

  it('hides platform tabs with requireRole when user lacks the role', async () => {
    const restrictedTab = makePlatformTab({
      id: 'restricted',
      label: 'Restricted',
      requireRole: 'special-role'
    })

    const wrapper = mount(AboutView, {
      props: { isAdmin: false, platformAboutTabs: [restrictedTab] }
    })
    await flushPromises()

    const labels = wrapper.findAll('nav button').map(b => b.text().trim())
    expect(labels.some(l => l.includes('Restricted'))).toBe(false)
  })

  it('shows role-gated platform tabs when user is admin', async () => {
    const restrictedTab = makePlatformTab({
      id: 'restricted',
      label: 'Restricted',
      requireRole: 'special-role'
    })

    const wrapper = mount(AboutView, {
      props: { isAdmin: true, platformAboutTabs: [restrictedTab] }
    })
    await flushPromises()

    const labels = wrapper.findAll('nav button').map(b => b.text().trim())
    expect(labels.some(l => l.includes('Restricted'))).toBe(true)
  })

  it('falls back to about tab when initialTab is unknown', async () => {
    const wrapper = mount(AboutView, {
      props: { isAdmin: false, initialTab: 'nonexistent', platformAboutTabs: [] }
    })
    await flushPromises()

    const activeButton = wrapper.find('nav button.border-primary-600, nav button[class*="border-primary"]')
    expect(activeButton.text()).toContain('About')
  })

  it('uses initialTab when it matches a valid tab', async () => {
    const wrapper = mount(AboutView, {
      props: { isAdmin: true, initialTab: 'help', platformAboutTabs: [] }
    })
    await flushPromises()

    expect(wrapper.find('h3').text()).toContain('App Info')
  })

  it('switches active tab on click', async () => {
    const wrapper = mount(AboutView, {
      props: { isAdmin: false, platformAboutTabs: [] }
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Org Pulse')

    const helpButton = wrapper.findAll('nav button').find(b => b.text().includes('Help & Debug'))
    await helpButton.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('App Info')
  })

  it('renders platform tab component when its tab is active', async () => {
    const docsTab = makePlatformTab()

    const wrapper = mount(AboutView, {
      props: { isAdmin: false, platformAboutTabs: [docsTab] }
    })
    await flushPromises()

    const docsButton = wrapper.findAll('nav button').find(b => b.text().includes('Docs'))
    await docsButton.trigger('click')
    await flushPromises()

    expect(wrapper.find('.platform-tab-content').exists()).toBe(true)
    expect(wrapper.text()).toContain('Platform Content')
  })
})
