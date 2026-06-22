import { describe, it, expect, beforeEach, afterEach } from 'vitest'

const { parseMrUrl, resolveGitlabToken, enrichMRStatuses, _setFetch, init } = require('../../server/mr-status')

describe('parseMrUrl', () => {
  it('parses GitLab MR URL with /-/ separator', () => {
    const result = parseMrUrl('https://gitlab.cee.redhat.com/docs/openshift-ai/-/merge_requests/1001')
    expect(result).toEqual({
      type: 'gitlab',
      host: 'https://gitlab.cee.redhat.com',
      projectPath: 'docs/openshift-ai',
      iid: '1001'
    })
  })

  it('parses GitLab MR URL with nested groups', () => {
    const result = parseMrUrl('https://gitlab.com/group/subgroup/project/-/merge_requests/42')
    expect(result).toEqual({
      type: 'gitlab',
      host: 'https://gitlab.com',
      projectPath: 'group/subgroup/project',
      iid: '42'
    })
  })

  it('parses legacy GitLab MR URL without /-/', () => {
    const result = parseMrUrl('https://gitlab.com/mygroup/myproject/merge_requests/99')
    expect(result).toEqual({
      type: 'gitlab',
      host: 'https://gitlab.com',
      projectPath: 'mygroup/myproject',
      iid: '99'
    })
  })

  it('parses GitHub PR URL', () => {
    const result = parseMrUrl('https://github.com/openshift/docs/pull/123')
    expect(result).toEqual({
      type: 'github',
      owner: 'openshift',
      repo: 'docs',
      number: '123'
    })
  })

  it('returns null for unrecognized URL', () => {
    expect(parseMrUrl('https://example.com/something')).toBeNull()
  })

  it('returns null for null/undefined', () => {
    expect(parseMrUrl(null)).toBeNull()
    expect(parseMrUrl(undefined)).toBeNull()
  })
})

describe('resolveGitlabToken', () => {
  afterEach(() => {
    init({})
  })

  it('returns GITLAB_CEE_REDHAT_DOCS_TOKEN for gitlab.cee.redhat.com', () => {
    init({ GITLAB_CEE_REDHAT_DOCS_TOKEN: 'cee-token' })
    expect(resolveGitlabToken('https://gitlab.cee.redhat.com')).toBe('cee-token')
  })

  it('returns GITLAB_TOKEN for gitlab.com', () => {
    init({ GITLAB_TOKEN: 'gl-token' })
    expect(resolveGitlabToken('https://gitlab.com')).toBe('gl-token')
  })

  it('returns GITLAB_TOKEN for other GitLab hosts', () => {
    init({ GITLAB_TOKEN: 'gl-token' })
    expect(resolveGitlabToken('https://gitlab.example.com')).toBe('gl-token')
  })

  it('returns null when no token is set', () => {
    init({})
    expect(resolveGitlabToken('https://gitlab.com')).toBeNull()
  })
})

describe('enrichMRStatuses', () => {
  let mockFetch

  beforeEach(() => {
    mockFetch = () => Promise.resolve({ ok: false, status: 404 })
    _setFetch((...args) => mockFetch(...args))
    init({})
  })

  afterEach(() => {
    _setFetch(globalThis.fetch)
    init({})
  })

  it('does nothing for empty issues', async () => {
    await enrichMRStatuses([])
  })

  it('does nothing for issues with no mrLinks', async () => {
    const issues = [{ key: 'TEST-1', mrLinks: [] }]
    await enrichMRStatuses(issues)
    expect(issues[0].mrStatuses).toEqual({})
  })

  it('skips URLs when no token is available', async () => {
    const issues = [{
      key: 'TEST-1',
      mrLinks: ['https://gitlab.com/org/repo/-/merge_requests/1']
    }]
    await enrichMRStatuses(issues)
    expect(issues[0].mrStatuses).toEqual({})
  })

  it('fetches GitLab MR state and attaches to issue', async () => {
    init({ GITLAB_TOKEN: 'test-token' })
    mockFetch = (url, opts) => {
      expect(url).toContain('/api/v4/projects/')
      expect(opts.headers.Authorization).toBe('Bearer test-token')
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ state: 'merged' })
      })
    }

    const issues = [{
      key: 'TEST-1',
      mrLinks: ['https://gitlab.com/org/repo/-/merge_requests/42']
    }]
    await enrichMRStatuses(issues)
    expect(issues[0].mrStatuses).toEqual({
      'https://gitlab.com/org/repo/-/merge_requests/42': 'merged'
    })
  })

  it('uses GITLAB_CEE_REDHAT_DOCS_TOKEN for gitlab.cee.redhat.com', async () => {
    init({ GITLAB_CEE_REDHAT_DOCS_TOKEN: 'cee-token' })
    mockFetch = (url, opts) => {
      expect(opts.headers.Authorization).toBe('Bearer cee-token')
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ state: 'opened' })
      })
    }

    const issues = [{
      key: 'TEST-1',
      mrLinks: ['https://gitlab.cee.redhat.com/docs/project/-/merge_requests/5']
    }]
    await enrichMRStatuses(issues)
    expect(issues[0].mrStatuses).toEqual({
      'https://gitlab.cee.redhat.com/docs/project/-/merge_requests/5': 'opened'
    })
  })

  it('fetches GitHub PR state — merged', async () => {
    init({ GITHUB_TOKEN: 'gh-token' })
    mockFetch = (url, opts) => {
      expect(url).toContain('/repos/openshift/docs/pulls/10')
      expect(opts.headers.Authorization).toBe('Bearer gh-token')
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ state: 'closed', merged: true })
      })
    }

    const issues = [{
      key: 'TEST-1',
      mrLinks: ['https://github.com/openshift/docs/pull/10']
    }]
    await enrichMRStatuses(issues)
    expect(issues[0].mrStatuses).toEqual({
      'https://github.com/openshift/docs/pull/10': 'merged'
    })
  })

  it('fetches GitHub PR state — open', async () => {
    init({ GITHUB_TOKEN: 'gh-token' })
    mockFetch = () => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ state: 'open', merged: false })
    })

    const issues = [{
      key: 'TEST-1',
      mrLinks: ['https://github.com/openshift/docs/pull/10']
    }]
    await enrichMRStatuses(issues)
    expect(issues[0].mrStatuses).toEqual({
      'https://github.com/openshift/docs/pull/10': 'opened'
    })
  })

  it('handles API errors gracefully', async () => {
    init({ GITLAB_TOKEN: 'test-token' })
    mockFetch = () => Promise.resolve({ ok: false, status: 404 })

    const issues = [{
      key: 'TEST-1',
      mrLinks: ['https://gitlab.com/org/repo/-/merge_requests/999']
    }]
    await enrichMRStatuses(issues)
    expect(issues[0].mrStatuses).toEqual({})
  })

  it('handles network errors gracefully', async () => {
    init({ GITLAB_TOKEN: 'test-token' })
    mockFetch = () => Promise.reject(new Error('ECONNREFUSED'))

    const issues = [{
      key: 'TEST-1',
      mrLinks: ['https://gitlab.com/org/repo/-/merge_requests/1']
    }]
    await enrichMRStatuses(issues)
    expect(issues[0].mrStatuses).toEqual({})
  })

  it('deduplicates URLs across multiple issues', async () => {
    init({ GITLAB_TOKEN: 'test-token' })
    let callCount = 0
    mockFetch = () => {
      callCount++
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ state: 'merged' })
      })
    }

    const url = 'https://gitlab.com/org/repo/-/merge_requests/1'
    const issues = [
      { key: 'TEST-1', mrLinks: [url] },
      { key: 'TEST-2', mrLinks: [url] }
    ]
    await enrichMRStatuses(issues)
    expect(callCount).toBe(1)
    expect(issues[0].mrStatuses).toEqual({ [url]: 'merged' })
    expect(issues[1].mrStatuses).toEqual({ [url]: 'merged' })
  })

  it('handles mixed GitLab and GitHub URLs', async () => {
    init({ GITLAB_TOKEN: 'gl-token', GITHUB_TOKEN: 'gh-token' })
    mockFetch = (url) => {
      if (url.includes('api.github.com')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ state: 'open', merged: false })
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ state: 'merged' })
      })
    }

    const issues = [{
      key: 'TEST-1',
      mrLinks: [
        'https://gitlab.com/org/repo/-/merge_requests/1',
        'https://github.com/org/repo/pull/2'
      ]
    }]
    await enrichMRStatuses(issues)
    expect(issues[0].mrStatuses).toEqual({
      'https://gitlab.com/org/repo/-/merge_requests/1': 'merged',
      'https://github.com/org/repo/pull/2': 'opened'
    })
  })
})
