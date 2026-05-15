import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import SiteSettings from '../components/SiteSettings.vue'

const mockGetSiteConfig = vi.fn()
const mockSaveSiteConfig = vi.fn()

vi.mock('@shared/client/services/api', () => ({
  getSiteConfig: (...args) => mockGetSiteConfig(...args),
  saveSiteConfig: (...args) => mockSaveSiteConfig(...args)
}))

describe('SiteSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSiteConfig.mockResolvedValue({ titlePrefix: '' })
    mockSaveSiteConfig.mockResolvedValue({ titlePrefix: 'Test' })
  })

  it('loads and displays current title prefix', async () => {
    mockGetSiteConfig.mockResolvedValue({ titlePrefix: 'My Org' })
    const wrapper = mount(SiteSettings)
    await flushPromises()

    const input = wrapper.find('input#titlePrefix')
    expect(input.element.value).toBe('My Org')
  })

  it('defaults to empty when config fetch fails', async () => {
    mockGetSiteConfig.mockRejectedValue(new Error('Network error'))
    const wrapper = mount(SiteSettings)
    await flushPromises()

    const input = wrapper.find('input#titlePrefix')
    expect(input.element.value).toBe('')
  })

  it('saves config and emits toast on success', async () => {
    const wrapper = mount(SiteSettings)
    await flushPromises()

    await wrapper.find('input#titlePrefix').setValue('New Prefix')
    await wrapper.find('button').trigger('click')
    await flushPromises()

    expect(mockSaveSiteConfig).toHaveBeenCalledWith({ titlePrefix: 'New Prefix', authEmailDomain: '' })
    expect(wrapper.emitted('toast')).toBeTruthy()
    expect(wrapper.emitted('toast')[0][0]).toEqual({
      message: 'Site configuration saved',
      type: 'success'
    })
  })

  it('emits error toast on save failure', async () => {
    mockSaveSiteConfig.mockRejectedValue(new Error('Forbidden'))
    const wrapper = mount(SiteSettings)
    await flushPromises()

    await wrapper.find('button').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('toast')).toBeTruthy()
    expect(wrapper.emitted('toast')[0][0]).toEqual({
      message: 'Forbidden',
      type: 'error'
    })
  })
})
