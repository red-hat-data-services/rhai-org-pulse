import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AiCatalystSettings from '../../client/components/AiCatalystSettings.vue'

vi.mock('@shared/client/services/api', () => ({ apiRequest: vi.fn() }))

import { apiRequest } from '@shared/client/services/api'

describe('AiCatalystSettings sync status', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('shows the persisted sync error instead of a green connected dot', async () => {
    apiRequest.mockImplementation(async url => {
      if (url.endsWith('/board-config')) return { feedUrl: '' }
      if (url.endsWith('/showcase/config')) return { feedUrl: '' }
      return {
        configured: true,
        demoMode: false,
        lastSyncTime: '2026-10-15T09:45:00Z',
        lastSyncAttemptTime: '2026-11-08T12:00:00Z',
        lastSyncError: 'Failed to reach POC Explorer feed: ECONNREFUSED 127.0.0.1:3128',
        boardCount: 7,
      }
    })

    const wrapper = mount(AiCatalystSettings)
    await flushPromises()

    expect(wrapper.text()).toContain('Configured, last sync failed')
    expect(wrapper.text()).toContain('Sync error: Failed to reach POC Explorer feed')
    expect(wrapper.text()).toContain('Last attempt')
    expect(wrapper.find('.bg-amber-500').exists()).toBe(true)
    expect(wrapper.find('.bg-green-500').exists()).toBe(false)
  })

  it('shows a readable stored-config error with the editable field', async () => {
    apiRequest.mockImplementation(async url => {
      if (url.endsWith('/board-config')) return { feedUrl: '', configReadError: 'Unexpected end of JSON input' }
      if (url.endsWith('/showcase/config')) return { feedUrl: '' }
      return {
        configured: true, demoMode: false,
        lastSyncTime: null, lastSyncAttemptTime: null, lastSyncError: null,
        configError: 'Unexpected end of JSON input', boardCount: 0,
      }
    })

    const wrapper = mount(AiCatalystSettings)
    await flushPromises()

    expect(wrapper.text()).toContain('Stored config unreadable: Unexpected end of JSON input')
    expect(wrapper.find('input').exists()).toBe(true)
  })
})
