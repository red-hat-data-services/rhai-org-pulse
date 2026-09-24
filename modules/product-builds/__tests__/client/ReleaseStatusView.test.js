import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import ReleaseStatusView from '../../client/views/ReleaseStatusView.vue'

vi.mock('@shared/client/services/api', () => ({
  apiRequest: vi.fn(),
}))

const { apiRequest } = await import('@shared/client/services/api')

describe('ReleaseStatusView', () => {
  beforeEach(() => {
    apiRequest.mockReset()
    window.localStorage.clear()
  })

  function response(epics) {
    return {
      total: epics.length,
      groups: [
        { key: 'rhaiis', label: 'RHAII', epics },
        { key: 'rhel-ai', label: 'RHEL AI', epics: [] },
        { key: 'base-images', label: 'Base images', epics: [] },
      ],
    }
  }

  it('renders the action hub and grouped epic tree while hiding technical labels', async () => {
    apiRequest.mockResolvedValue({
      ...response([{
        key: 'AIPCC-100',
        summary: 'RHAII release',
        status: { name: 'In Progress', category: 'indeterminate' },
        labels: ['release-automation'],
        updated: '2026-09-22T10:00:00Z',
        details: { version: '3.5', target: 'prod' },
        children: [{
          key: 'AIPCC-101',
          summary: 'Production card',
          status: { name: 'Ready', category: 'indeterminate' },
          labels: ['ready', 'customer-facing'],
          updated: '2026-09-22T10:00:00Z',
        }],
      }]),
    })

    const wrapper = mount(ReleaseStatusView)
    await flushPromises()

    expect(apiRequest).toHaveBeenCalledWith('/modules/product-builds/release-status')
    expect(wrapper.text()).toContain('Release status')
    expect(wrapper.get('#release-actions-heading').text()).toBe('Release actions')
    expect(wrapper.text()).not.toContain('coming soon')
    expect(wrapper.get('[data-release-action="create-epic"]').text()).toContain('Create release epic')
    expect(wrapper.get('[data-release-action="create-epic"]').element.disabled).toBe(false)
    expect(wrapper.get('[data-release-action="trigger-release"]').text()).toContain('Trigger release')
    expect(wrapper.get('[data-release-action="trigger-release"]').element.disabled).toBe(true)
    expect(wrapper.text()).toContain('AIPCC-100')
    expect(wrapper.text()).toContain('AIPCC-101')
    expect(wrapper.text()).not.toContain('release-automation')
    expect(wrapper.text()).toContain('customer-facing')
    expect(wrapper.text()).toContain('ready')
    expect(wrapper.get('[aria-label="Status legend"]').text()).toContain('Triggered / in progress')
    expect(wrapper.get('[data-tree-root="AIPCC-100"]')).toBeTruthy()
    expect(wrapper.get('[data-tree-branch]')).toBeTruthy()
    expect(wrapper.get('[data-tree-child="AIPCC-101"]').text()).toContain('Production card')
    expect(wrapper.get('[data-status-badge="AIPCC-100"]').classes()).toContain('bg-emerald-50')
    expect(wrapper.get('[data-status-badge="AIPCC-101"]').classes()).toContain('bg-blue-50')
    expect(wrapper.get('[data-tree-child="AIPCC-101"] a').attributes('href')).toBe('https://redhat.atlassian.net/browse/AIPCC-101')

    const epicRoot = wrapper.get('[data-tree-root="AIPCC-100"]')
    const branch = wrapper.get('[data-tree-branch]')
    expect(epicRoot.attributes('aria-expanded')).toBe('true')
    await epicRoot.trigger('click')
    await nextTick()
    expect(branch.attributes('style')).toContain('display: none')
    expect(epicRoot.attributes('aria-expanded')).toBe('false')
    await epicRoot.trigger('click')
    await nextTick()
    expect(branch.attributes('style')).not.toContain('display: none')
    expect(wrapper.find('[data-tree-child="AIPCC-101"]').exists()).toBe(true)
  })

  it('renders the authoritative create-release-epic form', async () => {
    apiRequest.mockResolvedValue(response([]))

    const wrapper = mount(ReleaseStatusView)
    await flushPromises()

    await wrapper.get('[data-release-action="create-epic"]').trigger('click')
    const createForm = wrapper.get('[data-release-form="create-epic"]')
    expect(createForm.text()).toContain('Product')
    expect(createForm.text()).toContain('Version')
    expect(createForm.text()).toContain('Branch')
    expect(createForm.text()).toContain('Release type')
    expect(createForm.text()).toContain('Advisory type')
    expect(createForm.text()).toContain('Exclude components or variants')
    expect(createForm.text()).toContain('Parent feature')
    expect(createForm.get('select[name="product"] option[value="rhaiis"]')).toBeTruthy()
    expect(createForm.get('select[name="product"] option[value="base-images"]')).toBeTruthy()
    expect(createForm.get('select[name="product"] option[value="rhaiis"]')).toBeTruthy()
    expect(createForm.get('select[name="product"] option[value="rhelai"]')).toBeTruthy()
    expect(createForm.get('select[name="product"] option[value="torch"]')).toBeTruthy()
    expect(createForm.get('select[name="product"] option[value="docling"]')).toBeTruthy()
    expect(createForm.get('select[name="version"]')).toBeTruthy()
    expect(createForm.get('select[name="branch"]')).toBeTruthy()
    expect(createForm.get('select[name="release-type"] option[value="GA"]')).toBeTruthy()
    expect(createForm.get('select[name="release-type"] option[value="EA"]')).toBeTruthy()
    expect(createForm.get('select[name="advisory-type"] option[value="RHEA"]')).toBeTruthy()
    expect(createForm.get('select[name="advisory-type"] option[value="RHBA"]')).toBeTruthy()
    expect(createForm.get('select[name="advisory-type"] option[value="RHSA"]')).toBeTruthy()
    expect(createForm.text()).not.toContain('Tech Preview')
    expect(createForm.text()).not.toMatch(/\bTarget\b/)
    expect(createForm.get('select[name="release-type"]').element.value).toBe('')
    expect(createForm.get('select[name="advisory-type"]').element.value).toBe('RHEA')
    expect(createForm.get('select[name="feature-mode"]').element.value).toBe('auto')
    expect(createForm.find('input[name="feature"]').exists()).toBe(false)
    await createForm.get('select[name="feature-mode"]').setValue('explicit')
    expect(createForm.get('input[name="feature"]').attributes('required')).toBeDefined()
    expect(createForm.text()).toContain('Leave blank to use the configured default')

    await wrapper.get('[data-release-action="create-epic"]').trigger('click')
    expect(wrapper.find('[data-release-form="create-epic"]').exists()).toBe(false)
  })

  it('keeps the trigger release action disabled until it is implemented', async () => {
    apiRequest.mockResolvedValue(response([]))

    const wrapper = mount(ReleaseStatusView)
    await flushPromises()
    expect(wrapper.get('[data-release-action="trigger-release"]').attributes('aria-disabled')).toBe('true')
    await wrapper.get('[data-release-action="trigger-release"]').trigger('click')
    expect(wrapper.find('[data-release-form="trigger-release"]').exists()).toBe(false)
    expect(wrapper.get('[data-release-action="create-epic"]')).toBeTruthy()
    expect(wrapper.get('[data-release-action="trigger-release"]')).toBeTruthy()
  })

  it('uses lifecycle labels before Jira status and maps each lifecycle color', async () => {
    const states = [
      ['planned', 'Done', 'bg-amber-50'],
      ['triggered', 'To Do', 'bg-emerald-50'],
       ['released', 'Done', 'bg-violet-50'],
      ['failed', 'Done', 'bg-red-50'],
       ['skip', 'Closed', 'bg-gray-100'],
    ]
    apiRequest.mockResolvedValue(response([{
      key: 'AIPCC-200',
      summary: 'Lifecycle release',
      status: { name: 'In Progress', category: 'indeterminate' },
      labels: ['ready', 'release-automation'],
      details: {},
      children: states.map(([label, jiraStatus], index) => ({
        key: `AIPCC-${201 + index}`,
        summary: `${label} card`,
        status: { name: jiraStatus, category: 'indeterminate' },
        labels: [label],
        updated: null,
      })),
    }]))

    const wrapper = mount(ReleaseStatusView)
    await flushPromises()

    expect(wrapper.get('[data-status-badge="AIPCC-200"]').classes()).toContain('bg-blue-50')
    expect(wrapper.get('[data-tree-child="AIPCC-203"]').attributes('data-completed')).toBe('true')
    expect(wrapper.get('[data-tree-child="AIPCC-205"]').attributes('data-completed')).toBe('true')
    for (const [label, , expectedClass] of states) {
      const key = `AIPCC-${201 + states.findIndex(([state]) => state === label)}`
       expect(wrapper.get(`[data-tree-child="${key}"]`).attributes('data-status-state')).toBe(label === 'skip' ? 'skipped' : label)
      expect(wrapper.get(`[data-status-badge="${key}"]`).classes()).toContain(expectedClass)
    }
  })

  it('uses readiness-detector precedence for conflicting lifecycle labels', async () => {
    apiRequest.mockResolvedValue(response([{
      key: 'AIPCC-400',
      summary: 'Conflicting labels',
      status: { name: 'Done', category: 'done' },
      labels: [],
      details: {},
      children: [{
        key: 'AIPCC-401',
        summary: 'Planned and ready card',
        status: { name: 'Done', category: 'done' },
        labels: ['ready', 'planned'],
        updated: null,
      }],
    }]))

    const wrapper = mount(ReleaseStatusView)
    await flushPromises()

    expect(wrapper.get('[data-tree-child="AIPCC-401"]').attributes('data-status-state')).toBe('planned')
  })

  it('falls back to Jira status when no lifecycle label is present', async () => {
    apiRequest.mockResolvedValue(response([{
      key: 'AIPCC-300',
      summary: 'Fallback release',
      status: { name: 'Ready', category: 'new' },
      labels: [],
      details: {},
      children: [],
    }]))

    const wrapper = mount(ReleaseStatusView)
    await flushPromises()

    expect(wrapper.get('[data-tree-root="AIPCC-300"]').attributes('data-status-state')).toBe('ready')
    expect(wrapper.get('[data-status-badge="AIPCC-300"]').classes()).toContain('bg-blue-50')
  })

  it('loads PMC metadata for the create form and exposes exact branch versions', async () => {
    apiRequest.mockImplementation((path) => {
      if (path === '/modules/product-builds/release-status') return Promise.resolve(response([]))
      return Promise.resolve({
        products: [{ key: 'rhaiis', branches: [{ branch: '3.6-fast1', tags: ['3.6.0-fast.1'], configured_versions: ['3.6.0-fast.1'] }] }],
      })
    })
    const wrapper = mount(ReleaseStatusView)
    await flushPromises()
    await wrapper.get('[data-release-action="create-epic"]').trigger('click')
    await flushPromises()

    const form = wrapper.get('[data-release-form="create-epic"]')
    await form.get('select[name="product"]').setValue('rhaiis')
    await form.get('select[name="branch"]').setValue('3.6-fast1')
    await nextTick()
    expect(form.get('select[name="version"] option[value="3.6.0-fast.1"]')).toBeTruthy()
    expect(form.get('select[name="advisory-type"]').attributes('required')).toBeDefined()
  })

  it('clears a selected Feature when the release identity changes', async () => {
    apiRequest.mockImplementation((path) => {
      if (path === '/modules/product-builds/release-status') return Promise.resolve(response([]))
      return Promise.resolve({
        products: [{ key: 'rhaiis', branches: [{ branch: 'main', configured_versions: ['3.6.0', '3.6.0-ea.1'] }] }],
      })
    })
    const wrapper = mount(ReleaseStatusView)
    await flushPromises()
    await wrapper.get('[data-release-action="create-epic"]').trigger('click')
    await flushPromises()

    const form = wrapper.get('[data-release-form="create-epic"]')
    await form.get('select[name="product"]').setValue('rhaiis')
    await form.get('select[name="branch"]').setValue('main')
    await form.get('select[name="version"]').setValue('3.6.0')
    await form.get('select[name="feature-mode"]').setValue('explicit')
    await form.get('input[name="feature"]').setValue('RHAISTRAT-7')
    await form.get('select[name="version"]').setValue('3.6.0-ea.1')

    expect(form.get('select[name="feature-mode"]').element.value).toBe('auto')
    expect(form.find('input[name="feature"]').exists()).toBe(false)
  })

  it('shows duplicate confirmation and resubmits with confirmation', async () => {
    const duplicate = { key: 'RHAI-10', summary: 'Release rhaiis 3.6.0 GA' }
    apiRequest.mockImplementation((path, options) => {
      if (path === '/modules/product-builds/release-status') return Promise.resolve(response([]))
       if (path === '/modules/product-builds/release-epic/options') return Promise.resolve({ products: [{ key: 'rhaiis', branches: [{ branch: '3.6', configured_versions: ['3.6.0'] }] }] })
      if (options?.method === 'POST' && !JSON.parse(options.body).confirm_duplicates) {
        const error = new Error('duplicate')
        error.data = { duplicates: [duplicate] }
        return Promise.reject(error)
      }
      return Promise.resolve({ epic: { key: 'RHAI-11' } })
    })
    const wrapper = mount(ReleaseStatusView)
    await flushPromises()
    await wrapper.get('[data-release-action="create-epic"]').trigger('click')
    const form = wrapper.get('[data-release-form="create-epic"]')
    await form.get('select[name="product"]').setValue('rhaiis')
    await form.get('select[name="version"]').setValue('3.6.0')
    await form.get('select[name="branch"]').setValue('3.6')
    await form.get('select[name="feature-mode"]').setValue('none')
    await form.get('select[name="advisory-type"]').setValue('RHEA')
    await form.trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('RHAI-10')
    expect(wrapper.text()).toContain('Confirm and create release epic')
    await form.trigger('submit')
    await flushPromises()
    const posts = apiRequest.mock.calls.filter(([path, options]) => path === '/modules/product-builds/release-epic' && options?.method === 'POST')
    expect(JSON.parse(posts.at(-1)[1].body).confirm_duplicates).toBe(true)
    expect(wrapper.text()).toContain('RHAI-11')
  })

  it('renders returned Feature choices for explicit selection or skip', async () => {
    apiRequest.mockImplementation((path, options) => {
      if (path === '/modules/product-builds/release-status') return Promise.resolve(response([]))
       if (path === '/modules/product-builds/release-epic/options') return Promise.resolve({ products: [{ key: 'rhaiis', branches: [{ branch: '3.6-fast1', configured_versions: ['3.6.0'] }] }] })
      if (options?.method !== 'POST') return Promise.resolve(response([]))
      const error = new Error('multiple features')
      error.data = { features: [{ key: 'RHAISTRAT-1', summary: 'RHAII 3.6 fast1 Release' }] }
      return Promise.reject(error)
    })
    const wrapper = mount(ReleaseStatusView)
    await flushPromises()
    await wrapper.get('[data-release-action="create-epic"]').trigger('click')
    const form = wrapper.get('[data-release-form="create-epic"]')
    await form.get('select[name="product"]').setValue('rhaiis')
    await form.get('select[name="version"]').setValue('3.6.0')
    await form.get('select[name="branch"]').setValue('3.6-fast1')
    await form.get('select[name="feature-mode"]').setValue('auto')
    await form.get('select[name="advisory-type"]').setValue('RHEA')
    await form.trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('RHAISTRAT-1')
    expect(wrapper.text()).toContain('Skip parent Feature')
  })
})
