const { describe, it, expect, vi } = require('vitest')
const { createTestContext } = require('../../../../shared/server/module-context')

const registerRoutes = require('../../server/index')

describe('server routes', () => {
  it('registers GET /hello', () => {
    const router = { get: vi.fn(), post: vi.fn() }
    const context = createTestContext()
    registerRoutes(router, context)
    expect(router.get).toHaveBeenCalledWith('/hello', expect.any(Function), expect.any(Function))
  })
})
