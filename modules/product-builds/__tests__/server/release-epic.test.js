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
})
