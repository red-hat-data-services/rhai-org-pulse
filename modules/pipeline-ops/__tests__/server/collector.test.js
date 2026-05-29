import { describe, it, expect, beforeEach } from 'vitest'

const { mergeRuns, pruneRuns, resolveToken, extractRepoPath } = await import('../../server/collector.js')

describe('extractRepoPath', () => {
  it('extracts path from GitLab URL', () => {
    expect(extractRepoPath('https://gitlab.com/redhat/rhel-ai/agentic-ci/rfe-autofixer'))
      .toBe('redhat/rhel-ai/agentic-ci/rfe-autofixer')
  })

  it('extracts path from GitHub URL', () => {
    expect(extractRepoPath('https://github.com/red-hat-data-services/fips-compliance'))
      .toBe('red-hat-data-services/fips-compliance')
  })

  it('strips .git suffix', () => {
    expect(extractRepoPath('https://gitlab.com/org/repo.git'))
      .toBe('org/repo')
  })

  it('returns null for invalid URL', () => {
    expect(extractRepoPath('not-a-url')).toBeNull()
  })
})

describe('resolveToken', () => {
  beforeEach(() => {
    delete process.env.GITLAB_TOKEN
    delete process.env.GITLAB_CEE_REDHAT_DOCS_TOKEN
    delete process.env.GITHUB_TOKEN
  })

  it('returns GITHUB_TOKEN for github pipelines', () => {
    process.env.GITHUB_TOKEN = 'gh-token'
    const token = resolveToken({ repo: { url: 'https://github.com/org/repo', platform: 'github' } })
    expect(token).toBe('gh-token')
  })

  it('returns GITLAB_TOKEN for gitlab.com pipelines', () => {
    process.env.GITLAB_TOKEN = 'gl-token'
    const token = resolveToken({ repo: { url: 'https://gitlab.com/org/repo', platform: 'gitlab' } })
    expect(token).toBe('gl-token')
  })

  it('returns GITLAB_CEE_REDHAT_DOCS_TOKEN for internal GitLab', () => {
    process.env.GITLAB_CEE_REDHAT_DOCS_TOKEN = 'cee-token'
    const token = resolveToken({ repo: { url: 'https://gitlab.cee.redhat.com/org/repo', platform: 'gitlab' } })
    expect(token).toBe('cee-token')
  })

  it('falls back to GITLAB_TOKEN for internal GitLab when CEE token missing', () => {
    process.env.GITLAB_TOKEN = 'gl-token'
    const token = resolveToken({ repo: { url: 'https://gitlab.cee.redhat.com/org/repo', platform: 'gitlab' } })
    expect(token).toBe('gl-token')
  })

  it('returns null when no token set', () => {
    const token = resolveToken({ repo: { url: 'https://gitlab.com/org/repo', platform: 'gitlab' } })
    expect(token).toBeNull()
  })
})

describe('mergeRuns', () => {
  it('deduplicates by id, preferring fresh', () => {
    const existing = [
      { id: '1', status: 'running', startedAt: '2026-05-28T06:00:00Z' },
      { id: '2', status: 'success', startedAt: '2026-05-27T06:00:00Z' },
    ]
    const fresh = [
      { id: '1', status: 'success', startedAt: '2026-05-28T06:00:00Z' },
      { id: '3', status: 'success', startedAt: '2026-05-28T12:00:00Z' },
    ]
    const merged = mergeRuns(existing, fresh)
    expect(merged).toHaveLength(3)
    expect(merged[0].id).toBe('3')
    expect(merged.find(r => r.id === '1').status).toBe('success')
  })

  it('sorts newest first', () => {
    const runs = mergeRuns(
      [{ id: '1', startedAt: '2026-05-26T00:00:00Z' }],
      [{ id: '2', startedAt: '2026-05-28T00:00:00Z' }]
    )
    expect(runs[0].id).toBe('2')
    expect(runs[1].id).toBe('1')
  })
})

describe('pruneRuns', () => {
  it('removes runs older than retentionDays', () => {
    const now = Date.now()
    const runs = [
      { id: '1', startedAt: new Date(now - 10 * 86400000).toISOString() },
      { id: '2', startedAt: new Date(now - 40 * 86400000).toISOString() },
    ]
    const pruned = pruneRuns(runs, 30)
    expect(pruned).toHaveLength(1)
    expect(pruned[0].id).toBe('1')
  })

  it('keeps all runs within retention window', () => {
    const now = Date.now()
    const runs = [
      { id: '1', startedAt: new Date(now - 1 * 86400000).toISOString() },
      { id: '2', startedAt: new Date(now - 5 * 86400000).toISOString() },
    ]
    const pruned = pruneRuns(runs, 30)
    expect(pruned).toHaveLength(2)
  })
})
