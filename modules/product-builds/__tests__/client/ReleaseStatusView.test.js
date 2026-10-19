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
    expect(wrapper.get('[data-release-action="trigger-release"]').element.disabled).toBe(false)
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

  it('opens the trigger release form and loads its options', async () => {
    apiRequest.mockResolvedValue(response([]))

    const wrapper = mount(ReleaseStatusView)
    await flushPromises()
    await wrapper.get('[data-release-action="trigger-release"]').trigger('click')
    await flushPromises()
    expect(apiRequest).toHaveBeenCalledWith('/modules/product-builds/release-trigger/options')
    expect(wrapper.find('[data-release-form="trigger-release"]').exists()).toBe(true)
    expect(wrapper.get('[data-release-action="create-epic"]')).toBeTruthy()
    expect(wrapper.get('[data-release-action="trigger-release"]')).toBeTruthy()
    const form = wrapper.get('[data-release-form="trigger-release"]')
    await form.findAll('select')[1].setValue('image-list')
    const instructions = form.findAll('details')
    expect(instructions).toHaveLength(2)
    expect(instructions[0].attributes('open')).toBeUndefined()
    await instructions[0].get('summary').trigger('click')
    expect(instructions[0].attributes('open')).toBeDefined()
    expect(form.text()).toContain('cuda, rocm')
    expect(form.text()).toContain('cuda rocm')
    expect(form.text()).toContain('cuda, rocm model-opt')
    expect(form.text()).toContain('bootc-gaudi:containers')
    expect(form.text()).toContain('quay.io/aipcc/rhaiis/rocm-ubi9@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef')
    expect(form.text()).toContain('bootc-gaudi:containers=<pullspec>')
    expect(form.text()).toContain('rocm=quay.io/aipcc/rhaiis/rocm-ubi9:3.6.0-fast.2-1790234469')
    await instructions[1].get('summary').trigger('click')
    expect(instructions[1].attributes('open')).toBeDefined()
    expect(form.text()).toContain('bootc-gaudi-qcow2-disk-image:disk-images')
    await form.findAll('select')[1].setValue('git-tag')
    expect(form.text()).toContain('Git tag')
    expect(form.text()).toContain('3.6.0-fast.2')
    await form.findAll('select')[1].setValue('commit-sha')
    expect(form.text()).toContain('Commit SHA')
    expect(form.text()).toContain('Use 7–64 hexadecimal characters.')
    expect(form.text()).toContain('488e59cf0fdce2ab17f0358fd71cc8136d14aa94')
  })

  it('shows which component each image-list pullspec was mapped to', async () => {
    const pullspec = 'quay.io/aipcc/rhaiis/rocm-ubi9:3.6.0-fast.2-1790234469'
    const gaudiContainersPullspec = 'quay.io/aipcc/rhelai/bootc-gaudi:3.4.5-2026100101'
    const gaudiDiskImagesPullspec = 'quay.io/aipcc/rhelai/bootc-gaudi:3.4.5-2026100102'
    const options = {
      sha: 'a'.repeat(40),
      cards: [{
        key: 'RHAI-1912', summary: 'Release rhaiis 3.6.0-fast.2 (stage-rc)', state: 'planned', target: 'stage-rc',
        input_type: 'image-list', input_value: '', pipeline_components: 'all',
        parent: { key: 'RHAI-1910', application: 'rhaiis-3-6-fast2', product: 'rhaiis', version: '3.6.0-fast.2', branch: '3.6-fast2', release_type: 'EA', advisory_type: 'RHEA' },
      }],
    }
    apiRequest.mockImplementation((path, request) => {
      if (path === '/modules/product-builds/release-status') return Promise.resolve(response([]))
      if (path === '/modules/product-builds/release-trigger/options') return Promise.resolve(options)
      if (request?.method === 'POST') return Promise.resolve({ tasks: [{
        key: 'RHAI-1912', operation: 'updated', state: 'ready',
        components: [
          { name: 'rocm', variant: 'rocm', pullspec },
          { name: 'bootc-gaudi', variant: 'gaudi', config_family: 'containers', pullspec: gaudiContainersPullspec },
          { name: 'bootc-gaudi', variant: 'gaudi', config_family: 'disk-images', pullspec: gaudiDiskImagesPullspec },
        ],
      }] })
      return Promise.resolve(response([]))
    })

    const wrapper = mount(ReleaseStatusView)
    await flushPromises()
    await wrapper.get('[data-release-action="trigger-release"]').trigger('click')
    await flushPromises()

    const form = wrapper.get('[data-release-form="trigger-release"]')
    await form.get('textarea[placeholder="all or cuda, rocm, model-opt"]').setValue('rocm')
    await form.get('textarea[placeholder="pullspecs or component=pullspec, one per line"]').setValue(`rocm=${pullspec}`)
    await form.trigger('submit')
    await flushPromises()

    expect(form.text()).toContain(`Mapped ${pullspec} to rocm`)
    expect(form.text()).toContain(`Mapped ${gaudiContainersPullspec} to bootc-gaudi:containers`)
    expect(form.text()).toContain(`Mapped ${gaudiDiskImagesPullspec} to bootc-gaudi:disk-images`)
  })

  it('selects a readiness card and submits PMC fields with read-only card metadata', async () => {
    const options = {
      sha: 'a'.repeat(40),
      cards: [{
        key: 'AIPCC-101',
        summary: 'Release rhaiis 3.6.0 (prod): cuda',
        state: 'planned',
        target: 'prod',
        parent: {
          key: 'AIPCC-100', application: 'rhaiis', product: 'rhaiis', version: '3.6.0',
          branch: '3.6', release_type: 'GA', advisory_type: 'RHSA',
        },
      }],
    }
    apiRequest.mockImplementation((path, request) => {
      if (path === '/modules/product-builds/release-status') return Promise.resolve(response([]))
      if (path === '/modules/product-builds/release-trigger/options') return Promise.resolve(options)
      if (request?.method === 'POST') return Promise.resolve({ tasks: [{ key: 'AIPCC-101', operation: 'updated', state: 'ready' }] })
      return Promise.resolve(response([]))
    })

    const wrapper = mount(ReleaseStatusView)
    await flushPromises()
    await wrapper.get('[data-release-action="trigger-release"]').trigger('click')
    await flushPromises()

    const form = wrapper.get('[data-release-form="trigger-release"]')
    expect(form.text()).toContain('Application: rhaiis')
    expect(form.text()).toContain('Target: prod')
    const cveList = form.get('textarea[placeholder="CVE-YYYY-NNNN (one per line)"]')
    expect(cveList.attributes('required')).toBeDefined()
    const skippedComponents = form.get('textarea[placeholder="cuda, rocm, model-opt"]')
    await skippedComponents.setValue('rocm')
    expect(form.text()).toContain('Put accelerator-specific CVE mapping here.')
    expect(form.text()).toContain('Ready components')
    expect(form.text()).toContain('Skipped components')
    expect(form.text()).not.toContain('accelerator-to-CVE mapping')
    await form.get('textarea[placeholder="all or cuda, rocm, model-opt"]').setValue('all')
    await form.get('textarea[placeholder="Additional context or special instructions for the AI agent"]').setValue('Only CUDA is affected.')
    await cveList.setValue('CVE-2026-1234')
    await form.get('textarea[placeholder="exact configured Git tag"]').setValue('3.6.0')
    await form.trigger('submit')
    await flushPromises()

    const post = apiRequest.mock.calls.find(([path, request]) => path === '/modules/product-builds/release-trigger' && request?.method === 'POST')
    const body = JSON.parse(post[1].body)
    expect(body.card_key).toBe('AIPCC-101')
    expect(body.target).toBe('prod')
    expect(body.components).toBe('all')
    expect(body.skipped_components).toBe('rocm')
    expect(body.user_prompt).toBe('Only CUDA is affected.')
    expect(body.cve_list).toBe('CVE-2026-1234')
    expect(form.text()).toContain('Updated release readiness:')
  })

  it('hides the CVE list for non-RHSA cards', async () => {
    const options = {
      sha: 'a'.repeat(40),
      cards: [{
        key: 'AIPCC-102',
        summary: 'Release rhaiis 3.6.0 (prod): cuda',
        state: 'planned',
        target: 'prod',
        parent: {
          key: 'AIPCC-103', application: 'rhaiis', product: 'rhaiis', version: '3.6.0',
          branch: '3.6', release_type: 'GA', advisory_type: 'RHEA',
        },
      }],
    }
    apiRequest.mockImplementation((path) => {
      if (path === '/modules/product-builds/release-trigger/options') return Promise.resolve(options)
      return Promise.resolve(response([]))
    })

    const wrapper = mount(ReleaseStatusView)
    await flushPromises()
    await wrapper.get('[data-release-action="trigger-release"]').trigger('click')
    await flushPromises()

    const form = wrapper.get('[data-release-form="trigger-release"]')
    expect(form.find('textarea[placeholder="CVE-YYYY-NNNN (one per line)"]').exists()).toBe(false)
    expect(form.text()).not.toContain('CVE list')
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

  it('shows each checklist-card creation error and where to find further diagnostics', async () => {
    const result = {
      epic: { key: 'RHAI-4333', summary: 'Release rhelai 3.4.5 GA' },
      cards: [{ key: 'RHAI-4334', summary: 'Release rhelai 3.4.5 (prod): bootc-gaudi' }],
      not_created: [],
      failures: [{
        summary: 'Release rhelai 3.4.5 (stage-rc): bootc-gaudi',
        error: 'Jira rejected the stage-rc card: required field is missing',
      }],
      warnings: ['Some checklist cards failed to create; see failures.'],
      created_keys: ['RHAI-4333', 'RHAI-4334'],
    }
    const options = {
      sha: 'a'.repeat(40),
      products: [{ key: 'rhelai', branches: [{ branch: '3.4', configured_versions: ['3.4.5'] }] }],
    }
    apiRequest.mockImplementation((path, request) => {
      if (path === '/modules/product-builds/release-status') return Promise.resolve(response([]))
      if (path.startsWith('/modules/product-builds/release-epic/options')) return Promise.resolve(options)
      if (request?.method === 'POST') return Promise.resolve(result)
      return Promise.resolve(response([]))
    })

    const wrapper = mount(ReleaseStatusView)
    await flushPromises()
    await wrapper.get('[data-release-action="create-epic"]').trigger('click')
    const form = wrapper.get('[data-release-form="create-epic"]')
    await form.get('select[name="product"]').setValue('rhelai')
    await form.get('select[name="branch"]').setValue('3.4')
    await flushPromises()
    await form.get('select[name="version"]').setValue('3.4.5')
    await form.get('select[name="feature-mode"]').setValue('none')
    await form.trigger('submit')
    await flushPromises()

    expect(form.text()).toContain('Created release Epic RHAI-4333')
    expect(form.text()).toContain('Checklist cards that failed to create:')
    expect(form.text()).toContain('Release rhelai 3.4.5 (stage-rc): bootc-gaudi')
    expect(form.text()).toContain('Jira rejected the stage-rc card: required field is missing')
    expect(form.text()).toContain('[release-epic] Checklist card creation failed')
    expect(form.text()).toContain('application logs')
    expect(form.text()).not.toContain('at createReleaseEpic')
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

  it('filters releases with multi-select product and status buttons', async () => {
    const release = (key, labels) => ({
      key,
      summary: `${key} release`,
      status: { name: 'In Progress', category: 'indeterminate' },
      labels,
      updated: '2026-10-15T10:00:00Z',
      details: {},
      children: [],
    })
    apiRequest.mockResolvedValue({
      total: 3,
      groups: [
        { key: 'rhaiis', label: 'RHAII', epics: [release('AIPCC-500', ['planned'])] },
        { key: 'rhel-ai', label: 'RHEL AI', epics: [release('AIPCC-501', ['released'])] },
        { key: 'torch', label: 'Torch', epics: [release('AIPCC-502', ['released'])] },
      ],
    })

    const wrapper = mount(ReleaseStatusView)
    await flushPromises()

    expect(wrapper.get('[data-tree-root="AIPCC-500"]')).toBeTruthy()
    expect(wrapper.get('[data-tree-root="AIPCC-501"]')).toBeTruthy()
    expect(wrapper.get('[data-tree-root="AIPCC-502"]')).toBeTruthy()

    await wrapper.get('[data-filter-product="rhel-ai"]').trigger('click')
    expect(wrapper.find('[data-tree-root="AIPCC-500"]').exists()).toBe(false)
    expect(wrapper.get('[data-tree-root="AIPCC-501"]')).toBeTruthy()

    await wrapper.get('[data-filter-product="torch"]').trigger('click')
    expect(wrapper.get('[data-tree-root="AIPCC-501"]')).toBeTruthy()
    expect(wrapper.get('[data-tree-root="AIPCC-502"]')).toBeTruthy()

    await wrapper.get('[data-filter-product="rhel-ai"]').trigger('click')
    expect(wrapper.find('[data-tree-root="AIPCC-501"]').exists()).toBe(false)

    await wrapper.get('[data-filter-status="released"]').trigger('click')
    expect(wrapper.get('[data-tree-root="AIPCC-502"]')).toBeTruthy()

    await wrapper.get('[data-filter-status="planned"]').trigger('click')
    expect(wrapper.get('[data-tree-root="AIPCC-502"]')).toBeTruthy()

    await wrapper.get('[data-filter-status="released"]').trigger('click')
    expect(wrapper.text()).toContain('No releases match the current filters.')

    await wrapper.get('[data-filter-product="torch"]').trigger('click')
    await wrapper.get('[data-filter-status="planned"]').trigger('click')
    expect(wrapper.get('[data-tree-root="AIPCC-500"]')).toBeTruthy()
    expect(wrapper.get('[data-tree-root="AIPCC-501"]')).toBeTruthy()
    expect(wrapper.get('[data-tree-root="AIPCC-502"]')).toBeTruthy()
  })

  it('puts release cards first and compacts the other checklist cards', async () => {
    apiRequest.mockResolvedValue(response([{
      key: 'AIPCC-700',
      summary: 'Card order release',
      status: { name: 'In Progress', category: 'indeterminate' },
      labels: ['release-automation'],
      updated: '2026-10-15T10:00:00Z',
      details: {},
      children: [
        { key: 'AIPCC-701', summary: 'Send a release announcement email', status: { name: 'To Do', category: 'new' }, labels: [], updated: '2026-10-15T10:00:00Z' },
        { key: 'AIPCC-702', summary: 'Release rhaiis 3.6.0 (prod)', status: { name: 'Triggered', category: 'indeterminate' }, labels: ['triggered'], updated: '2026-10-15T10:00:00Z' },
        { key: 'AIPCC-703', summary: 'Build RC drops', status: { name: 'Done', category: 'done' }, labels: [], updated: '2026-10-15T10:00:00Z' },
        { key: 'AIPCC-705', summary: 'Release rhaiis 3.4.6 (prod): cpu, cuda', status: { name: 'Done', category: 'done' }, labels: [], updated: '2026-10-15T10:00:00Z' },
      ],
    }]))

    const wrapper = mount(ReleaseStatusView)
    await flushPromises()

    const children = wrapper.findAll('[data-tree-child]')
    expect(children.map(node => node.attributes('data-tree-child'))).toEqual(['AIPCC-702', 'AIPCC-705', 'AIPCC-701', 'AIPCC-703'])
    expect(children[0].attributes('data-release-card')).toBe('true')
    expect(children[1].attributes('data-release-card')).toBe('true')
    expect(children[2].attributes('data-release-card')).toBe('false')
    expect(children[3].attributes('data-release-card')).toBe('false')
    expect(children[0].classes()).toContain('rounded-xl')
    expect(children[2].classes()).not.toContain('rounded-xl')
    expect(children[2].text()).toContain('Send a release announcement email')
    expect(children[2].text()).not.toContain('Updated')
  })

  it('renders version bump cards below the release cards with their MR links', async () => {
    const run = {
      namespace: 'rhel-ai-cicd--claudio',
      name: 'create-release-mr-run-abc',
      url: 'https://console-openshift-console.apps.mpp-e1-preprod.syvu.p1.openshiftapps.com/k8s/ns/rhel-ai-cicd--claudio/tekton.dev~v1~PipelineRun/create-release-mr-run-abc',
      triggered_at: '2026-10-12T10:00:00Z',
    }
    const mr = {
      iid: 769, state: 'merged',
      web_url: 'https://gitlab.com/redhat/rhel-ai/ci-cd/aipcc-product-management-configs/-/merge_requests/769',
    }
    apiRequest.mockImplementation((path) => {
      if (path === '/modules/product-builds/release-status') {
        return Promise.resolve(response([{
          key: 'AIPCC-700',
          summary: 'Card order release',
          status: { name: 'In Progress', category: 'indeterminate' },
          labels: ['release-automation'],
          updated: '2026-10-15T10:00:00Z',
          details: {},
          children: [
            { key: 'AIPCC-701', summary: 'Send a release announcement email', status: { name: 'To Do', category: 'new' }, labels: [], updated: '2026-10-15T10:00:00Z' },
            { key: 'AIPCC-702', summary: 'Release rhaiis 3.6.0 (prod)', status: { name: 'Triggered', category: 'indeterminate' }, labels: ['triggered'], updated: '2026-10-15T10:00:00Z' },
            { key: 'AIPCC-704', summary: 'Bump RHAII version to 3.6.1', status: { name: 'Done', category: 'done' }, labels: [], updated: '2026-10-15T10:00:00Z' },
          ],
        }]))
      }
      if (path === '/modules/product-builds/release-status/links') {
        return Promise.resolve({ links: {
          'AIPCC-702': { merge_requests: [], pipeline_run: run },
          'AIPCC-704': { merge_requests: [mr], pipeline_run: null },
        } })
      }
      return Promise.resolve(response([]))
    })

    const wrapper = mount(ReleaseStatusView)
    await flushPromises()

    const children = wrapper.findAll('[data-tree-child]')
    expect(children.map(node => node.attributes('data-tree-child'))).toEqual(['AIPCC-702', 'AIPCC-704', 'AIPCC-701'])
    const bumpCard = children[1]
    expect(bumpCard.attributes('data-version-bump')).toBe('true')
    expect(bumpCard.classes()).toContain('rounded-lg')
    const bumpMr = bumpCard.get('[data-mr-link="769"]')
    expect(bumpMr.attributes('href')).toBe('https://gitlab.com/redhat/rhel-ai/ci-cd/aipcc-product-management-configs/-/merge_requests/769')
    expect(children[2].classes()).not.toContain('rounded-lg')
  })

  it('links PMC merge requests and PipelineRuns on epics and readiness cards', async () => {
    const run = {
      namespace: 'rhel-ai-cicd--claudio',
      name: 'create-release-mr-run-abc',
      url: 'https://console-openshift-console.apps.mpp-e1-preprod.syvu.p1.openshiftapps.com/k8s/ns/rhel-ai-cicd--claudio/tekton.dev~v1~PipelineRun/create-release-mr-run-abc',
      logs_url: 'https://rhcorporate.sumologic.com/log-search/create?query=_index%3Drh_paas_preprod',
      triggered_at: '2026-10-12T10:00:00Z',
    }
    const mr = {
      iid: 796, state: 'merged',
      web_url: 'https://gitlab.com/redhat/rhel-ai/ci-cd/aipcc-product-management-configs/-/merge_requests/796',
    }
    apiRequest.mockImplementation((path) => {
      if (path === '/modules/product-builds/release-status') {
        return Promise.resolve(response([{
          key: 'AIPCC-600',
          summary: 'Linked release',
          status: { name: 'In Progress', category: 'indeterminate' },
          labels: ['release-automation'],
          updated: '2026-10-15T10:00:00Z',
          details: {},
          children: [{
            key: 'AIPCC-601',
            summary: 'Production card',
            status: { name: 'Triggered', category: 'indeterminate' },
            labels: ['triggered'],
            updated: '2026-10-15T10:00:00Z',
          }],
        }]))
      }
      if (path === '/modules/product-builds/release-status/links') {
        return Promise.resolve({ links: {
          'AIPCC-600': { merge_requests: [mr], pipeline_runs: [run] },
          'AIPCC-601': { merge_requests: [mr], pipeline_run: run },
        } })
      }
      return Promise.resolve(response([]))
    })

    const wrapper = mount(ReleaseStatusView)
    await flushPromises()

    expect(wrapper.findAll('[data-mr-link]')).toHaveLength(1)
    expect(wrapper.findAll('[data-pipelinerun-link]')).toHaveLength(1)
    const childMr = wrapper.get('[data-tree-child="AIPCC-601"] [data-mr-link="796"]')
    expect(childMr.attributes('href')).toBe('https://gitlab.com/redhat/rhel-ai/ci-cd/aipcc-product-management-configs/-/merge_requests/796')
    expect(childMr.text()).toContain('merged')
    const childRun = wrapper.get('[data-tree-child="AIPCC-601"] [data-pipelinerun-link="create-release-mr-run-abc"]')
    expect(childRun.attributes('href')).toBe(run.url)
    expect(childRun.attributes('title')).toBe('rhel-ai-cicd--claudio/create-release-mr-run-abc')
    const childLogs = wrapper.get('[data-tree-child="AIPCC-601"] [data-logs-link="create-release-mr-run-abc"]')
    expect(childLogs.attributes('href')).toBe(run.logs_url)
    expect(childLogs.text()).toContain('Logs')
  })
})
