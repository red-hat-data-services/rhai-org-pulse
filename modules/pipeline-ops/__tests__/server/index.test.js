import { describe, it, expect, vi } from 'vitest'

const { createTestContext } = await import('../../../../shared/server/module-context.js')
const registerRoutes = (await import('../../server/index.js')).default

describe('pipeline-ops server routes', () => {
  it('registers expected routes', () => {
    const router = { get: vi.fn(), post: vi.fn() }
    const context = createTestContext()
    registerRoutes(router, context)

    const getPaths = router.get.mock.calls.map(c => c[0])
    expect(getPaths).toContain('/pipelines')
    expect(getPaths).toContain('/pipelines/:slug')
    expect(getPaths).toContain('/config')
    expect(getPaths).toContain('/refresh/status')

    const postPaths = router.post.mock.calls.map(c => c[0])
    expect(postPaths).toContain('/config')
    expect(postPaths).toContain('/refresh')
    expect(postPaths).toContain('/runs/bulk')
  })

  it('registers diagnostics', () => {
    const router = { get: vi.fn(), post: vi.fn() }
    const context = createTestContext({ registerDiagnostics: vi.fn() })
    registerRoutes(router, context)
    expect(context.registerDiagnostics).toHaveBeenCalled()
  })
})
