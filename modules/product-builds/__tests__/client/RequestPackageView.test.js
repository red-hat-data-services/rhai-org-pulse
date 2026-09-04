import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import RequestPackageView from '../../client/views/RequestPackageView.vue'

vi.mock('@shared/client/services/api', () => ({
  apiRequest: vi.fn()
}))

vi.mock('@shared/client/composables/useAuth', () => ({
  useAuth: () => ({
    user: { value: { email: 'jane@redhat.com', displayName: 'Jane Doe' } }
  })
}))

const { apiRequest } = await import('@shared/client/services/api')

function futureDate(days = 30) {
  const date = new Date()
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

async function fillValidForm(wrapper) {
  await wrapper.find('#req-team').setValue('Platform')
  await wrapper.find('#req-package-name').setValue('vllm')
  await wrapper.find('#req-extras').setValue('cu12, dev')
  await wrapper.find('#req-jira-id').setValue('AIPCC-42')
  await wrapper.find('#req-justification').setValue('Needed for CUDA wheel builds')
  await wrapper.find('#req-delivery-timeline').setValue(futureDate())
  await wrapper.find('#req-hardware-ack').setValue(true)
  await wrapper.find('#req-testing-ack').setValue(true)
}

function successResponse() {
  return {
    status: 'created',
    requester: 'jane@redhat.com',
    summary: 'vllm[cu12,dev] package update request',
    jira: {
      key: 'AIPCC-999',
      url: 'https://redhat.atlassian.net/browse/AIPCC-999'
    },
    pipeline: {
      triggered: true,
      web_url: 'https://gitlab.com/redhat/rhel-ai/core/package-onboarding/-/pipelines/777'
    }
  }
}

describe('RequestPackageView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiRequest.mockReset()
    apiRequest.mockResolvedValue(successResponse())
  })

  it('renders the form and authenticated identity', () => {
    const wrapper = mount(RequestPackageView)
    expect(wrapper.text()).toContain('Request Package')
    expect(wrapper.text()).toContain('Jane Doe')
    expect(wrapper.find('#req-team').exists()).toBe(true)
    expect(wrapper.find('#req-package-name').exists()).toBe(true)
    expect(wrapper.find('#req-jira-id').exists()).toBe(true)
    expect(wrapper.find('button[type="submit"]').text()).toContain('Submit request')
  })

  it('shows required validation without submitting', async () => {
    const wrapper = mount(RequestPackageView)
    await wrapper.find('form').trigger('submit')

    expect(apiRequest).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Team is required')
    expect(wrapper.text()).toContain('Package name must start with a letter')
    expect(wrapper.text()).toContain('Business justification is required')
    expect(wrapper.text()).toContain('Provide hardware details')
    expect(wrapper.text()).toContain('Provide testing requirements')
  })

  it('requires a URL only for git and other sources', async () => {
    const wrapper = mount(RequestPackageView)
    expect(wrapper.find('#req-source-url').exists()).toBe(false)

    await wrapper.find('input[value="git"]').setChecked()
    expect(wrapper.find('#req-source-url').exists()).toBe(true)
    await fillValidForm(wrapper)
    await wrapper.find('form').trigger('submit')
    expect(wrapper.text()).toContain('Source URL is required for git and other package sources')

    await wrapper.find('#req-source-url').setValue('ftp://example.com/repo')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.text()).toContain('Source URL must be an HTTP or HTTPS URL')
  })

  it('accepts hardware and testing acknowledgements', async () => {
    const wrapper = mount(RequestPackageView)
    await wrapper.find('#req-team').setValue('Platform')
    await wrapper.find('#req-package-name').setValue('vllm')
    await wrapper.find('#req-jira-id').setValue('AIPCC-42')
    await wrapper.find('#req-justification').setValue('Needed')
    await wrapper.find('#req-delivery-timeline').setValue(futureDate())

    await wrapper.find('#req-hardware-ack').setValue(true)
    await wrapper.find('#req-testing-ack').setValue(true)
    await wrapper.find('form').trigger('submit')

    expect(wrapper.text()).not.toContain('Provide hardware details or acknowledge')
    expect(wrapper.text()).not.toContain('Provide testing requirements or acknowledge')
    expect(apiRequest).toHaveBeenCalled()
  })

  it('submits the backend payload without a requester field', async () => {
    const wrapper = mount(RequestPackageView)
    await fillValidForm(wrapper)
    await wrapper.find('#req-version').setValue('2.5.1')
    await wrapper.find('#req-release-target').setValue('3.4, 3.5')
    await wrapper.find('#req-backport-versions').setValue('2.4.0')
    await wrapper.find('#req-release-commitment').setValue('3.4 GA')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    const options = apiRequest.mock.calls[0][1]
    const payload = JSON.parse(options.body)
    expect(apiRequest.mock.calls[0][0]).toBe('/modules/product-builds/package-requests')
    expect(payload).toMatchObject({
      team: 'Platform',
      package_name: 'vllm',
      extras: ['cu12', 'dev'],
      package_source: 'pypi',
      source_url: null,
      version: '2.5.1',
      jira_id: 'AIPCC-42',
      delivery_timeline: futureDate(),
      release_target: ['3.4', '3.5'],
      backport_versions: ['2.4.0']
    })
    expect(payload).not.toHaveProperty('requester')
    expect(wrapper.text()).toContain('Package request submitted')
    expect(wrapper.text()).toContain('AIPCC-999')
    expect(wrapper.text()).toContain('View pipeline')
  })

  it('offers an explicit retry for a production warning', async () => {
    apiRequest
      .mockResolvedValueOnce({
        status: 'warning',
        package_name: 'vllm',
        message: 'Review the production package before continuing.',
        found_in: [{ product_version: '3.4', variant: 'cuda-ubi9', index_url: 'https://packages.example/simple/', files: ['vllm-2.5.1.whl'] }]
      })
      .mockResolvedValueOnce(successResponse())

    const wrapper = mount(RequestPackageView)
    await fillValidForm(wrapper)
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('already present in production')
    expect(wrapper.text()).toContain('3.4 / cuda-ubi9')
    const retryButton = wrapper.findAll('button').find(button => button.text() === 'Submit anyway')
    await retryButton.trigger('click')
    await flushPromises()

    expect(apiRequest).toHaveBeenCalledTimes(2)
    const retryPayload = JSON.parse(apiRequest.mock.calls[1][1].body)
    expect(retryPayload.skip_production_check).toBe(true)
    expect(wrapper.text()).toContain('Package request submitted')
  })

  it('shows duplicate tickets and backend field errors', async () => {
    const duplicate = Object.assign(new Error('Duplicate request'), {
      status: 409,
      data: { error: 'Duplicate request', existing_tickets: [{ key: 'AIPCC-100', url: 'https://redhat.atlassian.net/browse/AIPCC-100', summary: 'vllm package update request', status: 'To Do' }] }
    })
    apiRequest.mockRejectedValueOnce(duplicate)

    const wrapper = mount(RequestPackageView)
    await fillValidForm(wrapper)
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('AIPCC-100')
    expect(wrapper.text()).toContain('vllm package update request')

    const validation = Object.assign(new Error('Validation failed'), {
      status: 422,
      data: { error: 'Validation failed', fields: { jira_id: 'Related Jira issue was not found' } }
    })
    apiRequest.mockRejectedValueOnce(validation)
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Related Jira issue was not found')
  })

  it('shows rate limit and network errors', async () => {
    const rateLimit = Object.assign(new Error('Rate limited: one package request per user per 60 seconds'), {
      status: 429,
      data: { retry_after_seconds: 42 }
    })
    apiRequest.mockRejectedValueOnce(rateLimit)

    const wrapper = mount(RequestPackageView)
    await fillValidForm(wrapper)
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('42 seconds')

    apiRequest.mockRejectedValueOnce(new Error('Failed to fetch'))
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Could not reach the server')
  })
})
