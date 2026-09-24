import { describe, expect, it, vi } from 'vitest'

const { getEffectiveSettings, saveSettings, validateHttpUrl } = require('../../server/config')
const { getOpenSearchConfig, createOpenSearchClient } = require('../../server/opensearch')
const registerRoutes = require('../../server/index')

function router() {
  const routes = {}
  return {
    get(path, ...handlers) { routes[`GET ${path}`] = handlers },
    post(path, ...handlers) { routes[`POST ${path}`] = handlers },
    routes
  }
}

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this }
  }
}

describe('Workflow Validation admin connection settings', () => {
  it('validates credential-free HTTP(S) endpoint and proxy URLs', () => {
    expect(validateHttpUrl('https://search.example/', 'URL')).toBe('https://search.example')
    expect(() => validateHttpUrl('https://reader:secret@search.example', 'URL')).toThrow(/credential-free/)
    expect(() => validateHttpUrl('socks5://proxy.example', 'HTTP_PROXY')).toThrow(/credential-free HTTP/)
  })

  it('persists only non-secret settings and gives them precedence over environment defaults', async () => {
    let stored
    await saveSettings(async (_path, value) => { stored = value }, {
      url: 'https://admin-search.example/', httpProxy: 'http://admin-proxy.example:8080', httpsProxy: ''
    })
    expect(stored).toEqual({ url: 'https://admin-search.example', httpProxy: 'http://admin-proxy.example:8080', httpsProxy: '' })
    expect(JSON.stringify(stored)).not.toContain('PASSWORD')
    const effective = await getEffectiveSettings(async () => stored, {
      WORKFLOW_VALIDATION_OPENSEARCH_URL: 'https://gitops-search.example',
      HTTP_PROXY: 'http://gitops-http.example:8080', HTTPS_PROXY: 'http://gitops-https.example:8080'
    })
    expect(effective).toMatchObject({
      url: 'https://admin-search.example', httpProxy: 'http://admin-proxy.example:8080', httpsProxy: 'http://gitops-https.example:8080',
      sources: { url: 'admin-setting', httpProxy: 'admin-setting', httpsProxy: 'environment' }
    })
  })

  it('falls back to deployment settings and then the local default', async () => {
    expect(await getEffectiveSettings(async () => null, {})).toMatchObject({
      url: 'http://localhost:9200', httpProxy: '', httpsProxy: '',
      sources: { url: 'default', httpProxy: 'none', httpsProxy: 'none' }
    })
  })

  it('uses a per-client proxy dispatcher only for OpenSearch requests', async () => {
    const request = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    const client = createOpenSearchClient({ url: 'https://search.example', httpsProxy: 'http://proxy.example:8080' }, request)
    await client.search('workflow-executions', { size: 0 })
    expect(request.mock.calls[0][1].dispatcher).toBeDefined()
  })

  it('protects configuration APIs with the existing admin middleware and rejects bad writes', async () => {
    const requireAdmin = vi.fn()
    const r = router()
    registerRoutes(r, { requireAuth: vi.fn(), requireAdmin, secrets: {}, storage: { readFromStorage: vi.fn(), writeToStorage: vi.fn() } })
    expect(r.routes['GET /config'][0]).toBe(requireAdmin)
    expect(r.routes['POST /config'][0]).toBe(requireAdmin)
    const res = response()
    await r.routes['POST /config'].at(-1)({ body: { url: 'https://user:secret@search.example' } }, res)
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toMatch(/credential-free/)
    const secretRes = response()
    await r.routes['POST /config'].at(-1)({ body: { WORKFLOW_VALIDATION_OPENSEARCH_PASSWORD: 'secret' } }, secretRes)
    expect(secretRes.statusCode).toBe(400)
  })

  it('keeps authentication secret-only and reports redacted configuration diagnostics', () => {
    const config = getOpenSearchConfig(
      { WORKFLOW_VALIDATION_OPENSEARCH_USERNAME: 'reader', WORKFLOW_VALIDATION_OPENSEARCH_PASSWORD: 'secret' },
      {}, { url: 'https://search.example', httpsProxy: 'http://proxy.example:8080' }
    )
    expect(config.authenticated).toBe(true)
    expect(JSON.stringify({ endpoint: config.url, authenticationConfigured: config.authenticated, proxyConfigured: Boolean(config.httpsProxy) }))
      .not.toMatch(/reader|secret|proxy\.example:8080/)
  })
})
