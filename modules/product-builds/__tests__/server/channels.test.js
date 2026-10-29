import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const registerChannelRoutes = require('../../server/channels')
const { listChannels, getChannel } = require('../../server/channels-mock')
const dashboard = require('../../../../fixtures/product-builds/channels-api.json')

function makeRouter() {
  const routes = {}
  return {
    get: vi.fn((path, handler) => { routes[path] = handler }),
    _routes: routes,
  }
}

function makeRes() {
  const res = {
    _status: 200,
    _json: null,
    _headers: {},
    status(code) { res._status = code; return res },
    json(data) { res._json = data; return res },
    set(name, value) { res._headers[name] = value; return res },
  }
  return res
}

describe('channel routes', () => {
  let router, getBaseUrl

  beforeEach(() => {
    router = makeRouter()
    getBaseUrl = vi.fn().mockResolvedValue('')
    vi.stubGlobal('fetch', vi.fn())
    registerChannelRoutes(router, { getBaseUrl, demoMode: true })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('registers list and detail routes', () => {
    expect(Object.keys(router._routes)).toEqual(['/channels', '/channels/:name'])
  })

  it('lists channel summaries flagged as sample data in an unconfigured demo', async () => {
    const res = makeRes()
    await router._routes['/channels']({ query: {} }, res)
    expect(res._status).toBe(200)
    expect(res._json.source).toBe('sample')
    expect(res._json.as_of).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(res._json.channels.length).toBeGreaterThan(0)
    const first = res._json.channels[0]
    expect(first).not.toHaveProperty('wheels')
    expect(first).not.toHaveProperty('drops')
    expect(first).toMatchObject({
      name: expect.any(String),
      accelerator: expect.any(String),
      rhel_version: expect.any(String),
      wheel_count: expect.any(Number),
    })
  })

  it('returns demo channel details with drops and wheels', async () => {
    const res = makeRes()
    await router._routes['/channels/:name']({ params: { name: 'cuda13.0-torch2.11-ubi9' } }, res)
    expect(res._status).toBe(200)
    expect(res._json.source).toBe('sample')
    expect(res._json.channel.name).toBe('cuda13.0-torch2.11-ubi9')
    expect(res._json.channel.drops.length).toBeGreaterThan(0)
    expect(res._json.channel.wheels.length).toBe(res._json.channel.wheel_count)
  })

  it('returns 404 for an unknown demo channel', async () => {
    const res = makeRes()
    await router._routes['/channels/:name']({ params: { name: 'cuda99.0-torch9.9-ubi9' } }, res)
    expect(res._status).toBe(404)
    expect(res._json.error).toMatch(/not found/)
  })

  it.each(['../etc/passwd', '.', '..', 'CUDA13', '', 'a b', '-leading-dash'])('rejects invalid channel name %j before contacting the dashboard', async (name) => {
    const res = makeRes()
    await router._routes['/channels/:name']({ params: { name } }, res)
    expect(res._status).toBe(400)
    expect(fetch).not.toHaveBeenCalled()
    expect(getBaseUrl).not.toHaveBeenCalled()
  })

  it('proxies configured dashboard data even when the rest of the app uses demo mode', async () => {
    getBaseUrl.mockResolvedValue('https://dashboard.example.test')
    fetch.mockResolvedValue(new Response(JSON.stringify(dashboard.list), {
      headers: { 'X-Total-Count': '23', 'X-Total-Pages': '2' },
    }))
    const res = makeRes()
    await router._routes['/channels']({ query: { limit: '20', offset: '0' } }, res)

    expect(fetch).toHaveBeenCalledWith('https://dashboard.example.test/channels?limit=20&offset=0', expect.any(Object))
    expect(res._json).toEqual(dashboard.list)
    expect(res._headers).toEqual({ 'X-Total-Count': '23', 'X-Total-Pages': '2' })
  })

  it('preserves real wheel versions, empty drop history and missing wheel kinds', async () => {
    getBaseUrl.mockResolvedValue('https://dashboard.example.test')
    fetch.mockResolvedValue(new Response(JSON.stringify(dashboard.detail)))
    const res = makeRes()
    await router._routes['/channels/:name']({ params: { name: dashboard.detail.channel.name } }, res)

    expect(fetch).toHaveBeenCalledWith(`https://dashboard.example.test/channels/${dashboard.detail.channel.name}`, expect.any(Object))
    expect(res._json).toEqual(dashboard.detail)
    expect(res._json.channel).not.toHaveProperty('wheel_kinds')
  })

  it('preserves upstream errors instead of returning a sample channel', async () => {
    getBaseUrl.mockResolvedValue('https://dashboard.example.test')
    fetch.mockResolvedValue(new Response(JSON.stringify({ detail: 'Channel not found' }), { status: 404 }))
    const res = makeRes()
    await router._routes['/channels/:name']({ params: { name: 'cpu-notorch-ubi9' } }, res)

    expect(res._status).toBe(404)
    expect(res._json).toEqual({ detail: 'Channel not found' })
  })

  it('reports an unavailable upstream without falling back to sample data', async () => {
    vi.useFakeTimers()
    getBaseUrl.mockResolvedValue('https://dashboard.example.test')
    fetch.mockRejectedValue(new Error('Connection refused'))
    const res = makeRes()
    const pending = router._routes['/channels']({ query: {} }, res)
    await vi.runAllTimersAsync()
    await pending

    expect(res._status).toBe(502)
    expect(res._json).not.toHaveProperty('channels')
  })

  it('requires a configured API outside demo mode', async () => {
    registerChannelRoutes(router, { getBaseUrl, demoMode: false })
    const res = makeRes()
    await router._routes['/channels']({ query: {} }, res)

    expect(res._status).toBe(503)
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('sample channel catalog', () => {
  const channels = listChannels()

  it('has unique channel names', () => {
    const names = channels.map(c => c.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('derives each name from accelerator, torch and OS', () => {
    for (const c of channels) {
      const torch = c.torch_version ? `torch${c.torch_version}` : 'notorch'
      expect(c.name).toBe(`${c.accelerator}${c.accelerator_version}-${torch}-${c.rhel_version}`)
    }
  })

  it('includes channels adopted by a release and channels not adopted yet', () => {
    expect(channels.some(c => c.compatible_releases.length > 0)).toBe(true)
    expect(channels.some(c => c.compatible_releases.length === 0)).toBe(true)
  })

  it('keeps summaries consistent with details', () => {
    for (const summary of channels) {
      const detail = getChannel(summary.name)
      expect(detail.drops.length).toBe(summary.drop_count)
      expect(detail.wheels.length).toBe(summary.wheel_count)
      const kinds = { accelerated: 0, native: 0, pure: 0 }
      for (const w of detail.wheels) kinds[w.kind]++
      expect(kinds).toEqual(summary.wheel_kinds)
      expect(summary.latest_drop?.name).toBe(detail.drops[0]?.name)
    }
  })

  it('lists drops newest first with a pull spec per channel', () => {
    for (const { name } of channels) {
      const { drops } = getChannel(name)
      const dates = drops.map(d => d.created_at)
      expect(dates).toEqual([...dates].sort().reverse())
      for (const d of drops) {
        expect(d.pullspec).toBe(`quay.io/aipcc/base-images/${name}:${d.name}`)
        expect(d).toMatchObject({ key: expect.any(String), product_key: 'base-images', git_branch: expect.any(String) })
      }
    }
  })

  it('only gives release branch drops to channels adopted by that release', () => {
    for (const c of channels) {
      const branchDrops = getChannel(c.name).drops.filter(d => d.git_branch !== 'main')
      if (!c.compatible_releases.includes('rhoai-3.6')) {
        expect(branchDrops).toEqual([])
      } else {
        expect(branchDrops.length).toBeGreaterThan(0)
      }
    }
  })

  it('ships the torch wheel matching the channel torch version, and none for notorch', () => {
    for (const c of channels) {
      const { wheels } = getChannel(c.name)
      const names = wheels.map(w => w.name)
      expect(new Set(names).size).toBe(names.length)
      const torch = wheels.find(w => w.name === 'torch')
      if (c.torch_version) {
        expect(torch.version.startsWith(`${c.torch_version}.`)).toBe(true)
        expect(torch.kind).toBe('accelerated')
      } else {
        expect(torch).toBeUndefined()
        expect(wheels.some(w => w.kind === 'accelerated')).toBe(false)
      }
    }
  })

  it('returns null for unknown channels', () => {
    expect(getChannel('nope')).toBeNull()
  })
})
