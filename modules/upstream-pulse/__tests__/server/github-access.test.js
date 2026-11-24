import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const registerRoutes = (await import('../../server/index.js')).default
const { normalizeGithubAccess, resetGithubAccessCache } = registerRoutes

const BASE_CONTEXT = {
  registerScopes: vi.fn(),
  registerRole: vi.fn(),
  requireRole: vi.fn(() => vi.fn()),
  requireScope: () => (req, res, next) => next(),
  storage: { readFromStorage: vi.fn().mockResolvedValue(null) },
}

function makeContext(overrides = {}) {
  return {
    ...BASE_CONTEXT,
    secrets: { GITLAB_TOKEN: 'test-token', GITLAB_TEAM_DATA_PROJECT_ID: '123' },
    ...overrides,
  }
}

function captureGithubAccessHandler(context) {
  const handlers = {}
  const router = {
    get: vi.fn((path, ...args) => { handlers[path] = args[args.length - 1] }),
    post: vi.fn(),
    patch: vi.fn(),
  }
  registerRoutes(router, context)
  return handlers['/github-access']
}

function makeResponse() {
  const res = { status: vi.fn(), json: vi.fn() }
  res.status.mockReturnValue(res)
  return res
}

function gitlabResponse(payload, ok = true, status = 200) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(payload),
    text: vi.fn().mockResolvedValue('gitlab error'),
  }
}

beforeEach(() => {
  resetGithubAccessCache()
  vi.restoreAllMocks()
  process.env.DEMO_MODE = 'false'
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.DEMO_MODE
})

describe('normalizeGithubAccess', () => {
  it('passes through v1 counts without members', () => {
    expect(normalizeGithubAccess({ write: 8, triage: 6, total: 45 })).toEqual({
      write: 8,
      triage: 6,
      total: 45,
      members: null,
      updatedAt: null,
      schemaVersion: 1,
    })
  })

  it('derives counts from grouped members', () => {
    const result = normalizeGithubAccess({
      total: 45,
      updatedAt: '2026-11-24',
      schemaVersion: 2,
      members: {
        write: ['Alex Kim', { name: 'Jordan Lee' }],
        triage: ['Sam Rivera'],
      },
    })

    expect(result).toMatchObject({
      write: 2,
      triage: 1,
      total: 45,
      updatedAt: '2026-11-24',
      schemaVersion: 2,
      members: {
        write: [{ name: 'Alex Kim' }, { name: 'Jordan Lee' }],
        triage: [{ name: 'Sam Rivera' }],
      },
    })
  })

  it('deduplicates members and keeps write over triage', () => {
    const result = normalizeGithubAccess({
      total: 10,
      members: {
        write: [
          { name: 'Alex Kim', githubUsername: 'akim' },
          { name: 'Alex Kim', githubUsername: 'akim' },
        ],
        triage: [{ githubUsername: 'AKIM' }, { githubUsername: 'srivera' }],
      },
    })

    expect(result.write).toBe(1)
    expect(result.members.triage).toEqual([{ githubUsername: 'srivera' }])
  })

  it('warns when declared counts disagree with members', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    normalizeGithubAccess({
      write: 9,
      triage: 6,
      total: 10,
      members: { write: ['Alex Kim'], triage: [] },
    })

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('write count does not match'),
      expect.anything()
    )
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('triage count does not match'),
      expect.anything()
    )
  })

  it('returns null when total is missing', () => {
    expect(normalizeGithubAccess({ write: 1, triage: 1 })).toBeNull()
  })

  it('returns null when neither counts nor members are present', () => {
    expect(normalizeGithubAccess({ total: 10 })).toBeNull()
  })

  it('returns null for invalid payloads', () => {
    expect(normalizeGithubAccess(null)).toBeNull()
    expect(normalizeGithubAccess([])).toBeNull()
  })
})

describe('GET /github-access', () => {
  it('returns normalized counts and members', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(gitlabResponse({
      total: 45,
      updatedAt: '2026-11-24',
      members: { write: ['Alex Kim'], triage: ['Sam Rivera'] },
    })))

    const res = makeResponse()
    await captureGithubAccessHandler(makeContext())({ query: {} }, res)

    expect(res.status).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      write: 1,
      triage: 1,
      total: 45,
      updatedAt: '2026-11-24',
      members: {
        write: [{ name: 'Alex Kim' }],
        triage: [{ name: 'Sam Rivera' }],
      },
    }))
  })

  it('returns 503 when the GitLab token is not configured', async () => {
    const res = makeResponse()
    await captureGithubAccessHandler(makeContext({ secrets: {} }))({ query: {} }, res)

    expect(res.status).toHaveBeenCalledWith(503)
  })

  it('returns 502 when GitLab fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(gitlabResponse(null, false, 500)))

    const res = makeResponse()
    await captureGithubAccessHandler(makeContext())({ query: {} }, res)

    expect(res.status).toHaveBeenCalledWith(502)
  })

  it('caches the normalized payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue(gitlabResponse({ write: 1, triage: 1, total: 2 }))
    vi.stubGlobal('fetch', fetchMock)

    const handler = captureGithubAccessHandler(makeContext())
    await handler({ query: {} }, makeResponse())
    await handler({ query: {} }, makeResponse())

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('serves demo members without calling GitLab', async () => {
    process.env.DEMO_MODE = 'true'
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const res = makeResponse()
    await captureGithubAccessHandler(makeContext({ secrets: {} }))({ query: {} }, res)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      members: expect.objectContaining({
        write: expect.any(Array),
        triage: expect.any(Array),
      }),
    }))
  })
})
