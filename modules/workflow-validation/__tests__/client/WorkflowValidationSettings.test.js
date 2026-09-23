import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import WorkflowValidationSettings from '../../client/components/WorkflowValidationSettings.vue'

const { isAdmin, apiRequest } = vi.hoisted(() => {
  const { ref } = require('vue')
  return { isAdmin: ref(false), apiRequest: vi.fn() }
})

vi.mock('@shared/client/composables/useAuth.js', () => ({
  useAuth: () => ({ isAdmin })
}))
vi.mock('@shared/client/services/api.js', () => ({ apiRequest }))

describe('WorkflowValidationSettings', () => {
  beforeEach(() => {
    isAdmin.value = false
    apiRequest.mockReset()
    apiRequest.mockResolvedValue({ url: 'https://search.example', httpProxy: '', httpsProxy: '', overrides: {}, sources: {} })
  })

  it('does not render the section or request settings for non-admins', async () => {
    const wrapper = mount(WorkflowValidationSettings)
    await flushPromises()
    expect(wrapper.text()).toBe('')
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it('renders connection controls for admins without exposing OpenSearch credentials', async () => {
    isAdmin.value = true
    const wrapper = mount(WorkflowValidationSettings)
    await flushPromises()
    expect(wrapper.text()).toContain('Workflow Validation connection')
    expect(wrapper.text()).toContain('remain managed in Vault')
    expect(wrapper.text()).not.toContain('WORKFLOW_VALIDATION_OPENSEARCH_PASSWORD')
    expect(apiRequest).toHaveBeenCalledWith('/modules/workflow-validation/config')
  })
})
