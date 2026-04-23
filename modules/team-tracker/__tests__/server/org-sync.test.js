import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node-fetch', () => ({ default: vi.fn() }))

// Clear the org display names cache before each test
const rosterSyncConfig = require('../../../../shared/server/roster-sync/config')
const googleSheets = require('../../../../shared/server/google-sheets')

const {
  deriveTeamsFromPeople,
  runSync,
  calculateHeadcountByRole,
} = require('../../server/org-sync')

function makeStorage(data) {
  return {
    readFromStorage(key) {
      return data[key] !== undefined ? JSON.parse(JSON.stringify(data[key])) : null
    },
    writeToStorage: vi.fn((key, value) => { data[key] = value }),
  }
}

function makeRosterData(orgRoots, people) {
  // Build team-data/registry.json structure
  const registryPeople = {}
  for (const p of people) {
    registryPeople[p.uid] = {
      ...p,
      orgRoot: p.orgKey,
      status: 'active',
      firstSeenAt: '2026-01-01T00:00:00.000Z',
      lastSeenAt: '2026-01-15T00:00:00.000Z',
      inactiveSince: null,
      github: p.githubUsername ? { username: p.githubUsername, source: 'ldap' } : null,
      gitlab: p.gitlabUsername ? { username: p.gitlabUsername, source: 'ldap' } : null,
    }
  }
  return {
    'team-data/registry.json': {
      meta: {
        generatedAt: '2026-01-15T00:00:00.000Z',
        provider: 'test',
        orgRoots: orgRoots.map(r => r.uid),
        vp: null
      },
      people: registryPeople
    },
    'team-data/config.json': { orgRoots },
  }
}

describe('deriveTeamsFromPeople', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear the org display names cache
    rosterSyncConfig.saveConfig({ readFromStorage: () => ({}), writeToStorage: () => {} }, {})
  })

  it('builds teams from people _teamGrouping values', () => {
    const data = makeRosterData(
      [{ uid: 'org1', displayName: 'Org Alpha' }],
      [
        { orgKey: 'org1', name: 'Alice', uid: 'alice', email: 'a@t.com', title: 'Eng', _teamGrouping: 'Team A' },
        { orgKey: 'org1', name: 'Bob', uid: 'bob', email: 'b@t.com', title: 'Eng', _teamGrouping: 'Team B' },
        { orgKey: 'org1', name: 'Leader', uid: 'leader', email: 'l@t.com', title: 'Lead' },
      ]
    )
    const storage = makeStorage(data)

    const teams = deriveTeamsFromPeople(storage)
    expect(teams).toHaveLength(2)
    expect(teams).toEqual(expect.arrayContaining([
      { org: 'Org Alpha', name: 'Team A', boardUrls: [] },
      { org: 'Org Alpha', name: 'Team B', boardUrls: [] },
    ]))
  })

  it('handles comma-separated multi-team values', () => {
    const data = makeRosterData(
      [{ uid: 'org1', displayName: 'Org Alpha' }],
      [
        { orgKey: 'org1', name: 'Alice', uid: 'alice', email: 'a@t.com', title: 'Eng', _teamGrouping: 'Team A, Team B' },
        { orgKey: 'org1', name: 'Leader', uid: 'leader', email: 'l@t.com', title: 'Lead' },
      ]
    )
    const storage = makeStorage(data)

    const teams = deriveTeamsFromPeople(storage)
    expect(teams).toHaveLength(2)
    expect(teams.map(t => t.name)).toEqual(['Team A', 'Team B'])
  })

  it('skips people with no org mapping', () => {
    const data = {
      'team-data/registry.json': {
        meta: { generatedAt: '2026-01-15T00:00:00.000Z', provider: 'test', orgRoots: [], vp: null },
        people: {
          n: { uid: 'n', name: 'Nobody', email: 'n@t.com', title: 'Eng', orgRoot: 'unknown', status: 'active', _teamGrouping: 'Team A', github: null, gitlab: null, firstSeenAt: '2026-01-01T00:00:00.000Z', lastSeenAt: '2026-01-15T00:00:00.000Z', inactiveSince: null }
        }
      },
      'team-data/config.json': { orgRoots: [] },
    }
    const storage = makeStorage(data)

    const teams = deriveTeamsFromPeople(storage)
    expect(teams).toHaveLength(0)
  })

  it('skips people with empty _teamGrouping', () => {
    const data = makeRosterData(
      [{ uid: 'org1', displayName: 'Org Alpha' }],
      [
        { orgKey: 'org1', name: 'Alice', uid: 'alice', email: 'a@t.com', title: 'Eng', _teamGrouping: '' },
        { orgKey: 'org1', name: 'Bob', uid: 'bob', email: 'b@t.com', title: 'Eng' },
        { orgKey: 'org1', name: 'Leader', uid: 'leader', email: 'l@t.com', title: 'Lead' },
      ]
    )
    const storage = makeStorage(data)

    const teams = deriveTeamsFromPeople(storage)
    expect(teams).toHaveLength(0)
  })

  it('deduplicates teams from multiple people', () => {
    const data = makeRosterData(
      [{ uid: 'org1', displayName: 'Org Alpha' }],
      [
        { orgKey: 'org1', name: 'Alice', uid: 'alice', email: 'a@t.com', title: 'Eng', _teamGrouping: 'Team A' },
        { orgKey: 'org1', name: 'Bob', uid: 'bob', email: 'b@t.com', title: 'Eng', _teamGrouping: 'Team A' },
        { orgKey: 'org1', name: 'Leader', uid: 'leader', email: 'l@t.com', title: 'Lead', _teamGrouping: 'Team A' },
      ]
    )
    const storage = makeStorage(data)

    const teams = deriveTeamsFromPeople(storage)
    expect(teams).toHaveLength(1)
    expect(teams[0].name).toBe('Team A')
  })

  it('falls back to miroTeam when _teamGrouping is absent', () => {
    const data = makeRosterData(
      [{ uid: 'org1', displayName: 'Org Alpha' }],
      [
        { orgKey: 'org1', name: 'Alice', uid: 'alice', email: 'a@t.com', title: 'Eng', miroTeam: 'Legacy Team' },
        { orgKey: 'org1', name: 'Leader', uid: 'leader', email: 'l@t.com', title: 'Lead' },
      ]
    )
    const storage = makeStorage(data)

    const teams = deriveTeamsFromPeople(storage)
    expect(teams).toHaveLength(1)
    expect(teams[0].name).toBe('Legacy Team')
  })
})

describe('runSync', () => {
  let fetchRawSheetSpy

  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
    rosterSyncConfig.saveConfig({ readFromStorage: () => ({}), writeToStorage: () => {} }, {})
    fetchRawSheetSpy = vi.spyOn(googleSheets, 'fetchRawSheet')
  })

  it('derives teams from people when sheetId is null', async () => {
    const data = makeRosterData(
      [{ uid: 'org1', displayName: 'Org Alpha' }],
      [
        { orgKey: 'org1', name: 'Alice', uid: 'alice', email: 'a@t.com', title: 'Eng', _teamGrouping: 'Team A' },
        { orgKey: 'org1', name: 'Bob', uid: 'bob', email: 'b@t.com', title: 'Eng', _teamGrouping: 'Team B' },
        { orgKey: 'org1', name: 'Leader', uid: 'leader', email: 'l@t.com', title: 'Lead' },
      ]
    )
    const storage = makeStorage(data)

    const result = await runSync(storage, null, {})
    expect(result.status).toBe('success')
    expect(result.teamCount).toBe(2)

    const meta = data['org-roster/teams-metadata.json']
    expect(meta).toBeTruthy()
    expect(meta.teams).toHaveLength(2)
  })

  it('falls back to derived teams when team-boards tab fetch fails', async () => {
    const data = makeRosterData(
      [{ uid: 'org1', displayName: 'Org Alpha' }],
      [
        { orgKey: 'org1', name: 'Alice', uid: 'alice', email: 'a@t.com', title: 'Eng', _teamGrouping: 'Fallback Team' },
        { orgKey: 'org1', name: 'Leader', uid: 'leader', email: 'l@t.com', title: 'Lead' },
      ]
    )
    const storage = makeStorage(data)
    fetchRawSheetSpy.mockRejectedValue(new Error('Sheet not found'))

    const result = await runSync(storage, 'sheet123', { teamBoardsTab: 'Missing Tab' })
    expect(result.status).toBe('success')
    expect(result.teamCount).toBe(1)

    const meta = data['org-roster/teams-metadata.json']
    expect(meta.teams[0].name).toBe('Fallback Team')
  })

  it('skips sheet fetch and board resolution when no tabs configured and no URLs', async () => {
    const data = makeRosterData(
      [{ uid: 'org1', displayName: 'Org Alpha' }],
      [
        { orgKey: 'org1', name: 'Alice', uid: 'alice', email: 'a@t.com', title: 'Eng', _teamGrouping: 'Team A' },
        { orgKey: 'org1', name: 'Leader', uid: 'leader', email: 'l@t.com', title: 'Lead' },
      ]
    )
    const storage = makeStorage(data)

    await runSync(storage, null, {})

    expect(fetchRawSheetSpy).not.toHaveBeenCalled()
  })
})

describe('calculateHeadcountByRole', () => {
  it('uses _teamGrouping before miroTeam for FTE calculation', () => {
    const people = [
      { _teamGrouping: 'A, B', miroTeam: 'C', engineeringSpeciality: 'SWE' },
    ]
    const result = calculateHeadcountByRole(people)
    // _teamGrouping has 2 teams, so FTE should be 0.5
    expect(result.totalFte).toBe(0.5)
    expect(result.totalHeadcount).toBe(1)
  })
})
