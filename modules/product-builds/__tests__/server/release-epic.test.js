import { describe, it, expect, vi } from 'vitest'

const workflow = require('../../server/release-epic')._testExports

const baseConfig = (application = 'rhaiis', _branch = '3.6-fast1', tags = ['3.6.0-fast.1']) => `
definitions:
  - application: ${application}
    tenant: ai-tenant
    components:
      common:
        pipelinerun:
          - variant: common
      items:
        - name: cuda
          pipelinerun:
            - variant: cuda
        - name: neuron
          tech_preview: true
    release_plan:
      - name: ${application}-stage
      - name: ${application}-prod
    release_plan_admission:
      common:
        tags:
${tags.map(tag => `          - "${tag}"`).join('\n')}
`

function filesForBase() {
  return {
    'owners-groups.yaml': 'groups:\n  productization:\n    - alice',
    'rhaiis/owners.yaml': 'owners:\n  groups:\n    - productization',
    'rhaiis/3.6-fast1/config.yaml': baseConfig(),
    'base-images/owners.yaml': 'owners:\n  users:\n    - alice',
    'base-images/main/config.yaml': baseConfig('base-images', 'main', ['3.6.0']),
  }
}

describe('release epic workflow', () => {
  it('parses branch applications, variants, and fast-channel inference', () => {
    const product = workflow.parsePmcSnapshot(filesForBase()).find(item => item.key === 'rhaiis')
    const branch = product.branches[0]
    expect(branch.application).toBe('rhaiis-3-6-fast1')
    expect(branch.inferred_release_type).toBe('EA')
    expect(branch.components).toEqual([
      { name: 'cuda', variant: 'cuda', tech_preview: false, config_family: '—' },
      { name: 'neuron', variant: 'common', tech_preview: true, config_family: '—' },
    ])
  })

  it('unions rhelai config families and rejects inconsistent applications', () => {
    const files = {
      'owners-groups.yaml': 'groups: {}',
      'rhelai/owners.yaml': 'owners: {}',
      'rhelai/3.5/config-containers.yaml': baseConfig('rhelai-bootc', '3.5', ['3.5.0']),
      'rhelai/3.5/config-disk-images.yaml': baseConfig('rhelai-bootc', '3.5', ['3.5.0']),
      'rhelai/3.5/config-disk-image-containers.yaml': baseConfig('rhelai-bootc', '3.5', ['3.5.0']),
    }
    const [product] = workflow.parsePmcSnapshot(files)
    expect(product.branches[0].application).toBe('rhelai-bootc-3-5')
    expect(product.branches[0].config_families).toEqual(['containers', 'disk-images', 'disk-image-containers'])
    expect(product.branches[0].components).toHaveLength(6)

    files['rhelai/3.5/config-disk-images.yaml'] = baseConfig('different-app', '3.5', ['3.5.0'])
    expect(() => workflow.parsePmcSnapshot(files)).toThrow(/application is inconsistent/)
  })

  it('validates exact configured tags and infers release type only when blank', () => {
    const products = workflow.parsePmcSnapshot(filesForBase())
    const inferred = workflow.validateReleaseInput(products, {
      product: 'rhaiis', version: '3.6.0-fast.1', branch: '3.6-fast1', advisory_type: 'RHEA', release_type: '',
    })
    expect(inferred.release_type).toBe('EA')
    const aliased = workflow.validateReleaseInput(products, {
      product: 'rhaiis', version: '3.6-fast1', branch: '3.6.0-fast.1', advisory_type: 'RHEA', release_type: '',
    })
    expect(aliased.version).toBe('3.6.0-fast.1')
    expect(aliased.branch).toBe('3.6-fast1')
    expect(() => workflow.validateReleaseInput(products, {
      product: 'rhaiis', version: '3.6', branch: '3.6-fast1', advisory_type: 'RHEA', release_type: '',
    })).toThrow(/not configured/)
    expect(() => workflow.validateReleaseInput(products, {
      product: 'rhaiis', version: '3.6.0', branch: '3.6-fast1', advisory_type: 'RHEA',
    })).toThrow(/not configured/)
    expect(() => workflow.validateReleaseInput(products, {
      product: 'rhaiis', version: '3.6.0-fast.1', branch: '3.6-fast1', advisory_type: '',
    })).toThrow(/Advisory type is required/)
  })

  it('infers EA from a configured main-branch tag and rejects an explicit mismatch', () => {
    const files = filesForBase()
    files['base-images/main/config.yaml'] = baseConfig('base-images', 'main', ['3.6.0-ea.1'])
    const products = workflow.parsePmcSnapshot(files)

    const inferred = workflow.validateReleaseInput(products, {
      product: 'base-images', version: '3.6.0-ea.1', branch: 'main', advisory_type: 'RHEA', release_type: '',
    })
    expect(inferred.release_type).toBe('EA')
    expect(() => workflow.validateReleaseInput(products, {
      product: 'base-images', version: '3.6.0-ea.1', branch: 'main', advisory_type: 'RHEA', release_type: 'GA',
    })).toThrow(/does not match the configured EA version/)
    expect(workflow.featureJql(inferred)).toContain('3.6 EA1')
  })

  it('applies exact name or variant exclusions to the ADF table', () => {
    const products = workflow.parsePmcSnapshot(filesForBase())
    const metadata = products.find(item => item.key === 'rhaiis').branches[0]
    const input = workflow.validateReleaseInput(products, {
      product: 'rhaiis', version: '3.6.0-fast.1', branch: '3.6-fast1', advisory_type: 'RHEA', release_type: 'EA',
    })
    const components = workflow.filterComponents(metadata.components, ['cuda', 'common'])
    const adf = workflow.buildEpicAdf(input, components)
    expect(adf.content[0].attrs.language).toBe('yaml')
    expect(adf.content[2].content).toHaveLength(1)
    expect(JSON.stringify(adf)).not.toContain('neuron')
    expect(JSON.stringify(adf)).toContain('How to Add Components')
  })

  it('creates release Epics and checklist Tasks without an assignee', () => {
    expect(workflow.buildEpicFields({ product: 'rhaiis', version: '3.5.2', release_type: 'GA' }, {}).assignee).toBeNull()
    expect(workflow.buildTaskFields('RHAI-1', { summary: 'Test', labels: [], adf: {} }).assignee).toBeNull()
  })

  it('creates only the cards allowed by release plans and version conditions', () => {
    const input = {
      product: 'base-images', version: '3.6.0', branch: 'main', release_type: 'GA', advisory_type: 'RHEA',
      metadata: { release_plans: ['base-stage'], tags: ['3.6.0'] },
    }
    const plan = workflow.checklistPlan(input, [{ name: 'cuda', variant: 'cuda' }])
    expect(plan.cards.map(card => card.summary)).toEqual([
      'Release base-images 3.6.0 (stage-rc): cuda',
      'Send a base-images 3.6.0 release announcement email',
    ])
    expect(plan.notCreated.map(item => item.summary)).toContain('Release base-images 3.6.0 (prod): cuda')
    expect(plan.notCreated.map(item => item.summary)).toContain('Bump base-images 3.6.0 version tags for next z-stream')
  })

  it('stops before creation when a duplicate needs confirmation', async () => {
    const input = {
      product: 'rhaiis', version: '3.6.0-fast.1', branch: '3.6-fast1', release_type: 'EA', advisory_type: 'RHEA',
      metadata: { release_plans: [], tags: [] },
    }
    const jira = {
      jiraRequest: vi.fn(async path => path === '/rest/api/3/search/jql'
        ? { issues: [{ key: 'RHAI-1', fields: { summary: 'Release rhaiis 3.6.0-fast.1 EA', status: { name: 'Open' } } }] }
        : {}),
    }
    await expect(workflow.createReleaseEpic(jira, input, [], {})).rejects.toMatchObject({ code: 'duplicates' })
    expect(jira.jiraRequest.mock.calls.some(([path, options]) => path === '/rest/api/3/issue' && options?.method === 'POST')).toBe(false)
    expect(workflow.duplicateJql(input)).toContain('labels = release-automation')
  })

  it('supports explicit Features and reports automatic Feature choices', async () => {
    const input = {
      product: 'rhaiis', version: '3.6.0-fast.1', branch: '3.6-fast1', release_type: 'EA', advisory_type: 'RHEA',
      metadata: { release_plans: [], tags: [] },
    }
    const jira = {
      jiraRequest: vi.fn(async path => path === '/rest/api/3/search/jql' ? { issues: [] } : {}),
    }
    await expect(workflow.resolveFeature(jira, input, {}, [])).rejects.toMatchObject({ code: 'feature-selection' })
    jira.jiraRequest.mockImplementation(async path => path === '/rest/api/3/search/jql'
      ? { issues: [] }
      : { key: 'RHAISTRAT-7', fields: { project: { key: 'RHAISTRAT' }, issuetype: { name: 'Feature' }, summary: 'Fast release' } })
    await expect(workflow.resolveFeature(jira, input, { feature_mode: 'explicit', feature: 'RHAISTRAT-7' }, [])).resolves.toMatchObject({ key: 'RHAISTRAT-7' })
    await expect(workflow.resolveFeature(jira, input, { feature_mode: 'explicit', feature: 'RHAI-7' }, [])).rejects.toThrow(/RHAISTRAT issue key/)
    expect(workflow.featureJql(input)).toContain('3.6 fast1')
  })

  it('returns a created Feature key when Epic creation fails', async () => {
    const input = {
      product: 'rhaiis', version: '3.6.0-fast.1', branch: '3.6-fast1', release_type: 'EA', advisory_type: 'RHEA',
      metadata: { release_plans: [], tags: [] },
    }
    const jira = {
      jiraRequest: vi.fn(async (path, options) => {
        if (path === '/rest/api/3/search/jql') return { issues: [] }
        if (options.body.fields.issuetype.name === 'Feature') return { key: 'RHAISTRAT-9' }
        throw new Error('Epic creation failed')
      }),
    }

    await expect(workflow.createReleaseEpic(jira, input, [], {
      feature_mode: 'create', feature_summary: 'RHAII 3.6 fast1 Release',
    })).rejects.toMatchObject({ featureKey: 'RHAISTRAT-9', createdKeys: ['RHAISTRAT-9'] })
  })

  it('uses the authenticated dashboard identity and expands PMC owner groups', () => {
    expect(workflow.callerKerberosId({ userEmail: 'alice@redhat.com' })).toBe('alice')
    expect(workflow.callerKerberosId({ user: { email: 'alice@redhat.com' } })).toBe('alice')
    expect(() => workflow.callerKerberosId({ headers: {} })).toThrow(/reliably/)
    expect(workflow.authorizedUsers(filesForBase(), 'rhaiis')).toEqual(['alice'])
  })

  it('accepts only component-specific stage pullspec anchors', () => {
    const component = { name: 'cuda', stage_repository: 'quay.io/aipcc/rhaiis/cuda-ubi9' }
    expect(() => workflow.validateStagePullspec(component, 'quay.io/aipcc/rhaiis/cuda-ubi9:3.6.0-2026092401', '3.6.0')).not.toThrow()
    expect(() => workflow.validateStagePullspec(component, 'quay.io/aipcc/rhaiis/cuda-ubi9@sha256:' + 'a'.repeat(64), '3.6.0')).not.toThrow()
    expect(() => workflow.validateStagePullspec(component, 'quay.io/redhat-user-workloads/rhaiis/cuda-ubi9:3.6.0-2026092401', '3.6.0')).toThrow(/stage repository/)
    expect(() => workflow.validateStagePullspec(component, 'quay.io/aipcc/rhaiis/rocm-ubi9:3.6.0-2026092401', '3.6.0')).toThrow(/stage repository/)
    expect(() => workflow.validateStagePullspec(component, 'quay.io/aipcc/rhaiis/cuda-ubi9:3.6.0', '3.6.0')).toThrow(/timestamp/)
  })

  it('builds single-value anchors without pullspecs', () => {
    const adf = workflow.triggerAdf(
      { product: 'rhaiis', version: '3.6.0', advisory_type: 'RHEA' },
      'stage-rc',
      'ready',
      [{ name: 'cuda', variant: 'cuda', pullspec: '', cves: '' }],
      'commit-sha',
      'a'.repeat(40),
    )
    const yaml = adf.content[0].content[0].text
    expect(yaml).toContain('input_type: commit-sha')
    expect(yaml).toContain(`input_value: "${'a'.repeat(40)}"`)
    expect(yaml).not.toContain('pullspec:')
    expect(JSON.stringify(adf)).not.toContain('Notes:')
  })

  it('writes the PMC component string and optional release context', () => {
    const adf = workflow.triggerAdf(
      { product: 'rhaiis', version: '3.6.0', advisory_type: 'RHSA' },
      'prod',
      'ready',
      [{ name: 'rhaiis-cuda-ubi9', variant: 'cuda', pullspec: '', cves: 'CVE-2026-1234' }],
      'git-tag',
      '3.6.0',
      {
        pipelineComponents: 'cuda, rocm',
        cveList: 'CVE-2026-1234',
        userPrompt: 'Only CUDA is affected; keep ROCm unchanged.',
      },
    )
    const yaml = adf.content[0].content[0].text
    expect(yaml).toContain('pipeline_components: "cuda, rocm"')
    expect(yaml).toContain('cve_list: "CVE-2026-1234"')
    expect(yaml).toContain('user_prompt: "Only CUDA is affected; keep ROCm unchanged."')
    expect(yaml).not.toContain('notes:')
  })

  it('creates a ready Task from a PMC-validated stage pullspec', async () => {
    const input = {
      product: 'rhaiis', version: '3.6.0-fast.1', branch: '3.6-fast1', release_type: 'EA', advisory_type: 'RHEA',
      metadata: { tenant: 'ai-tenant', application: 'rhaiis-3-6-fast1', release_plans: ['rhaiis-stage', 'rhaiis-prod'], tags: ['3.6.0-fast.1'] },
    }
    const epicAdf = workflow.buildEpicAdf(input, [{ name: 'cuda', variant: 'cuda', tech_preview: false, config_family: '—' }])
    const epicIssue = {
      key: 'AIPCC-10',
      fields: {
        summary: 'Release rhaiis 3.6.0-fast.1 EA',
        labels: ['release-automation'],
        description: epicAdf,
      },
    }
    const pmc = {
      sha: 'a'.repeat(40),
      products: [{
        key: 'rhaiis',
        branches: [{
          branch: '3.6-fast1',
          configured_versions: ['3.6.0-fast.1'],
          release_plans: ['rhaiis-stage', 'rhaiis-prod'],
          components: [{ name: 'cuda', variant: 'cuda', config_family: '—', stage_repository: 'quay.io/aipcc/rhaiis/cuda-ubi9' }],
        }],
      }],
    }
    const jira = {
      fetchAllJqlResults: vi.fn(async () => []),
      jiraRequest: vi.fn(async (path, options) => options?.method === 'POST' && path === '/rest/api/3/issue' ? { key: 'AIPCC-11' } : {}),
    }

    const result = await workflow.mutateTriggerRelease(jira, pmc, epicIssue, {
      target: 'stage-rc',
      action: 'ready',
      input_type: 'image-list',
      components: [{ name: 'cuda', variant: 'cuda', pullspec: 'quay.io/aipcc/rhaiis/cuda-ubi9:3.6.0-fast.1-2026092401' }],
    })

    expect(result.tasks).toMatchObject([{ key: 'AIPCC-11', operation: 'created', state: 'ready' }])
    const createCall = jira.jiraRequest.mock.calls.find(([path, options]) => path === '/rest/api/3/issue' && options.method === 'POST')
    expect(createCall[1].body.fields.description.content[0].content[0].text).toContain('quay.io/aipcc/rhaiis/cuda-ubi9:3.6.0-fast.1-2026092401')
  })

  it('resolves an omitted config family when PMC has one unambiguous family', () => {
    const result = workflow.validateTriggerComponents(
      { version: '3.5.0', advisory_type: 'RHEA' },
      { expected_components: [{ name: 'bootc-cuda', variant: 'cuda', config_family: 'containers', stage_repository: 'quay.io/aipcc/rhelai/bootc-cuda' }] },
      [{ name: 'bootc-cuda', variant: 'cuda', config_family: '—', pullspec: 'quay.io/aipcc/rhelai/bootc-cuda:3.5.0-123' }],
      [], 'ready', 'image-list',
    )

    expect(result.components[0].config_family).toBe('containers')
  })

  it('normalizes legacy card families before checking array submissions', async () => {
    const input = {
      product: 'rhelai', version: '3.5.0', branch: '3.5', release_type: 'GA', advisory_type: 'RHEA',
      metadata: { tenant: 'ai-tenant', application: 'rhelai-3-5', release_plans: ['rhelai-stage'], tags: ['3.5.0'] },
    }
    const component = { name: 'bootc-cuda', variant: 'cuda', config_family: 'containers', stage_repository: 'quay.io/aipcc/rhelai/bootc-cuda' }
    const epicIssue = {
      key: 'AIPCC-28',
      fields: { summary: 'Release rhelai 3.5.0 GA', labels: ['release-automation'], description: workflow.buildEpicAdf(input, [component]) },
    }
    const cardDescription = workflow.triggerAdf(input, 'stage-rc', 'planned', [{ name: component.name, variant: component.variant }], 'image-list', '')
    const jira = {
      fetchAllJqlResults: vi.fn(async () => [{
        key: 'AIPCC-29',
        fields: { summary: 'Release card', labels: ['planned'], status: { name: 'To Do' }, description: cardDescription, parent: { key: 'AIPCC-28' } },
      }]),
      jiraRequest: vi.fn(async () => ({})),
    }
    const pmc = {
      sha: 'i'.repeat(40),
      products: [{ key: 'rhelai', branches: [{
        branch: '3.5', configured_versions: ['3.5.0'], release_plans: ['rhelai-stage'], components: [component],
      }] }],
    }

    const result = await workflow.mutateTriggerRelease(jira, pmc, epicIssue, {
      card_key: 'AIPCC-29', target: 'stage-rc', action: 'ready', input_type: 'image-list', input_value: '',
      components: [{ name: 'bootc-cuda', variant: 'cuda', pullspec: 'quay.io/aipcc/rhelai/bootc-cuda:3.5.0-123' }],
    })

    expect(result.tasks).toMatchObject([{ key: 'AIPCC-29', operation: 'updated', state: 'ready' }])
  })

  it('rejects an unqualified token when multiple config families match', () => {
    const components = [
      { name: 'cuda', variant: 'cuda', config_family: 'containers' },
      { name: 'cuda', variant: 'cuda', config_family: 'disk-images' },
    ]
    expect(() => workflow.resolveCardComponentTokens(components, 'cuda')).toThrow('ambiguous')
    expect(() => workflow.resolveComponentTokens(components, 'cuda', 'ready')).toThrow('ambiguous')
    expect(workflow.resolveComponentTokens([
      { name: 'rhaiis-cuda-ubi9', variant: 'cuda', config_family: '—' },
      { name: 'rhaiis-cuda-alt-ubi9', variant: 'cuda', config_family: '—' },
    ], 'cuda', 'ready')).toHaveLength(2)
  })

  it('updates the selected readiness card and keeps the PMC component string', async () => {
    const input = {
      product: 'rhaiis', version: '3.6.0-fast.1', branch: '3.6-fast1', release_type: 'EA', advisory_type: 'RHEA',
      metadata: { tenant: 'ai-tenant', application: 'rhaiis-3-6-fast1', release_plans: ['rhaiis-stage', 'rhaiis-prod'], tags: ['3.6.0-fast.1'] },
    }
    const component = { name: 'cuda', variant: 'cuda', tech_preview: false, config_family: '—', stage_repository: 'quay.io/aipcc/rhaiis/cuda-ubi9' }
    const secondComponent = { name: 'rocm', variant: 'rocm', tech_preview: false, config_family: '—', stage_repository: 'quay.io/aipcc/rhaiis/rocm-ubi9' }
    const epicIssue = {
      key: 'AIPCC-30',
      fields: { summary: 'Release rhaiis 3.6.0-fast.1 EA', labels: ['release-automation'], description: workflow.buildEpicAdf(input, [component, secondComponent]) },
    }
    const cardDescription = workflow.triggerAdf(
      input, 'stage-rc', 'planned', [
        { name: component.name, variant: component.variant },
        { name: secondComponent.name, variant: secondComponent.variant },
      ], 'image-list', '',
    )
    const jira = {
      fetchAllJqlResults: vi.fn(async () => [{
        key: 'AIPCC-31',
        fields: {
          summary: 'Release card',
          labels: ['planned'],
          status: { name: 'To Do' },
          description: cardDescription,
          parent: { key: 'AIPCC-30' },
        },
      }]),
      jiraRequest: vi.fn(async (path, options) => options?.method === 'PUT' ? {} : {}),
    }

    const result = await workflow.mutateTriggerRelease(jira, {
      sha: 'c'.repeat(40),
      products: [{ key: 'rhaiis', branches: [{
          branch: '3.6-fast1', configured_versions: ['3.6.0-fast.1'], release_plans: ['rhaiis-stage', 'rhaiis-prod'], components: [component, secondComponent],
      }] }],
    }, epicIssue, {
      card_key: 'AIPCC-31', target: 'stage-rc', action: 'ready', input_type: 'image-list',
      input_value: 'quay.io/aipcc/rhaiis/cuda-ubi9:3.6.0-fast.1-2026092401\nquay.io/aipcc/rhaiis/rocm-ubi9:3.6.0-fast.1-2026092401', components: 'cuda,rocm',
      user_prompt: 'Use the selected card.',
    })

    expect(result.tasks).toMatchObject([{ key: 'AIPCC-31', operation: 'updated', state: 'ready' }])
    const update = jira.jiraRequest.mock.calls.find(([path, options]) => path === '/rest/api/3/issue/AIPCC-31' && options.method === 'PUT')
    const yaml = update[1].body.fields.description.content[0].content[0].text
    expect(yaml).toContain('pipeline_components: "cuda,rocm"')
    expect(yaml).toContain('user_prompt: "Use the selected card."')
    expect(yaml).toContain('quay.io/aipcc/rhaiis/cuda-ubi9:3.6.0-fast.1-2026092401')
    expect(yaml).toContain('quay.io/aipcc/rhaiis/rocm-ubi9:3.6.0-fast.1-2026092401')
    expect(jira.jiraRequest.mock.calls.filter(([path, options]) => path === '/rest/api/3/issue' && options.method === 'POST')).toHaveLength(0)
  })

  it('partitions a selected card into ready, skipped, and planned cards in one request', async () => {
    const input = {
      product: 'rhaiis', version: '3.6.0-fast.1', branch: '3.6-fast1', release_type: 'EA', advisory_type: 'RHSA',
      metadata: { tenant: 'ai-tenant', application: 'rhaiis-3-6-fast1', release_plans: ['rhaiis-stage', 'rhaiis-prod'], tags: ['3.6.0-fast.1'] },
    }
    const components = [
      { name: 'cuda', variant: 'cuda', tech_preview: false, config_family: '—' },
      { name: 'rocm', variant: 'rocm', tech_preview: false, config_family: '—' },
      { name: 'neuron', variant: 'neuron', tech_preview: false, config_family: '—' },
    ]
    const epicIssue = {
      key: 'AIPCC-50',
      fields: { summary: 'Release rhaiis 3.6.0-fast.1 EA', labels: ['release-automation'], description: workflow.buildEpicAdf(input, components) },
    }
    const cardDescription = workflow.triggerAdf(input, 'stage-rc', 'planned', [
      { name: 'cuda', variant: 'cuda', cves: 'CVE-2026-1000' },
      { name: 'rocm', variant: 'rocm', cves: 'CVE-2026-2000' },
      { name: 'neuron', variant: 'neuron', cves: 'CVE-2026-3000' },
    ], 'git-tag', '3.6.0-fast.1', {
      pipelineComponents: 'all', cveList: 'CVE-2026-9999', userPrompt: 'Keep the omitted components planned.',
    })
    const pmc = {
      sha: 'e'.repeat(40),
      products: [{ key: 'rhaiis', branches: [{
        branch: '3.6-fast1', configured_versions: ['3.6.0-fast.1'], release_plans: ['rhaiis-stage', 'rhaiis-prod'],
        components: components.map(component => ({ ...component, stage_repository: `quay.io/aipcc/rhaiis/${component.name}-ubi9` })),
      }] }],
    }
    let nextKey = 50
    const jira = {
      fetchAllJqlResults: vi.fn(async () => [{
        key: 'AIPCC-51',
        fields: {
          summary: 'Release card', labels: ['planned'], status: { name: 'To Do' }, description: cardDescription, parent: { key: 'AIPCC-50' },
        },
      }]),
      jiraRequest: vi.fn(async (path, options) => options?.method === 'POST' ? { key: `AIPCC-${++nextKey}` } : {}),
    }

    const result = await workflow.mutateTriggerRelease(jira, pmc, epicIssue, {
      card_key: 'AIPCC-51', target: 'stage-rc', action: 'ready', input_type: 'image-list',
      input_value: 'quay.io/aipcc/rhaiis/cuda-ubi9:3.6.0-fast.1-2026092401', components: 'cuda', skipped_components: 'neuron',
      cve_list: 'CVE-2026-9999', user_prompt: 'Ready only CUDA.',
    })

    expect(result.tasks.map(task => task.state)).toEqual(['planned', 'ready', 'skip'])
    expect(result.tasks.map(task => task.operation)).toEqual(['updated', 'created', 'created'])
    const update = jira.jiraRequest.mock.calls.find(([path, options]) => path === '/rest/api/3/issue/AIPCC-51' && options.method === 'PUT')
    const creates = jira.jiraRequest.mock.calls.filter(([path, options]) => path === '/rest/api/3/issue' && options.method === 'POST')
    const plannedYaml = update[1].body.fields.description.content[0].content[0].text
    const readyYaml = creates[0][1].body.fields.description.content[0].content[0].text
    const skipYaml = creates[1][1].body.fields.description.content[0].content[0].text
    expect(plannedYaml).toContain('input_type: git-tag')
    expect(plannedYaml).toContain('input_value: "3.6.0-fast.1"')
    expect(plannedYaml).toContain('CVE-2026-2000')
    expect(readyYaml).toContain('input_type: image-list')
    expect(readyYaml).toContain('user_prompt: "Ready only CUDA."')
    expect(readyYaml).toContain('CVE-2026-1000')
    expect(skipYaml).toContain('reason: "Excluded from this release"')
    expect(skipYaml).not.toContain('cve_list:')
    expect(skipYaml).not.toContain('user_prompt:')
    expect(creates.every(([, options]) => options.body.fields.assignee === null)).toBe(true)
  })

  it('reports Tasks created before a later split write fails', async () => {
    const input = {
      product: 'rhaiis', version: '3.6.0-fast.1', branch: '3.6-fast1', release_type: 'EA', advisory_type: 'RHEA',
      metadata: { tenant: 'ai-tenant', application: 'rhaiis-3-6-fast1', release_plans: ['rhaiis-stage'], tags: ['3.6.0-fast.1'] },
    }
    const components = [
      { name: 'cuda', variant: 'cuda', config_family: '—', stage_repository: 'quay.io/aipcc/rhaiis/cuda-ubi9' },
      { name: 'rocm', variant: 'rocm', config_family: '—', stage_repository: 'quay.io/aipcc/rhaiis/rocm-ubi9' },
      { name: 'neuron', variant: 'neuron', config_family: '—', stage_repository: 'quay.io/aipcc/rhaiis/neuron-ubi9' },
    ]
    const epicIssue = {
      key: 'AIPCC-55',
      fields: { summary: 'Release rhaiis 3.6.0-fast.1 EA', labels: ['release-automation'], description: workflow.buildEpicAdf(input, components) },
    }
    const cardDescription = workflow.triggerAdf(input, 'stage-rc', 'planned', components, 'git-tag', '3.6.0-fast.1')
    let postCount = 0
    const jira = {
      fetchAllJqlResults: vi.fn(async () => [{
        key: 'AIPCC-56',
        fields: { summary: 'Release card', labels: ['planned'], status: { name: 'To Do' }, description: cardDescription, parent: { key: 'AIPCC-55' } },
      }]),
      jiraRequest: vi.fn(async (path, options) => {
        if (options?.method === 'POST') {
          postCount += 1
          if (postCount === 1) return { key: 'AIPCC-57' }
          throw new Error('Jira create failed')
        }
        return {}
      }),
    }
    const pmc = {
      sha: 'g'.repeat(40),
      products: [{ key: 'rhaiis', branches: [{
        branch: '3.6-fast1', configured_versions: ['3.6.0-fast.1'], release_plans: ['rhaiis-stage'], components,
      }] }],
    }

    await expect(workflow.mutateTriggerRelease(jira, pmc, epicIssue, {
      card_key: 'AIPCC-56', target: 'stage-rc', action: 'ready', input_type: 'git-tag', input_value: '3.6.0-fast.1',
      components: 'cuda', skipped_components: 'rocm',
    })).rejects.toMatchObject({ message: 'Jira create failed', createdKeys: ['AIPCC-57'] })
  })

  it('rejects overlap between ready and skipped components on a selected card', async () => {
    const input = {
      product: 'rhaiis', version: '3.6.0-fast.1', branch: '3.6-fast1', release_type: 'EA', advisory_type: 'RHEA',
      metadata: { tenant: 'ai-tenant', application: 'rhaiis-3-6-fast1', release_plans: ['rhaiis-stage'], tags: ['3.6.0-fast.1'] },
    }
    const component = { name: 'cuda', variant: 'cuda', tech_preview: false, config_family: '—', stage_repository: 'quay.io/aipcc/rhaiis/cuda-ubi9' }
    const epicIssue = {
      key: 'AIPCC-60',
      fields: { summary: 'Release rhaiis 3.6.0-fast.1 EA', labels: ['release-automation'], description: workflow.buildEpicAdf(input, [component]) },
    }
    const cardDescription = workflow.triggerAdf(input, 'stage-rc', 'planned', [{ name: 'cuda', variant: 'cuda' }], 'git-tag', '3.6.0-fast.1')
    const jira = {
      fetchAllJqlResults: vi.fn(async () => [{
        key: 'AIPCC-61', fields: { summary: 'Release card', labels: ['planned'], status: { name: 'To Do' }, description: cardDescription, parent: { key: 'AIPCC-60' } },
      }]),
      jiraRequest: vi.fn(async () => ({})),
    }

    await expect(workflow.mutateTriggerRelease(jira, {
      sha: 'f'.repeat(40),
      products: [{ key: 'rhaiis', branches: [{ branch: '3.6-fast1', configured_versions: ['3.6.0-fast.1'], release_plans: ['rhaiis-stage'], components: [component] }] }],
    }, epicIssue, {
      card_key: 'AIPCC-61', target: 'stage-rc', input_type: 'git-tag', input_value: '3.6.0-fast.1',
      components: 'cuda', skipped_components: 'cuda',
    })).rejects.toThrow('both ready and skipped')
    expect(jira.jiraRequest).not.toHaveBeenCalledWith('/rest/api/3/issue/AIPCC-61', expect.anything())
  })

  it('rejects skipped components already owned by another skip card', async () => {
    const input = {
      product: 'rhaiis', version: '3.6.0-fast.1', branch: '3.6-fast1', release_type: 'EA', advisory_type: 'RHEA',
      metadata: { tenant: 'ai-tenant', application: 'rhaiis-3-6-fast1', release_plans: ['rhaiis-stage'], tags: ['3.6.0-fast.1'] },
    }
    const components = [
      { name: 'cuda', variant: 'cuda', tech_preview: false, config_family: '—' },
      { name: 'rocm', variant: 'rocm', tech_preview: false, config_family: '—' },
    ]
    const epicIssue = {
      key: 'AIPCC-70',
      fields: { summary: 'Release rhaiis 3.6.0-fast.1 EA', labels: ['release-automation'], description: workflow.buildEpicAdf(input, components) },
    }
    const selectedDescription = workflow.triggerAdf(input, 'stage-rc', 'planned', components, 'git-tag', '3.6.0-fast.1')
    const skipDescription = workflow.triggerAdf(input, 'stage-rc', 'skip', [{ name: 'rocm', variant: 'rocm' }], 'image-list', '')
    const jira = {
      fetchAllJqlResults: vi.fn(async () => [
        { key: 'AIPCC-71', fields: { summary: 'Selected card', labels: ['planned'], status: { name: 'To Do' }, description: selectedDescription, parent: { key: 'AIPCC-70' } } },
        { key: 'AIPCC-72', fields: { summary: 'Existing skip card', labels: ['skip'], status: { name: 'Closed' }, description: skipDescription, parent: { key: 'AIPCC-70' } } },
      ]),
      jiraRequest: vi.fn(async () => ({})),
    }
    const pmc = {
      sha: '1'.repeat(40),
      products: [{ key: 'rhaiis', branches: [{
        branch: '3.6-fast1', configured_versions: ['3.6.0-fast.1'], release_plans: ['rhaiis-stage'],
        components: components.map(component => ({ ...component, stage_repository: `quay.io/aipcc/rhaiis/${component.name}-ubi9` })),
      }] }],
    }

    await expect(workflow.mutateTriggerRelease(jira, pmc, epicIssue, {
      card_key: 'AIPCC-71', target: 'stage-rc', input_type: 'git-tag', input_value: '3.6.0-fast.1',
      components: 'cuda', skipped_components: 'rocm',
    })).rejects.toMatchObject({ code: 'skip-duplicate' })
    expect(jira.jiraRequest).not.toHaveBeenCalledWith('/rest/api/3/issue/AIPCC-71', expect.anything())
    expect(jira.jiraRequest).not.toHaveBeenCalledWith('/rest/api/3/issue', expect.anything())
  })

  it('rejects skipped components already owned by a triggered card', async () => {
    const input = {
      product: 'rhaiis', version: '3.6.0-fast.1', branch: '3.6-fast1', release_type: 'EA', advisory_type: 'RHEA',
      metadata: { tenant: 'ai-tenant', application: 'rhaiis-3-6-fast1', release_plans: ['rhaiis-stage'], tags: ['3.6.0-fast.1'] },
    }
    const components = [
      { name: 'cuda', variant: 'cuda', tech_preview: false, config_family: '—' },
      { name: 'rocm', variant: 'rocm', tech_preview: false, config_family: '—' },
    ]
    const epicIssue = {
      key: 'AIPCC-80',
      fields: { summary: 'Release rhaiis 3.6.0-fast.1 EA', labels: ['release-automation'], description: workflow.buildEpicAdf(input, components) },
    }
    const selectedDescription = workflow.triggerAdf(input, 'stage-rc', 'planned', components, 'git-tag', '3.6.0-fast.1')
    const triggeredDescription = workflow.triggerAdf(input, 'stage-rc', 'ready', [{ name: 'rocm', variant: 'rocm' }], 'git-tag', '3.6.0-fast.1')
    const jira = {
      fetchAllJqlResults: vi.fn(async () => [
        { key: 'AIPCC-81', fields: { summary: 'Selected card', labels: ['planned'], status: { name: 'To Do' }, description: selectedDescription, parent: { key: 'AIPCC-80' } } },
        { key: 'AIPCC-82', fields: { summary: 'Existing triggered card', labels: ['triggered'], status: { name: 'In Progress' }, description: triggeredDescription, parent: { key: 'AIPCC-80' } } },
      ]),
      jiraRequest: vi.fn(async () => ({})),
    }
    const pmc = {
      sha: '2'.repeat(40),
      products: [{ key: 'rhaiis', branches: [{
        branch: '3.6-fast1', configured_versions: ['3.6.0-fast.1'], release_plans: ['rhaiis-stage'],
        components: components.map(component => ({ ...component, stage_repository: `quay.io/aipcc/rhaiis/${component.name}-ubi9` })),
      }] }],
    }

    await expect(workflow.mutateTriggerRelease(jira, pmc, epicIssue, {
      card_key: 'AIPCC-81', target: 'stage-rc', input_type: 'git-tag', input_value: '3.6.0-fast.1',
      components: 'cuda', skipped_components: 'rocm',
    })).rejects.toMatchObject({ code: 'triggered-duplicate' })
    expect(jira.jiraRequest).not.toHaveBeenCalledWith('/rest/api/3/issue/AIPCC-81', expect.anything())
    expect(jira.jiraRequest).not.toHaveBeenCalledWith('/rest/api/3/issue', expect.anything())
  })

  it('does not add Epic-expected components through an array request for a selected card', async () => {
    const input = {
      product: 'rhaiis', version: '3.6.0-fast.1', branch: '3.6-fast1', release_type: 'EA', advisory_type: 'RHEA',
      metadata: { tenant: 'ai-tenant', application: 'rhaiis-3-6-fast1', release_plans: ['rhaiis-stage'], tags: ['3.6.0-fast.1'] },
    }
    const cuda = { name: 'cuda', variant: 'cuda', tech_preview: false, config_family: '—', stage_repository: 'quay.io/aipcc/rhaiis/cuda-ubi9' }
    const rocm = { name: 'rocm', variant: 'rocm', tech_preview: false, config_family: '—', stage_repository: 'quay.io/aipcc/rhaiis/rocm-ubi9' }
    const epicIssue = {
      key: 'AIPCC-90',
      fields: { summary: 'Release rhaiis 3.6.0-fast.1 EA', labels: ['release-automation'], description: workflow.buildEpicAdf(input, [cuda, rocm]) },
    }
    const selectedDescription = workflow.triggerAdf(input, 'stage-rc', 'planned', [{ name: 'cuda', variant: 'cuda' }], 'git-tag', '3.6.0-fast.1')
    const jira = {
      fetchAllJqlResults: vi.fn(async () => [{
        key: 'AIPCC-91', fields: { summary: 'Selected card', labels: ['planned'], status: { name: 'To Do' }, description: selectedDescription, parent: { key: 'AIPCC-90' } },
      }]),
      jiraRequest: vi.fn(async () => ({})),
    }
    const pmc = {
      sha: '3'.repeat(40),
      products: [{ key: 'rhaiis', branches: [{
        branch: '3.6-fast1', configured_versions: ['3.6.0-fast.1'], release_plans: ['rhaiis-stage'], components: [cuda, rocm],
      }] }],
    }

    await expect(workflow.mutateTriggerRelease(jira, pmc, epicIssue, {
      card_key: 'AIPCC-91', target: 'stage-rc', input_type: 'image-list', input_value: '',
      components: [{ name: 'cuda', variant: 'cuda' }, { name: 'rocm', variant: 'rocm' }],
    })).rejects.toThrow('not on selected readiness card')
    expect(jira.jiraRequest).not.toHaveBeenCalledWith('/rest/api/3/issue/AIPCC-91', expect.anything())
  })

  it('rejects an RHSA trigger without a non-empty CVE list', async () => {
    const input = {
      product: 'rhaiis', version: '3.6.0-fast.1', branch: '3.6-fast1', release_type: 'EA', advisory_type: 'RHSA',
      metadata: { tenant: 'ai-tenant', application: 'rhaiis-3-6-fast1', release_plans: ['rhaiis-stage', 'rhaiis-prod'], tags: ['3.6.0-fast.1'] },
    }
    const component = { name: 'cuda', variant: 'cuda', tech_preview: false, config_family: '—', stage_repository: 'quay.io/aipcc/rhaiis/cuda-ubi9' }
    const epicIssue = {
      key: 'AIPCC-32',
      fields: { summary: 'Release rhaiis 3.6.0-fast.1 EA', labels: ['release-automation'], description: workflow.buildEpicAdf(input, [component]) },
    }
    const pmc = {
      sha: 'd'.repeat(40),
      products: [{ key: 'rhaiis', branches: [{
        branch: '3.6-fast1', configured_versions: ['3.6.0-fast.1'], release_plans: ['rhaiis-stage', 'rhaiis-prod'], components: [component],
      }] }],
    }
    const jira = { fetchAllJqlResults: vi.fn(async () => []) }

    await expect(workflow.mutateTriggerRelease(jira, pmc, epicIssue, {
      target: 'stage-rc', input_type: 'git-tag', input_value: '3.6.0-fast.1', components: 'cuda', cve_list: ' \n ',
    })).rejects.toThrow('cve_list is required for RHSA releases')
  })

  it('applies ready and skip actions for different components in one request', async () => {
    const input = {
      product: 'rhaiis', version: '3.6.0-fast.1', branch: '3.6-fast1', release_type: 'EA', advisory_type: 'RHEA',
      metadata: { tenant: 'ai-tenant', application: 'rhaiis-3-6-fast1', release_plans: ['rhaiis-stage', 'rhaiis-prod'], tags: ['3.6.0-fast.1'] },
    }
    const components = [
      { name: 'cuda', variant: 'cuda', tech_preview: false, config_family: '—' },
      { name: 'rocm', variant: 'rocm', tech_preview: false, config_family: '—' },
    ]
    const epicIssue = {
      key: 'AIPCC-20',
      fields: { summary: 'Release rhaiis 3.6.0-fast.1 EA', labels: ['release-automation'], description: workflow.buildEpicAdf(input, components) },
    }
    const pmc = {
      sha: 'b'.repeat(40),
      products: [{ key: 'rhaiis', branches: [{
        branch: '3.6-fast1', configured_versions: ['3.6.0-fast.1'], release_plans: ['rhaiis-stage', 'rhaiis-prod'],
        components: components.map(component => ({ ...component, stage_repository: `quay.io/aipcc/rhaiis/${component.name}-ubi9` })),
      }] }],
    }
    let nextKey = 20
    const jira = {
      fetchAllJqlResults: vi.fn(async () => []),
      jiraRequest: vi.fn(async (path, options) => options?.method === 'POST' && path === '/rest/api/3/issue' ? { key: `AIPCC-${++nextKey}` } : {}),
    }

    const result = await workflow.mutateTriggerRelease(jira, pmc, epicIssue, {
      target: 'stage-rc',
      input_type: 'image-list',
      components: [
        { name: 'cuda', variant: 'cuda', action: 'skip', reason: 'Not part of this drop' },
        { name: 'rocm', variant: 'rocm', action: 'ready', pullspec: 'quay.io/aipcc/rhaiis/rocm-ubi9:3.6.0-fast.1-2026092401' },
      ],
    })

    expect(result.groups.map(group => group.action)).toEqual(['skip', 'ready'])
    expect(result.tasks).toHaveLength(2)
    expect(result.tasks.map(task => task.state)).toEqual(['skip', 'ready'])
  })

  it('keeps created keys when a later grouped action fails', async () => {
    const input = {
      product: 'rhaiis', version: '3.6.0-fast.1', branch: '3.6-fast1', release_type: 'EA', advisory_type: 'RHEA',
      metadata: { tenant: 'ai-tenant', application: 'rhaiis-3-6-fast1', release_plans: ['rhaiis-stage'] },
    }
    const components = [
      { name: 'cuda', variant: 'cuda', config_family: '—', stage_repository: 'quay.io/aipcc/rhaiis/cuda-ubi9' },
      { name: 'rocm', variant: 'rocm', config_family: '—', stage_repository: 'quay.io/aipcc/rhaiis/rocm-ubi9' },
    ]
    const epicIssue = {
      key: 'AIPCC-25',
      fields: { summary: 'Release rhaiis 3.6.0-fast.1 EA', labels: ['release-automation'], description: workflow.buildEpicAdf(input, components) },
    }
    let postCount = 0
    const jira = {
      fetchAllJqlResults: vi.fn(async () => []),
      jiraRequest: vi.fn(async (path, options) => {
        if (options?.method === 'POST') {
          postCount += 1
          if (postCount === 1) return { key: 'AIPCC-26' }
          throw new Error('Jira create failed')
        }
        return {}
      }),
    }
    const pmc = {
      sha: 'h'.repeat(40),
      products: [{ key: 'rhaiis', branches: [{
        branch: '3.6-fast1', configured_versions: ['3.6.0-fast.1'], release_plans: ['rhaiis-stage'], components,
      }] }],
    }

    await expect(workflow.mutateTriggerRelease(jira, pmc, epicIssue, {
      target: 'stage-rc', input_type: 'git-tag', input_value: '3.6.0-fast.1',
      components: [
        { name: 'cuda', variant: 'cuda', action: 'skip' },
        { name: 'rocm', variant: 'rocm', action: 'ready' },
      ],
    })).rejects.toMatchObject({ message: 'Jira create failed', createdKeys: ['AIPCC-26'] })
  })

  it('resolves free-form component lists and infers the skipped complement', () => {
    const branch = workflow.parsePmcSnapshot(filesForBase()).find(product => product.key === 'rhaiis').branches[0]
    const epic = { key: 'RHAI-1910', expected_components: [] }
    const result = workflow.freeFormTriggerComponents(epic, branch, {
      ready_components: 'cuda',
      skipped_components: '',
      input_type: 'git-tag',
      input_value: '3.6.0-fast.1',
      cve_list: 'CVE-2026-1234',
    })

    expect(result.components.map(component => [component.name, component.action])).toEqual([
      ['neuron', 'skip'],
      ['cuda', 'ready'],
    ])
    expect(result.components.find(component => component.action === 'ready').cves).toBe('CVE-2026-1234')
  })

  it('uses PMC components when a release Epic has no components table', () => {
    const epic = workflow.parseEpicIssue({
      key: 'RHAI-1910',
      fields: {
        project: { key: 'RHAI' },
        description: {
          type: 'doc',
          content: [{ type: 'codeBlock', attrs: { language: 'yaml' }, content: [{ type: 'text', text: 'product: rhaiis\nversion: 3.6.0-fast.1\nbranch: 3.6-fast1' }] }],
        },
      },
    })
    const branch = workflow.parsePmcSnapshot(filesForBase()).find(product => product.key === 'rhaiis').branches[0]
    expect(epic.expected_components).toEqual([])
    expect(workflow.expectedComponentsForEpic(epic, branch).map(component => component.name)).toEqual(['cuda', 'neuron'])
  })

  it('loads planned and failed cards in one bulk child query with parent metadata', async () => {
    const input = {
      product: 'rhaiis', version: '3.6.0-fast.1', branch: '3.6-fast1', release_type: 'EA', advisory_type: 'RHEA',
      metadata: { tenant: 'ai-tenant', application: 'rhaiis-3-6-fast1' },
    }
    const epicIssue = {
      key: 'AIPCC-40',
      fields: { summary: 'Release', labels: ['release-automation'], status: { name: 'Open' }, description: workflow.buildEpicAdf(input, [{ name: 'cuda', variant: 'cuda', tech_preview: false, config_family: '—' }]) },
    }
    const childDescription = workflow.triggerAdf(input, 'prod', 'failed', [{ name: 'cuda', variant: 'cuda' }], 'git-tag', '3.6.0-fast.1')
    const jira = {
      fetchAllJqlResults: vi.fn(async jql => jql.includes('issuetype = Epic') ? [epicIssue] : [{
        key: 'AIPCC-41', fields: { summary: 'Failed card', status: { name: 'Open' }, labels: ['failed'], description: childDescription, parent: { key: 'AIPCC-40' } },
      }]),
    }
    const files = filesForBase()
    const gitlab = {
      repositoryCatalog: vi.fn(async () => ({ sha: 'd'.repeat(40), products: [{ key: 'rhaiis', branches: [{ branch: '3.6-fast1', config_paths: ['rhaiis/3.6-fast1/config.yaml'] }] }] })),
      selective: vi.fn(async () => ({ sha: 'd'.repeat(40), files })),
    }

    const result = await workflow.loadTriggerOptions(jira, { secrets: {} }, { userEmail: 'alice@redhat.com' }, { gitlab })

    expect(jira.fetchAllJqlResults).toHaveBeenCalledTimes(2)
    expect(jira.fetchAllJqlResults.mock.calls[1][0]).toContain('parent in (AIPCC-40)')
    expect(result.cards).toMatchObject([{ key: 'AIPCC-41', state: 'failed', target: 'prod', parent: { key: 'AIPCC-40', application: 'rhaiis' } }])
  })

  it('disambiguates duplicate variants by PMC config family', () => {
    const components = [
      { name: 'bootc-cuda', variant: 'cuda', config_family: 'containers' },
      { name: 'bootc-cuda-iso', variant: 'cuda', config_family: 'disk-images' },
      { name: 'bootc-cuda-disk', variant: 'cuda', config_family: 'disk-image-containers' },
    ]
    expect(workflow.canonicalComponentTokens(components)).toContain('cuda:containers')
    expect(workflow.canonicalComponentTokens(components)).toContain('cuda:disk-images')
    expect(() => workflow.resolveComponentTokens(components, 'cuda', 'ready')).toThrow(/ambiguous/)
    expect(workflow.resolveComponentTokens(components, 'cuda:disk-images', 'ready')).toEqual([components[1]])
  })
})
