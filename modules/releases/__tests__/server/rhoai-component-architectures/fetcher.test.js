import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const yaml = require('js-yaml')
const { _setFetch: setMaturityFetch } = require('../../../server/rhoai-component-architectures/maturity-mapping')
const { registerRhoaiComponentArchitecturesFetcher, _setOctokit, parseBranch, sortBranches, branchesFromRegistry } = require('../../../server/rhoai-component-architectures/fetcher')

const mockGetContent = vi.fn()
const mockMaturityFetch = vi.fn()

function MockOctokit() {
  return { rest: { repos: { getContent: mockGetContent } } }
}

beforeEach(() => {
  vi.clearAllMocks()
  setMaturityFetch(mockMaturityFetch)
  _setOctokit(MockOctokit)
})

afterEach(() => {
  setMaturityFetch(globalThis.fetch)
})

function makeStorage(data = {}) {
  const store = { ...data }
  return {
    readFromStorage: vi.fn(async (key) => store[key] ? JSON.parse(JSON.stringify(store[key])) : null),
    writeToStorage: vi.fn(async (key, value) => { store[key] = value }),
    _store: store
  }
}

function makeRouter() {
  const routes = { get: {}, post: {} }
  return {
    get: vi.fn(function (path, ...handlers) { routes.get[path] = handlers }),
    post: vi.fn(function (path, ...handlers) { routes.post[path] = handlers }),
    _routes: routes
  }
}

function makeRes() {
  const res = {
    _status: 200,
    _json: null,
    status(code) { res._status = code; return res },
    json(data) { res._json = data; return res }
  }
  return res
}

function makeReq(query = {}) {
  return { query }
}

const SAMPLE_YAML = yaml.dump({
  components: [
    { name: 'odh-kserve-controller-rhel9', 'build-platforms': ['linux/x86_64', 'linux-m2xlarge/arm64'] },
    { name: 'odh-dashboard-rhel9', 'build-platforms': ['linux/x86_64'] }
  ]
})

function setupOctokit() {
  mockGetContent.mockResolvedValue({
    data: { content: Buffer.from(SAMPLE_YAML).toString('base64') }
  })
}

function makeMaturityResponse(components) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ components })
  }
}

const MATURITY_COMPONENTS = [
  {
    name: 'Serving Orchestration',
    id: 'serving',
    images: ['quay.io/rhoai/odh-kserve-controller-rhel9']
  },
  {
    name: 'AI Core Dashboard',
    id: 'dashboard',
    images: ['quay.io/rhoai/odh-dashboard-rhel9']
  }
]

const REGISTRY_KEY = 'releases/registry.json'
const STORAGE_KEY = 'releases/rhoai-component-architectures/latest.json'

describe('rhoai-component-architectures fetcher integration', () => {
  it('adds productComponent when maturity fetch succeeds', async () => {
    setupOctokit()
    mockMaturityFetch.mockResolvedValueOnce(makeMaturityResponse(MATURITY_COMPONENTS))

    const storage = makeStorage({
      [REGISTRY_KEY]: { releases: [{ id: 'rhoai-3.5' }] }
    })
    const router = makeRouter()

    registerRhoaiComponentArchitecturesFetcher(router, {
      storage,
      requireAuth: (req, res, next) => next(),
      requireScope: () => (req, res, next) => next(),
      secrets: { GITHUB_TOKEN: 'gh-token', GITLAB_CEE_TOKEN: 'gl-token' }
    })

    const handler = router._routes.post['/refresh'].pop()
    const res = makeRes()
    await handler(makeReq(), res)

    expect(res._json.status).toBe('ok')
    expect(res._json.maturity.available).toBe(true)

    const stored = storage._store[STORAGE_KEY]
    const branch = stored.branches['rhoai-3.5']
    const kserve = branch.components.find(c => c.imageName === 'odh-kserve-controller-rhel9')
    expect(kserve.productComponent).toBe('Serving Orchestration')
  })

  it('continues when maturity fetch fails', async () => {
    setupOctokit()
    mockMaturityFetch.mockRejectedValueOnce(new Error('GitLab down'))

    const storage = makeStorage({
      [REGISTRY_KEY]: { releases: [{ id: 'rhoai-3.5' }] }
    })
    const router = makeRouter()

    registerRhoaiComponentArchitecturesFetcher(router, {
      storage,
      requireAuth: (req, res, next) => next(),
      requireScope: () => (req, res, next) => next(),
      secrets: { GITHUB_TOKEN: 'gh-token', GITLAB_CEE_TOKEN: 'gl-token' }
    })

    const handler = router._routes.post['/refresh'].pop()
    const res = makeRes()
    await handler(makeReq(), res)

    expect(res._json.status).toBe('ok')
    expect(res._json.maturity.available).toBe(false)
    expect(res._json.maturity.warning).toContain('GitLab down')
  })

  it('fetches maturity without token when GITLAB_CEE_TOKEN is not set', async () => {
    setupOctokit()
    mockMaturityFetch.mockResolvedValueOnce(makeMaturityResponse(MATURITY_COMPONENTS))

    const storage = makeStorage({
      [REGISTRY_KEY]: { releases: [{ id: 'rhoai-3.5' }] }
    })
    const router = makeRouter()

    registerRhoaiComponentArchitecturesFetcher(router, {
      storage,
      requireAuth: (req, res, next) => next(),
      requireScope: () => (req, res, next) => next(),
      secrets: { GITHUB_TOKEN: 'gh-token' }
    })

    const handler = router._routes.post['/refresh'].pop()
    const res = makeRes()
    await handler(makeReq(), res)

    expect(res._json.status).toBe('ok')
    expect(res._json.maturity.available).toBe(true)
    expect(mockMaturityFetch).toHaveBeenCalledTimes(1)
    const [, fetchOptions] = mockMaturityFetch.mock.calls[0]
    expect(fetchOptions.headers).toBeUndefined()
  })

  it('never produces the legacy GITLAB_CEE_TOKEN warning string', async () => {
    // Regression guard: commit 15f2c926 accidentally reverted the fix that
    // removed the GITLAB_CEE_TOKEN gate. Maturity is always fetched now.
    setupOctokit()
    mockMaturityFetch.mockResolvedValueOnce(makeMaturityResponse(MATURITY_COMPONENTS))

    const storage = makeStorage({
      [REGISTRY_KEY]: { releases: [{ id: 'rhoai-3.5' }] }
    })
    const router = makeRouter()

    registerRhoaiComponentArchitecturesFetcher(router, {
      storage,
      requireAuth: (req, res, next) => next(),
      requireScope: () => (req, res, next) => next(),
      secrets: { GITHUB_TOKEN: 'gh-token' }
    })

    const handler = router._routes.post['/refresh'].pop()
    const res = makeRes()
    await handler(makeReq(), res)

    expect(res._json.maturity.warning).toBeNull()
    expect(res._json.maturity.available).toBe(true)
    expect(mockMaturityFetch).toHaveBeenCalledTimes(1)
  })

  it('preserves cached maturity on partial failure', async () => {
    setupOctokit()
    mockMaturityFetch.mockRejectedValueOnce(new Error('timeout'))

    const oldData = {
      fetchedAt: '2026-08-17T10:00:00.000Z',
      source: { owner: 'red-hat-data-services', repo: 'konflux-central' },
      branches: {
        'rhoai-3.5': {
          components: [
            { name: 'odh-kserve-controller', imageName: 'odh-kserve-controller-rhel9', productComponent: 'Serving Orchestration' }
          ],
          reportAvailable: true
        }
      },
      maturity: {
        available: true,
        fetchedAt: '2026-08-17T10:00:00.000Z',
        warning: null,
        allProductComponents: [{ name: 'Serving Orchestration', owner: null, team: null }]
      }
    }

    const storage = makeStorage({
      [REGISTRY_KEY]: { releases: [{ id: 'rhoai-3.5' }] },
      [STORAGE_KEY]: oldData
    })
    const router = makeRouter()

    registerRhoaiComponentArchitecturesFetcher(router, {
      storage,
      requireAuth: (req, res, next) => next(),
      requireScope: () => (req, res, next) => next(),
      secrets: { GITHUB_TOKEN: 'gh-token', GITLAB_CEE_TOKEN: 'gl-token' }
    })

    const handler = router._routes.post['/refresh'].pop()
    const res = makeRes()
    await handler(makeReq(), res)

    const stored = storage._store[STORAGE_KEY]
    expect(stored.maturity.available).toBe(true)
    expect(stored.maturity.allProductComponents).toEqual([{ name: 'Serving Orchestration', owner: null, team: null }])

    const kserve = stored.branches['rhoai-3.5'].components.find(c => c.imageName === 'odh-kserve-controller-rhel9')
    expect(kserve.productComponent).toBe('Serving Orchestration')
  })
})

describe('fetchBranchReport normalization', () => {
  const { fetchBranchReport } = require('../../../server/rhoai-component-architectures/fetcher')

  function octokitReturning(yamlObj) {
    return {
      rest: {
        repos: {
          getContent: vi.fn(async () => ({
            data: { content: Buffer.from(yaml.dump(yamlObj)).toString('base64') }
          }))
        }
      }
    }
  }

  it('guarantees every component has an architectures object (missing key)', async () => {
    // Regression (RHOAIENG-84746): a component without an architectures key
    // crashed the client, which indexes comp.architectures[arch].
    const octokit = octokitReturning({
      components: [
        { name: 'odh-no-arch', imageName: 'odh-no-arch' },
        { name: 'odh-synth-rhel9', 'build-platforms': ['linux/x86_64'] }
      ]
    })

    const report = await fetchBranchReport(octokit, 'rhoai-3.5')

    for (const comp of report.components) {
      expect(comp.architectures).toBeDefined()
      expect(typeof comp.architectures).toBe('object')
      expect(comp.architectures).not.toBeNull()
    }
  })

  it('preserves an existing architectures object', async () => {
    const octokit = octokitReturning({
      components: [
        { name: 'odh-x', imageName: 'odh-x', architectures: { amd64: { status: 'supported' } } }
      ]
    })

    const report = await fetchBranchReport(octokit, 'rhoai-3.5')

    expect(report.components[0].architectures).toEqual({ amd64: { status: 'supported' } })
  })
})

describe('parseBranch + sortBranches', () => {
  it('parses GA branch', () => {
    expect(parseBranch('rhoai-3.5')).toEqual({ major: 3, minor: 5, eaNum: Infinity })
  })

  it('parses EA branch', () => {
    expect(parseBranch('rhoai-3.6-ea.2')).toEqual({ major: 3, minor: 6, eaNum: 2 })
  })

  it('returns zeroed result for unrecognized format', () => {
    expect(parseBranch('unknown-branch')).toEqual({ major: 0, minor: 0, eaNum: 0 })
  })

  it('sorts branches latest-first, with EA before its GA', () => {
    const input = ['rhoai-3.5', 'rhoai-3.6-ea.1', 'rhoai-3.5-ea.2', 'rhoai-3.5-ea.1', 'rhoai-3.6']
    const expected = ['rhoai-3.6', 'rhoai-3.6-ea.1', 'rhoai-3.5', 'rhoai-3.5-ea.2', 'rhoai-3.5-ea.1']
    expect(sortBranches(input)).toEqual(expected)
  })

  it('sorts newer versioned branches before legacy branches', () => {
    const input = ['rhoai-2.25', 'rhoai-3.5']
    const expected = ['rhoai-3.5', 'rhoai-2.25']
    expect(sortBranches(input)).toEqual(expected)
  })

  it('branchesFromRegistry returns latest-first order with legacy branches', () => {
    const registry = {
      releases: [
        { id: 'rhai-3.6-ga' },
        { id: 'rhai-3.5-ea1' },
        { id: 'rhai-3.5-ga' },
        { id: 'rhai-3.5-ea2' }
      ]
    }
    const result = branchesFromRegistry(registry)
    expect(result).toEqual([
      'rhoai-3.6',
      'rhoai-3.5',
      'rhoai-3.5-ea.2',
      'rhoai-3.5-ea.1',
      'rhoai-3.3',
      'rhoai-2.25'
    ])
  })
})
