import { describe, it, expect } from 'vitest'
import { getRegistryUrl, getQuayDirectTagUrl, getQuayAllTagsUrl, getDigestUrl, formatShortDate, getCommitUrlForRepo, getCommitUrl } from '../../client/utils/formatting.js'

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

describe('formatShortDate', () => {
  it('formats timestamps and keeps date-only values on their calendar day', () => {
    expect(formatShortDate('2026-09-11')).toBe('Sep 11, 2026')
    expect(formatShortDate('2026-01-01')).toBe('Jan 1, 2026')
    expect(formatShortDate('2026-09-11T14:12:00Z')).toMatch(/Sep 1[01], 2026/)
    expect(formatShortDate('')).toBe('')
  })
})

describe('getCommitUrlForRepo', () => {
  it('uses GitHub-style commit URLs for github.com repositories', () => {
    expect(getCommitUrlForRepo('https://github.com/red-hat-data-services/rhelai', 'cbc6ca5380e1ee3f0e38e65900f4a6af752da391')).toBe(
      'https://github.com/red-hat-data-services/rhelai/commit/cbc6ca5380e1ee3f0e38e65900f4a6af752da391'
    )
  })

  it('strips .git suffix and trailing slashes before building the URL', () => {
    expect(getCommitUrlForRepo('https://github.com/red-hat-data-services/rhelai.git/', 'abc123')).toBe(
      'https://github.com/red-hat-data-services/rhelai/commit/abc123'
    )
  })

  it('keeps GitLab-style commit URLs for gitlab.com repositories', () => {
    expect(getCommitUrlForRepo('https://gitlab.com/redhat/rhel-ai/rhaiis/containers', 'abc123')).toBe(
      'https://gitlab.com/redhat/rhel-ai/rhaiis/containers/-/commit/abc123'
    )
  })

  it('returns null for missing repo URL or commit', () => {
    expect(getCommitUrlForRepo(null, 'abc123')).toBeNull()
    expect(getCommitUrlForRepo('https://github.com/o/r', null)).toBeNull()
  })
})

describe('getCommitUrl', () => {
  it('links GitHub-hosted artifacts with GitHub-style commit URLs', () => {
    expect(getCommitUrl({
      commit: 'cbc6ca5380e1ee3f0e38e65900f4a6af752da391',
      git_repository: { url: 'https://github.com/red-hat-data-services/rhelai' }
    })).toBe(
      'https://github.com/red-hat-data-services/rhelai/commit/cbc6ca5380e1ee3f0e38e65900f4a6af752da391'
    )
  })

  it('links GitLab-hosted artifacts with GitLab-style commit URLs', () => {
    expect(getCommitUrl({
      commit: 'abc123',
      git_repository: { url: 'https://gitlab.com/redhat/rhel-ai/rhaiis/containers' }
    })).toBe(
      'https://gitlab.com/redhat/rhel-ai/rhaiis/containers/-/commit/abc123'
    )
  })

  it('falls back to the source label for the repository URL', () => {
    expect(getCommitUrl({
      commit: 'abc123',
      labels: { 'org.opencontainers.image.source': 'https://github.com/red-hat-data-services/rhelai' }
    })).toBe(
      'https://github.com/red-hat-data-services/rhelai/commit/abc123'
    )
  })
})
