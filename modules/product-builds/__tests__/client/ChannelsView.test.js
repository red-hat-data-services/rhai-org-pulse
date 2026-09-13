import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import ChannelsView from '../../client/views/ChannelsView.vue'

vi.mock('@shared/client/services/api', () => ({
  apiRequest: vi.fn(),
}))

const { apiRequest } = await import('@shared/client/services/api')

function summary(overrides) {
  return {
    description: '',
    rhel_version: 'ubi9',
    os_release: 'RHEL 9.8',
    python_version: '3.12',
    architectures: ['x86_64', 'aarch64'],
    compatible_releases: [],
    visibility: 'public',
    wheel_count: 3,
    wheel_kinds: { accelerated: 2, native: 1, pure: 0 },
    drop_count: 2,
    latest_drop: { name: 'base-v2026091101', created_at: '2026-09-11T14:12:00Z' },
    ...overrides,
    index_url: `https://example.test/${overrides.name}/simple/`,
    base_image: `quay.io/aipcc/base-images/${overrides.name}`,
  }
}

const CHANNELS = [
  summary({ name: 'cuda13.0-torch2.11-ubi9', accelerator: 'cuda', accelerator_version: '13.0', torch_version: '2.11', maturity: 'stable', compatible_releases: ['rhoai-3.5', 'rhoai-3.6'] }),
  summary({ name: 'cuda13.0-torch2.13-ubi9', accelerator: 'cuda', accelerator_version: '13.0', torch_version: '2.13', maturity: 'rolling', compatible_releases: ['rhoai-3.7'] }),
  summary({ name: 'rocm7.14-torch2.12-ubi9', accelerator: 'rocm', accelerator_version: '7.14', torch_version: '2.12', maturity: 'rolling' }),
  summary({ name: 'cpu-notorch-ubi9', accelerator: 'cpu', accelerator_version: '', torch_version: null, maturity: 'stable', compatible_releases: ['rhoai-3.6'], wheel_kinds: undefined }),
]

function detail(name) {
  const base = CHANNELS.find(c => c.name === name)
  if (!base) return null
  return {
    ...base,
    drops: [
      { key: 'base-images-base-v2026091101', name: 'base-v2026091101', product_key: 'base-images', git_branch: 'main', created_at: '2026-09-11T14:12:00Z', pullspec: `quay.io/aipcc/base-images/${name}:base-v2026091101`, changes: ['(feat) AIPCC-1: something'] },
      { key: 'base-images-base-v3.6-EA1.2026090901', name: 'base-v3.6-EA1.2026090901', product_key: 'base-images', git_branch: '3.6-EA1', created_at: '2026-09-09T15:36:00Z', pullspec: `quay.io/aipcc/base-images/${name}:base-v3.6-EA1.2026090901`, changes: [] },
    ],
    wheels: base.torch_version
      ? [
          { name: 'numpy', version: '2.3.2', kind: 'native' },
          { name: 'torch', version: `${base.torch_version}.0`, kind: 'accelerated' },
          { name: 'torchvision', version: '0.26.0', kind: 'accelerated' },
        ]
      : [{ name: 'numpy', version: '2.3.2' }],
  }
}

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
    }),
  }
  return nav
}

function mountView(params = {}) {
  const nav = createNav(params)
  const wrapper = mount(ChannelsView, {
    attachTo: document.body,
    global: { provide: { moduleNav: nav } },
  })
  return { wrapper, nav }
}

function drawer() {
  return document.body.querySelector('[data-testid="channel-drawer"]')
}

function keydown(el, key, init = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  el.dispatchEvent(event)
  return event
}

function mockApi({ delays = {} } = {}) {
  apiRequest.mockImplementation((path) => {
    if (path === '/modules/product-builds/channels') {
      return Promise.resolve({ source: 'sample', as_of: '2026-09-11', channels: CHANNELS })
    }
    const match = path.match(/^\/modules\/product-builds\/channels\/(.+)$/)
    if (!match) return Promise.reject(new Error(`unexpected ${path}`))
    const name = decodeURIComponent(match[1])
    const channel = detail(name)
    const result = channel ? { source: 'sample', channel } : null
    const settle = () => (result ? Promise.resolve(result) : Promise.reject(new Error('Channel not found')))
    return delays[name] ? new Promise(r => setTimeout(r, delays[name])).then(settle) : settle()
  })
}

describe('ChannelsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.style.overflow = ''
    mockApi()
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('renders the matrix, table and dated sample note', async () => {
    const { wrapper } = mountView()
    await flushPromises()

    const note = wrapper.find('[data-testid="channels-sample-note"]')
    expect(note.text()).toContain('Sample data as of Sep 11, 2026')
    expect(wrapper.find('[data-testid="channel-matrix"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="channel-row"]')).toHaveLength(CHANNELS.length)
    expect(wrapper.find('[data-channel="rocm7.14-torch2.12-ubi9"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('shows stable channels first in the table', async () => {
    const { wrapper } = mountView()
    await flushPromises()

    const maturities = wrapper.findAll('[data-testid="channel-row"]').map(r => r.text().includes('Stable') ? 'stable' : 'rolling')
    expect(maturities).toEqual(['stable', 'stable', 'rolling', 'rolling'])
    wrapper.unmount()
  })

  it('filters the table and dims non-matching matrix cells', async () => {
    const { wrapper } = mountView()
    await flushPromises()

    await wrapper.findAll('button').find(b => b.text() === 'Rolling').trigger('click')

    expect(wrapper.findAll('[data-testid="channel-row"]')).toHaveLength(2)
    expect(wrapper.find('[data-channel="cuda13.0-torch2.11-ubi9"]').classes()).toContain('opacity-30')
    expect(wrapper.find('[data-channel="cuda13.0-torch2.13-ubi9"]').classes()).not.toContain('opacity-30')

    await wrapper.find('input[aria-label="Search channels"]').setValue('no-such-channel')
    expect(wrapper.text()).toContain('No channels match these filters.')
    wrapper.unmount()
  })

  it('opens a channel from the matrix and shows its drops and wheels', async () => {
    const { wrapper, nav } = mountView()
    await flushPromises()

    await wrapper.find('[data-channel="cuda13.0-torch2.11-ubi9"]').trigger('click')
    expect(nav.updateParams).toHaveBeenCalledWith({ channel: 'cuda13.0-torch2.11-ubi9' }, { push: false })
    await flushPromises()

    const panel = drawer()
    expect(panel.textContent).toContain('cuda13.0-torch2.11-ubi9')
    expect(panel.textContent).toContain('rhoai-3.5')
    expect(panel.textContent).toContain('Sample data')
    expect(panel.querySelectorAll('[data-testid="channel-drop"]')).toHaveLength(2)
    expect(panel.textContent).toContain('3.6-EA1 branch')
    // Sample index URLs and pull specs are illustrative, so copy actions are hidden.
    expect([...panel.querySelectorAll('button')].some(b => /copy/i.test(b.textContent + (b.getAttribute('aria-label') || '')))).toBe(false)

    const wheelsTab = [...panel.querySelectorAll('[role="tab"]')].find(t => t.textContent.includes('Wheels'))
    wheelsTab.click()
    await flushPromises()
    const names = () => [...panel.querySelectorAll('[data-testid="channel-wheel"] td:first-child')].map(td => td.textContent.trim())
    expect(names()).toEqual(['torch', 'torchvision', 'numpy'])

    const input = panel.querySelector('input[aria-label="Filter wheels by name"]')
    input.value = 'vision'
    input.dispatchEvent(new Event('input'))
    await flushPromises()
    expect(names()).toEqual(['torchvision'])
    wrapper.unmount()
  })

  it('shows copy actions and hides the sample chip for live data', async () => {
    apiRequest.mockImplementation((path) => path === '/modules/product-builds/channels'
      ? Promise.resolve({ source: 'live', channels: CHANNELS })
      : Promise.resolve({ source: 'live', channel: detail('cuda13.0-torch2.11-ubi9') }))
    const { wrapper } = mountView({ channel: 'cuda13.0-torch2.11-ubi9' })
    await flushPromises()

    expect(wrapper.find('[data-testid="channels-sample-note"]').exists()).toBe(false)
    expect(drawer().textContent).not.toContain('Sample data')
    expect(drawer().querySelector('button[aria-label="Copy pull spec for base-v2026091101"]')).not.toBeNull()
    wrapper.unmount()
  })

  it('hides the wheel kind breakdown when kinds are not provided', async () => {
    const { wrapper } = mountView({ channel: 'cpu-notorch-ubi9' })
    await flushPromises()

    ;[...drawer().querySelectorAll('[role="tab"]')].find(t => t.textContent.includes('Wheels')).click()
    await flushPromises()
    expect(drawer().querySelectorAll('[data-testid="channel-wheel"]')).toHaveLength(1)
    expect(drawer().textContent).not.toContain('Accelerator builds')
    wrapper.unmount()
  })

  it('opens the drawer from a deep link, locks page scroll and restores it on close', async () => {
    document.body.style.overflow = 'clip'
    const { wrapper, nav } = mountView({ channel: 'cpu-notorch-ubi9' })
    await flushPromises()

    expect(drawer()).not.toBeNull()
    expect(document.body.style.overflow).toBe('hidden')
    expect(apiRequest).toHaveBeenCalledWith('/modules/product-builds/channels/cpu-notorch-ubi9')

    document.body.querySelector('button[aria-label="Close channel details"]').click()
    await flushPromises()
    expect(nav.updateParams).toHaveBeenCalledWith({ channel: undefined }, { push: false })
    expect(drawer()).toBeNull()
    expect(document.body.style.overflow).toBe('clip')
    wrapper.unmount()
  })

  it('restores page scroll when unmounted with the drawer open', async () => {
    const { wrapper } = mountView({ channel: 'cpu-notorch-ubi9' })
    await flushPromises()
    expect(document.body.style.overflow).toBe('hidden')

    wrapper.unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('closes with Escape, but clears a non-empty wheel filter first', async () => {
    const { wrapper, nav } = mountView({ channel: 'cuda13.0-torch2.11-ubi9' })
    await flushPromises()

    ;[...drawer().querySelectorAll('[role="tab"]')].find(t => t.textContent.includes('Wheels')).click()
    await flushPromises()
    const input = drawer().querySelector('input[aria-label="Filter wheels by name"]')
    input.value = 'torch'
    input.dispatchEvent(new Event('input'))
    await flushPromises()

    keydown(input, 'Escape')
    await flushPromises()
    expect(input.value).toBe('')
    expect(drawer()).not.toBeNull()

    keydown(input, 'Escape')
    await flushPromises()
    expect(nav.updateParams).toHaveBeenCalledWith({ channel: undefined }, { push: false })
    expect(drawer()).toBeNull()
    wrapper.unmount()
  })

  it('keeps keyboard events inside the dialog and traps Tab focus', async () => {
    const { wrapper } = mountView({ channel: 'cuda13.0-torch2.11-ubi9' })
    await flushPromises()

    const windowListener = vi.fn()
    window.addEventListener('keydown', windowListener)
    const panel = drawer()
    const focusables = panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    const first = focusables[0]
    const last = focusables[focusables.length - 1]

    last.focus()
    const tab = keydown(last, 'Tab')
    expect(tab.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(first)

    const shiftTab = keydown(first, 'Tab', { shiftKey: true })
    expect(shiftTab.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(last)

    keydown(first, '/')
    expect(windowListener).not.toHaveBeenCalled()
    window.removeEventListener('keydown', windowListener)
    wrapper.unmount()
  })

  it('shows the latest channel when an earlier request resolves last', async () => {
    vi.useFakeTimers()
    mockApi({ delays: { 'cuda13.0-torch2.11-ubi9': 50 } })
    const { wrapper, nav } = mountView({ channel: 'cuda13.0-torch2.11-ubi9' })
    await vi.advanceTimersByTimeAsync(0)

    nav.updateParams({ channel: 'rocm7.14-torch2.12-ubi9' })
    await vi.advanceTimersByTimeAsync(0)
    expect(drawer().textContent).toContain('ROCm 7.14')

    await vi.advanceTimersByTimeAsync(100)
    expect(drawer().querySelector('h2').textContent).toContain('rocm7.14')
    expect(drawer().querySelector('h2').textContent).not.toContain('cuda13.0')
    wrapper.unmount()
  })

  it.each(['.', '..', 'NOPE'])('rejects the channel name %j without calling the API', async (name) => {
    const { wrapper } = mountView({ channel: name })
    await flushPromises()

    expect(drawer().textContent).toContain('Invalid channel name')
    expect(apiRequest).not.toHaveBeenCalledWith(expect.stringContaining('/channels/'))
    wrapper.unmount()
  })

  it('shows an error in the drawer for an unknown channel', async () => {
    const { wrapper } = mountView({ channel: 'cuda99-torch9-ubi9' })
    await flushPromises()

    expect(drawer().textContent).toContain('Could not load cuda99-torch9-ubi9')
    wrapper.unmount()
  })

  it('treats a response without a channel as not found', async () => {
    apiRequest.mockImplementation((path) => path === '/modules/product-builds/channels'
      ? Promise.resolve({ source: 'sample', channels: CHANNELS })
      : Promise.resolve({ source: 'sample', channels: CHANNELS }))
    const { wrapper } = mountView({ channel: 'cpu-notorch-ubi9' })
    await flushPromises()

    expect(drawer().textContent).toContain('Channel not found')
    wrapper.unmount()
  })

  it('shows an error when channels fail to load', async () => {
    apiRequest.mockRejectedValueOnce(new Error('boom'))
    const { wrapper } = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('Could not load channels: boom')
    wrapper.unmount()
  })
})
