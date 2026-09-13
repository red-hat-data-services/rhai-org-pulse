import { describe, it, expect, vi, beforeEach } from 'vitest'

const registerChannelRoutes = require('../../server/channels')
const { listChannels, getChannel } = require('../../server/channels-mock')

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
    status(code) { res._status = code; return res },
    json(data) { res._json = data; return res },
  }
  return res
}

describe('channel routes', () => {
  let router

  beforeEach(() => {
    router = makeRouter()
    registerChannelRoutes(router)
  })

  it('registers list and detail routes', () => {
    expect(Object.keys(router._routes)).toEqual(['/channels', '/channels/:name'])
  })

  it('lists channel summaries flagged as sample data', () => {
    const res = makeRes()
    router._routes['/channels']({ query: {} }, res)
    expect(res._status).toBe(200)
    expect(res._json.source).toBe('sample')
    expect(res._json.as_of).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(res._json.channels.length).toBeGreaterThan(0)
    const first = res._json.channels[0]
    expect(first).not.toHaveProperty('wheels')
    expect(first).not.toHaveProperty('drops')
    expect(first).toMatchObject({
      name: expect.any(String),
      maturity: expect.stringMatching(/^(stable|rolling)$/),
      accelerator: expect.any(String),
      rhel_version: expect.any(String),
      wheel_count: expect.any(Number),
    })
  })

  it('returns channel details with drops and wheels', () => {
    const res = makeRes()
    router._routes['/channels/:name']({ params: { name: 'cuda13.0-torch2.11-ubi9' } }, res)
    expect(res._status).toBe(200)
    expect(res._json.source).toBe('sample')
    expect(res._json.channel.name).toBe('cuda13.0-torch2.11-ubi9')
    expect(res._json.channel.drops.length).toBeGreaterThan(0)
    expect(res._json.channel.wheels.length).toBe(res._json.channel.wheel_count)
  })

  it('returns 404 for an unknown channel', () => {
    const res = makeRes()
    router._routes['/channels/:name']({ params: { name: 'cuda99.0-torch9.9-ubi9' } }, res)
    expect(res._status).toBe(404)
    expect(res._json.error).toMatch(/not found/)
  })

  it.each(['../etc/passwd', 'CUDA13', '', 'a b', '-leading-dash'])('rejects invalid channel name %j', (name) => {
    const res = makeRes()
    router._routes['/channels/:name']({ params: { name } }, res)
    expect(res._status).toBe(400)
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

  it('covers both maturities, and every stable channel is adopted by a release', () => {
    expect(channels.some(c => c.maturity === 'rolling')).toBe(true)
    const stable = channels.filter(c => c.maturity === 'stable')
    expect(stable.length).toBeGreaterThan(0)
    for (const c of stable) expect(c.compatible_releases.length).toBeGreaterThan(0)
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

  it('only gives release branch drops to stable channels adopted by that release', () => {
    for (const c of channels) {
      const branchDrops = getChannel(c.name).drops.filter(d => d.git_branch !== 'main')
      if (c.maturity === 'rolling' || !c.compatible_releases.includes('rhoai-3.6')) {
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
