import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock external dependencies before importing the module
vi.mock('../../../../shared/server/jira', () => ({
  JIRA_HOST: 'https://test.atlassian.net',
  jiraRequest: vi.fn()
}))
vi.mock('../../server/jira/person-metrics', () => ({ fetchPersonMetrics: vi.fn() }))
vi.mock('../../server/github/contributions', () => ({ fetchGithubData: vi.fn() }))
vi.mock('../../server/gitlab/contributions', () => ({ fetchGitlabData: vi.fn() }))
vi.mock('../../../../shared/server/roster-sync', () => ({
  runSync: vi.fn(),
  scheduleSync: vi.fn()
}))
vi.mock('../../server/snapshots', () => ({
  getCompletedPeriods: vi.fn(() => []),
  getCurrentPeriod: vi.fn(() => null)
}))

const express = require('express')
const registerRoutes = require('../../server/index')
const rosterSyncConfig = require('../../../../shared/server/roster-sync/config')

function makeStorage(data) {
  return {
    readFromStorage(key) {
      return data[key] !== undefined ? JSON.parse(JSON.stringify(data[key])) : null
    },
    writeToStorage() {},
    listStorageFiles() { return [] },
    deleteStorageDirectory() {}
  }
}

function makeMember(name, uid, opts = {}) {
  return {
    name, uid,
    email: `${uid}@example.com`,
    title: opts.title || 'Engineer',
    miroTeam: opts.miroTeam || null,
    githubUsername: null,
    gitlabUsername: null,
    ...opts
  }
}

/**
 * Convert old roster format + config to registry format for tests.
 * Takes { vp, orgs } and config.orgRoots and produces
 * { 'team-data/registry.json': {...}, 'team-data/config.json': {...} }
 */
function toRegistryData(rosterData, configData) {
  const people = {}
  const orgRootUids = (configData?.orgRoots || []).map(r => r.uid)

  if (rosterData && rosterData.orgs) {
    for (const [orgKey, org] of Object.entries(rosterData.orgs)) {
      if (org.leader) {
        const p = { ...org.leader }
        p.orgRoot = orgKey
        p.status = 'active'
        p.firstSeenAt = '2026-01-01T00:00:00.000Z'
        p.lastSeenAt = '2026-01-15T00:00:00.000Z'
        p.inactiveSince = null
        p.managerUid = p.managerUid || null
        p.github = p.githubUsername ? { username: p.githubUsername, source: 'ldap' } : null
        p.gitlab = p.gitlabUsername ? { username: p.gitlabUsername, source: 'ldap' } : null
        people[p.uid] = p
      }
      if (org.members) {
        for (const m of org.members) {
          const p = { ...m }
          p.orgRoot = orgKey
          p.status = 'active'
          p.firstSeenAt = '2026-01-01T00:00:00.000Z'
          p.lastSeenAt = '2026-01-15T00:00:00.000Z'
          p.inactiveSince = null
          p.managerUid = p.managerUid || null
          p.github = p.githubUsername ? { username: p.githubUsername, source: 'ldap' } : null
          p.gitlab = p.gitlabUsername ? { username: p.gitlabUsername, source: 'ldap' } : null
          people[p.uid] = p
        }
      }
    }
  }

  const result = {
    'team-data/registry.json': {
      meta: {
        generatedAt: '2026-01-15T00:00:00.000Z',
        provider: 'test',
        orgRoots: orgRootUids.length > 0 ? orgRootUids : Object.keys(rosterData?.orgs || {}),
        vp: rosterData?.vp || null
      },
      people
    }
  }

  if (configData) {
    result['team-data/config.json'] = configData
  } else {
    // Build minimal config with orgRoots from roster keys
    result['team-data/config.json'] = {
      orgRoots: Object.keys(rosterData?.orgs || {}).map(uid => ({ uid }))
    }
  }

  return result
}

const http = require('http')

function createTestServer(storageData) {
  const app = express()
  app.use(express.json())
  const router = express.Router()
  const storage = makeStorage(storageData)
  registerRoutes(router, {
    storage,
    requireAdmin: (_req, _res, next) => next()
  })
  app.use(router)
  return app
}

function requestGet(app, path) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app)
    server.listen(0, () => {
      const port = server.address().port
      http.get(`http://127.0.0.1:${port}${path}`, (res) => {
        let data = ''
        res.on('data', chunk => { data += chunk })
        res.on('end', () => {
          server.close()
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) })
          } catch {
            resolve({ status: res.statusCode, body: data })
          }
        })
      }).on('error', (err) => {
        server.close()
        reject(err)
      })
    })
  })
}

describe('deriveRoster org merging', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rosterSyncConfig.clearDisplayNamesCache()
  })

  it('merges orgs with the same explicitly-configured displayName', async () => {
    const config = {
      orgRoots: [
        { uid: 'uid_beta', displayName: 'Platform Team' },
        { uid: 'uid_alpha', displayName: 'Platform Team' }
      ]
    }
    const roster = {
      vp: { name: 'VP', uid: 'vp1', title: 'VP' },
      orgs: {
        uid_beta: {
          leader: { name: 'Leader B', uid: 'uid_beta', title: 'Manager' },
          members: [makeMember('Alice', 'alice', { miroTeam: 'TeamA' })]
        },
        uid_alpha: {
          leader: { name: 'Leader A', uid: 'uid_alpha', title: 'Manager' },
          members: [makeMember('Bob', 'bob', { miroTeam: 'TeamB' })]
        }
      }
    }
    const app = createTestServer(toRegistryData(roster, config))

    const { status, body } = await requestGet(app, '/roster')
    expect(status).toBe(200)

    const { orgs } = body
    expect(orgs).toHaveLength(1)

    const merged = orgs[0]
    expect(merged.key).toBe('uid_alpha')
    expect(merged.displayName).toBe('Platform Team')
    expect(merged.mergedKeys).toEqual(['uid_alpha', 'uid_beta'])
    expect(merged.teams).toHaveProperty('TeamA')
    expect(merged.teams).toHaveProperty('TeamB')
  })

  it('does not merge orgs without explicit displayName', async () => {
    const roster = {
      vp: { name: 'VP', uid: 'vp1', title: 'VP' },
      orgs: {
        uid_x: {
          leader: { name: 'Same Name', uid: 'uid_x', title: 'Manager' },
          members: [makeMember('Alice', 'alice')]
        },
        uid_y: {
          leader: { name: 'Same Name', uid: 'uid_y', title: 'Manager' },
          members: [makeMember('Bob', 'bob')]
        }
      }
    }
    const app = createTestServer(toRegistryData(roster, null))

    const { body } = await requestGet(app, '/roster')
    expect(body.orgs).toHaveLength(2)
  })

  it('handles team name collision by deduplicating members', async () => {
    const config = {
      orgRoots: [
        { uid: 'uid_a', displayName: 'Merged' },
        { uid: 'uid_b', displayName: 'Merged' }
      ]
    }
    const roster = {
      vp: { name: 'VP', uid: 'vp1', title: 'VP' },
      orgs: {
        uid_a: {
          leader: { name: 'Leader A', uid: 'uid_a', title: 'Manager' },
          members: [
            makeMember('Alice', 'alice', { miroTeam: 'Shared' }),
            makeMember('Common Person', 'common', { miroTeam: 'Shared' })
          ]
        },
        uid_b: {
          leader: { name: 'Leader B', uid: 'uid_b', title: 'Manager' },
          members: [
            makeMember('Bob', 'bob', { miroTeam: 'Shared' }),
            makeMember('Common Person', 'common2', { miroTeam: 'Shared' })
          ]
        }
      }
    }
    const app = createTestServer(toRegistryData(roster, config))

    const { body } = await requestGet(app, '/roster')
    const merged = body.orgs[0]
    const sharedTeam = merged.teams['Shared']

    const names = sharedTeam.members.map(m => m.name)
    const commonCount = names.filter(n => n === 'Common Person').length
    expect(commonCount).toBe(1)
  })

  it('uses alphabetically first UID as canonical key', async () => {
    const config = {
      orgRoots: [
        { uid: 'uid_zebra', displayName: 'Same' },
        { uid: 'uid_alpha', displayName: 'Same' }
      ]
    }
    const roster = {
      vp: { name: 'VP', uid: 'vp1', title: 'VP' },
      orgs: {
        uid_zebra: {
          leader: { name: 'Leader Z', uid: 'uid_zebra', title: 'Manager' },
          members: []
        },
        uid_alpha: {
          leader: { name: 'Leader A', uid: 'uid_alpha', title: 'Manager' },
          members: []
        }
      }
    }
    const app = createTestServer(toRegistryData(roster, config))

    const { body } = await requestGet(app, '/roster')
    const merged = body.orgs[0]
    expect(merged.key).toBe('uid_alpha')
    expect(merged.leader.name).toBe('Leader A')
  })

  it('does not include mergedKeyMap in API response', async () => {
    const config = {
      orgRoots: [{ uid: 'uid_a', displayName: 'Org' }]
    }
    const roster = {
      vp: { name: 'VP', uid: 'vp1', title: 'VP' },
      orgs: {
        uid_a: {
          leader: { name: 'Leader', uid: 'uid_a', title: 'Manager' },
          members: []
        }
      }
    }
    const app = createTestServer(toRegistryData(roster, config))

    const { body } = await requestGet(app, '/roster')
    expect(body).not.toHaveProperty('mergedKeyMap')
  })

  it('resolves secondary key in team metrics lookup', async () => {
    const config = {
      orgRoots: [
        { uid: 'uid_alpha', displayName: 'Merged' },
        { uid: 'uid_beta', displayName: 'Merged' }
      ]
    }
    const roster = {
      vp: { name: 'VP', uid: 'vp1', title: 'VP' },
      orgs: {
        uid_alpha: {
          leader: { name: 'Leader A', uid: 'uid_alpha', title: 'Manager' },
          members: [makeMember('Alice', 'alice', { miroTeam: 'TeamA' })]
        },
        uid_beta: {
          leader: { name: 'Leader B', uid: 'uid_beta', title: 'Manager' },
          members: [makeMember('Bob', 'bob', { miroTeam: 'TeamB' })]
        }
      }
    }
    const app = createTestServer(toRegistryData(roster, config))

    // Access using secondary key uid_beta::TeamB
    const { status, body } = await requestGet(app, '/team/' + encodeURIComponent('uid_beta::TeamB') + '/metrics')
    expect(status).toBe(200)
    expect(body.members).toBeDefined()
    const memberNames = body.members.map(m => m.name)
    expect(memberNames).toContain('Bob')
  })

  it('keeps orgs with different displayNames separate', async () => {
    const config = {
      orgRoots: [
        { uid: 'uid_a', displayName: 'Team Alpha' },
        { uid: 'uid_b', displayName: 'Team Beta' }
      ]
    }
    const roster = {
      vp: { name: 'VP', uid: 'vp1', title: 'VP' },
      orgs: {
        uid_a: {
          leader: { name: 'Leader A', uid: 'uid_a', title: 'Manager' },
          members: []
        },
        uid_b: {
          leader: { name: 'Leader B', uid: 'uid_b', title: 'Manager' },
          members: []
        }
      }
    }
    const app = createTestServer(toRegistryData(roster, config))

    const { body } = await requestGet(app, '/roster')
    expect(body.orgs).toHaveLength(2)
  })

  it('does not add mergedKeys to non-merged orgs', async () => {
    const config = {
      orgRoots: [{ uid: 'uid_only', displayName: 'Solo Org' }]
    }
    const roster = {
      vp: { name: 'VP', uid: 'vp1', title: 'VP' },
      orgs: {
        uid_only: {
          leader: { name: 'Leader', uid: 'uid_only', title: 'Manager' },
          members: []
        }
      }
    }
    const app = createTestServer(toRegistryData(roster, config))

    const { body } = await requestGet(app, '/roster')
    expect(body.orgs[0]).not.toHaveProperty('mergedKeys')
  })
})
