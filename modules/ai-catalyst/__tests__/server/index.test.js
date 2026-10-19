import { describe, it, expect, vi, afterEach } from 'vitest'
import { createRequire } from 'node:module'

const registerRoutes = (await import('../../server/index.js')).default
const showcase = createRequire(import.meta.url)('../../server/showcase/feed-sync.js')

const FEED_BOARDS_PAYLOAD = {
  boards: ['board-2026-09', 'board-2026-10'],
}

const BOARD_2026_09_PAYLOAD = {
  kind: 'board',
  name: 'board-2026-09',
  count: 3,
  columns: ['title', 'unique_id', 'capability_labels', 'gpu_required', 'impact_score'],
  rows: [
    {
      title: 'Agent Framework',
      unique_id: 'org/agent-framework',
      link: 'https://github.com/org/agent-framework',
      item_type: 'repo',
      source: 'github',
      sources: 'github, hn',
      category: 'agentic-ai',
      capability_labels: 'agents, kubernetes',
      red_hat_stack: 'OpenShift AI, vLLM',
      impact_score: '9',
      feasibility_score: '7.5',
      stars: '1137',
      contributors: '6',
      gpu_required: 'yes',
      has_dockerfile: 'yes',
      board_passes_gate: 'yes',
      board_feasibility_estimated: 'no',
      vram_gb: '24',
      pm_decision: 'Approve(mock-reviewer)',
      pm_review_history: JSON.stringify([{ reviewer: 'mock-reviewer', decision: 'Approve' }]),
    },
    {
      title: 'Legacy Pipe Era Entry',
      unique_id: 'org/pipe-era',
      capability_labels: 'agents|kubernetes',
      gpu_required: 'no',
      impact_score: '',
      pm_review_history: '',
    },
    { title: '', unique_id: '', impact_score: '' },
  ],
}

const BOARD_2026_10_PAYLOAD = {
  kind: 'board',
  name: 'board-2026-10',
  count: 1,
  columns: ['title', 'unique_id'],
  rows: [
    { title: 'October Entry', unique_id: 'org/october', gpu_required: 'no' },
  ],
}

const SHOWCASE_FEED_PAYLOAD = {
  showcase_entries: [],
  strategy_pillars: [],
  site_config: {},
  generated_at: '2026-10-11T00:00:00Z',
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  }
}

function stubFeedFeed(responses, { url = 'https://pocexplorer.redhataicatalyst.com', token = 'token-123' } = {}) {
  const fetchMock = vi.fn(async (requestUrl, options) => {
    if (!options || options.headers.Authorization !== `Bearer ${token}`) {
      return jsonResponse(401, { error: 'unauthorized' })
    }
    for (const [suffix, body] of Object.entries(responses)) {
      if (String(requestUrl) === url + suffix) return jsonResponse(200, body)
    }
    return jsonResponse(404, { error: 'unknown board', known: ['board-2026-09'] })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function makeStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    map,
    readFromStorage: vi.fn(async key => (map.has(key) ? map.get(key) : null)),
    writeToStorage: vi.fn(async (key, value) => { map.set(key, value) }),
  }
}

function makeContext(overrides = {}) {
  const storage = overrides.storage || makeStorage()
  const handlers = {}
  const router = {
    get: vi.fn((path, ...args) => { handlers[path] = args.at(-1) }),
    post: vi.fn((path, ...args) => { handlers[path] = args.at(-1) }),
  }
  const context = {
    storage,
    requireAuth: vi.fn((req, res, next) => next()),
    requireAdmin: vi.fn((req, res, next) => next()),
    requireScope: vi.fn(() => vi.fn((req, res, next) => next())),
    resolveSecret: vi.fn(),
    secrets: { POC_EXPLORER_FEED_TOKEN: 'token-123' },
    registerScopes: vi.fn(),
    registerRefresh: vi.fn(),
    registerDiagnostics: vi.fn(),
    registerExport: vi.fn(),
    ...overrides.context,
  }
  registerRoutes(router, context)
  return { handlers, context, storage }
}

describe('ai-catalyst server module', () => {
  it.each(['', 'canonical-id'])('only resolves a source-link fallback for a blank producer ID (%j)', async uniqueId => {
    const link = 'https://github.com/org/legacy'
    const { handlers } = makeContext({ storage: makeStorage({
      'ai-catalyst/index.json': { boards: [{ month: '2026-04' }] },
      'ai-catalyst/boards/2026-04.json': [{ uniqueId, title: 'Legacy project', link }],
      'ai-catalyst/showcase/showcase-data.json': { entries: [], pillars: [] },
    }) })
    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() }

    await handlers['/candidates/:id']({ params: { id: link } }, res)

    if (uniqueId) expect(res.status).toHaveBeenCalledWith(404)
    else expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ uniqueId: '', link, title: 'Legacy project' }))
  })

  it('exports a function', () => {
    expect(typeof registerRoutes).toBe('function')
  })

  it('registers expected GET routes', () => {
    const registered = []
    const router = {
      get: vi.fn((...args) => registered.push({ method: 'get', path: args[0] })),
      post: vi.fn((...args) => registered.push({ method: 'post', path: args[0] }))
    }
    const context = {
      storage: {
        readFromStorage: vi.fn(async () => null),
        writeToStorage: vi.fn(async () => {})
      },
      requireAuth: vi.fn((req, res, next) => next()),
      requireAdmin: vi.fn((req, res, next) => next()),
      requireScope: vi.fn(() => vi.fn((req, res, next) => next())),
      resolveSecret: vi.fn(),
      secrets: {},
      registerScopes: vi.fn(),
      registerRefresh: vi.fn(),
      registerDiagnostics: vi.fn(),
      registerExport: vi.fn()
    }

    registerRoutes(router, context)

    const getPaths = registered.filter(r => r.method === 'get').map(r => r.path)
    expect(getPaths).toContain('/board-config')
    expect(getPaths).toContain('/config')
    expect(getPaths).toContain('/boards')
    expect(getPaths).toContain('/boards/:month')
    expect(getPaths).toContain('/candidates/:id')
    expect(getPaths).toContain('/stats')
    expect(getPaths).toContain('/showcase/config')
    expect(getPaths).toContain('/showcase/entries')
    expect(getPaths).toContain('/showcase/entries/:slug')
  })

  it('registers POST routes including showcase', () => {
    const registered = []
    const router = {
      get: vi.fn(),
      post: vi.fn((...args) => registered.push({ method: 'post', path: args[0] }))
    }
    const context = {
      storage: {
        readFromStorage: vi.fn(async () => null),
        writeToStorage: vi.fn(async () => {})
      },
      requireAuth: vi.fn((req, res, next) => next()),
      requireAdmin: vi.fn((req, res, next) => next()),
      requireScope: vi.fn(() => vi.fn((req, res, next) => next())),
      resolveSecret: vi.fn(),
      secrets: {},
      registerScopes: vi.fn(),
      registerRefresh: vi.fn(),
      registerDiagnostics: vi.fn(),
      registerExport: vi.fn()
    }

    registerRoutes(router, context)

    const postPaths = registered.filter(r => r.method === 'post').map(r => r.path)
    expect(postPaths).toContain('/board-config')
    expect(postPaths).toContain('/sync')
    expect(postPaths).toContain('/showcase/config')
    expect(postPaths).toContain('/showcase/refresh')
  })

  it('registers scopes', () => {
    const router = { get: vi.fn(), post: vi.fn() }
    const context = {
      storage: { readFromStorage: vi.fn(async () => null), writeToStorage: vi.fn(async () => {}) },
      requireAuth: vi.fn((req, res, next) => next()),
      requireAdmin: vi.fn((req, res, next) => next()),
      requireScope: vi.fn(() => vi.fn((req, res, next) => next())),
      resolveSecret: vi.fn(),
      secrets: {},
      registerScopes: vi.fn(),
      registerRefresh: vi.fn(),
      registerDiagnostics: vi.fn(),
      registerExport: vi.fn()
    }

    registerRoutes(router, context)

    expect(context.registerScopes).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ key: 'ai-catalyst:read' }),
        expect.objectContaining({ key: 'ai-catalyst:showcase' })
      ])
    )
  })

  it('registers refresh handlers', () => {
    const router = { get: vi.fn(), post: vi.fn() }
    const context = {
      storage: { readFromStorage: vi.fn(async () => null), writeToStorage: vi.fn(async () => {}) },
      requireAuth: vi.fn((req, res, next) => next()),
      requireAdmin: vi.fn((req, res, next) => next()),
      requireScope: vi.fn(() => vi.fn((req, res, next) => next())),
      resolveSecret: vi.fn(),
      secrets: {},
      registerScopes: vi.fn(),
      registerRefresh: vi.fn(),
      registerDiagnostics: vi.fn(),
      registerExport: vi.fn()
    }

    registerRoutes(router, context)

    expect(context.registerRefresh).toHaveBeenCalledWith(
      'ai-catalyst:sync-boards',
      expect.objectContaining({ cadence: '1h' })
    )
    expect(context.registerRefresh).toHaveBeenCalledWith(
      'ai-catalyst:showcase-sync',
      expect.objectContaining({ cadence: '1h' })
    )
  })

  it('registers diagnostics hook', () => {
    const router = { get: vi.fn(), post: vi.fn() }
    const context = {
      storage: { readFromStorage: vi.fn(async () => null), writeToStorage: vi.fn(async () => {}) },
      requireAuth: vi.fn((req, res, next) => next()),
      requireAdmin: vi.fn((req, res, next) => next()),
      requireScope: vi.fn(() => vi.fn((req, res, next) => next())),
      resolveSecret: vi.fn(),
      secrets: {},
      registerScopes: vi.fn(),
      registerRefresh: vi.fn(),
      registerDiagnostics: vi.fn(),
      registerExport: vi.fn()
    }

    registerRoutes(router, context)

    expect(context.registerDiagnostics).toHaveBeenCalled()
  })

  it('registers export hook', () => {
    const router = { get: vi.fn(), post: vi.fn() }
    const context = {
      storage: { readFromStorage: vi.fn(async () => null), writeToStorage: vi.fn(async () => {}) },
      requireAuth: vi.fn((req, res, next) => next()),
      requireAdmin: vi.fn((req, res, next) => next()),
      requireScope: vi.fn(() => vi.fn((req, res, next) => next())),
      resolveSecret: vi.fn(),
      secrets: {},
      registerScopes: vi.fn(),
      registerRefresh: vi.fn(),
      registerDiagnostics: vi.fn(),
      registerExport: vi.fn()
    }

    registerRoutes(router, context)

    expect(context.registerExport).toHaveBeenCalled()
  })

  it('scopes board pillars to the complete month while keeping showcase pillars complete', async () => {
    const handlers = {}
    const candidates = [
      { uniqueId: 'inference-item', category: 'model-inference', impactScore: 9 },
      { uniqueId: 'data-item', category: 'data-science-engineering', impactScore: 8 }
    ]
    const showcaseData = {
      fetchedAt: '2026-09-16T10:00:00Z',
      pillars: [
        { pillarKey: 'model-inference', title: 'Model Inference', sortOrder: 1 },
        { pillarKey: 'data-science-engineering', title: 'Data Science', sortOrder: 2 },
        { pillarKey: 'model-customization', title: 'Model Customization', sortOrder: 3 }
      ],
      entries: [{ slug: 'inference-showcase', strategyPillarKey: 'model-inference', status: 'active' }]
    }
    const index = { boards: [{ month: '2026-09', candidateCount: candidates.length }] }
    const storage = {
      readFromStorage: vi.fn(async key => {
        if (key === 'ai-catalyst/index.json') return index
        if (key === 'ai-catalyst/boards/2026-09.json') return candidates
        if (key === 'ai-catalyst/showcase/showcase-data.json') return showcaseData
        return null
      }),
      writeToStorage: vi.fn(async () => {})
    }
    const router = {
      get: vi.fn((path, ...args) => { handlers[path] = args.at(-1) }),
      post: vi.fn()
    }
    const context = {
      storage,
      requireAuth: vi.fn((req, res, next) => next()),
      requireAdmin: vi.fn((req, res, next) => next()),
      requireScope: vi.fn(() => vi.fn((req, res, next) => next())),
      resolveSecret: vi.fn(),
      secrets: {},
      registerScopes: vi.fn(),
      registerRefresh: vi.fn(),
      registerDiagnostics: vi.fn(),
      registerExport: vi.fn()
    }

    registerRoutes(router, context)

    const boardResponse = { json: vi.fn(), status: vi.fn() }
    await handlers['/boards/:month'](
      { params: { month: '2026-09' }, query: { category: 'model-inference' } },
      boardResponse
    )

    expect(boardResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      filtered: 1,
      pillars: expect.arrayContaining([
        expect.objectContaining({ pillarKey: 'model-inference' }),
        expect.objectContaining({ pillarKey: 'data-science-engineering' })
      ])
    }))
    expect(boardResponse.json.mock.calls[0][0].pillars).toHaveLength(2)

    const detailResponse = { json: vi.fn(), status: vi.fn() }
    await handlers['/candidates/:id']({ params: { id: 'data-item' } }, detailResponse)
    expect(detailResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      boardMonth: '2026-09',
      pillar: expect.objectContaining({ pillarKey: 'data-science-engineering' })
    }))

    const showcaseResponse = { json: vi.fn(), status: vi.fn() }
    await handlers['/showcase/entries']({}, showcaseResponse)

    expect(showcaseResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      pillars: expect.arrayContaining([
        expect.objectContaining({ pillarKey: 'model-inference' }),
        expect.objectContaining({ pillarKey: 'data-science-engineering' }),
        expect.objectContaining({ pillarKey: 'model-customization' })
      ])
    }))
    expect(showcaseResponse.json.mock.calls[0][0].pillars).toHaveLength(3)
  })
})

describe('ai-catalyst board sync via POC Explorer feed', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('syncs boards and adapts stringified feed rows to the camelCase contract', async () => {
    const fetchMock = stubFeedFeed({
      '/feed/boards.json': FEED_BOARDS_PAYLOAD,
      '/feed/board.json?board=board-2026-09': BOARD_2026_09_PAYLOAD,
      '/feed/board.json?board=board-2026-10': BOARD_2026_10_PAYLOAD,
    })
    const { handlers, storage } = makeContext()

    const res = { json: vi.fn(), status: vi.fn() }
    await handlers['/sync']({}, res)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://pocexplorer.redhataicatalyst.com/feed/boards.json',
      expect.objectContaining({ headers: { Authorization: 'Bearer token-123' } })
    )
    expect(res.status).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'ok', synced: 2, total: 2 }))

    const september = storage.map.get('ai-catalyst/boards/2026-09.json')
    expect(september).toHaveLength(2)

    expect(september[0]).toMatchObject({
      title: 'Agent Framework',
      uniqueId: 'org/agent-framework',
      itemType: 'repo',
      sources: ['github', 'hn'],
      capabilityLabels: ['agents', 'kubernetes'],
      redHatStack: ['OpenShift AI', 'vLLM'],
      impactScore: 9,
      feasibilityScore: 7.5,
      stars: 1137,
      contributors: 6,
      gpuRequired: true,
      hasDockerfile: true,
      boardPassesGate: true,
      boardFeasibilityEstimated: false,
      vramGb: 24,
      pmReviewHistory: [{ reviewer: 'mock-reviewer', decision: 'Approve' }],
    })

    expect(september[1]).toMatchObject({
      capabilityLabels: ['agents', 'kubernetes'],
      gpuRequired: false,
      impactScore: null,
      pmReviewHistory: [],
    })

    expect(storage.map.get('ai-catalyst/boards/2026-10.json')).toHaveLength(1)

    const index = storage.map.get('ai-catalyst/index.json')
    expect(index.boards.map(b => b.month)).toEqual(['2026-10', '2026-09'])
    expect(index.boards[1]).toMatchObject({ month: '2026-09', candidateCount: 2 })
    expect(index.boards[1].lastSynced).toEqual(expect.any(String))
  })

  it('keeps previously synced months in the index', async () => {
    stubFeedFeed({
      '/feed/boards.json': { boards: ['board-2026-10'] },
      '/feed/board.json?board=board-2026-10': BOARD_2026_10_PAYLOAD,
    })
    const { handlers, storage } = makeContext({
      storage: makeStorage({
        'ai-catalyst/index.json': {
          boards: [{ month: '2026-09', candidateCount: 2, lastSynced: '2026-09-16T10:00:00Z' }],
        },
        'ai-catalyst/boards/2026-09.json': [{ title: 'Old' }],
      }),
    })

    const res = { json: vi.fn(), status: vi.fn() }
    await handlers['/sync']({}, res)

    const index = storage.map.get('ai-catalyst/index.json')
    expect(index.boards.map(b => b.month)).toEqual(['2026-10', '2026-09'])
  })

  it('surfaces an actionable error on 401 responses', async () => {
    stubFeedFeed({})
    const { handlers } = makeContext({ context: { secrets: { POC_EXPLORER_FEED_TOKEN: 'bad-token' } } })

    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() }
    await handlers['/sync']({}, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({
      error: 'Sync failed: unauthorized — check POC_EXPLORER_FEED_TOKEN'
    })
  })

  it('reports unknown board errors per board without failing the whole sync', async () => {
    stubFeedFeed({ '/feed/boards.json': { boards: ['board-1999-01'] } })
    const { handlers } = makeContext()

    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() }
    await handlers['/sync']({}, res)

    expect(res.status).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'ok',
      synced: 0,
      total: 1,
      failed: [{ board: 'board-1999-01', error: expect.stringContaining('unknown board') }],
    }))
  })

  it('reports garbage board names as failed instead of silently dropping them', async () => {
    stubFeedFeed({
      '/feed/boards.json': { boards: ['board-2026-09', 'garbage'] },
      '/feed/board.json?board=board-2026-09': BOARD_2026_09_PAYLOAD,
    })
    const { handlers, storage } = makeContext()

    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() }
    await handlers['/sync']({}, res)

    expect(res.status).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'ok',
      synced: 1,
      total: 2,
      failed: [{ board: 'garbage', error: 'board name does not match board-YYYY-MM' }],
    }))
    expect(storage.map.get('ai-catalyst/boards/2026-09.json')).toHaveLength(2)
  })

  it('continues past per-board failures and reports them honestly', async () => {
    stubFeedFeed({
      '/feed/boards.json': FEED_BOARDS_PAYLOAD,
      '/feed/board.json?board=board-2026-09': BOARD_2026_09_PAYLOAD,
    })
    const { handlers, storage } = makeContext()

    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() }
    await handlers['/sync']({}, res)

    expect(res.status).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'ok',
      synced: 1,
      total: 2,
      failed: [{ board: 'board-2026-10', error: expect.stringContaining('unknown board') }],
    }))

    expect(storage.map.get('ai-catalyst/boards/2026-09.json')).toHaveLength(2)
    const index = storage.map.get('ai-catalyst/index.json')
    expect(index.boards.map(b => b.month)).toEqual(['2026-09'])
  })

  it.each([
    ['malformed rows', {}, 'rows'],
    ['a different board', { ...BOARD_2026_10_PAYLOAD }, 'board-2026-09'],
  ])('keeps cached data and timestamps when board.json returns %s', async (_label, payload, error) => {
    stubFeedFeed({
      '/feed/boards.json': { boards: ['board-2026-09'] },
      '/feed/board.json?board=board-2026-09': payload,
    })
    const cachedBoard = [{ title: 'Cached Entry', uniqueId: 'org/cached' }]
    const { handlers, storage } = makeContext({
      storage: makeStorage({
        'ai-catalyst/index.json': {
          boards: [{ month: '2026-09', candidateCount: 1, lastSynced: '2026-09-16T10:00:00Z' }],
          lastSynced: '2026-09-16T10:00:00Z',
        },
        'ai-catalyst/boards/2026-09.json': cachedBoard,
      }),
    })

    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() }
    await handlers['/sync']({}, res)

    expect(res.status).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'ok',
      synced: 0,
      total: 1,
      failed: [{ board: 'board-2026-09', error: expect.stringContaining(error) }],
    }))
    expect(storage.map.get('ai-catalyst/boards/2026-09.json')).toEqual(cachedBoard)
    expect(storage.map.get('ai-catalyst/index.json').lastSynced).toBe('2026-09-16T10:00:00Z')
    expect(storage.map.get('ai-catalyst/index.json').boards[0].lastSynced).toBe('2026-09-16T10:00:00Z')
  })

  it('keeps the cached board when board.json serves a valid envelope with non-string cells', async () => {
    stubFeedFeed({
      '/feed/boards.json': { boards: ['board-2026-09'] },
      '/feed/board.json?board=board-2026-09': {
        kind: 'board',
        name: 'board-2026-09',
        count: 1,
        columns: ['title', 'unique_id', 'pm_decision'],
        rows: [{ title: 'Drifted Entry', unique_id: 'org/drift', pm_decision: { decision: 'Approve' } }],
      },
    })
    const cachedBoard = [{ title: 'Cached Entry', uniqueId: 'org/cached' }]
    const { handlers, storage } = makeContext({
      storage: makeStorage({
        'ai-catalyst/index.json': {
          boards: [{ month: '2026-09', candidateCount: 1, lastSynced: '2026-09-16T10:00:00Z' }],
          lastSynced: '2026-09-16T10:00:00Z',
        },
        'ai-catalyst/boards/2026-09.json': cachedBoard,
      }),
    })

    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() }
    await handlers['/sync']({}, res)

    expect(res.status).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'ok',
      synced: 0,
      total: 1,
      failed: [{ board: 'board-2026-09', error: expect.stringContaining('strings') }],
    }))
    expect(storage.writeToStorage).not.toHaveBeenCalledWith('ai-catalyst/boards/2026-09.json', expect.anything())
    expect(storage.map.get('ai-catalyst/boards/2026-09.json')).toBe(cachedBoard)
    const index = storage.map.get('ai-catalyst/index.json')
    expect(index.lastSynced).toBe('2026-09-16T10:00:00Z')
    expect(index.boards[0].lastSynced).toBe('2026-09-16T10:00:00Z')
  })

  it.each(['', null, '  '])('preserves boards and retries when a non-padding row has no ID or source link (%j)', async identity => {
    stubFeedFeed({
      '/feed/boards.json': { boards: ['board-2026-09'] },
      '/feed/board.json?board=board-2026-09': { count: 1, rows: [{ title: 'Broken', unique_id: identity, link: identity }] },
    })
    const cached = [{ uniqueId: 'org/good', title: 'Good candidate' }]
    const previous = { boards: [{ month: '2026-09', candidateCount: 1, lastSynced: 'before' }], lastSynced: 'before' }
    const { handlers, context, storage } = makeContext({ storage: makeStorage({
      'ai-catalyst/boards/2026-09.json': cached,
      'ai-catalyst/index.json': previous,
    }) })
    const res = { json: vi.fn() }

    await handlers['/sync']({}, res)

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ synced: 0, failed: [{ board: 'board-2026-09', error: expect.stringContaining('identity') }] }))
    expect(storage.map.get('ai-catalyst/boards/2026-09.json')).toBe(cached)
    expect(storage.map.get('ai-catalyst/index.json')).toEqual(previous)
    const refresh = context.registerRefresh.mock.calls.find(c => c[0] === 'ai-catalyst:sync-boards')[1]
    await expect(refresh.handler()).rejects.toThrow('identity')
  })

  it('rejects the refresh handler when a board serves non-string cells so the registry retries', async () => {
    stubFeedFeed({
      '/feed/boards.json': { boards: ['board-2026-09'] },
      '/feed/board.json?board=board-2026-09': {
        count: 1,
        rows: [{ title: 'Drifted Entry', unique_id: 'org/drift', pm_decision: { decision: 'Approve' } }],
      },
    })
    const { context } = makeContext()
    const syncBoardsConfig = context.registerRefresh.mock.calls.find(c => c[0] === 'ai-catalyst:sync-boards')[1]

    await expect(syncBoardsConfig.handler()).rejects.toThrow(
      'Board sync failed for 1/1 boards — board-2026-09:',
    )
  })

  it('keeps the cached board when board.json reports a count that disagrees with its rows', async () => {
    stubFeedFeed({
      '/feed/boards.json': { boards: ['board-2026-09'] },
      '/feed/board.json?board=board-2026-09': { count: 145, rows: [] },
    })
    const cachedBoard = [{ title: 'Cached Entry', uniqueId: 'org/cached' }]
    const { handlers, storage } = makeContext({
      storage: makeStorage({
        'ai-catalyst/index.json': {
          boards: [{ month: '2026-09', candidateCount: 1, lastSynced: '2026-09-16T10:00:00Z' }],
          lastSynced: '2026-09-16T10:00:00Z',
        },
        'ai-catalyst/boards/2026-09.json': cachedBoard,
      }),
    })

    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() }
    await handlers['/sync']({}, res)

    expect(res.status).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'ok',
      synced: 0,
      total: 1,
      failed: [{ board: 'board-2026-09', error: expect.stringContaining('count') }],
    }))
    expect(storage.map.get('ai-catalyst/boards/2026-09.json')).toEqual(cachedBoard)
  })

  it('fails the board and preserves the cache when rows are whitespace-only', async () => {
    stubFeedFeed({
      '/feed/boards.json': { boards: ['board-2026-09'] },
      '/feed/board.json?board=board-2026-09': {
        count: 2,
        rows: [
          { title: ' ', unique_id: ' ', pm_decision: ' ' },
          { title: '  ', unique_id: '  ', problem_statement: '\t' },
        ],
      },
    })
    const cachedBoard = [{ title: 'Cached Entry', uniqueId: 'org/cached' }]
    const storedIndex = {
      boards: [{ month: '2026-09', candidateCount: 1, lastSynced: '2026-09-16T10:00:00Z' }],
      lastSynced: '2026-09-16T10:00:00Z',
    }
    const { context, handlers, storage } = makeContext({
      storage: makeStorage({
        'ai-catalyst/index.json': storedIndex,
        'ai-catalyst/boards/2026-09.json': cachedBoard,
      }),
    })

    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() }
    await handlers['/sync']({}, res)

    expect(res.status).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'ok',
      synced: 0,
      total: 1,
      failed: [{ board: 'board-2026-09', error: expect.stringContaining('degraded') }],
    }))
    expect(storage.map.get('ai-catalyst/boards/2026-09.json')).toEqual(cachedBoard)
    expect(storage.map.get('ai-catalyst/index.json')).toEqual(storedIndex)

    const syncBoardsConfig = context.registerRefresh.mock.calls.find(c => c[0] === 'ai-catalyst:sync-boards')[1]
    await expect(syncBoardsConfig.handler()).rejects.toThrow(
      'Board sync failed for 1/1 boards — board-2026-09:',
    )
  })

  it('drops whitespace-only padding rows alongside real rows', async () => {
    stubFeedFeed({
      '/feed/boards.json': { boards: ['board-2026-09'] },
      '/feed/board.json?board=board-2026-09': {
        count: 2,
        rows: [
          { title: 'Real Entry', unique_id: 'org/real', impact_score: '8' },
          { title: ' ', unique_id: ' ' },
        ],
      },
    })
    const { handlers, storage } = makeContext()

    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() }
    await handlers['/sync']({}, res)

    expect(res.status).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'ok',
      synced: 1,
      total: 1,
      failed: [],
    }))
    expect(storage.map.get('ai-catalyst/boards/2026-09.json')).toEqual([
      expect.objectContaining({ title: 'Real Entry', uniqueId: 'org/real', impactScore: 8 }),
    ])
  })

  it('fails the board and preserves the cache when pm_review_history is not valid JSON', async () => {
    stubFeedFeed({
      '/feed/boards.json': { boards: ['board-2026-09'] },
      '/feed/board.json?board=board-2026-09': {
        count: 1,
        rows: [{ title: 'Broken History', unique_id: 'org/broken', pm_review_history: '{not-json' }],
      },
    })
    const cachedBoard = [{ title: 'Cached Entry', uniqueId: 'org/cached' }]
    const { handlers, storage } = makeContext({
      storage: makeStorage({
        'ai-catalyst/index.json': {
          boards: [{ month: '2026-09', candidateCount: 1, lastSynced: '2026-09-16T10:00:00Z' }],
          lastSynced: '2026-09-16T10:00:00Z',
        },
        'ai-catalyst/boards/2026-09.json': cachedBoard,
      }),
    })

    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() }
    await handlers['/sync']({}, res)

    expect(res.status).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'ok',
      synced: 0,
      total: 1,
      failed: [{ board: 'board-2026-09', error: expect.stringContaining('pm_review_history') }],
    }))
    expect(res.json.mock.calls[0][0].failed[0].error).toEqual(expect.stringContaining('Broken History'))
    expect(storage.map.get('ai-catalyst/boards/2026-09.json')).toEqual(cachedBoard)
  })

  it('fails the board when pm_review_history parses to a non-array', async () => {
    stubFeedFeed({
      '/feed/boards.json': { boards: ['board-2026-09'] },
      '/feed/board.json?board=board-2026-09': {
        count: 1,
        rows: [{ title: 'Object History', unique_id: 'org/object', pm_review_history: '{"reviewer":"a"}' }],
      },
    })
    const { handlers, storage } = makeContext()

    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() }
    await handlers['/sync']({}, res)

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'ok',
      synced: 0,
      total: 1,
      failed: [{ board: 'board-2026-09', error: expect.stringContaining('pm_review_history') }],
    }))
    expect(res.json.mock.calls[0][0].failed[0].error).toEqual(expect.stringContaining('Object History'))
    expect(storage.map.has('ai-catalyst/boards/2026-09.json')).toBe(false)
  })

  it('fails the board and preserves the cache when pm_review_history contains a null element', async () => {
    stubFeedFeed({
      '/feed/boards.json': { boards: ['board-2026-09'] },
      '/feed/board.json?board=board-2026-09': {
        count: 1,
        rows: [{ title: 'Null Element', unique_id: 'org/null-el', pm_review_history: '[null]' }],
      },
    })
    const cachedBoard = [{ title: 'Cached Entry', uniqueId: 'org/cached' }]
    const { handlers, storage } = makeContext({
      storage: makeStorage({
        'ai-catalyst/index.json': {
          boards: [{ month: '2026-09', candidateCount: 1, lastSynced: '2026-09-16T10:00:00Z' }],
          lastSynced: '2026-09-16T10:00:00Z',
        },
        'ai-catalyst/boards/2026-09.json': cachedBoard,
      }),
    })

    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() }
    await handlers['/sync']({}, res)

    expect(res.status).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'ok',
      synced: 0,
      total: 1,
      failed: [{ board: 'board-2026-09', error: expect.stringContaining('pm_review_history') }],
    }))
    expect(storage.writeToStorage).not.toHaveBeenCalledWith('ai-catalyst/boards/2026-09.json', expect.anything())
    expect(storage.map.get('ai-catalyst/boards/2026-09.json')).toBe(cachedBoard)
  })

  it('fails the board when a pm_review_history element has a non-string decision', async () => {
    stubFeedFeed({
      '/feed/boards.json': { boards: ['board-2026-09'] },
      '/feed/board.json?board=board-2026-09': {
        count: 1,
        rows: [{ title: 'Numeric Decision', unique_id: 'org/num-decision', pm_review_history: '[{"reviewer":"a","decision":5}]' }],
      },
    })
    const { handlers, storage } = makeContext()

    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() }
    await handlers['/sync']({}, res)

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'ok',
      synced: 0,
      total: 1,
      failed: [{ board: 'board-2026-09', error: expect.stringContaining('decision') }],
    }))
    expect(storage.map.has('ai-catalyst/boards/2026-09.json')).toBe(false)
  })

  it('accepts well-formed pm_review_history elements and an empty history array', async () => {
    stubFeedFeed({
      '/feed/boards.json': { boards: ['board-2026-09'] },
      '/feed/board.json?board=board-2026-09': {
        count: 2,
        rows: [
          { title: 'Good History', unique_id: 'org/good', pm_review_history: '[{"reviewer":"a","decision":"approve","timestamp":"2026-10-01T00:00:00Z"}]' },
          { title: 'Empty History', unique_id: 'org/empty', pm_review_history: '[]' },
        ],
      },
    })
    const { handlers, storage } = makeContext()

    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() }
    await handlers['/sync']({}, res)

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'ok',
      synced: 1,
      total: 1,
      failed: [],
    }))
    const board = storage.map.get('ai-catalyst/boards/2026-09.json')
    expect(board[0].pmReviewHistory).toEqual([
      { reviewer: 'a', decision: 'approve', timestamp: '2026-10-01T00:00:00Z' },
    ])
    expect(board[1].pmReviewHistory).toEqual([])
  })

  it('fails the board and preserves the cache when every row parses empty but count is positive', async () => {
    stubFeedFeed({
      '/feed/boards.json': { boards: ['board-2026-09'] },
      '/feed/board.json?board=board-2026-09': {
        count: 2,
        rows: [
          { title: '', unique_id: '', impact_score: '' },
          { title: '', unique_id: '', impact_score: '' },
        ],
      },
    })
    const cachedBoard = [{ title: 'Cached Entry', uniqueId: 'org/cached' }]
    const { handlers, storage } = makeContext({
      storage: makeStorage({
        'ai-catalyst/index.json': {
          boards: [{ month: '2026-09', candidateCount: 1, lastSynced: '2026-09-16T10:00:00Z' }],
          lastSynced: '2026-09-16T10:00:00Z',
        },
        'ai-catalyst/boards/2026-09.json': cachedBoard,
      }),
    })

    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() }
    await handlers['/sync']({}, res)

    expect(res.status).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'ok',
      synced: 0,
      total: 1,
      failed: [{ board: 'board-2026-09', error: expect.stringContaining('degraded') }],
    }))
    expect(storage.map.get('ai-catalyst/boards/2026-09.json')).toEqual(cachedBoard)
  })

  it('clears a populated cached month when the feed returns a valid empty snapshot', async () => {
    stubFeedFeed({
      '/feed/boards.json': { boards: ['board-2026-09'] },
      '/feed/board.json?board=board-2026-09': { count: 0, rows: [] },
    })
    const cachedBoard = [{ title: 'Cached Entry', uniqueId: 'org/cached' }]
    const storedIndex = {
      boards: [{ month: '2026-09', candidateCount: 1, lastSynced: '2026-09-16T10:00:00Z' }],
      lastSynced: '2026-09-16T10:00:00Z',
    }
    const { context, handlers, storage } = makeContext({
      storage: makeStorage({
        'ai-catalyst/index.json': storedIndex,
        'ai-catalyst/boards/2026-09.json': cachedBoard,
      }),
    })

    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() }
    await handlers['/sync']({}, res)

    expect(res.status).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'ok',
      synced: 1,
      total: 1,
      failed: [],
    }))
    expect(storage.map.get('ai-catalyst/boards/2026-09.json')).toEqual([])
    expect(storage.map.get('ai-catalyst/index.json').boards[0].candidateCount).toBe(0)
    expect(storage.map.get('ai-catalyst/index.json').lastSynced).not.toBe(storedIndex.lastSynced)

    const syncBoardsConfig = context.registerRefresh.mock.calls.find(c => c[0] === 'ai-catalyst:sync-boards')[1]
    await expect(syncBoardsConfig.handler()).resolves.toMatchObject({ status: 'success', synced: 1, failed: [] })
  })

  it('accepts a legitimately empty board with count 0 and no rows', async () => {
    stubFeedFeed({
      '/feed/boards.json': { boards: ['board-2026-09'] },
      '/feed/board.json?board=board-2026-09': { count: 0, rows: [] },
    })
    const { handlers, storage } = makeContext()

    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() }
    await handlers['/sync']({}, res)

    expect(res.status).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'ok',
      synced: 1,
      total: 1,
      failed: [],
    }))
    expect(storage.map.get('ai-catalyst/boards/2026-09.json')).toEqual([])
  })

  it('preserves the previous lastSynced for months that fail this run', async () => {
    stubFeedFeed({
      '/feed/boards.json': FEED_BOARDS_PAYLOAD,
      '/feed/board.json?board=board-2026-10': BOARD_2026_10_PAYLOAD,
    })
    const { handlers, storage } = makeContext({
      storage: makeStorage({
        'ai-catalyst/index.json': {
          boards: [{ month: '2026-09', candidateCount: 2, lastSynced: '2026-09-16T10:00:00Z' }],
          lastSynced: '2026-09-16T10:00:00Z',
        },
        'ai-catalyst/boards/2026-09.json': [{ title: 'September Entry' }],
      }),
    })

    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() }
    await handlers['/sync']({}, res)

    const index = storage.map.get('ai-catalyst/index.json')
    expect(index.boards.map(b => b.month)).toEqual(['2026-10', '2026-09'])
    expect(index.boards[0].lastSynced).toEqual(expect.any(String))
    expect(index.boards[0].lastSynced).not.toBe('2026-09-16T10:00:00Z')
    expect(index.boards[1]).toMatchObject({ month: '2026-09', candidateCount: 1 })
    expect(index.boards[1].lastSynced).toBe('2026-09-16T10:00:00Z')
    expect(index.lastSynced).toBe('2026-09-16T10:00:00Z')
  })

  it('stamps a fresh index lastSynced only when every board syncs', async () => {
    stubFeedFeed({
      '/feed/boards.json': { boards: ['board-2026-10'] },
      '/feed/board.json?board=board-2026-10': BOARD_2026_10_PAYLOAD,
    })
    const { handlers, storage } = makeContext()

    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() }
    await handlers['/sync']({}, res)

    const index = storage.map.get('ai-catalyst/index.json')
    expect(index.lastSynced).toEqual(expect.any(String))
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'ok', synced: 1, failed: [] }))
  })

  it('rejects the refresh handler when boards fail so the registry retries', async () => {
    stubFeedFeed({
      '/feed/boards.json': FEED_BOARDS_PAYLOAD,
      '/feed/board.json?board=board-2026-09': BOARD_2026_09_PAYLOAD,
    })
    const { context } = makeContext()
    const syncBoardsConfig = context.registerRefresh.mock.calls.find(c => c[0] === 'ai-catalyst:sync-boards')[1]

    await expect(syncBoardsConfig.handler()).rejects.toThrow(
      'Board sync failed for 1/2 boards — board-2026-10: unknown board (1 known)',
    )
  })

  it('rejects the refresh handler when a board name is garbage so the registry retries', async () => {
    stubFeedFeed({
      '/feed/boards.json': { boards: ['board-2026-09', 'garbage'] },
      '/feed/board.json?board=board-2026-09': BOARD_2026_09_PAYLOAD,
    })
    const { context } = makeContext()
    const syncBoardsConfig = context.registerRefresh.mock.calls.find(c => c[0] === 'ai-catalyst:sync-boards')[1]

    await expect(syncBoardsConfig.handler()).rejects.toThrow(
      'Board sync failed for 1/2 boards — garbage: board name does not match board-YYYY-MM',
    )
  })

  it('fails the run instead of skipping when every listed board name is garbage', async () => {
    stubFeedFeed({ '/feed/boards.json': { boards: ['garbage'] } })
    const { context } = makeContext()
    const syncBoardsConfig = context.registerRefresh.mock.calls.find(c => c[0] === 'ai-catalyst:sync-boards')[1]

    await expect(syncBoardsConfig.handler()).rejects.toThrow(
      'Board sync failed for 1/1 boards — garbage: board name does not match board-YYYY-MM',
    )
  })

  it('returns success from the refresh handler when every board syncs', async () => {
    stubFeedFeed({
      '/feed/boards.json': { boards: ['board-2026-09'] },
      '/feed/board.json?board=board-2026-09': BOARD_2026_09_PAYLOAD,
    })
    const { context } = makeContext()
    const syncBoardsConfig = context.registerRefresh.mock.calls.find(c => c[0] === 'ai-catalyst:sync-boards')[1]

    await expect(syncBoardsConfig.handler()).resolves.toMatchObject({
      status: 'success',
      synced: 1,
      total: 1,
      failed: [],
    })
  })

  it('returns a skip instead of burning the cadence when the feed lists no boards', async () => {
    stubFeedFeed({ '/feed/boards.json': { boards: [] } })
    const { handlers, storage } = makeContext()

    const res = { json: vi.fn(), status: vi.fn() }
    await handlers['/sync']({}, res)

    expect(res.json).toHaveBeenCalledWith({ status: 'skipped', reason: 'feed returned no boards' })
    expect(storage.writeToStorage).not.toHaveBeenCalled()
  })

  it('passes the empty-board-list skip through the boards refresh handler', async () => {
    stubFeedFeed({ '/feed/boards.json': { boards: [] } })
    const { context } = makeContext()
    const syncBoardsConfig = context.registerRefresh.mock.calls.find(c => c[0] === 'ai-catalyst:sync-boards')[1]

    await expect(syncBoardsConfig.handler()).resolves.toEqual({ status: 'skipped', reason: 'feed returned no boards' })
  })

  it('skips syncing when no feed token is configured', async () => {
    const fetchMock = stubFeedFeed({})
    const { handlers } = makeContext({ context: { secrets: {} } })

    const res = { json: vi.fn(), status: vi.fn() }
    await handlers['/sync']({}, res)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith({ status: 'skipped', reason: 'not configured' })
  })

  it('reports an in-flight sync as skipped instead of counting it as success', async () => {
    let releaseBoards
    const gate = new Promise(resolve => { releaseBoards = resolve })
    const fetchMock = vi.fn(async url => {
      if (String(url).endsWith('/feed/boards.json')) await gate
      return jsonResponse(200, { boards: [] })
    })
    vi.stubGlobal('fetch', fetchMock)
    const { handlers } = makeContext()

    const first = handlers['/sync']({}, { json: vi.fn(), status: vi.fn() })
    // Let the first call enter its fetch before racing it with a second one.
    await new Promise(resolve => setTimeout(resolve, 0))
    const secondRes = { json: vi.fn(), status: vi.fn() }
    await handlers['/sync']({}, secondRes)

    expect(secondRes.json).toHaveBeenCalledWith({ status: 'skipped', reason: 'sync already running' })
    releaseBoards()
    await first
  })

  it('skips the boards refresh handler when the feed is not configured', async () => {
    const { context } = makeContext({ context: { secrets: {} } })
    const syncBoardsConfig = context.registerRefresh.mock.calls.find(c => c[0] === 'ai-catalyst:sync-boards')[1]

    await expect(syncBoardsConfig.handler()).resolves.toEqual({ status: 'skipped', reason: 'not configured' })
  })

  it('skips the showcase refresh handler when the feed is not configured', async () => {
    const { context } = makeContext({ context: { secrets: {} } })
    const showcaseConfig = context.registerRefresh.mock.calls.find(c => c[0] === 'ai-catalyst:showcase-sync')[1]

    await expect(showcaseConfig.handler()).resolves.toEqual({ status: 'skipped', reason: 'not configured' })
  })

  it('reports feed configuration status', async () => {
    const { handlers } = makeContext()

    const res = { json: vi.fn(), status: vi.fn() }
    await handlers['/config']({}, res)

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ configured: true }))
  })

  it('reports unconfigured status without a token', async () => {
    const { handlers } = makeContext({ context: { secrets: {} } })

    const res = { json: vi.fn(), status: vi.fn() }
    await handlers['/config']({}, res)

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ configured: false }))
  })

  it('does not inherit a developer feed token in an unconfigured test context', async () => {
    vi.stubEnv('POC_EXPLORER_FEED_TOKEN', 'ambient-token-not-for-tests')
    const { handlers } = makeContext({ context: { secrets: {} } })
    const res = { json: vi.fn() }

    await handlers['/config']({}, res)

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ configured: false }))
  })

  it('saves and reloads the board feed URL override', async () => {
    const { handlers, storage } = makeContext()

    const saveRes = { json: vi.fn(), status: vi.fn().mockReturnThis() }
    await handlers['/board-config'](
      { body: { feedUrl: 'https://showcase.redhataicatalyst.com' } },
      saveRes
    )
    expect(saveRes.json).toHaveBeenCalledWith({ status: 'saved' })

    const { handlers: reloaded } = makeContext({ storage })
    const fetchMock = stubFeedFeed(
      { '/feed/boards.json': { boards: [] } },
      { url: 'https://showcase.redhataicatalyst.com' }
    )
    const res = { json: vi.fn(), status: vi.fn() }
    await reloaded['/sync']({}, res)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://showcase.redhataicatalyst.com/feed/boards.json',
      expect.anything()
    )
    expect(res.json).toHaveBeenCalledWith({ status: 'skipped', reason: 'feed returned no boards' })
  })

  it('rejects stored board feed URLs with unapproved origins before fetching', async () => {
    const fetchMock = stubFeedFeed({})
    const { handlers } = makeContext({
      storage: makeStorage({
        'ai-catalyst/board-config.json': { feedUrl: 'https://evil.example.test' },
      }),
    })

    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() }
    await handlers['/sync']({}, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({
      error: expect.stringContaining('not an approved origin'),
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('honors stored loopback board feed URLs when POC_EXPLORER_ALLOW_LOOPBACK is set', async () => {
    const fetchMock = stubFeedFeed(
      { '/feed/boards.json': { boards: [] } },
      { url: 'http://127.0.0.1:4567' }
    )
    const { handlers } = makeContext({
      context: { resolveSecret: vi.fn(key => key === 'POC_EXPLORER_ALLOW_LOOPBACK' ? '1' : undefined) },
      storage: makeStorage({
        'ai-catalyst/board-config.json': { feedUrl: 'http://127.0.0.1:4567' },
      }),
    })

    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() }
    await handlers['/sync']({}, res)

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:4567/feed/boards.json',
      expect.anything()
    )
    expect(res.json).toHaveBeenCalledWith({ status: 'skipped', reason: 'feed returned no boards' })
  })

  it('rejects stored loopback board feed URLs unless POC_EXPLORER_ALLOW_LOOPBACK is set', async () => {
    // Hermetic: a developer who exports the flag for local spec runs must
    // not flip this test.
    vi.stubEnv('POC_EXPLORER_ALLOW_LOOPBACK', '')
    const fetchMock = stubFeedFeed({})
    const { handlers } = makeContext({
      storage: makeStorage({
        'ai-catalyst/board-config.json': { feedUrl: 'http://127.0.0.1:4567' },
      }),
    })

    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() }
    await handlers['/sync']({}, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({
      error: expect.stringContaining('POC_EXPLORER_ALLOW_LOOPBACK'),
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects non-string feed URLs in board config', async () => {
    const { handlers } = makeContext()

    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() }
    await handlers['/board-config']({ body: { feedUrl: 123 } }, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'feedUrl must be a string' })
  })
})

describe('ai-catalyst showcase feed URL resolution', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    showcase.clearCache()
    vi.restoreAllMocks()
  })

  it.each(['manual', 'scheduled'])('preserves warm showcase data after a failed %s refresh and PVC outage', async mode => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    stubFeedFeed({ '/feed/showcase.json': {
      showcase_entries: [{ slug: 'preserved', title: 'Preserved catalog' }], strategy_pillars: [],
    } }, { url: 'https://showcase.redhataicatalyst.com' })
    const storage = makeStorage()
    showcase.clearCache()
    await showcase.fetchShowcaseData('https://showcase.redhataicatalyst.com', 'token-123', storage)
    storage.writeToStorage.mockRejectedValue(new Error('EIO write'))
    storage.readFromStorage.mockImplementation(async key => {
      if (key === showcase.STORAGE_KEY) throw new Error('EIO read')
      return null
    })
    const { handlers, context } = makeContext({ storage })
    if (mode === 'manual') {
      const failed = { json: vi.fn(), status: vi.fn().mockReturnThis() }
      await handlers['/showcase/refresh']({}, failed)
      expect(failed.status).toHaveBeenCalledWith(500)
    } else {
      const refresh = context.registerRefresh.mock.calls.find(c => c[0] === 'ai-catalyst:showcase-sync')[1]
      await expect(refresh.handler()).rejects.toThrow('EIO write')
    }

    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() }
    await handlers['/showcase/entries']({}, res)

    expect(res.status).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ entries: [expect.objectContaining({ slug: 'preserved' })] }))
  })

  it.each(['/showcase/entries', '/showcase/entries/:slug'])('serves %s from warm memory when every storage read fails', async route => {
    stubFeedFeed({ '/feed/showcase.json': {
      showcase_entries: [{ slug: 'preserved', title: 'Preserved catalog' }], strategy_pillars: [],
    } }, { url: 'https://showcase.redhataicatalyst.com' })
    const storage = makeStorage()
    showcase.clearCache()
    await showcase.fetchShowcaseData('https://showcase.redhataicatalyst.com', 'token-123', storage)
    storage.readFromStorage.mockRejectedValue(new Error('EIO read'))
    const { handlers } = makeContext({ storage })
    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() }

    await handlers[route]({ params: { slug: 'preserved' } }, res)

    expect(res.status).not.toHaveBeenCalled()
    expect(res.json.mock.calls[0][0]).toMatchObject(route.endsWith(':slug')
      ? { entry: { slug: 'preserved' } } : { entries: [{ slug: 'preserved' }] })
  })

  it('defaults the showcase feed to the showcase host', async () => {
    const fetchMock = stubFeedFeed(
      { '/feed/showcase.json': SHOWCASE_FEED_PAYLOAD },
      { url: 'https://showcase.redhataicatalyst.com' }
    )
    const { handlers } = makeContext()

    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() }
    await handlers['/showcase/refresh']({}, res)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://showcase.redhataicatalyst.com/feed/showcase.json',
      expect.objectContaining({ headers: { Authorization: 'Bearer token-123' } })
    )
    expect(res.status).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'refreshed' }))
  })

  it('does not apply POC_EXPLORER_FEED_URL to the showcase feed', async () => {
    const fetchMock = stubFeedFeed(
      { '/feed/showcase.json': SHOWCASE_FEED_PAYLOAD },
      { url: 'https://showcase.redhataicatalyst.com' }
    )
    const { handlers } = makeContext({
      context: {
        secrets: { POC_EXPLORER_FEED_TOKEN: 'token-123', POC_EXPLORER_FEED_URL: 'https://boards.example.test' },
      },
    })

    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() }
    await handlers['/showcase/refresh']({}, res)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://showcase.redhataicatalyst.com/feed/showcase.json',
      expect.anything()
    )
    expect(res.status).not.toHaveBeenCalled()
  })

  it('overrides the showcase default with the POC_EXPLORER_SHOWCASE_FEED_URL secret', async () => {
    const fetchMock = stubFeedFeed(
      { '/feed/showcase.json': SHOWCASE_FEED_PAYLOAD },
      { url: 'https://showcase-staging.example.test' }
    )
    const { handlers } = makeContext({
      context: {
        secrets: { POC_EXPLORER_FEED_TOKEN: 'token-123', POC_EXPLORER_SHOWCASE_FEED_URL: 'https://showcase-staging.example.test' },
      },
    })

    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() }
    await handlers['/showcase/refresh']({}, res)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://showcase-staging.example.test/feed/showcase.json',
      expect.anything()
    )
    expect(res.status).not.toHaveBeenCalled()
  })

  it('prefers the stored showcase config over the showcase secret', async () => {
    const fetchMock = stubFeedFeed(
      { '/feed/showcase.json': SHOWCASE_FEED_PAYLOAD },
      { url: 'https://pocexplorer.redhataicatalyst.com' }
    )
    const { handlers } = makeContext({
      storage: makeStorage({
        'ai-catalyst/showcase/config.json': { feedUrl: 'https://pocexplorer.redhataicatalyst.com' },
      }),
      context: {
        secrets: { POC_EXPLORER_FEED_TOKEN: 'token-123', POC_EXPLORER_SHOWCASE_FEED_URL: 'https://showcase-staging.example.test' },
      },
    })

    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() }
    await handlers['/showcase/refresh']({}, res)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://pocexplorer.redhataicatalyst.com/feed/showcase.json',
      expect.anything()
    )
    expect(res.status).not.toHaveBeenCalled()
  })

  it('rejects stored showcase feed URLs with unapproved origins before fetching', async () => {
    const fetchMock = stubFeedFeed({})
    const { handlers } = makeContext({
      storage: makeStorage({
        'ai-catalyst/showcase/config.json': { feedUrl: 'https://evil.example.test' },
      }),
    })

    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() }
    await handlers['/showcase/refresh']({}, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({
      error: 'Failed to refresh from POC Explorer feed',
      details: expect.stringContaining('not an approved origin'),
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('throws from the showcase refresh handler when the feed serves malformed rows', async () => {
    stubFeedFeed(
      { '/feed/showcase.json': { showcase_entries: [null], strategy_pillars: [] } },
      { url: 'https://showcase.redhataicatalyst.com' }
    )
    const { context } = makeContext()
    const showcaseConfig = context.registerRefresh.mock.calls.find(c => c[0] === 'ai-catalyst:showcase-sync')[1]

    // Throwing is the refresh registry's retry mechanism — a returned value
    // would count the malformed sync as successful.
    await expect(showcaseConfig.handler()).rejects.toThrow('showcase_entries')
  })

  it('reports manual showcase refresh failure and preserves stored data on malformed rows', async () => {
    stubFeedFeed(
      { '/feed/showcase.json': { showcase_entries: [null], strategy_pillars: [] } },
      { url: 'https://showcase.redhataicatalyst.com' }
    )
    const stored = {
      entries: [{ slug: 'stored-entry', status: 'active', strategyPillarKey: 'model-inference' }],
      pillars: [],
      fetchedAt: '2026-09-01T00:00:00Z',
    }
    const storage = makeStorage({ 'ai-catalyst/showcase/showcase-data.json': stored })
    const { handlers } = makeContext({ storage })

    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() }
    await handlers['/showcase/refresh']({}, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({
      error: 'Failed to refresh from POC Explorer feed',
      details: expect.stringContaining('showcase_entries'),
    })
    expect(storage.writeToStorage).not.toHaveBeenCalled()
    expect(storage.map.get('ai-catalyst/showcase/showcase-data.json')).toBe(stored)

    // Reads after the failed refresh serve the preserved stored catalog.
    const entriesRes = { json: vi.fn(), status: vi.fn() }
    await handlers['/showcase/entries']({}, entriesRes)
    expect(entriesRes.json).toHaveBeenCalledWith(expect.objectContaining({
      entries: [expect.objectContaining({ slug: 'stored-entry' })],
      fetchedAt: '2026-09-01T00:00:00Z',
    }))
  })

  it('keeps the board feed on POC_EXPLORER_FEED_URL', async () => {
    const fetchMock = stubFeedFeed(
      { '/feed/boards.json': { boards: [] } },
      { url: 'https://boards.example.test' }
    )
    const { handlers } = makeContext({
      context: {
        secrets: { POC_EXPLORER_FEED_TOKEN: 'token-123', POC_EXPLORER_FEED_URL: 'https://boards.example.test' },
      },
    })

    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() }
    await handlers['/sync']({}, res)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://boards.example.test/feed/boards.json',
      expect.anything()
    )
    expect(res.json).toHaveBeenCalledWith({ status: 'skipped', reason: 'feed returned no boards' })
  })
})
