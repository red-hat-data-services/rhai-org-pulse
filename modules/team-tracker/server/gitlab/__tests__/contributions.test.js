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

describe('validateInstances', () => {
  let validateInstances

  function setup() {
    const contribPath = require.resolve('../../gitlab/contributions')
    delete require.cache[contribPath]
    const mod = require('../../gitlab/contributions')
    validateInstances = mod.validateInstances
    return { contribPath }
  }

  function cleanup(refs) {
    delete require.cache[refs.contribPath]
  }

  it('valid instance passes validation', () => {
    const refs = setup()
    try {
      const result = validateInstances([{
        label: 'GitLab.com',
        baseUrl: 'https://gitlab.com',
        tokenEnvVar: 'GITLAB_TOKEN',
        groups: ['redhat/rhoai']
      }])
      expect(result).toHaveLength(1)
      expect(result[0].label).toBe('GitLab.com')
    } finally {
      cleanup(refs)
    }
  })

  it('missing baseUrl is rejected', () => {
    const refs = setup()
    try {
      const result = validateInstances([{
        label: 'Test',
        tokenEnvVar: 'TOKEN',
        groups: []
      }])
      expect(result).toHaveLength(0)
    } finally {
      cleanup(refs)
    }
  })

  it('missing tokenEnvVar is rejected', () => {
    const refs = setup()
    try {
      const result = validateInstances([{
        label: 'Test',
        baseUrl: 'https://gitlab.com',
        groups: []
      }])
      expect(result).toHaveLength(0)
    } finally {
      cleanup(refs)
    }
  })

  it('non-https baseUrl is rejected', () => {
    const refs = setup()
    try {
      const result = validateInstances([{
        label: 'Test',
        baseUrl: 'http://gitlab.com',
        tokenEnvVar: 'TOKEN',
        groups: []
      }])
      expect(result).toHaveLength(0)
    } finally {
      cleanup(refs)
    }
  })

  it('empty groups array is allowed', () => {
    const refs = setup()
    try {
      const result = validateInstances([{
        label: 'Test',
        baseUrl: 'https://gitlab.com',
        tokenEnvVar: 'TOKEN',
        groups: []
      }])
      expect(result).toHaveLength(1)
    } finally {
      cleanup(refs)
    }
  })

  it('missing label is rejected', () => {
    const refs = setup()
    try {
      const result = validateInstances([{
        baseUrl: 'https://gitlab.com',
        tokenEnvVar: 'TOKEN',
        groups: []
      }])
      expect(result).toHaveLength(0)
    } finally {
      cleanup(refs)
    }
  })

  it('non-array groups is rejected', () => {
    const refs = setup()
    try {
      const result = validateInstances([{
        label: 'Test',
        baseUrl: 'https://gitlab.com',
        tokenEnvVar: 'TOKEN',
        groups: 'not-an-array'
      }])
      expect(result).toHaveLength(0)
    } finally {
      cleanup(refs)
    }
  })

  it('returns empty array for non-array input', () => {
    const refs = setup()
    try {
      expect(validateInstances(null)).toEqual([])
      expect(validateInstances(undefined)).toEqual([])
      expect(validateInstances('string')).toEqual([])
    } finally {
      cleanup(refs)
    }
  })

  it('filters out invalid entries while keeping valid ones', () => {
    const refs = setup()
    try {
      const result = validateInstances([
        { label: 'Valid', baseUrl: 'https://gitlab.com', tokenEnvVar: 'TOKEN', groups: [] },
        { label: 'Bad URL', baseUrl: 'http://bad.com', tokenEnvVar: 'TOKEN', groups: [] },
        { label: 'Also Valid', baseUrl: 'https://internal.gl', tokenEnvVar: 'TOKEN2', groups: ['g'] }
      ])
      expect(result).toHaveLength(2)
      expect(result[0].label).toBe('Valid')
      expect(result[1].label).toBe('Also Valid')
    } finally {
      cleanup(refs)
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

  function makeInstance(overrides = {}) {
    return {
      label: 'Test GitLab',
      baseUrl: 'https://gitlab.test',
      tokenEnvVar: 'GITLAB_TOKEN',
      groups: ['redhat/rhel-ai'],
      ...overrides
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
  }

  it('fetches contributions from instances and returns correct shape', async () => {
    const refs = setup()
    try {
      mockFetch.mockImplementation(async () => {
        return makeGraphQLResponse([
          { user: { username: 'dhellmann' }, totalEvents: 100 },
          { user: { username: 'otheruser' }, totalEvents: 50 }
        ])
      })

      const results = await fetchGitlabData(['dhellmann'], {
        gitlabInstances: [makeInstance()]
      })

      expect(results.dhellmann).toBeTruthy()
      expect(results.dhellmann.totalContributions).toBe(1200) // 100 * 12 months
      expect(results.dhellmann.source).toBe('graphql')
      expect(results.dhellmann.instances).toBeDefined()
      expect(results.dhellmann.fetchedAt).toBeTruthy()
      expect(Object.keys(results.dhellmann.months).length).toBe(12)
      // Should have instances array
      expect(results.dhellmann.instances).toBeTruthy()
      expect(results.dhellmann.instances).toHaveLength(1)
      expect(results.dhellmann.instances[0].baseUrl).toBe('https://gitlab.test')
      expect(results.dhellmann.instances[0].contributions).toBe(1200)

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
        gitlabInstances: [makeInstance()]
      })

      expect(results.ghostuser).toBeTruthy()
      expect(results.ghostuser.totalContributions).toBe(0)
      expect(results.ghostuser.months).toEqual({})
    } finally {
      cleanup(refs)
    }
  })

  it('returns null for all users when no instances configured', async () => {
    const refs = setup()
    try {
      const results = await fetchGitlabData(['testuser'], { gitlabInstances: [] })

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
      const results = await fetchGitlabData([], { gitlabInstances: [makeInstance()] })
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
        gitlabInstances: [makeInstance({ groups: ['group-a', 'group-b'] })]
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
        gitlabInstances: [makeInstance()]
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
        gitlabInstances: [makeInstance()]
      })

      // 5 + 3 = 8 per month from pagination, 12 months = 96
      expect(results.testuser.totalContributions).toBe(96)
    } finally {
      cleanup(refs)
    }
  })

  it('skips instances with missing token env var', async () => {
    const refs = setup()
    try {
      delete process.env.MISSING_TOKEN

      mockFetch.mockImplementation(async () => {
        return makeGraphQLResponse([
          { user: { username: 'testuser' }, totalEvents: 10 }
        ])
      })

      const results = await fetchGitlabData(['testuser'], {
        gitlabInstances: [
          makeInstance(),
          makeInstance({ label: 'No Token', baseUrl: 'https://other.gl', tokenEnvVar: 'MISSING_TOKEN', groups: ['some/group'] })
        ]
      })

      // Only the first instance contributes (second is skipped)
      expect(results.testuser.totalContributions).toBe(120) // 10 * 12
      expect(results.testuser.instances).toHaveLength(1)
    } finally {
      cleanup(refs)
    }
  })

  it('should skip excluded groups within an instance', async () => {
    const refs = setup()
    try {
      const queriedGroups = []
      mockFetch.mockImplementation(async (url, opts) => {
        const body = JSON.parse(opts.body)
        queriedGroups.push(body.variables.groupPath)
        return makeGraphQLResponse([
          { user: { username: 'testuser' }, totalEvents: 10 }
        ])
      })

      await fetchGitlabData(['testuser'], {
        gitlabInstances: [
          makeInstance({
            groups: ['group-a', 'group-b', 'group-c'],
            excludeGroups: ['group-b']
          })
        ]
      })

      // Verify group-b was not queried
      expect(queriedGroups).not.toContain('group-b')
      expect(queriedGroups).toContain('group-a')
      expect(queriedGroups).toContain('group-c')
    } finally {
      cleanup(refs)
    }
  })

  it('merges contributions across multiple instances', async () => {
    const refs = setup()
    try {
      process.env.GITLAB_TOKEN_2 = 'token-2'

      mockFetch.mockImplementation(async (url) => {
        if (url.startsWith('https://gitlab.test/')) {
          return makeGraphQLResponse([
            { user: { username: 'testuser' }, totalEvents: 10 }
          ])
        }
        if (url.startsWith('https://internal.gl/')) {
          return makeGraphQLResponse([
            { user: { username: 'testuser' }, totalEvents: 5 }
          ])
        }
        return makeGraphQLResponse([])
      })

      const results = await fetchGitlabData(['testuser'], {
        gitlabInstances: [
          makeInstance(),
          makeInstance({ label: 'Internal', baseUrl: 'https://internal.gl', tokenEnvVar: 'GITLAB_TOKEN_2', groups: ['internal/proj'] })
        ]
      })

      // 10 + 5 = 15 per month, 12 months = 180
      expect(results.testuser.totalContributions).toBe(180)
      expect(results.testuser.instances).toHaveLength(2)

      const inst1 = results.testuser.instances.find(i => i.baseUrl === 'https://gitlab.test')
      const inst2 = results.testuser.instances.find(i => i.baseUrl === 'https://internal.gl')
      expect(inst1.contributions).toBe(120)
      expect(inst2.contributions).toBe(60)
    } finally {
      delete process.env.GITLAB_TOKEN_2
      cleanup(refs)
    }
  })

  it('should aggregate only from non-excluded groups', async () => {
    const refs = setup()
    try {
      mockFetch.mockImplementation(async (url, opts) => {
        const body = JSON.parse(opts.body)
        if (body.variables.groupPath === 'group-a') {
          return makeGraphQLResponse([
            { user: { username: 'testuser' }, totalEvents: 10 }
          ])
        }
        if (body.variables.groupPath === 'group-c') {
          return makeGraphQLResponse([
            { user: { username: 'testuser' }, totalEvents: 20 }
          ])
        }
        // group-b should not be called
        return makeGraphQLResponse([])
      })

      const results = await fetchGitlabData(['testuser'], {
        gitlabInstances: [
          makeInstance({
            groups: ['group-a', 'group-b', 'group-c'],
            excludeGroups: ['group-b']
          })
        ]
      })

      // 10 + 20 = 30 per month (group-b excluded), 12 months = 360
      expect(results.testuser.totalContributions).toBe(360)
    } finally {
      cleanup(refs)
    }
  })
})
