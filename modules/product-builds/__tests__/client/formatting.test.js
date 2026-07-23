import { describe, it, expect } from 'vitest'
import { getRegistryUrl, getQuayDirectTagUrl, getQuayAllTagsUrl, getDigestUrl } from '../../client/utils/formatting.js'

describe('getRegistryUrl', () => {
  it('returns quay tags URL for quay.io keys', () => {
    expect(getRegistryUrl('quay.io/rhoai/spyre-ubi9:3.5.0')).toBe(
      'https://quay.io/repository/rhoai/spyre-ubi9?tab=tags'
    )
  })

  it('returns Red Hat Catalog URL for registry.redhat.io keys', () => {
    expect(getRegistryUrl('registry.redhat.io/rhoai/spyre-ubi9:3.5.0')).toBe(
      'https://catalog.redhat.com/en/search?searchType=All&q=rhoai%2Fspyre-ubi9&p=1'
    )
  })

  it('returns null for unknown registries', () => {
    expect(getRegistryUrl('docker.io/library/node:18')).toBeNull()
  })

  it('returns null for null/undefined', () => {
    expect(getRegistryUrl(null)).toBeNull()
    expect(getRegistryUrl(undefined)).toBeNull()
  })
})

describe('getQuayDirectTagUrl', () => {
  it('returns direct tag URL for quay keys with tag', () => {
    expect(getQuayDirectTagUrl('quay.io/rhoai/spyre-ubi9:3.5.0')).toBe(
      'https://quay.io/repository/rhoai/spyre-ubi9/tag/3.5.0'
    )
  })

  it('returns null for quay keys without tag', () => {
    expect(getQuayDirectTagUrl('quay.io/rhoai/spyre-ubi9')).toBeNull()
  })

  it('returns null for non-quay keys', () => {
    expect(getQuayDirectTagUrl('registry.redhat.io/rhoai/spyre-ubi9:3.5.0')).toBeNull()
  })

  it('returns null for null', () => {
    expect(getQuayDirectTagUrl(null)).toBeNull()
  })
})

describe('getQuayAllTagsUrl', () => {
  it('returns all-tags URL with tag filter for quay keys', () => {
    expect(getQuayAllTagsUrl('quay.io/rhoai/spyre-ubi9:3.5.0')).toBe(
      'https://quay.io/repository/rhoai/spyre-ubi9?tab=tags&tag=3.5.0'
    )
  })

  it('returns all-tags URL without filter when no tag', () => {
    expect(getQuayAllTagsUrl('quay.io/rhoai/spyre-ubi9')).toBe(
      'https://quay.io/repository/rhoai/spyre-ubi9?tab=tags'
    )
  })

  it('returns null for non-quay keys', () => {
    expect(getQuayAllTagsUrl('registry.redhat.io/rhoai/spyre-ubi9:3.5.0')).toBeNull()
  })
})

describe('getDigestUrl', () => {
  it('returns quay manifest URL for quay keys', () => {
    expect(getDigestUrl({ key: 'quay.io/rhoai/spyre-ubi9:3.5.0', sha_digest: 'sha256:abc123' })).toBe(
      'https://quay.io/repository/rhoai/spyre-ubi9/manifest/sha256:abc123'
    )
  })

  it('falls back to registry URL for non-quay keys', () => {
    expect(getDigestUrl({ key: 'registry.redhat.io/rhoai/spyre-ubi9:3.5.0', sha_digest: 'sha256:abc123' })).toBe(
      'https://catalog.redhat.com/en/search?searchType=All&q=rhoai%2Fspyre-ubi9&p=1'
    )
  })

  it('returns null when no digest', () => {
    expect(getDigestUrl({ key: 'quay.io/rhoai/spyre-ubi9:3.5.0', sha_digest: null })).toBeNull()
  })

  it('returns null when no key', () => {
    expect(getDigestUrl({ key: null, sha_digest: 'sha256:abc123' })).toBeNull()
  })

  it('returns null for null artifact', () => {
    expect(getDigestUrl(null)).toBeNull()
  })
})
