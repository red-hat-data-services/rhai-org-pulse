import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import RpmRequestForm from '../../client/components/requests/RpmRequestForm.vue'
import ChannelRequestForm from '../../client/components/requests/ChannelRequestForm.vue'
import { isoBusinessDaysFromNow, formatDateLabel } from '../../client/utils/request-dates'

vi.mock('@shared/client/services/api', () => ({
  apiRequest: vi.fn()
}))

const { apiRequest } = await import('@shared/client/services/api')
const submitRequest = vi.fn()
const CHANNELS = [
  { name: 'rocm6.4-torch2.11-ubi9', maturity: 'stable' },
  { name: 'cuda13.0-torch2.11-ubi9', maturity: 'stable' }
]
// 20 business days after Wed 2026-10-28.
const EARLIEST = '2026-11-25'

function created(summary) {
  return {
    status: 'created',
    requester: 'jane@redhat.com',
    summary,
    jira: { key: 'RHAI-321', url: 'https://redhat.atlassian.net/browse/RHAI-321' },
    assignee: { assigned: true, email: 'epacific@redhat.com' }
  }
}

async function fillCommon(wrapper, prefix) {
  await flushPromises()
  await wrapper.find(`#${prefix}-team`).setValue('Platform')
  await wrapper.find(`#${prefix}-jira-id`).setValue('RHAISTRAT-42')
  await wrapper.find(`#${prefix}-delivery-timeline`).setValue(EARLIEST)
  await wrapper.find(`#${prefix}-justification`).setValue('Needed for the new card')
}

async function pickChannel(wrapper, name) {
  await wrapper.find('#rpm-channels').trigger('focus')
  await wrapper.find(`[role="option"][data-value="${name}"]`).trigger('mousedown')
}

function lastPayload() {
  return JSON.parse(submitRequest.mock.calls.at(-1)[1].body)
}

describe('request date helpers', () => {
  it('counts business days in UTC and formats labels', () => {
    expect(isoBusinessDaysFromNow(20, new Date('2026-10-28T12:00:00Z'))).toBe(EARLIEST)
    expect(isoBusinessDaysFromNow(10, new Date('2026-10-30T23:00:00Z'))).toBe('2026-11-13')
    expect(formatDateLabel(EARLIEST)).toBe('Wed, Nov 25, 2026')
  })
})

describe('AIPCC-E triage request forms', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-28T12:00:00Z'))
    vi.clearAllMocks()
    submitRequest.mockReset()
    apiRequest.mockImplementation(async (url, options) => {
      if (options?.method === 'POST') return submitRequest(url, options)
      if (url.startsWith('/modules/product-builds/channels')) return { channels: CHANNELS }
      return [{ value: 'Platform', label: 'Platform' }]
    })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('RpmRequestForm', () => {
    it('lists existing channels as sorted typeahead options', async () => {
      const wrapper = mount(RpmRequestForm)
      await flushPromises()
      expect(apiRequest).toHaveBeenCalledWith('/modules/product-builds/channels?limit=1000&offset=0')
      const names = wrapper.findAll('[role="option"]').map(option => option.attributes('data-value'))
      expect(names).toEqual(['cuda13.0-torch2.11-ubi9', 'rocm6.4-torch2.11-ubi9'])
      expect(wrapper.find('#rpm-channels-listbox').text()).not.toContain('stable')
    })

    it('filters channels as you type and picks them with the keyboard', async () => {
      const wrapper = mount(RpmRequestForm)
      await flushPromises()
      const combobox = wrapper.find('#rpm-channels')
      await combobox.trigger('focus')
      expect(combobox.attributes('aria-expanded')).toBe('true')
      await combobox.setValue('ROCM')
      expect(wrapper.findAll('[role="option"]').map(option => option.attributes('data-value'))).toEqual(['rocm6.4-torch2.11-ubi9'])
      await combobox.trigger('keydown', { key: 'Enter' })
      expect(wrapper.findAll('[data-testid="channel-chip"]').map(chip => chip.text())).toEqual([expect.stringContaining('rocm6.4-torch2.11-ubi9')])
      expect(combobox.element.value).toBe('')

      await combobox.setValue('nothing-like-this')
      expect(wrapper.text()).toContain('No channels match "nothing-like-this"')
      await combobox.setValue('')
      await combobox.trigger('keydown', { key: 'Backspace' })
      expect(wrapper.findAll('[data-testid="channel-chip"]')).toHaveLength(0)
      await combobox.trigger('keydown', { key: 'Escape' })
      expect(combobox.attributes('aria-expanded')).toBe('false')
    })

    it('blocks dates inside 20 business days without calling it an SLA', async () => {
      const wrapper = mount(RpmRequestForm)
      await flushPromises()
      const date = wrapper.find('#rpm-delivery-timeline')
      expect(date.attributes('min')).toBe(EARLIEST)
      expect(wrapper.find('#rpm-delivery-timeline-hint').text()).toBe('Earliest available date: Wed, Nov 25, 2026.')
      expect(wrapper.text()).not.toMatch(/SLA/)

      await fillCommon(wrapper, 'rpm')
      await wrapper.find('#rpm-name').setValue('gcc-toolset-14')
      await wrapper.find('#rpm-source-details').setValue('EPEL 10')
      await pickChannel(wrapper, 'cuda13.0-torch2.11-ubi9')
      await date.setValue('2026-11-24')
      await wrapper.find('form').trigger('submit')
      await flushPromises()
      expect(submitRequest).not.toHaveBeenCalled()
      expect(wrapper.find('#rpm-delivery-timeline-error').text()).toBe('Delivery date must be Wed, Nov 25, 2026 or later')
    })

    it('requires a source and at least one channel', async () => {
      const wrapper = mount(RpmRequestForm)
      await fillCommon(wrapper, 'rpm')
      await wrapper.find('#rpm-name').setValue('zlib')
      await wrapper.find('form').trigger('submit')
      await flushPromises()
      expect(submitRequest).not.toHaveBeenCalled()
      expect(wrapper.find('#rpm-source-url-error').text()).toBe('Provide a source URL or describe where the RPM comes from')
      expect(wrapper.find('#rpm-channels-error').text()).toBe('Select at least one channel')
    })

    it('submits the RPM request and shows the filed Epic', async () => {
      submitRequest.mockResolvedValue(created('gcc-toolset-14 RPM request'))
      const wrapper = mount(RpmRequestForm)
      await fillCommon(wrapper, 'rpm')
      await wrapper.find('#rpm-name').setValue('gcc-toolset-14')
      await wrapper.find('#rpm-version').setValue('14.2.1')
      await wrapper.find('#rpm-source-url').setValue('https://src.fedoraproject.org/rpms/gcc-toolset-14')
      await pickChannel(wrapper, 'cuda13.0-torch2.11-ubi9')
      await pickChannel(wrapper, 'rocm6.4-torch2.11-ubi9')
      await wrapper.find('#rpm-release-target').setValue('3.6, 3.7')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(submitRequest.mock.calls[0][0]).toBe('/modules/product-builds/rpm-requests')
      expect(lastPayload()).toEqual({
        team: 'Platform',
        project: 'RHAISTRAT',
        rpm_name: 'gcc-toolset-14',
        version: '14.2.1',
        source_url: 'https://src.fedoraproject.org/rpms/gcc-toolset-14',
        source_details: null,
        channels: ['cuda13.0-torch2.11-ubi9', 'rocm6.4-torch2.11-ubi9'],
        jira_id: 'RHAISTRAT-42',
        delivery_timeline: EARLIEST,
        justification: 'Needed for the new card',
        release_target: ['3.6', '3.7'],
        release_commitment: ''
      })
      expect(wrapper.text()).toContain('RPM request submitted')
      expect(wrapper.find('a[href="https://redhat.atlassian.net/browse/RHAI-321"]').exists()).toBe(true)
    })

    it('shows server field errors', async () => {
      submitRequest.mockRejectedValue(Object.assign(new Error('Validation failed'), {
        status: 422,
        data: { error: 'Validation failed', fields: { jira_id: 'Related Jira issue RHAISTRAT-42 was not found or could not be verified' } }
      }))
      const wrapper = mount(RpmRequestForm)
      await fillCommon(wrapper, 'rpm')
      await wrapper.find('#rpm-name').setValue('zlib')
      await wrapper.find('#rpm-source-details').setValue('Fedora')
      await pickChannel(wrapper, 'cuda13.0-torch2.11-ubi9')
      await wrapper.find('form').trigger('submit')
      await flushPromises()
      expect(wrapper.find('[role="alert"]').text()).toBe('Validation failed')
      expect(wrapper.find('#rpm-jira-id-error').text()).toContain('RHAISTRAT-42')
    })
  })

  describe('ChannelRequestForm', () => {
    it('puts the STRAT and AIPCC discussion disclaimer at the top', async () => {
      const wrapper = mount(ChannelRequestForm)
      await flushPromises()
      const disclaimer = wrapper.find('#chan-disclaimer')
      expect(wrapper.element.firstElementChild).toBe(disclaimer.element)
      expect(disclaimer.text()).toContain('New channels require an approved STRAT and prior discussion with AIPCC')
      expect(disclaimer.text()).toContain('#forum-aipcc')
      expect(disclaimer.text()).toContain('@aipcc-support')
      expect(wrapper.text()).not.toMatch(/SLA/)
    })

    it('requires torch version, accelerator and OS', async () => {
      const wrapper = mount(ChannelRequestForm)
      await fillCommon(wrapper, 'chan')
      await wrapper.find('form').trigger('submit')
      await flushPromises()
      expect(submitRequest).not.toHaveBeenCalled()
      expect(wrapper.find('#chan-torch-version-error').text()).toBe('Torch version is required')
      expect(wrapper.find('#chan-accelerator-error').text()).toBe('Accelerator is required')
      expect(wrapper.find('#chan-os-error').text()).toBe('Operating system is required')
    })

    it('submits free text stack details', async () => {
      submitRequest.mockResolvedValue(created('New channel request: torch 2.12, ROCm 10.4, RHEL 10'))
      const wrapper = mount(ChannelRequestForm)
      await fillCommon(wrapper, 'chan')
      await wrapper.find('#chan-team-project').setValue('RHAI')
      await flushPromises()
      await wrapper.find('#chan-team').setValue('Platform')
      await wrapper.find('#chan-torch-version').setValue(' 2.12 ')
      await wrapper.find('#chan-accelerator').setValue('ROCm 10.4')
      await wrapper.find('#chan-os').setValue('RHEL 10')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(submitRequest.mock.calls[0][0]).toBe('/modules/product-builds/channel-requests')
      expect(lastPayload()).toEqual({
        team: 'Platform',
        project: 'RHAI',
        torch_version: '2.12',
        accelerator: 'ROCm 10.4',
        os: 'RHEL 10',
        jira_id: 'RHAISTRAT-42',
        delivery_timeline: EARLIEST,
        justification: 'Needed for the new card'
      })
      expect(wrapper.text()).toContain('Channel request submitted')
      await wrapper.find('button').trigger('click')
      expect(wrapper.find('#chan-torch-version').element.value).toBe('')
    })
  })
})
