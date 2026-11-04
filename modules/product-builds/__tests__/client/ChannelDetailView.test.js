import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import ChannelDetailView from '../../client/views/ChannelDetailView.vue'

vi.mock('@shared/client/services/api', () => ({
  apiRequest: vi.fn(),
}))

const { apiRequest } = await import('@shared/client/services/api')

const CHANNEL_NAME = 'cuda13.0-torch2.11-ubi9'

function channel(pullspec) {
  return {
    name: CHANNEL_NAME,
    description: 'CUDA 13.0 with Torch 2.11 on UBI 9',
    accelerator: 'cuda',
    accelerator_version: '13.0',
    torch_version: '2.11',
    rhel_version: 'ubi9',
    os_release: 'RHEL 9.8',
    python_version: '3.12',
    architectures: ['x86_64', 'aarch64'],
    compatible_releases: [],
    visibility: 'public',
    index_url: `https://example.test/${CHANNEL_NAME}/simple/`,
    base_image: `quay.io/aipcc/base-images/${CHANNEL_NAME}`,
    drops: [{
      key: 'base-images-base-v2026091101',
      name: 'base-v2026091101',
      product_key: 'base-images',
      git_branch: 'main',
      created_at: '2026-09-11T14:12:00Z',
      pullspec,
      changes: [],
    }],
    wheels: [],
  }
}

function createNav(params = {}) {
  return {
    params: ref(params),
    navigateTo: vi.fn(),
    goBack: vi.fn(),
    updateParams: vi.fn(),
  }
}

function mockChannel(data) {
  apiRequest.mockImplementation(() => Promise.resolve({ source: 'sample', channel: data }))
}

function mountView(nav) {
  return mount(ChannelDetailView, {
    global: { provide: { moduleNav: nav } },
  })
}

describe('ChannelDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.scrollTo = vi.fn()
  })

  it('opens the image artifact detail when a RHAIBI drop is clicked', async () => {
    const pullspec = `quay.io/aipcc/base-images/${CHANNEL_NAME}:base-v2026091101`
    mockChannel(channel(pullspec))
    const nav = createNav({ channel: CHANNEL_NAME })
    const wrapper = mountView(nav)
    await flushPromises()

    const dropButton = wrapper.get('button[aria-label="View drop base-v2026091101"]')
    await dropButton.trigger('click')

    expect(nav.navigateTo).toHaveBeenCalledWith('artifact-detail', {
      key: pullspec,
      product: 'base-images',
    })
    wrapper.unmount()
  })

  it('falls back to the drop detail when a drop has no pull spec', async () => {
    mockChannel(channel(undefined))
    const nav = createNav({ channel: CHANNEL_NAME })
    const wrapper = mountView(nav)
    await flushPromises()

    await wrapper.get('button[aria-label="View drop base-v2026091101"]').trigger('click')

    expect(nav.navigateTo).toHaveBeenCalledWith('drop-detail', {
      key: 'base-images-base-v2026091101',
      product: 'base-images',
    })
    wrapper.unmount()
  })
})
