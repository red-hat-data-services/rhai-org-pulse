import { describe, it, expect } from 'vitest'

const { getManagerPurview } = require('../../server/manager-purview')

function makeRegistry(people) {
  return { people }
}

function makeTeams(teams) {
  const teamsMap = {}
  for (const t of teams) {
    teamsMap[t.id] = t
  }
  return { teams: teamsMap }
}

describe('getManagerPurview', () => {
  it('returns both teams when manager has reports on 2 teams', () => {
    const registry = makeRegistry({
      mgr: { uid: 'mgr', status: 'active', managerUid: null },
      alice: { uid: 'alice', status: 'active', managerUid: 'mgr', teamIds: ['team_a'] },
      bob: { uid: 'bob', status: 'active', managerUid: 'mgr', teamIds: ['team_b'] }
    })
    const teamsData = makeTeams([
      { id: 'team_a', name: 'Alpha', orgKey: 'org1', metadata: {}, boards: [] },
      { id: 'team_b', name: 'Beta', orgKey: 'org1', metadata: {}, boards: [] }
    ])

    const result = getManagerPurview('mgr', registry, teamsData)

    expect(result.directReportUids).toEqual(expect.arrayContaining(['alice', 'bob']))
    expect(result.directReportUids).toHaveLength(2)
    expect(result.teams).toHaveLength(2)

    const teamA = result.teams.find(t => t.id === 'team_a')
    expect(teamA.directReportUids).toEqual(['alice'])
    expect(teamA.totalMemberCount).toBe(1)

    const teamB = result.teams.find(t => t.id === 'team_b')
    expect(teamB.directReportUids).toEqual(['bob'])
    expect(teamB.totalMemberCount).toBe(1)
  })

  it('returns reports but empty teams when reports have no team assignments', () => {
    const registry = makeRegistry({
      mgr: { uid: 'mgr', status: 'active', managerUid: null },
      alice: { uid: 'alice', status: 'active', managerUid: 'mgr' },
      bob: { uid: 'bob', status: 'active', managerUid: 'mgr', teamIds: [] }
    })
    const teamsData = makeTeams([
      { id: 'team_a', name: 'Alpha', orgKey: 'org1', metadata: {}, boards: [] }
    ])

    const result = getManagerPurview('mgr', registry, teamsData)

    expect(result.directReportUids).toEqual(expect.arrayContaining(['alice', 'bob']))
    expect(result.directReportUids).toHaveLength(2)
    expect(result.teams).toHaveLength(0)
  })

  it('deduplicates team when multiple reports are on the same team', () => {
    const registry = makeRegistry({
      mgr: { uid: 'mgr', status: 'active', managerUid: null },
      alice: { uid: 'alice', status: 'active', managerUid: 'mgr', teamIds: ['team_a'] },
      bob: { uid: 'bob', status: 'active', managerUid: 'mgr', teamIds: ['team_a'] },
      charlie: { uid: 'charlie', status: 'active', managerUid: 'other', teamIds: ['team_a'] }
    })
    const teamsData = makeTeams([
      { id: 'team_a', name: 'Alpha', orgKey: 'org1', metadata: {}, boards: [] }
    ])

    const result = getManagerPurview('mgr', registry, teamsData)

    expect(result.teams).toHaveLength(1)
    expect(result.teams[0].directReportUids).toEqual(expect.arrayContaining(['alice', 'bob']))
    expect(result.teams[0].directReportUids).toHaveLength(2)
    // totalMemberCount includes charlie (not a direct report but on the team)
    expect(result.teams[0].totalMemberCount).toBe(3)
  })

  it('excludes inactive reports', () => {
    const registry = makeRegistry({
      mgr: { uid: 'mgr', status: 'active', managerUid: null },
      alice: { uid: 'alice', status: 'active', managerUid: 'mgr', teamIds: ['team_a'] },
      bob: { uid: 'bob', status: 'inactive', managerUid: 'mgr', teamIds: ['team_a'] }
    })
    const teamsData = makeTeams([
      { id: 'team_a', name: 'Alpha', orgKey: 'org1', metadata: {}, boards: [] }
    ])

    const result = getManagerPurview('mgr', registry, teamsData)

    expect(result.directReportUids).toEqual(['alice'])
    expect(result.teams).toHaveLength(1)
    expect(result.teams[0].directReportUids).toEqual(['alice'])
  })

  it('reports with no teamIds are in directReportUids but not in any team', () => {
    const registry = makeRegistry({
      mgr: { uid: 'mgr', status: 'active', managerUid: null },
      alice: { uid: 'alice', status: 'active', managerUid: 'mgr', teamIds: ['team_a'] },
      bob: { uid: 'bob', status: 'active', managerUid: 'mgr' }
    })
    const teamsData = makeTeams([
      { id: 'team_a', name: 'Alpha', orgKey: 'org1', metadata: {}, boards: [] }
    ])

    const result = getManagerPurview('mgr', registry, teamsData)

    expect(result.directReportUids).toEqual(expect.arrayContaining(['alice', 'bob']))
    expect(result.directReportUids).toHaveLength(2)
    expect(result.teams).toHaveLength(1)
    expect(result.teams[0].directReportUids).toEqual(['alice'])
  })

  it('handles null teamsData', () => {
    const registry = makeRegistry({
      mgr: { uid: 'mgr', status: 'active', managerUid: null },
      alice: { uid: 'alice', status: 'active', managerUid: 'mgr', teamIds: ['team_a'] }
    })

    const result = getManagerPurview('mgr', registry, null)

    expect(result.directReportUids).toEqual(['alice'])
    expect(result.teams).toHaveLength(0)
  })

  it('handles manager with no reports', () => {
    const registry = makeRegistry({
      mgr: { uid: 'mgr', status: 'active', managerUid: null },
      alice: { uid: 'alice', status: 'active', managerUid: 'other', teamIds: ['team_a'] }
    })
    const teamsData = makeTeams([
      { id: 'team_a', name: 'Alpha', orgKey: 'org1', metadata: {}, boards: [] }
    ])

    const result = getManagerPurview('mgr', registry, teamsData)

    expect(result.directReportUids).toHaveLength(0)
    expect(result.teams).toHaveLength(0)
  })
})
