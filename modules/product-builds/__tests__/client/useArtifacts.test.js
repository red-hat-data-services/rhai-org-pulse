import { describe, it, expect, vi, beforeEach } from 'vitest'

const apiRequest = vi.fn()

vi.mock('@shared/client/services/api', () => ({
  apiRequest
}))

const { useArtifacts } = await import('../../client/composables/useArtifacts.js')

describe('useArtifacts', () => {
  beforeEach(() => {
    apiRequest.mockReset()
  })

  it('loads artifacts and sets hasMore when full page returned', async () => {
    const items = Array.from({ length: 50 }, (_, i) => ({ key: `art-${i}` }))
    apiRequest.mockResolvedValue(items)

    const { artifacts, hasMore, loadArtifacts } = useArtifacts()
    await loadArtifacts({ limit: 50 })

    expect(artifacts.value).toHaveLength(50)
    expect(hasMore.value).toBe(true)
  })

  it('sets hasMore to false when partial page returned', async () => {
    const items = [{ key: 'art-0' }, { key: 'art-1' }]
    apiRequest.mockResolvedValue(items)

    const { artifacts, hasMore, loadArtifacts } = useArtifacts()
    await loadArtifacts({ limit: 50 })

    expect(artifacts.value).toHaveLength(2)
    expect(hasMore.value).toBe(false)
  })

  it('appends results when append option is true', async () => {
    const page1 = [{ key: 'a' }, { key: 'b' }]
    const page2 = [{ key: 'c' }]

    const { artifacts, loadArtifacts } = useArtifacts()

    apiRequest.mockResolvedValue(page1)
    await loadArtifacts({ limit: 50 })
    expect(artifacts.value).toHaveLength(2)

    apiRequest.mockResolvedValue(page2)
    await loadArtifacts({ limit: 50, offset: 2 }, { append: true })
    expect(artifacts.value).toHaveLength(3)
    expect(artifacts.value.map(a => a.key)).toEqual(['a', 'b', 'c'])
  })

  it('replaces results when append is false', async () => {
    const page1 = [{ key: 'a' }]
    const page2 = [{ key: 'b' }]

    const { artifacts, loadArtifacts } = useArtifacts()

    apiRequest.mockResolvedValue(page1)
    await loadArtifacts({ limit: 50 })

    apiRequest.mockResolvedValue(page2)
    await loadArtifacts({ limit: 50 })
    expect(artifacts.value).toHaveLength(1)
    expect(artifacts.value[0].key).toBe('b')
  })

  it('sets error on rejected request', async () => {
    apiRequest.mockRejectedValue(new Error('not found'))

    const { error, loadArtifacts } = useArtifacts()
    await loadArtifacts({ limit: 50 })

    expect(error.value).toBe('not found')
  })

  it('resets state including error', async () => {
    apiRequest.mockRejectedValue(new Error('fail'))

    const { artifacts, hasMore, error, reset, loadArtifacts } = useArtifacts()
    await loadArtifacts({ limit: 1 })
    expect(error.value).toBe('fail')

    apiRequest.mockResolvedValue([{ key: 'a' }])
    await loadArtifacts({ limit: 1 })
    expect(artifacts.value).toHaveLength(1)
    expect(hasMore.value).toBe(true)

    reset()
    expect(artifacts.value).toHaveLength(0)
    expect(hasMore.value).toBe(false)
    expect(error.value).toBeNull()
  })

  it('passes filters as query params', async () => {
    apiRequest.mockResolvedValue([])

    const { loadArtifacts } = useArtifacts()
    await loadArtifacts({ product_key: 'rhaiis', type: 'containers', limit: 50 })

    const path = apiRequest.mock.calls[0][0]
    expect(path).toContain('product_key=rhaiis')
    expect(path).toContain('type=containers')
    expect(path).toContain('limit=50')
  })
})
