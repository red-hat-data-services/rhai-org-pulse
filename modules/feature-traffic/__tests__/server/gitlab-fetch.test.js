import { describe, it, expect, vi, beforeEach } from 'vitest'
import AdmZip from 'adm-zip'

const { fetchArtifacts, _setFetch } = require('../../server/gitlab-fetch')

const mockFetch = vi.fn()

function createZipBuffer(files) {
  const zip = new AdmZip()
  for (const [name, content] of Object.entries(files)) {
    zip.addFile(name, Buffer.from(JSON.stringify(content)))
  }
  return zip.toBuffer()
}

function makeStorage() {
  const written = {}
  return {
    writeToStorage(key, data) { written[key] = data },
    readFromStorage(key) { return written[key] || null },
    _written: written
  }
}

const baseConfig = {
  gitlabBaseUrl: 'https://gitlab.com',
  projectPath: 'group/project',
  jobName: 'fetch-traffic',
  branch: 'main',
  artifactPath: 'output'
}

describe('fetchArtifacts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _setFetch(mockFetch)
  })

  it('downloads, extracts, and writes artifact files', async () => {
    const zipBuf = createZipBuffer({
      'output/index.json': { fetchedAt: '2026-01-01', features: [], featureCount: 0 },
      'output/features/RHAISTRAT-1.json': { key: 'RHAISTRAT-1', summary: 'Test' }
    })

    mockFetch.mockResolvedValue({
      ok: true,
      buffer: () => Promise.resolve(zipBuf)
    })

    const storage = makeStorage()
    const result = await fetchArtifacts(storage, baseConfig, 'test-token')

    expect(result.status).toBe('success')
    expect(result.fileCount).toBe(2)
    expect(storage._written['feature-traffic/index.json']).toBeDefined()
    expect(storage._written['feature-traffic/features/RHAISTRAT-1.json']).toBeDefined()
  })

  it('writes features before index.json (atomic ordering)', async () => {
    const writeOrder = []
    const storage = makeStorage()
    const origWrite = storage.writeToStorage.bind(storage)
    storage.writeToStorage = (key, data) => {
      writeOrder.push(key)
      origWrite(key, data)
    }

    const zipBuf = createZipBuffer({
      'output/index.json': { fetchedAt: '2026-01-01', features: [], featureCount: 0 },
      'output/features/RHAISTRAT-1.json': { key: 'RHAISTRAT-1' }
    })

    mockFetch.mockResolvedValue({ ok: true, buffer: () => Promise.resolve(zipBuf) })

    await fetchArtifacts(storage, baseConfig, 'token')

    const indexIdx = writeOrder.indexOf('feature-traffic/index.json')
    const featureIdx = writeOrder.indexOf('feature-traffic/features/RHAISTRAT-1.json')
    expect(featureIdx).toBeLessThan(indexIdx)
  })

  it('throws when index.json is missing from archive', async () => {
    const zipBuf = createZipBuffer({
      'output/features/RHAISTRAT-1.json': { key: 'RHAISTRAT-1' }
    })

    mockFetch.mockResolvedValue({ ok: true, buffer: () => Promise.resolve(zipBuf) })

    const storage = makeStorage()
    await expect(fetchArtifacts(storage, baseConfig, 'token'))
      .rejects.toThrow('missing index.json')
  })

  it('returns artifact_expired on 404', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' })

    const storage = makeStorage()
    const result = await fetchArtifacts(storage, baseConfig, 'token')

    expect(result.status).toBe('artifact_expired')
  })

  it('throws on 401', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401, statusText: 'Unauthorized' })

    const storage = makeStorage()
    await expect(fetchArtifacts(storage, baseConfig, 'token'))
      .rejects.toThrow('authentication failed')
  })

  it('throws on 429', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 429, statusText: 'Too Many Requests' })

    const storage = makeStorage()
    await expect(fetchArtifacts(storage, baseConfig, 'token'))
      .rejects.toThrow('rate limited')
  })

  it('skips non-JSON files', async () => {
    const zip = new AdmZip()
    zip.addFile('output/index.json', Buffer.from(JSON.stringify({ features: [], featureCount: 0 })))
    zip.addFile('output/readme.txt', Buffer.from('hello'))

    mockFetch.mockResolvedValue({ ok: true, buffer: () => Promise.resolve(zip.toBuffer()) })

    const storage = makeStorage()
    const result = await fetchArtifacts(storage, baseConfig, 'token')

    expect(result.fileCount).toBe(1)
  })

  it('skips entries with path traversal', async () => {
    const zip = new AdmZip()
    zip.addFile('output/index.json', Buffer.from(JSON.stringify({ features: [], featureCount: 0 })))
    zip.addFile('output/../../../etc/passwd.json', Buffer.from(JSON.stringify({ evil: true })))

    mockFetch.mockResolvedValue({ ok: true, buffer: () => Promise.resolve(zip.toBuffer()) })

    const storage = makeStorage()
    await fetchArtifacts(storage, baseConfig, 'token')

    expect(storage._written['feature-traffic/../../../etc/passwd.json']).toBeUndefined()
  })

  it('skips files that fail JSON.parse and logs warning', async () => {
    const zip = new AdmZip()
    zip.addFile('output/index.json', Buffer.from(JSON.stringify({ features: [], featureCount: 0 })))
    zip.addFile('output/features/bad.json', Buffer.from('not valid json {{{'))

    mockFetch.mockResolvedValue({ ok: true, buffer: () => Promise.resolve(zip.toBuffer()) })

    const storage = makeStorage()
    const result = await fetchArtifacts(storage, baseConfig, 'token')

    expect(result.fileCount).toBe(1)
    expect(result.warnings).toBeDefined()
    expect(result.warnings[0]).toContain('bad.json')
  })

  it('requires projectPath', async () => {
    const storage = makeStorage()
    await expect(fetchArtifacts(storage, { ...baseConfig, projectPath: '' }, 'token'))
      .rejects.toThrow('projectPath is required')
  })

  it('encodes project path in URL', async () => {
    const zipBuf = createZipBuffer({
      'output/index.json': { features: [], featureCount: 0 }
    })
    mockFetch.mockResolvedValue({ ok: true, buffer: () => Promise.resolve(zipBuf) })

    const storage = makeStorage()
    await fetchArtifacts(storage, { ...baseConfig, projectPath: 'group/sub/project' }, 'token')

    const calledUrl = mockFetch.mock.calls[0][0]
    expect(calledUrl).toContain(encodeURIComponent('group/sub/project'))
  })

  it('writes last-fetch.json metadata', async () => {
    const zipBuf = createZipBuffer({
      'output/index.json': { features: [], featureCount: 0 }
    })
    mockFetch.mockResolvedValue({ ok: true, buffer: () => Promise.resolve(zipBuf) })

    const storage = makeStorage()
    await fetchArtifacts(storage, baseConfig, 'token')

    const lastFetch = storage._written['feature-traffic/last-fetch.json']
    expect(lastFetch).toBeDefined()
    expect(lastFetch.status).toBe('success')
    expect(lastFetch.duration).toBeGreaterThanOrEqual(0)
  })
})
