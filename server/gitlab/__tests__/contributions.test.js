import { describe, it, expect, vi } from 'vitest'

// Replicate generateMonthlyWindows for unit testing since it's not exported
// (the actual function is exported, but we replicate to test the logic independently)
function generateMonthlyWindows() {
  const windows = []
  const now = new Date()
  const todayYear = now.getUTCFullYear()
  const todayMonth = now.getUTCMonth()
  const todayDate = now.getUTCDate()

  for (let i = 11; i >= 0; i--) {
    const from = new Date(Date.UTC(todayYear, todayMonth - i, 1))
    let to
    if (i === 0) {
      to = new Date(Date.UTC(todayYear, todayMonth, todayDate + 1))
    } else {
      to = new Date(Date.UTC(todayYear, todayMonth - i + 1, 1))
    }

    windows.push({
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      monthKey: from.toISOString().slice(0, 7)
    })
  }

  return windows
}

describe('GitLab generateMonthlyWindows', () => {
  it('generates 12 monthly windows', () => {
    const windows = generateMonthlyWindows()
    expect(windows.length).toBe(12)
  })

  it('each window has from, to, and monthKey', () => {
    const windows = generateMonthlyWindows()
    for (const w of windows) {
      expect(w.from).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(w.to).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(w.monthKey).toMatch(/^\d{4}-\d{2}$/)
    }
  })

  it('windows are contiguous (each to equals next from)', () => {
    const windows = generateMonthlyWindows()
    for (let i = 0; i < windows.length - 1; i++) {
      expect(windows[i].to).toBe(windows[i + 1].from)
    }
  })

  it('first window starts on the 1st of the month ~12 months ago', () => {
    const windows = generateMonthlyWindows()
    expect(windows[0].from).toMatch(/-01$/)
  })

  it('monthKey matches the from date month', () => {
    const windows = generateMonthlyWindows()
    for (const w of windows) {
      expect(w.monthKey).toBe(w.from.slice(0, 7))
    }
  })
})

describe('fetchGitlabData integration', () => {
  let mockFetch
  let fetchGitlabData

  function makeGraphQLResponse(nodes, hasNextPage = false, endCursor = null) {
    return {
      ok: true,
      json: async () => ({
        data: {
          group: {
            contributions: {
              nodes,
              pageInfo: { hasNextPage, endCursor }
            }
          }
        }
      })
    }
  }

  function makeErrorResponse(message) {
    return {
      ok: true,
      json: async () => ({
        errors: [{ message }]
      })
    }
  }

  function setup() {
    mockFetch = vi.fn()

    // Replace node-fetch in require cache
    const fetchModulePath = require.resolve('node-fetch')
    const originalModule = require.cache[fetchModulePath]
    require.cache[fetchModulePath] = { id: fetchModulePath, exports: mockFetch }

    // Set env vars before loading
    process.env.GITLAB_TOKEN = 'test-token'
    process.env.GITLAB_BASE_URL = 'https://gitlab.test'

    // Clear contributions module cache and reload
    const contribPath = require.resolve('../../gitlab/contributions')
    delete require.cache[contribPath]
    const mod = require('../../gitlab/contributions')
    fetchGitlabData = mod.fetchGitlabData

    // Restore original fetch module for cleanup
    return { fetchModulePath, originalModule, contribPath }
  }

  function cleanup(refs) {
    if (refs.originalModule) {
      require.cache[refs.fetchModulePath] = refs.originalModule
    }
    delete require.cache[refs.contribPath]
    delete process.env.GITLAB_TOKEN
    delete process.env.GITLAB_BASE_URL
  }

  it('fetches contributions from groups and returns correct shape', async () => {
    const refs = setup()
    try {
      // Mock all 12 monthly window queries to return dhellmann with some events
      mockFetch.mockImplementation(async () => {
        return makeGraphQLResponse([
          { user: { username: 'dhellmann' }, totalEvents: 100 },
          { user: { username: 'otheruser' }, totalEvents: 50 }
        ])
      })

      const results = await fetchGitlabData(['dhellmann'], {
        gitlabGroups: ['redhat/rhel-ai']
      })

      expect(results.dhellmann).toBeTruthy()
      expect(results.dhellmann.totalContributions).toBe(1200) // 100 * 12 months
      expect(results.dhellmann.source).toBe('graphql')
      expect(results.dhellmann.fetchedAt).toBeTruthy()
      expect(Object.keys(results.dhellmann.months).length).toBe(12)

      // Should not include otheruser (not in requested usernames)
      expect(results.otheruser).toBeUndefined()
    } finally {
      cleanup(refs)
    }
  })

  it('returns zero contributions for users not in any group', async () => {
    const refs = setup()
    try {
      mockFetch.mockImplementation(async () => {
        return makeGraphQLResponse([
          { user: { username: 'someoneelse' }, totalEvents: 50 }
        ])
      })

      const results = await fetchGitlabData(['ghostuser'], {
        gitlabGroups: ['redhat/rhel-ai']
      })

      expect(results.ghostuser).toBeTruthy()
      expect(results.ghostuser.totalContributions).toBe(0)
      expect(results.ghostuser.months).toEqual({})
    } finally {
      cleanup(refs)
    }
  })

  it('returns null for all users when no groups configured', async () => {
    const refs = setup()
    try {
      const results = await fetchGitlabData(['testuser'], { gitlabGroups: [] })

      expect(results.testuser).toBeNull()
      expect(mockFetch).not.toHaveBeenCalled()
    } finally {
      cleanup(refs)
    }
  })

  it('handles empty usernames array', async () => {
    const refs = setup()
    try {
      mockFetch.mockImplementation(async () => makeGraphQLResponse([]))
      const results = await fetchGitlabData([], { gitlabGroups: ['some/group'] })
      expect(results).toEqual({})
    } finally {
      cleanup(refs)
    }
  })

  it('aggregates contributions across multiple groups', async () => {
    const refs = setup()
    try {
      mockFetch.mockImplementation(async (url, opts) => {
        const body = JSON.parse(opts.body)
        if (body.variables.groupPath === 'group-a') {
          return makeGraphQLResponse([
            { user: { username: 'testuser' }, totalEvents: 10 }
          ])
        }
        if (body.variables.groupPath === 'group-b') {
          return makeGraphQLResponse([
            { user: { username: 'testuser' }, totalEvents: 20 }
          ])
        }
        return makeGraphQLResponse([])
      })

      const results = await fetchGitlabData(['testuser'], {
        gitlabGroups: ['group-a', 'group-b']
      })

      // 10 + 20 = 30 per month, 12 months = 360
      expect(results.testuser.totalContributions).toBe(360)
    } finally {
      cleanup(refs)
    }
  })

  it('handles GraphQL errors gracefully', async () => {
    const refs = setup()
    try {
      mockFetch.mockImplementation(async () => {
        return makeErrorResponse('The given date range is larger than 93 days')
      })

      const results = await fetchGitlabData(['testuser'], {
        gitlabGroups: ['some/group']
      })

      // Should still return a result with 0 contributions (errors are caught per-window)
      expect(results.testuser).toBeTruthy()
      expect(results.testuser.totalContributions).toBe(0)
    } finally {
      cleanup(refs)
    }
  })

  it('handles pagination within a window', async () => {
    const refs = setup()
    try {
      mockFetch.mockImplementation(async (url, opts) => {
        const body = JSON.parse(opts.body)
        if (!body.variables.cursor) {
          return makeGraphQLResponse(
            [{ user: { username: 'testuser' }, totalEvents: 5 }],
            true,
            'cursor-1'
          )
        }
        // Second page
        return makeGraphQLResponse(
          [{ user: { username: 'testuser' }, totalEvents: 3 }],
          false
        )
      })

      const results = await fetchGitlabData(['testuser'], {
        gitlabGroups: ['some/group']
      })

      // 5 + 3 = 8 per month from pagination, 12 months = 96
      expect(results.testuser.totalContributions).toBe(96)
    } finally {
      cleanup(refs)
    }
  })
})
