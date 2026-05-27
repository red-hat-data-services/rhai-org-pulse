import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { proxyGet, buildUpstreamUrl } = require('../../server/proxy')

function makeRes() {
  const res = {
    _status: 200,
    _json: null,
    _headers: {},
    status(code) { res._status = code; return res },
    json(data) { res._json = data; return res },
    set(key, val) { res._headers[key] = val; return res }
  }
  return res
}

describe('buildUpstreamUrl', () => {
  it('appends path to base URL', () => {
    expect(buildUpstreamUrl('https://api.example.com', '/products', {}))
      .toBe('https://api.example.com/products')
  })

  it('appends query parameters', () => {
    const url = buildUpstreamUrl('https://api.example.com', '/drops', { product_key: 'rhaiis', limit: '10' })
    expect(url).toContain('product_key=rhaiis')
    expect(url).toContain('limit=10')
  })

  it('preserves path segments in base URL', () => {
    expect(buildUpstreamUrl('https://api.example.com/api/v1', '/products', {}))
      .toBe('https://api.example.com/api/v1/products')
  })

  it('skips empty/null/undefined query values', () => {
    const url = buildUpstreamUrl('https://api.example.com', '/drops', { product_key: 'rhaiis', series: '', empty: null, undef: undefined })
    expect(url).toContain('product_key=rhaiis')
    expect(url).not.toContain('series')
    expect(url).not.toContain('empty')
    expect(url).not.toContain('undef')
  })
})

describe('proxyGet', () => {
  let originalFetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('returns 503 when baseUrl is empty', async () => {
    const res = makeRes()
    await proxyGet('', '/products', {}, res)
    expect(res._status).toBe(503)
    expect(res._json.error).toContain('not configured')
  })

  it('proxies successful upstream response', async () => {
    const headers = new Map()
    const upstream = { ok: true, status: 200, headers, json: () => Promise.resolve([{ key: 'rhaiis' }]) }
    globalThis.fetch = vi.fn().mockResolvedValue(upstream)

    const res = makeRes()
    await proxyGet('https://api.example.com', '/products', {}, res)

    expect(globalThis.fetch).toHaveBeenCalledOnce()
    expect(res._status).toBe(200)
    expect(res._json).toEqual([{ key: 'rhaiis' }])
  })

  it('forwards pagination headers from upstream', async () => {
    const headers = new Map([['X-Total-Count', '42'], ['X-Total-Pages', '3']])
    const upstream = { ok: true, status: 200, headers, json: () => Promise.resolve([]) }
    globalThis.fetch = vi.fn().mockResolvedValue(upstream)

    const res = makeRes()
    await proxyGet('https://api.example.com', '/drops', { product_key: 'rhaiis' }, res)

    expect(res._headers['X-Total-Count']).toBe('42')
    expect(res._headers['X-Total-Pages']).toBe('3')
  })

  it('handles missing pagination headers gracefully', async () => {
    const headers = new Map()
    const upstream = { ok: true, status: 200, headers, json: () => Promise.resolve([]) }
    globalThis.fetch = vi.fn().mockResolvedValue(upstream)

    const res = makeRes()
    await proxyGet('https://api.example.com', '/drops', {}, res)

    expect(res._headers['X-Total-Count']).toBeUndefined()
    expect(res._headers['X-Total-Pages']).toBeUndefined()
  })

  it('passes upstream error status through', async () => {
    const headers = new Map()
    const upstream = { ok: false, status: 404, headers, json: () => Promise.resolve({ detail: 'not found' }) }
    globalThis.fetch = vi.fn().mockResolvedValue(upstream)

    const res = makeRes()
    await proxyGet('https://api.example.com', '/products/missing', {}, res)

    expect(res._status).toBe(404)
    expect(res._json.detail).toBe('not found')
  })

  it('returns 502 on fetch error', { timeout: 15000 }, async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))

    const res = makeRes()
    await proxyGet('https://api.example.com', '/products', {}, res)

    expect(res._status).toBe(502)
    expect(res._json.error).toContain('Failed to reach')
  })

  it('returns 504 on timeout', async () => {
    const err = new Error('timeout')
    err.name = 'TimeoutError'
    globalThis.fetch = vi.fn().mockRejectedValue(err)

    const res = makeRes()
    await proxyGet('https://api.example.com', '/products', {}, res)

    expect(res._status).toBe(504)
    expect(res._json.error).toContain('timed out')
  })
})
