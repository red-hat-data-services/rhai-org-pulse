import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('@shared/client/services/api.js', () => ({
  apiRequest: vi.fn()
}))

import { apiRequest } from '@shared/client/services/api.js'
import CatalogView from '../../client/views/CatalogView.vue'
import ShowcaseCard from '../../client/components/ShowcaseCard.vue'
import { _resetForTesting } from '../../client/composables/useShowcase.js'

beforeEach(() => {
  _resetForTesting()
  vi.clearAllMocks()
})

function mountCatalog() {
  return mount(CatalogView, {
    global: {
      provide: {
        moduleNav: {
          navigateTo: vi.fn(),
          goBack: vi.fn(),
          params: { value: {} }
        }
      }
    }
  })
}

describe('CatalogView', () => {
  it('sorts an entry with sortOrder 0 before sortOrder 1', async () => {
    apiRequest.mockResolvedValue({
      entries: [
        { slug: 'second', title: 'Second Entry', sortOrder: 1 },
        { slug: 'first', title: 'First Entry', sortOrder: 0 }
      ],
      pillars: []
    })

    const wrapper = mountCatalog()
    await flushPromises()

    const slugs = wrapper.findAllComponents(ShowcaseCard).map(c => c.props('entry').slug)
    expect(slugs).toEqual(['first', 'second'])
  })
})
