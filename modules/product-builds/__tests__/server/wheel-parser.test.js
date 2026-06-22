import { describe, it, expect } from 'vitest'

const { parsePackageFile } = require('../../server/wheel-parser')

describe('wheel-parser', () => {
  describe('wheel filenames', () => {
    it('parses a standard wheel', () => {
      const result = parsePackageFile(
        'torch-2.5.1-cp311-cp311-linux_x86_64.whl',
        'https://example.com/torch-2.5.1-cp311-cp311-linux_x86_64.whl'
      )
      expect(result).toEqual({
        filename: 'torch-2.5.1-cp311-cp311-linux_x86_64.whl',
        version: '2.5.1',
        python: 'cp311',
        abi: 'cp311',
        platform: 'linux_x86_64',
        url: 'https://example.com/torch-2.5.1-cp311-cp311-linux_x86_64.whl'
      })
    })

    it('parses a wheel with any/none tags', () => {
      const result = parsePackageFile(
        'requests-2.31.0-py3-none-any.whl',
        'https://example.com/requests-2.31.0-py3-none-any.whl'
      )
      expect(result.version).toBe('2.31.0')
      expect(result.python).toBe('py3')
      expect(result.abi).toBe('none')
      expect(result.platform).toBe('any')
    })

    it('parses a wheel with build tag', () => {
      const result = parsePackageFile(
        'pkg-1.0.0-123-cp311-cp311-linux_x86_64.whl',
        'https://example.com/pkg.whl'
      )
      expect(result.version).toBe('1.0.0')
      expect(result.python).toBe('cp311')
    })

    it('parses a wheel with dotted version', () => {
      const result = parsePackageFile(
        'numpy-1.26.4.post1-cp312-cp312-manylinux_2_17_x86_64.whl',
        'https://example.com/numpy.whl'
      )
      expect(result.version).toBe('1.26.4.post1')
      expect(result.python).toBe('cp312')
    })
  })

  describe('sdist filenames', () => {
    it('parses a tar.gz sdist', () => {
      const result = parsePackageFile(
        'torch-2.5.1.tar.gz',
        'https://example.com/torch-2.5.1.tar.gz'
      )
      expect(result).toEqual({
        filename: 'torch-2.5.1.tar.gz',
        version: '2.5.1',
        python: null,
        abi: null,
        platform: null,
        url: 'https://example.com/torch-2.5.1.tar.gz'
      })
    })

    it('parses a zip sdist', () => {
      const result = parsePackageFile(
        'mypackage-0.1.0.zip',
        'https://example.com/mypackage-0.1.0.zip'
      )
      expect(result.version).toBe('0.1.0')
      expect(result.platform).toBeNull()
    })
  })

  describe('unparseable filenames', () => {
    it('returns unknown version for unrecognized format', () => {
      const result = parsePackageFile('README.txt', 'https://example.com/README.txt')
      expect(result.version).toBe('unknown')
      expect(result.filename).toBe('README.txt')
    })

    it('returns unknown for malformed wheel name', () => {
      const result = parsePackageFile('bad.whl', 'https://example.com/bad.whl')
      expect(result.version).toBe('unknown')
    })
  })
})
