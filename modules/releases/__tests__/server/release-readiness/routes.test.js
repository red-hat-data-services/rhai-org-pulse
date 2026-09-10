import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const registerRoutes = require('../../../server/release-readiness/routes')

describe('release readiness default release', () => {
  let handler
  let storage

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-07T12:00:00Z'))
    storage = { listStorageFiles: vi.fn(), readFromStorage: vi.fn() }
    const router = {
      get: (path, ...handlers) => { if (path === '/versions') handler = handlers.at(-1) },
      post: vi.fn()
    }
    registerRoutes(router, { storage, requireAuth: vi.fn(), requireScope: () => vi.fn() })
  })

  afterEach(() => vi.useRealTimers())

  async function getVersions(entries) {
    storage.listStorageFiles.mockResolvedValue(Object.keys(entries).map(v => `${v}.json`))
    storage.readFromStorage.mockImplementation(async path => {
      const entry = entries[path.split('/').at(-1).replace('.json', '')]
      if (entry instanceof Error) throw entry
      return entry
    })
    const res = { json: vi.fn() }
    await handler({}, res)
    return res.json.mock.calls[0][0]
  }

  const scheduled = ga_date => ({ release_schedule: { ga_date } })

  it('selects the latest arrived GA, regardless of file order', async () => {
    const result = await getVersions({
      future: scheduled('2026-11-15'),
      version: {},
      current: scheduled('2026-08-19'),
      old: scheduled('2026-05-01')
    })
    expect(result.default_version).toBe('current')
    expect(result.versions).toEqual(['future', 'version', 'current', 'old'])
  })

  it('includes a release arriving today', async () => {
    expect((await getVersions({ old: scheduled('2026-08-19'), today: scheduled('2026-09-07') })).default_version).toBe('today')
  })

  it('does not fall back to future, undated, invalid, or unreadable versions', async () => {
    expect((await getVersions({
      future: scheduled('2026-11-15'),
      version: {},
      invalid: scheduled('2026-02-30'),
      malformed: scheduled('not-a-date'),
      unreadable: new Error('Unreadable metrics')
    })).default_version).toBeNull()
  })

  it('returns no default when storage is empty', async () => {
    expect(await getVersions({})).toEqual({ versions: [], default_version: null })
  })
})
