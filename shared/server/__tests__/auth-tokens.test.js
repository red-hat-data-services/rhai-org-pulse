import { describe, it, expect, beforeEach, afterEach } from 'vitest'

const { createAuthMiddleware, proxySecretGuard } = require('../auth')

function createMockStorage() {
  const store = {
    'allowlist.json': { emails: ['admin@test.com'] }
  }
  return {
    readFromStorage(key) { return store[key] || null },
    writeToStorage(key, data) { store[key] = JSON.parse(JSON.stringify(data)) }
  }
}

function createMockReq(overrides = {}) {
  return {
    method: 'GET',
    path: '/api/roster',
    ip: '127.0.0.1',
    headers: {},
    ...overrides
  }
}

function createMockRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) { res.statusCode = code; return res },
    json(data) { res.body = data; return res }
  }
  return res
}

describe('authMiddleware with Bearer tokens', () => {
  let storage, authMiddleware, tokenValidator

  beforeEach(() => {
    storage = createMockStorage()
    tokenValidator = {
      validateToken(rawToken) {
        if (rawToken === 'tt_validtoken00000000000000000000') {
          return { id: 'tok-1', ownerEmail: 'admin@test.com', name: 'Test' }
        }
        if (rawToken === 'tt_nonadmin0000000000000000000000') {
          return { id: 'tok-2', ownerEmail: 'user@test.com', name: 'User Token' }
        }
        return null
      },
      touchLastUsed() {}
    }
    const result = createAuthMiddleware(
      storage.readFromStorage.bind(storage),
      storage.writeToStorage.bind(storage),
      { tokenValidator }
    )
    authMiddleware = result.authMiddleware
  })

  it('authenticates with valid Bearer token', async () => {
    const req = createMockReq({
      headers: { authorization: 'Bearer tt_validtoken00000000000000000000' }
    })
    const res = createMockRes()
    let nextCalled = false
    await authMiddleware(req, res, () => { nextCalled = true })
    expect(nextCalled).toBe(true)
    expect(req.userEmail).toBe('admin@test.com')
    expect(req.isAdmin).toBe(true)
    expect(req.authMethod).toBe('token')
  })

  it('sets isAdmin=false for non-admin token owner', async () => {
    const req = createMockReq({
      headers: { authorization: 'Bearer tt_nonadmin0000000000000000000000' }
    })
    const res = createMockRes()
    let nextCalled = false
    await authMiddleware(req, res, () => { nextCalled = true })
    expect(nextCalled).toBe(true)
    expect(req.userEmail).toBe('user@test.com')
    expect(req.isAdmin).toBe(false)
    expect(req.authMethod).toBe('token')
  })

  it('HARD STOP: invalid Bearer token returns 401, no fallback', async () => {
    const req = createMockReq({
      headers: { authorization: 'Bearer tt_garbage0000000000000000000000' }
    })
    const res = createMockRes()
    let nextCalled = false
    await authMiddleware(req, res, () => { nextCalled = true })
    expect(nextCalled).toBe(false)
    expect(res.statusCode).toBe(401)
    expect(res.body.error).toContain('Invalid or expired')
  })

  it('HARD STOP: does NOT fall through to X-Forwarded-Email on invalid token', async () => {
    const req = createMockReq({
      headers: {
        authorization: 'Bearer tt_garbage0000000000000000000000',
        'x-forwarded-email': 'admin@test.com'
      }
    })
    const res = createMockRes()
    let nextCalled = false
    await authMiddleware(req, res, () => { nextCalled = true })
    expect(nextCalled).toBe(false)
    expect(res.statusCode).toBe(401)
    // Must NOT have set userEmail from the header
    expect(req.userEmail).toBeUndefined()
  })

  it('HARD STOP: does NOT fall through to local dev fallback on invalid token', async () => {
    const req = createMockReq({
      headers: { authorization: 'Bearer tt_garbage0000000000000000000000' }
    })
    const res = createMockRes()
    let nextCalled = false
    await authMiddleware(req, res, () => { nextCalled = true })
    expect(nextCalled).toBe(false)
    expect(res.statusCode).toBe(401)
  })

  it('falls through to X-Forwarded-Email when no Bearer token', async () => {
    const req = createMockReq({
      headers: { 'x-forwarded-email': 'admin@test.com' }
    })
    const res = createMockRes()
    let nextCalled = false
    await authMiddleware(req, res, () => { nextCalled = true })
    expect(nextCalled).toBe(true)
    expect(req.userEmail).toBe('admin@test.com')
    expect(req.authMethod).toBeUndefined()
  })

  it('falls through to local dev fallback when no auth at all', async () => {
    const req = createMockReq()
    const res = createMockRes()
    let nextCalled = false
    await authMiddleware(req, res, () => { nextCalled = true })
    expect(nextCalled).toBe(true)
    expect(req.userEmail).toBeTruthy()
  })

  it('passes OPTIONS requests through', async () => {
    const req = createMockReq({ method: 'OPTIONS' })
    const res = createMockRes()
    let nextCalled = false
    await authMiddleware(req, res, () => { nextCalled = true })
    expect(nextCalled).toBe(true)
  })
})

describe('proxySecretGuard with Bearer tokens', () => {
  let originalEnv, tokenValidator

  beforeEach(() => {
    originalEnv = process.env.PROXY_AUTH_SECRET
    tokenValidator = {
      isValidToken(rawToken) {
        return rawToken === 'tt_validtoken00000000000000000000'
      }
    }
  })

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.PROXY_AUTH_SECRET
    } else {
      process.env.PROXY_AUTH_SECRET = originalEnv
    }
  })

  it('allows valid Bearer token through when proxy secret is set', () => {
    process.env.PROXY_AUTH_SECRET = 'test-secret'
    const req = createMockReq({
      headers: { authorization: 'Bearer tt_validtoken00000000000000000000' }
    })
    const res = createMockRes()
    let called = false
    proxySecretGuard(req, res, () => { called = true }, { tokenValidator })
    expect(called).toBe(true)
  })

  it('rejects garbage tt_ token at guard level (defense in depth)', () => {
    process.env.PROXY_AUTH_SECRET = 'test-secret'
    const req = createMockReq({
      headers: { authorization: 'Bearer tt_garbage0000000000000000000000' }
    })
    const res = createMockRes()
    let called = false
    proxySecretGuard(req, res, () => { called = true }, { tokenValidator })
    expect(called).toBe(false)
    expect(res.statusCode).toBe(401)
    expect(res.body.error).toContain('Invalid or expired')
  })

  it('still allows valid proxy secret when no Bearer token', () => {
    process.env.PROXY_AUTH_SECRET = 'test-secret'
    const req = createMockReq({
      headers: { 'x-proxy-secret': 'test-secret' }
    })
    const res = createMockRes()
    let called = false
    proxySecretGuard(req, res, () => { called = true }, { tokenValidator })
    expect(called).toBe(true)
  })

  it('rejects when no proxy secret and no valid token', () => {
    process.env.PROXY_AUTH_SECRET = 'test-secret'
    const req = createMockReq()
    const res = createMockRes()
    let called = false
    proxySecretGuard(req, res, () => { called = true }, { tokenValidator })
    expect(called).toBe(false)
    expect(res.statusCode).toBe(401)
  })

  it('passes through when PROXY_AUTH_SECRET not set (local dev)', () => {
    delete process.env.PROXY_AUTH_SECRET
    const req = createMockReq({
      headers: { authorization: 'Bearer tt_anything' }
    })
    const res = createMockRes()
    let called = false
    proxySecretGuard(req, res, () => { called = true }, { tokenValidator })
    expect(called).toBe(true)
  })
})
