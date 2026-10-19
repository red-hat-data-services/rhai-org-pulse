import { describe, it, expect, beforeEach } from 'vitest'

const {
  SCAN_JQL,
  ALL_CHILD_TASKS_JQL,
  productGroup,
  groupEpics,
  buildReleaseStatus,
  transformEpic,
  parsePipelineRunRef,
  sumoLogsUrl,
  matchMergeRequests,
  attributeMergeRequests,
  titleMentionsRelease,
  isVersionBumpCard,
  matchVersionBumpMergeRequests,
  buildReleaseLinks,
  createPayloadCache,
  clearPipelineRunCommentCache,
  CONSOLE_BASE_URL,
  SUMO_UI_BASE_URL,
} = require('../../server/release-status')._testExports

const epic = (key, product, summary = 'Release epic') => ({
  key,
  fields: {
    summary,
    status: { name: 'In Progress', statusCategory: { key: 'indeterminate' } },
    labels: ['release-automation'],
    description: {
      type: 'doc',
      content: [{
        type: 'codeBlock',
        attrs: { language: 'yaml' },
        content: [{ type: 'text', text: `product: ${product}\nversion: 3.5` }],
      }],
    },
  },
})

const child = (key, status, labels) => ({
  key,
  fields: {
    summary: `${key} summary`,
    status: { name: status, statusCategory: { key: 'indeterminate' } },
    labels,
    issuetype: { name: 'Task' },
  },
})

const mr = (iid, extra = {}) => ({
  iid,
  title: `RHAI-2453: Create production release for base-images 3.6.0-ea.2`,
  state: 'opened',
  web_url: `https://gitlab.com/redhat/rhel-ai/ci-cd/aipcc-product-management-configs/-/merge_requests/${iid}`,
  source_branch: 'RHAI-2453-base-images-3-6-ea2-prod-release',
  created_at: '2026-10-15T08:04:19.051Z',
  updated_at: '2026-10-15T08:04:19.051Z',
  ...extra,
})

const comment = (created, text) => ({
  created,
  body: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] },
})

describe('release status', () => {
  beforeEach(() => {
    clearPipelineRunCommentCache()
  })

  it('maps supported Jira product values to display groups', () => {
    expect(productGroup('rhaiis')).toBe('rhaiis')
    expect(productGroup('rhelai')).toBe('rhel-ai')
    expect(productGroup('base-images')).toBe('base-images')
  })

  it('keeps the three product groups and their epic children', () => {
    const epics = [
      transformEpic(epic('AIPCC-1', 'rhaiis'), [child('AIPCC-2', 'To Do', ['planned'])]),
      transformEpic(epic('AIPCC-3', 'rhelai'), []),
      transformEpic(epic('AIPCC-4', 'base-images'), []),
    ]

    const groups = groupEpics(epics)
    expect(groups.map(group => group.label)).toEqual(['RHAII', 'RHEL AI', 'Base Images'])
    expect(groups.map(group => group.epics.length)).toEqual([1, 1, 1])
    expect(groups[0].epics[0].children[0]).toMatchObject({
      key: 'AIPCC-2',
      status: { name: 'To Do' },
      labels: ['planned'],
    })
  })

  it('creates groups for products beyond the pinned three instead of dropping them', () => {
    const epics = [
      transformEpic(epic('RHAI-1', 'rhaiis'), []),
      transformEpic(epic('RHAI-2', 'torch'), []),
      transformEpic(epic('RHAI-3', 'guidellm'), []),
      transformEpic(epic('RHAI-4', 'ai-hub'), []),
      transformEpic(epic('RHAI-5', null, 'Release epic'), []),
    ]

    const groups = groupEpics(epics)
    expect(groups.map(group => group.key)).toEqual(['rhaiis', 'rhel-ai', 'base-images', 'ai-hub', 'guidellm', 'other', 'torch'])
    expect(groups.find(group => group.key === 'torch').label).toBe('Torch')
    expect(groups.find(group => group.key === 'guidellm').label).toBe('GuideLLM')
    expect(groups.find(group => group.key === 'ai-hub').label).toBe('AI Hub')
    expect(groups.find(group => group.key === 'other').epics.map(epic => epic.key)).toEqual(['RHAI-5'])
  })

  it('uses the readiness detector queries and Jira issue shape', async () => {
    const queries = []
    const jira = {
      fetchAllJqlResults: async (jql) => {
        queries.push(jql)
        return jql === SCAN_JQL
          ? [epic('AIPCC-1', 'rhaiis'), epic('AIPCC-9', 'other')]
          : [child('AIPCC-2', 'Ready', ['ready'])]
      },
    }

    const result = await buildReleaseStatus(jira)
    expect(result.total).toBe(2)
    expect(queries[0]).toContain('project in (AIPCC, RHAI)')
    expect(result.groups[0].epics[0]).toMatchObject({
      key: 'AIPCC-1',
      status: { name: 'In Progress' },
      labels: ['release-automation'],
      children: [{ key: 'AIPCC-2', labels: ['ready'] }],
    })
    expect(result.groups.at(-1)).toMatchObject({ key: 'other', label: 'Other' })
    expect(result.groups.at(-1).epics.map(issue => issue.key)).toEqual(['AIPCC-9'])
    expect(ALL_CHILD_TASKS_JQL('AIPCC-1')).toBe(
      'project in (AIPCC, RHAI) AND issuetype = Task AND (parent = AIPCC-1 OR "Epic Link" = AIPCC-1)'
    )
    expect(queries[1]).toContain('project in (AIPCC, RHAI)')
  })

  it('extracts the newest PipelineRun reference from readiness-detector comments', () => {
    const comments = [
      comment('2026-10-10T10:00:00.000Z', 'readiness-detector: PipelineRun triggered: rhel-ai-cicd--claudio/create-release-mr-run-old at 2026-10-10T10:00:00Z'),
      comment('2026-10-12T10:00:00.000Z', 'readiness-detector: PipelineRun triggered: rhel-ai-cicd--claudio/create-release-mr-run-new at 2026-10-12T10:00:00Z'),
    ]
    const ref = parsePipelineRunRef(comments)
    expect(ref).toEqual({
      namespace: 'rhel-ai-cicd--claudio',
      name: 'create-release-mr-run-new',
      url: `${CONSOLE_BASE_URL}/k8s/ns/rhel-ai-cicd--claudio/tekton.dev~v1~PipelineRun/create-release-mr-run-new`,
      logs_url: expect.any(String),
      triggered_at: '2026-10-12T10:00:00Z',
    })

    const params = new URL(ref.logs_url).searchParams
    expect(ref.logs_url).toContain(`${SUMO_UI_BASE_URL}/log-search/create?`)
    expect(params.get('query')).toContain('json "kubernetes.namespace_name" as ns')
    expect(params.get('query')).toContain('ns="rhel-ai-cicd--claudio" and pod matches "create-release-mr-run-new*"')
    expect(params.get('query')).toContain('json "message" as log_message nodrop')
    expect(params.get('startTime')).toMatch(/^-\d+[hd]$/)
    expect(params.get('endTime')).toBe(null)
  })

  it('opens a tight window for a run that just triggered', () => {
    const url = sumoLogsUrl({
      namespace: 'rhel-ai-cicd--claudio',
      name: 'create-release-mr-run-now',
      triggered_at: new Date().toISOString(),
    })
    const params = new URL(url).searchParams
    expect(params.get('startTime')).toBe('-1h')
    expect(params.get('endTime')).toBe(null)
  })

  it('falls back to a recent window for the Sumo link when no timestamp is present', () => {
    const url = sumoLogsUrl({ namespace: 'rhel-ai-cicd--claudio', name: 'create-release-mr-run-x', triggered_at: null })
    const params = new URL(url).searchParams
    expect(params.get('startTime')).toBe('-7d')
    expect(params.get('endTime')).toBe(null)
  })

  it('ignores malformed or missing PipelineRun references', () => {
    expect(parsePipelineRunRef([
      comment('2026-10-10T10:00:00.000Z', 'readiness-detector: PipelineRun triggered: not-a-reference'),
    ])).toBe(null)
    expect(parsePipelineRunRef([
      comment('2026-10-10T10:00:00.000Z', 'readiness-detector: PipelineRun triggered: ns/run/extra'),
    ])).toBe(null)
    expect(parsePipelineRunRef([
      comment('2026-10-10T10:00:00.000Z', 'readiness-detector: Pipeline triggered: legacy marker without ref'),
    ])).toBe(null)
    expect(parsePipelineRunRef([])).toBe(null)
    expect(parsePipelineRunRef(null)).toBe(null)
  })

  it('matches PMC merge requests by Jira key in title or source branch', () => {
    const mergeRequests = [
      mr(796),
      mr(797, { title: 'Unrelated change', source_branch: 'main', iid: 797 }),
      mr(798, { title: 'AIPCC-2: Create stage release', source_branch: 'AIPCC-2-stage', iid: 798, created_at: '2026-10-16T08:00:00.000Z' }),
      mr(796),
    ]

    expect(matchMergeRequests(['AIPCC-2'], mergeRequests).map(item => item.iid)).toEqual([798])
    expect(matchMergeRequests(['RHAI-2453'], mergeRequests).map(item => item.iid)).toEqual([796])
    expect(matchMergeRequests(['RHAI-9999'], mergeRequests)).toEqual([])
  })

  it('builds PipelineRun and merge request links keyed by issue', async () => {
    const epics = [
      transformEpic(epic('RHAI-10', 'rhaiis'), [child('RHAI-11', 'Triggered', ['triggered'])]),
    ]
    const jira = {
      jiraRequest: async (path) => {
        if (path.startsWith('/rest/api/3/issue/RHAI-11/comment')) {
          return { comments: [comment('2026-10-12T10:00:00.000Z', 'readiness-detector: PipelineRun triggered: rhel-ai-cicd--claudio/create-release-mr-run-abc at 2026-10-12T10:00:00Z')] }
        }
        throw new Error(`unexpected path ${path}`)
      },
    }
    const gitlab = {
      listMergeRequests: async () => [mr(796, { title: 'RHAI-11: Create production release', source_branch: 'RHAI-11-prod' })],
    }

    const links = await buildReleaseLinks(epics, { jira, gitlab })
    expect(links['RHAI-11'].pipeline_run).toMatchObject({
      namespace: 'rhel-ai-cicd--claudio',
      name: 'create-release-mr-run-abc',
    })
    expect(links['RHAI-11'].merge_requests.map(item => item.iid)).toEqual([796])
    expect(links['RHAI-10'].merge_requests.map(item => item.iid)).toEqual([796])
    expect(links['RHAI-10'].pipeline_runs.map(run => run.name)).toEqual(['create-release-mr-run-abc'])
  })

  it('keeps the page working when GitLab fails or comments are unavailable', async () => {
    const epics = [
      transformEpic(epic('RHAI-20', 'rhaiis'), [child('RHAI-21', 'Ready', ['ready'])]),
    ]
    const jira = {}
    const gitlab = {
      listMergeRequests: async () => { throw new Error('HTTP 500') },
    }

    const links = await buildReleaseLinks(epics, { jira, gitlab })
    expect(links['RHAI-21']).toEqual({ merge_requests: [], pipeline_run: null })
    expect(links['RHAI-20']).toEqual({ merge_requests: [], pipeline_runs: [] })
  })

  it('attributes epic-keyed release MRs to the card whose run was executing', () => {
    const epics = [
      transformEpic(epic('RHAI-904', 'rhaiis'), [
        child('RHAI-7568', 'Released', ['released']),
        child('RHAI-7570', 'Released', ['released']),
      ]),
    ]
    epics[0].details.version = '3.5.2'
    const refs = new Map([
      ['RHAI-7568', { namespace: 'rhel-ai-cicd--claudio', name: 'create-release-mr-run-d2kw6', url: 'u1', triggered_at: '2026-10-13T16:00:00Z' }],
      ['RHAI-7570', { namespace: 'rhel-ai-cicd--claudio', name: 'create-release-mr-run-c2sqb', url: 'u2', triggered_at: '2026-10-13T18:13:31Z' }],
    ])
    const mergeRequests = [
      mr(765, { title: 'RHAI-904: Add RHSA prod release for rhaiis 3.5.2', source_branch: 'RHAI-904-rhaiis-3-5-2-rhsa-prod-release', created_at: '2026-10-13T16:20:00.000Z' }),
      mr(768, { title: 'RHAI-904: Add RHSA production release for rhaiis-cpu-ubi9 3.5.2', source_branch: 'RHAI-904-rhaiis-3-5-2-rhsa-cpu-ubi9-release', created_at: '2026-10-13T18:16:00.000Z' }),
      mr(769, { title: 'RHAI-904: bump rhaiis 3.5 tags to 3.5.3', source_branch: 'RHAI-904-rhaiis-3-5-version-bump', created_at: '2026-10-13T16:25:00.000Z' }),
      mr(770, { title: 'RHAI-999: Add release for rhelai 3.5.2', source_branch: 'RHAI-999-rhelai', created_at: '2026-10-13T18:15:00.000Z' }),
      mr(771, { title: 'RHAI-904: Add release for rhaiis 3.5.2', source_branch: 'x', created_at: '2026-10-10T16:20:00.000Z' }),
    ]

    const claims = attributeMergeRequests(
      epics[0],
      epics[0].children,
      refs,
      mergeRequests,
      new Set()
    )
    expect(claims.get(765)).toBe('RHAI-7568')
    expect(claims.get(768)).toBe('RHAI-7570')
    expect(claims.has(769)).toBe(false)
    expect(claims.has(770)).toBe(false)
    expect(claims.has(771)).toBe(false)
    expect(titleMentionsRelease('Add RHSA prod release for rhaiis 3.5.2', { product: 'rhaiis', version: '3.5.2' })).toBe(true)
    expect(titleMentionsRelease('bump rhaiis 3.5 tags to 3.5.3', { product: 'rhaiis', version: '3.5.2' })).toBe(false)
    expect(titleMentionsRelease('Add release for rhelai 3.5.2', { product: 'rhaiis', version: '3.5.2' })).toBe(false)
    expect(titleMentionsRelease('Create production release for rhelai 3.6.0-ea.1', { product: 'rhelai', version: '3.6.0-ea.1' })).toBe(true)
    expect(titleMentionsRelease('Add production release for torch 1.2.0', { product: 'torch', version: '1.2.0' })).toBe(true)
  })

  it('attributes fallback MRs through buildReleaseLinks and aggregates them at the epic level', async () => {
    const epics = [
      transformEpic(epic('RHAI-904', 'rhaiis'), [
        child('RHAI-7570', 'Released', ['released']),
      ]),
    ]
    epics[0].details.version = '3.5.2'
    const jira = {
      jiraRequest: async (path) => {
        if (path.startsWith('/rest/api/3/issue/RHAI-7570/comment')) {
          return { comments: [comment('2026-10-13T18:13:31.000Z', 'readiness-detector: PipelineRun triggered: rhel-ai-cicd--claudio/create-release-mr-run-c2sqb at 2026-10-13T18:13:31Z')] }
        }
        throw new Error(`unexpected path ${path}`)
      },
    }
    const gitlab = {
      listMergeRequests: async () => [
        mr(768, { title: 'RHAI-904: Add RHSA production release for rhaiis-cpu-ubi9 3.5.2', source_branch: 'RHAI-904-rhaiis-3-5-2-rhsa-cpu-ubi9-release', created_at: '2026-10-13T18:16:00.000Z' }),
      ],
    }

    const links = await buildReleaseLinks(epics, { jira, gitlab })
    expect(links['RHAI-7570'].merge_requests.map(item => item.iid)).toEqual([768])
    expect(links['RHAI-904'].merge_requests.map(item => item.iid)).toEqual([768])
  })

  it('attributes version bump MRs to the version bump card', () => {
    const epics = [
      transformEpic(epic('RHAI-904', 'rhaiis'), [
        child('RHAI-919', 'To Do', []),
      ]),
    ]
    epics[0].children[0].summary = 'Bump RHAII version to 3.5.3'
    epics[0].details.version = '3.5.2'
    const mergeRequests = [
      mr(769, { title: 'RHAI-904: bump rhaiis 3.5 tags to 3.5.3', source_branch: 'RHAI-904-rhaiis-3-5-version-bump' }),
      mr(772, { title: 'RHAI-904: bump rhaiis 3.5 tags to 3.6.0', source_branch: 'RHAI-904-rhaiis-3-6-version-bump' }),
      mr(773, { title: 'RHAI-907: bump rhelai 3.5 tags to 3.5.3', source_branch: 'RHAI-907-rhelai-3-5-version-bump' }),
      mr(790, { title: 'RHAI-8687: Edit config.yaml to bump RHAII version from 3.4.6 to 3.4.7', source_branch: 'RHAI-8687-version-bump' }),
    ]

    expect(isVersionBumpCard(epics[0].children[0])).toBe(true)
    const matches = matchVersionBumpMergeRequests(epics[0], epics[0].children[0], mergeRequests, new Set())
    expect(matches.map(item => item.iid)).toEqual([769])

    const rhaiiEpic = transformEpic(epic('RHAI-8687', 'rhaiis'), [child('RHAI-8686', 'To Do', [])])
    rhaiiEpic.children[0].summary = 'Bump RHAII version to 3.4.7'
    const rhaiiMatches = matchVersionBumpMergeRequests(rhaiiEpic, rhaiiEpic.children[0], mergeRequests, new Set([769]))
    expect(rhaiiMatches.map(item => item.iid)).toEqual([790])
  })

  it('attributes version bump MRs through buildReleaseLinks', async () => {
    const epics = [
      transformEpic(epic('RHAI-904', 'rhaiis'), [
        child('RHAI-919', 'Done', []),
      ]),
    ]
    epics[0].children[0].summary = 'Bump RHAII version to 3.5.3'
    const gitlab = {
      listMergeRequests: async () => [
        mr(769, { title: 'RHAI-904: bump rhaiis 3.5 tags to 3.5.3', source_branch: 'RHAI-904-rhaiis-3-5-version-bump' }),
      ],
    }

    const links = await buildReleaseLinks(epics, { jira: {}, gitlab })
    expect(links['RHAI-919'].merge_requests.map(item => item.iid)).toEqual([769])
    expect(links['RHAI-904'].merge_requests.map(item => item.iid)).toEqual([769])
  })

  it('caches the payload for repeated and concurrent requests', async () => {
    let builds = 0
    const builder = async () => ({ total: ++builds })
    const buildCached = createPayloadCache(60000)

    expect(await buildCached(builder)).toEqual({ total: 1 })
    expect(await buildCached(builder)).toEqual({ total: 1 })
    const [first, second] = await Promise.all([buildCached(builder), buildCached(builder)])
    expect(first).toEqual({ total: 1 })
    expect(second).toEqual({ total: 1 })
    expect(builds).toBe(1)

    const expired = createPayloadCache(0)
    expect(await expired(builder)).toEqual({ total: 2 })
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(await expired(builder)).toEqual({ total: 2 })
    for (let attempt = 0; attempt < 20 && builds < 3; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 5))
    }
    expect(builds).toBe(3)
    expect(await expired(builder)).toEqual({ total: 3 })
    for (let attempt = 0; attempt < 20 && builds < 4; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 5))
    }
    expect(builds).toBe(4)

    const failing = createPayloadCache(60000)
    await expect(failing(async () => { throw new Error('boom') })).rejects.toThrow('boom')
    expect(await failing(builder)).toEqual({ total: 5 })
  })

  it('rebuilds immediately after invalidation', async () => {
    let builds = 0
    const builder = async () => ({ total: ++builds })
    const buildCached = createPayloadCache(60000)

    expect(await buildCached(builder)).toEqual({ total: 1 })
    expect(await buildCached(builder)).toEqual({ total: 1 })
    buildCached.invalidate()
    expect(await buildCached(builder)).toEqual({ total: 2 })
  })

  it('discards an in-flight build that resolves after invalidation', async () => {
    let builds = 0
    let release
    const gate = new Promise(resolve => { release = resolve })
    const buildCached = createPayloadCache(60000)

    const inFlight = buildCached(async () => {
      await gate
      return { total: ++builds }
    })
    buildCached.invalidate()
    release()
    expect(await inFlight).toEqual({ total: 1 })
    expect(await buildCached(async () => ({ total: ++builds }))).toEqual({ total: 2 })
  })

  it('serves stale data immediately while refreshing in the background', async () => {
    let builds = 0
    const builder = async () => ({ total: ++builds })
    const buildCached = createPayloadCache(0)

    expect(await buildCached(builder)).toEqual({ total: 1 })
    expect(await buildCached(builder)).toEqual({ total: 1 })
    for (let attempt = 0; attempt < 20 && builds < 2; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 5))
    }
    expect(builds).toBe(2)
    expect(await buildCached(builder)).toEqual({ total: 2 })

    const failing = createPayloadCache(0)
    await failing(builder)
    await new Promise(resolve => setTimeout(resolve, 10))
    const stale = await failing(async () => { throw new Error('boom') })
    expect(stale.total).toBeGreaterThanOrEqual(1)
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(await failing(builder).catch(() => 'kept stale')).not.toBe('kept stale')
  })
})
