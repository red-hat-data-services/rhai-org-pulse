import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const {
  validateGithubCandidates,
  validateGitlabCandidates,
  validateAmbiguousUsernames,
  _setFetch
} = require('../username-validation')

const mockFetch = vi.fn()

beforeEach(() => {
  mockFetch.mockReset()
  _setFetch(mockFetch)
})

afterEach(() => {
  _setFetch(globalThis.fetch)
})

describe('validateGithubCandidates', () => {
  it('returns the first User-type candidate', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ login: 'project-koku', type: 'Organization' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ login: 'chambridge', type: 'User' })
      })

    var result = await validateGithubCandidates(['project-koku', 'chambridge'])
    expect(result).toBe('chambridge')
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('returns null when all candidates are orgs', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ login: 'some-org', type: 'Organization' })
    })

    var result = await validateGithubCandidates(['org-a', 'org-b'])
    expect(result).toBeNull()
  })

  it('returns first candidate if it is a User', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ login: 'jdoe', type: 'User' })
    })

    var result = await validateGithubCandidates(['jdoe', 'some-org'])
    expect(result).toBe('jdoe')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('handles API errors gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('network error'))

    var result = await validateGithubCandidates(['jdoe'])
    expect(result).toBeNull()
  })

  it('handles non-ok responses', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 })

    var result = await validateGithubCandidates(['nonexistent'])
    expect(result).toBeNull()
  })

  it('uses githubToken when provided via options', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ login: 'jdoe', type: 'User' })
    })

    await validateGithubCandidates(['jdoe'], { githubToken: 'test-token' })

    var headers = mockFetch.mock.calls[0][1].headers
    expect(headers.Authorization).toBe('token test-token')
  })
})

describe('validateGitlabCandidates', () => {
  it('returns candidate when user exists', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([{ username: 'jdoe', id: 123 }])
    })

    var result = await validateGitlabCandidates(['jdoe'])
    expect(result).toBe('jdoe')
  })

  it('returns null when user does not exist', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([])
    })

    var result = await validateGitlabCandidates(['some-group'])
    expect(result).toBeNull()
  })

  it('tries next candidate when first is not a user', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ([]) })
      .mockResolvedValueOnce({ ok: true, json: async () => ([{ username: 'jdoe', id: 123 }]) })

    var result = await validateGitlabCandidates(['some-group', 'jdoe'])
    expect(result).toBe('jdoe')
  })
})

describe('validateAmbiguousUsernames', () => {
  it('validates GitHub candidates and updates person', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ login: 'project-koku', type: 'Organization' })
      })

    var people = [{
      uid: 'chambrid',
      name: 'Chris Hambridge',
      githubUsername: 'project-koku',
      _usernameValidation: { github: ['project-koku'] }
    }]

    var stats = await validateAmbiguousUsernames(people)

    expect(people[0].githubUsername).toBeNull()
    expect(people[0]._usernameValidation).toBeUndefined()
    expect(stats.githubCleared).toBe(1)
  })

  it('skips people without _usernameValidation', async () => {
    var people = [
      { uid: 'jdoe', name: 'John Doe', githubUsername: 'jdoe' }
    ]

    var stats = await validateAmbiguousUsernames(people)

    expect(people[0].githubUsername).toBe('jdoe')
    expect(stats.githubValidated).toBe(0)
    expect(stats.githubCleared).toBe(0)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('picks the valid user from multiple candidates', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ login: 'project-koku', type: 'Organization' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ login: 'chambridge', type: 'User' })
      })

    var people = [{
      uid: 'chambrid',
      name: 'Chris Hambridge',
      githubUsername: 'project-koku',
      _usernameValidation: { github: ['project-koku', 'chambridge'] }
    }]

    var stats = await validateAmbiguousUsernames(people)

    expect(people[0].githubUsername).toBe('chambridge')
    expect(stats.githubValidated).toBe(1)
  })
})
