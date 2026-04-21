import { describe, it, expect } from 'vitest'

const teamStore = require('../../../../shared/server/team-store')

function makeStorage(initial = {}) {
  const data = { ...initial }
  return {
    readFromStorage(key) { return data[key] ? JSON.parse(JSON.stringify(data[key])) : null },
    writeToStorage(key, val) { data[key] = JSON.parse(JSON.stringify(val)) },
    _data: data
  }
}

describe('team-store updateTeamFields', () => {
  it('sets team field values', () => {
    const storage = makeStorage({
      'team-data/teams.json': {
        teams: {
          team_abc: { id: 'team_abc', name: 'Platform', orgKey: 'achen', metadata: {} }
        }
      },
      'audit-log.json': { entries: [] }
    })

    const result = teamStore.updateTeamFields(storage, 'team_abc', { field_x: 'hello' }, 'admin@test.com')
    expect(result.metadata).toEqual({ field_x: 'hello' })
  })

  it('handles multi-value arrays', () => {
    const storage = makeStorage({
      'team-data/teams.json': {
        teams: {
          team_abc: { id: 'team_abc', name: 'Platform', orgKey: 'achen', metadata: {} }
        }
      },
      'audit-log.json': { entries: [] }
    })

    const result = teamStore.updateTeamFields(storage, 'team_abc', { field_x: ['A', 'B'] }, 'admin@test.com')
    expect(result.metadata.field_x).toEqual(['A', 'B'])
  })

  it('returns null for unknown team', () => {
    const storage = makeStorage({
      'team-data/teams.json': { teams: {} },
      'audit-log.json': { entries: [] }
    })

    const result = teamStore.updateTeamFields(storage, 'team_nope', { field_x: 'y' }, 'admin@test.com')
    expect(result).toBeNull()
  })

  it('creates audit log entries', () => {
    const storage = makeStorage({
      'team-data/teams.json': {
        teams: {
          team_abc: { id: 'team_abc', name: 'Platform', orgKey: 'achen', metadata: {} }
        }
      },
      'audit-log.json': { entries: [] }
    })

    teamStore.updateTeamFields(storage, 'team_abc', { field_x: 'hello' }, 'admin@test.com')
    const log = storage._data['audit-log.json']
    expect(log.entries.length).toBeGreaterThan(0)
    expect(log.entries[0].action).toBe('team.field.update')
  })
})
