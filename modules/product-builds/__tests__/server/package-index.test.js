import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const {
  canonicalizeName,
  parseSimpleHtml,
  parseSimpleJson,
  fetchIndex,
  clearCache,
  getBaseUrl,
  getVariants,
  getProductVersions,
  getDefaultProductVersion
} = require('../../server/package-index')

describe('package-index', () => {
  beforeEach(() => {
    clearCache()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    delete process.env.PACKAGE_INDEX_BASE_URL
    delete process.env.PACKAGE_INDEX_VARIANTS
    delete process.env.PACKAGE_INDEX_PRODUCT_VERSIONS
    delete process.env.PACKAGE_INDEX_DEFAULT_PRODUCT_VERSION
    delete process.env.PACKAGE_INDEX_QUERY_TIMEOUT
    delete process.env.PACKAGE_INDEX_CACHE_TTL
  })

  describe('canonicalizeName', () => {
    it('lowercases and normalizes separators', () => {
      expect(canonicalizeName('My_Package.Name')).toBe('my-package-name')
    })

    it('collapses consecutive separators', () => {
      expect(canonicalizeName('a__b--c..d')).toBe('a-b-c-d')
    })
  })

  describe('parseSimpleHtml', () => {
    it('extracts links from PEP 503 HTML', () => {
      const html = `
        <a href="https://example.com/torch-2.5.1.tar.gz">torch-2.5.1.tar.gz</a>
        <a href="https://example.com/torch-2.5.1-cp311-cp311-linux_x86_64.whl">torch-2.5.1-cp311-cp311-linux_x86_64.whl</a>
      `
      const files = parseSimpleHtml(html)
      expect(files).toHaveLength(2)
      expect(files[0].filename).toBe('torch-2.5.1.tar.gz')
      expect(files[0].url).toBe('https://example.com/torch-2.5.1.tar.gz')
      expect(files[1].filename).toBe('torch-2.5.1-cp311-cp311-linux_x86_64.whl')
    })

    it('handles links with extra attributes', () => {
      const html = '<a href="url" data-requires-python=">=3.8">pkg-1.0.tar.gz</a>'
      const files = parseSimpleHtml(html)
      expect(files).toHaveLength(1)
      expect(files[0].filename).toBe('pkg-1.0.tar.gz')
    })

    it('returns empty for no links', () => {
      expect(parseSimpleHtml('<html><body></body></html>')).toEqual([])
    })
  })

  describe('parseSimpleJson', () => {
    it('extracts files from PEP 691 JSON', () => {
      const data = {
        files: [
          { filename: 'pkg-1.0.tar.gz', url: 'https://example.com/pkg-1.0.tar.gz' },
          { filename: 'pkg-1.0-py3-none-any.whl', url: 'https://example.com/pkg-1.0-py3-none-any.whl' }
        ]
      }
      const files = parseSimpleJson(data)
      expect(files).toHaveLength(2)
      expect(files[0].filename).toBe('pkg-1.0.tar.gz')
    })

    it('returns empty for missing files array', () => {
      expect(parseSimpleJson({})).toEqual([])
      expect(parseSimpleJson(null)).toEqual([])
    })
  })

  describe('fetchIndex', () => {
    it('returns found with files on 200', async () => {
      const html = '<a href="url">torch-2.5.1.tar.gz</a>'
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
        text: vi.fn().mockResolvedValue(html)
      })

      const result = await fetchIndex('https://index.example.com/simple/', 'torch')
      expect(result.indexExists).toBe(true)
      expect(result.found).toBe(true)
      expect(result.files).toHaveLength(1)
      expect(result.error).toBeNull()
    })

    it('returns found=false on 404', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 404,
        headers: new Headers()
      })

      const result = await fetchIndex('https://index.example.com/simple/', 'nonexistent')
      expect(result.indexExists).toBe(true)
      expect(result.found).toBe(false)
      expect(result.files).toEqual([])
      expect(result.error).toBeNull()
    })

    it('returns timeout error', async () => {
      const err = new DOMException('signal timed out', 'TimeoutError')
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(err)

      const result = await fetchIndex('https://index.example.com/simple/', 'pkg')
      expect(result.indexExists).toBe(false)
      expect(result.error).toBe('timeout')
    })

    it('retries once on network error', async () => {
      const html = '<a href="url">pkg-1.0.tar.gz</a>'
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
        .mockRejectedValueOnce(new Error('connection refused'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'text/html' }),
          text: vi.fn().mockResolvedValue(html)
        })

      const result = await fetchIndex('https://index.example.com/simple/', 'pkg')
      expect(fetchSpy).toHaveBeenCalledTimes(2)
      expect(result.found).toBe(true)
    })

    it('returns error when retry also fails', async () => {
      vi.spyOn(globalThis, 'fetch')
        .mockRejectedValueOnce(new Error('conn refused'))
        .mockRejectedValueOnce(new Error('still refused'))

      const result = await fetchIndex('https://index.example.com/simple/', 'pkg')
      expect(result.indexExists).toBe(false)
      expect(result.error).toBe('still refused')
    })

    it('uses cache on second call', async () => {
      const html = '<a href="url">pkg-1.0.tar.gz</a>'
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
        text: vi.fn().mockResolvedValue(html)
      })

      await fetchIndex('https://index.example.com/simple/', 'pkg')
      const result2 = await fetchIndex('https://index.example.com/simple/', 'pkg')
      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(result2.found).toBe(true)
    })

    it('normalizes package name for cache key', async () => {
      const html = '<a href="url">pkg-1.0.tar.gz</a>'
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
        text: vi.fn().mockResolvedValue(html)
      })

      await fetchIndex('https://index.example.com/simple/', 'My_Package')
      await fetchIndex('https://index.example.com/simple/', 'my-package')
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })

    it('parses PEP 691 JSON response', async () => {
      const jsonData = { files: [{ filename: 'pkg-1.0.tar.gz', url: 'https://example.com/pkg.tar.gz' }] }
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/vnd.pypi.simple.v1+json' }),
        json: vi.fn().mockResolvedValue(jsonData)
      })

      const result = await fetchIndex('https://index.example.com/simple/', 'pkg')
      expect(result.files).toHaveLength(1)
      expect(result.files[0].filename).toBe('pkg-1.0.tar.gz')
    })
  })

  describe('config helpers', () => {
    it('getBaseUrl returns default', () => {
      expect(getBaseUrl()).toBe('https://packages.redhat.com/api/pypi/public-rhai/rhoai')
    })

    it('getBaseUrl reads env var', () => {
      process.env.PACKAGE_INDEX_BASE_URL = 'https://custom.example.com/pypi/'
      expect(getBaseUrl()).toBe('https://custom.example.com/pypi')
    })

    it('getVariants returns default', () => {
      expect(getVariants()).toEqual(['cpu-ubi9'])
    })

    it('getVariants parses comma-separated env', () => {
      process.env.PACKAGE_INDEX_VARIANTS = 'cpu-ubi9,cuda12.9-ubi9,rocm6.4-ubi9'
      expect(getVariants()).toEqual(['cpu-ubi9', 'cuda12.9-ubi9', 'rocm6.4-ubi9'])
    })

    it('getProductVersions returns default list when env not set', () => {
      const versions = getProductVersions()
      expect(versions).toContain('3.4')
      expect(versions).toContain('3.5-EA2')
      expect(versions).toContain('4.0')
      expect(versions[0]).toBe('3.2')
    })

    it('getProductVersions reads env var when set', () => {
      process.env.PACKAGE_INDEX_PRODUCT_VERSIONS = '3.4,3.5'
      expect(getProductVersions()).toEqual(['3.4', '3.5'])
    })

    it('getDefaultProductVersion returns null when env not set', () => {
      expect(getDefaultProductVersion()).toBeNull()
    })

    it('getDefaultProductVersion reads env var', () => {
      process.env.PACKAGE_INDEX_DEFAULT_PRODUCT_VERSION = '3.4'
      expect(getDefaultProductVersion()).toBe('3.4')
    })
  })
})
