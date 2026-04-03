import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'

// Mock the composable
const mockTokens = ref([])
const mockAllTokens = ref([])
const mockLoading = ref(false)
const mockError = ref(null)
const mockLoadTokens = vi.fn().mockResolvedValue()
const mockLoadAllTokens = vi.fn().mockResolvedValue()
const mockCreateToken = vi.fn()
const mockRevokeToken = vi.fn()
const mockAdminRevokeToken = vi.fn()

vi.mock('../composables/useApiTokens', () => ({
  useApiTokens: () => ({
    tokens: mockTokens,
    allTokens: mockAllTokens,
    loading: mockLoading,
    error: mockError,
    loadTokens: mockLoadTokens,
    loadAllTokens: mockLoadAllTokens,
    createToken: mockCreateToken,
    revokeToken: mockRevokeToken,
    adminRevokeToken: mockAdminRevokeToken
  })
}))

// Need to import after mock setup
let ApiTokensView

describe('ApiTokensView', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mockTokens.value = []
    mockAllTokens.value = []
    mockLoading.value = false
    mockError.value = null
    mockLoadTokens.mockResolvedValue()
    mockLoadAllTokens.mockResolvedValue()

    const mod = await import('../components/ApiTokensView.vue')
    ApiTokensView = mod.default
  })

  it('renders the heading and create button', async () => {
    const wrapper = mount(ApiTokensView, {
      props: { isAdmin: false }
    })
    await flushPromises()
    expect(wrapper.text()).toContain('API Tokens')
    expect(wrapper.text()).toContain('Create Token')
  })

  it('shows empty state when no tokens', async () => {
    const wrapper = mount(ApiTokensView, {
      props: { isAdmin: false }
    })
    await flushPromises()
    expect(wrapper.text()).toContain('No tokens yet')
  })

  it('shows tokens table when tokens exist', async () => {
    mockTokens.value = [
      {
        id: '1',
        name: 'My Script',
        tokenPrefix: 'tt_abc12345',
        createdAt: '2026-04-01T00:00:00Z',
        expiresAt: null,
        lastUsedAt: null
      }
    ]

    const wrapper = mount(ApiTokensView, {
      props: { isAdmin: false }
    })
    await flushPromises()

    expect(wrapper.text()).toContain('My Script')
    expect(wrapper.text()).toContain('tt_abc12345...')
    expect(wrapper.text()).toContain('Never')
    expect(wrapper.text()).toContain('Revoke')
  })

  it('shows admin section only for admins', async () => {
    const wrapperUser = mount(ApiTokensView, { props: { isAdmin: false } })
    await flushPromises()
    expect(wrapperUser.text()).not.toContain('All Tokens (Admin)')

    const wrapperAdmin = mount(ApiTokensView, { props: { isAdmin: true } })
    await flushPromises()
    expect(wrapperAdmin.text()).toContain('All Tokens (Admin)')
  })

  it('shows expired indicator for expired tokens', async () => {
    mockTokens.value = [
      {
        id: '1',
        name: 'Old Token',
        tokenPrefix: 'tt_expired0',
        createdAt: '2025-01-01T00:00:00Z',
        expiresAt: '2025-02-01T00:00:00Z',
        lastUsedAt: null
      }
    ]

    const wrapper = mount(ApiTokensView, {
      props: { isAdmin: false }
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Expired')
  })

  it('opens create modal when button clicked', async () => {
    const wrapper = mount(ApiTokensView, {
      props: { isAdmin: false }
    })
    await flushPromises()

    // Click the "Create Token" button (first button with that text)
    const createBtn = wrapper.findAll('button').find(b => b.text().includes('Create Token'))
    await createBtn.trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Create API Token')
    expect(wrapper.text()).toContain('Token Name')
    expect(wrapper.text()).toContain('Expiration')
  })

  it('calls loadTokens on mount', async () => {
    mount(ApiTokensView, {
      props: { isAdmin: false }
    })
    await flushPromises()
    expect(mockLoadTokens).toHaveBeenCalled()
  })

  it('calls loadAllTokens for admin on mount', async () => {
    mount(ApiTokensView, {
      props: { isAdmin: true }
    })
    await flushPromises()
    expect(mockLoadAllTokens).toHaveBeenCalled()
  })

  it('has collapsible help panel', async () => {
    const wrapper = mount(ApiTokensView, {
      props: { isAdmin: false }
    })
    await flushPromises()

    // Help should start collapsed
    expect(wrapper.text()).toContain('How to use API tokens')
    expect(wrapper.text()).not.toContain('Authorization header format')

    // Click to expand
    const helpButton = wrapper.findAll('button').find(b => b.text().includes('How to use API tokens'))
    await helpButton.trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Authorization header format')
    expect(wrapper.text()).toContain('curl')
  })
})
