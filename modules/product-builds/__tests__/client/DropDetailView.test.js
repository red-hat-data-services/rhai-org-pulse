import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import DropDetailView from '../../client/views/DropDetailView.vue'

vi.mock('@shared/client/services/api', () => ({
  apiRequest: vi.fn(),
}))

const { apiRequest } = await import('@shared/client/services/api')

const DROP_KEY = 'base-images-base-v2026102901'
const LINKED_DROP_KEY = 'base-images-base-v2026102601'
const CHANNEL = 'cuda13.0-torch2.11-el9.8'

const DROP = {
  key: DROP_KEY,
  name: 'base-v2026102901',
  product_key: 'base-images',
  product_version: '3.6',
  git_branch: 'release/trailing',
  environments: [],
}

const LINKED_DROP = { ...DROP, key: LINKED_DROP_KEY, name: 'base-v2026102601' }

function artifact(key, overrides = {}) {
  return {
    key,
    type: 'containers',
    variant: 'cuda13.0-el9.8',
    archs: ['x86_64'],
    environments: ['stage'],
    alternative_names: [],
    created_at: '2026-10-29T04:00:00',
    ...overrides,
  }
}

const ARTIFACTS = [
  artifact('quay.io/aipcc/base-images/cpu-el9.8:3.6.0-1793242131', { variant: 'cpu-el9.8' }),
  artifact(`quay.io/aipcc/base-images/${CHANNEL}:${CHANNEL}-1793241603`),
  artifact(`quay.io/aipcc/base-images/${CHANNEL}:1793241603`),
  artifact('quay.io/aipcc/base-images/rocm7.14-torch2.11-el9.8:rocm7.14-torch2.11-1793241618'),
]

function mockApi(options = {}) {
  // Accepts either a plain artifact list (the common case) or
  // { artifacts, artifactsByDrop } where a drop's page can be deferred.
  const list = Array.isArray(options) ? options : options.artifacts || ARTIFACTS
  const byDrop = (!Array.isArray(options) && options.artifactsByDrop) || {}
  const drops = { [DROP_KEY]: DROP, [LINKED_DROP_KEY]: LINKED_DROP }

  apiRequest.mockImplementation((path) => {
    if (path.endsWith('/changelog')) return Promise.resolve(null)
    if (path.endsWith('/metrics')) return Promise.resolve(null)
    if (path.startsWith('/modules/product-builds/artifacts?')) {
      const dropKey = new URLSearchParams(path.split('?')[1]).get('drop_key')
      return byDrop[dropKey] ? byDrop[dropKey]() : Promise.resolve(list)
    }
    if (path.startsWith('/modules/product-builds/artifacts/')) return Promise.resolve([])
    if (path.startsWith('/modules/product-builds/drops/')) {
      return Promise.resolve(drops[decodeURIComponent(path.split('/').pop())] || DROP)
    }
    return Promise.reject(new Error(`unexpected ${path}`))
  })
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
  const nav = createNav({ key: DROP_KEY, product: 'base-images', ...params })
  const wrapper = mount(DropDetailView, {
    attachTo: document.body,
    global: { provide: { moduleNav: nav } },
  })
  return { wrapper, nav }
}

describe('DropDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Element.prototype.scrollIntoView = vi.fn()
    mockApi()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('shows no channel context when the drop is opened directly', async () => {
    const { wrapper } = mountView()
    await flushPromises()

    expect(wrapper.find('[data-testid="drop-channel-note"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-channel-match="true"]')).toHaveLength(0)
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('picks out and scrolls to the channel images when opened from a channel', async () => {
    const { wrapper } = mountView({ channel: CHANNEL })
    await flushPromises()
    await nextTick()

    const note = wrapper.find('[data-testid="drop-channel-note"]')
    expect(note.text()).toContain(CHANNEL)
    expect(note.text()).toContain('2 images are included in this drop')
    expect(note.find('button').text()).toBe('Jump to first')

    const matches = wrapper.findAll('[data-channel-match="true"]')
    expect(matches).toHaveLength(2)
    expect(matches[0].text()).toContain(`${CHANNEL}:${CHANNEL}-1793241603`)

    expect(document.getElementById('channel-artifact-anchor')).toBe(matches[0].element)
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
    wrapper.unmount()
  })

  it('scrolls to the new drop once its own artifacts land', async () => {
    let resolveLinked
    mockApi({
      artifactsByDrop: {
        [LINKED_DROP_KEY]: () => new Promise((resolve) => { resolveLinked = resolve }),
      },
    })
    const { wrapper, nav } = mountView({ channel: CHANNEL })
    await flushPromises()
    await nextTick()
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1)

    Element.prototype.scrollIntoView.mockClear()
    nav.updateParams({ key: LINKED_DROP_KEY })
    await flushPromises()

    // The previous drop's matches are no longer shown, and nothing is scrolled yet.
    const note = wrapper.find('[data-testid="drop-channel-note"]')
    expect(wrapper.findAll('[data-channel-match="true"]')).toHaveLength(0)
    expect(note.text()).toContain('looking for its images')
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled()

    resolveLinked([artifact(`quay.io/aipcc/base-images/${CHANNEL}:1793241603`)])
    await flushPromises()
    await nextTick()

    // The new drop's own match is found and scrolled to exactly once.
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1)
    const match = wrapper.find('[data-channel-match="true"]')
    expect(document.getElementById('channel-artifact-anchor')).toBe(match.element)
    expect(note.text()).toContain('1 image is included in this drop')
    wrapper.unmount()
  })

  it('labels a match count as partial while more artifacts remain', async () => {
    const page = Array.from({ length: 50 }, (_, i) => artifact(`quay.io/aipcc/base-images/other-${i}:1793241603`))
    page[3] = artifact(`quay.io/aipcc/base-images/${CHANNEL}:1793241603`)
    mockApi(page)

    const { wrapper } = mountView({ channel: CHANNEL })
    await flushPromises()
    await nextTick()

    const note = wrapper.find('[data-testid="drop-channel-note"]')
    expect(note.text()).toContain('1 image is included in this drop so far')
    expect(note.find('button').text()).toBe('Jump to it')
    wrapper.unmount()
  })

  it('says so when the drop has no image for the channel', async () => {
    const { wrapper } = mountView({ channel: 'cuda12.9-torch2.11-el9.8' })
    await flushPromises()
    await nextTick()

    expect(wrapper.find('[data-testid="drop-channel-note"]').text()).toContain('no image for this channel in this drop')
    expect(wrapper.findAll('[data-channel-match="true"]')).toHaveLength(0)
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('clears the channel highlight from the banner', async () => {
    const { wrapper, nav } = mountView({ channel: CHANNEL })
    await flushPromises()

    await wrapper.find('button[aria-label="Clear channel highlight"]').trigger('click')
    await flushPromises()

    expect(nav.updateParams).toHaveBeenCalledWith({ channel: undefined }, { push: false })
    expect(wrapper.find('[data-testid="drop-channel-note"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-channel-match="true"]')).toHaveLength(0)
    wrapper.unmount()
  })

  it('keeps the channel when following a linked drop', async () => {
    mockApi([artifact(`quay.io/aipcc/base-images/${CHANNEL}:1793241603`, { drop_keys: ['base-images-base-v2026102601'] })])
    const { wrapper, nav } = mountView({ channel: CHANNEL })
    await flushPromises()

    await wrapper.find('[data-channel-match="true"]').trigger('click')
    await flushPromises()

    const linkedDrop = [...wrapper.findAll('span')].find(el => el.text() === 'base-images-base-v2026102601')
    expect(linkedDrop).toBeTruthy()
    await linkedDrop.trigger('click')

    expect(nav.navigateTo).toHaveBeenCalledWith('drop-detail', {
      key: 'base-images-base-v2026102601',
      product: 'base-images',
      channel: CHANNEL,
    })
    wrapper.unmount()
  })
})
