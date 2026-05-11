import { describe, it, expect } from 'vitest'

const teamStore = require('../server/team-store')

function makeStorage(initial = {}) {
  const data = { ...initial }
  return {
    readFromStorage(key) { return data[key] ? JSON.parse(JSON.stringify(data[key])) : null },
    writeToStorage(key, val) { data[key] = JSON.parse(JSON.stringify(val)) },
    _data: data
  }
}

function storageWithTeam(teamOverrides = {}) {
  return makeStorage({
    'team-data/teams.json': {
      teams: {
        team_abc: {
          id: 'team_abc',
          name: 'Platform',
          orgKey: 'achen',
          metadata: {},
          boards: [
            { url: 'https://jira.example.com/board/old', name: 'Old Board' }
          ],
          ...teamOverrides
        }
      }
    },
    'audit-log.json': { entries: [] }
  })
}

describe('updateTeamBoards', () => {
  it('replaces the entire boards array', () => {
    const storage = storageWithTeam()
    const newBoards = [
      { url: 'https://jira.example.com/board/1', name: 'Board One' },
      { url: 'https://jira.example.com/board/2', name: 'Board Two' }
    ]

    const result = teamStore.updateTeamBoards(storage, 'team_abc', newBoards, 'admin@test.com')

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ url: 'https://jira.example.com/board/1', name: 'Board One' })
    expect(result[1]).toEqual({ url: 'https://jira.example.com/board/2', name: 'Board Two' })

    // Verify persisted data matches
    const persisted = storage._data['team-data/teams.json'].teams.team_abc.boards
    expect(persisted).toEqual(result)
  })

  it('defaults name to empty string when not provided', () => {
    const storage = storageWithTeam()
    const boards = [
      { url: 'https://jira.example.com/board/1' },
      { url: 'https://jira.example.com/board/2', name: undefined },
      { url: 'https://jira.example.com/board/3', name: null },
      { url: 'https://jira.example.com/board/4', name: 42 }
    ]

    const result = teamStore.updateTeamBoards(storage, 'team_abc', boards, 'admin@test.com')

    expect(result[0].name).toBe('')
    expect(result[1].name).toBe('')
    expect(result[2].name).toBe('')
    expect(result[3].name).toBe('')
  })

  it('preserves url values exactly', () => {
    const storage = storageWithTeam()
    const url = 'https://redhat.atlassian.net/jira/software/c/projects/RHOAIENG/boards/1103'
    const result = teamStore.updateTeamBoards(storage, 'team_abc', [{ url, name: '' }], 'admin@test.com')

    expect(result[0].url).toBe(url)
  })

  it('returns null for unknown team', () => {
    const storage = storageWithTeam()
    const result = teamStore.updateTeamBoards(storage, 'team_nonexistent', [], 'admin@test.com')
    expect(result).toBeNull()
  })

  it('can set boards to an empty array', () => {
    const storage = storageWithTeam()
    const result = teamStore.updateTeamBoards(storage, 'team_abc', [], 'admin@test.com')

    expect(result).toEqual([])
    expect(storage._data['team-data/teams.json'].teams.team_abc.boards).toEqual([])
  })

  it('rejects javascript: URLs', () => {
    const storage = storageWithTeam()
    expect(() => {
      teamStore.updateTeamBoards(storage, 'team_abc', [{ url: 'javascript:alert(1)', name: '' }], 'admin@test.com')
    }).toThrow('must start with https:// or http://')
  })

  it('rejects data: URLs', () => {
    const storage = storageWithTeam()
    expect(() => {
      teamStore.updateTeamBoards(storage, 'team_abc', [{ url: 'data:text/html,<h1>XSS</h1>', name: '' }], 'admin@test.com')
    }).toThrow('must start with https:// or http://')
  })

  it('accepts http:// URLs', () => {
    const storage = storageWithTeam()
    const result = teamStore.updateTeamBoards(storage, 'team_abc', [{ url: 'http://jira.local/board/1', name: '' }], 'admin@test.com')
    expect(result[0].url).toBe('http://jira.local/board/1')
  })

  it('rejects boards array exceeding 50 entries', () => {
    const storage = storageWithTeam()
    const boards = Array.from({ length: 51 }, (_, i) => ({ url: `https://example.com/board/${i}`, name: '' }))
    expect(() => {
      teamStore.updateTeamBoards(storage, 'team_abc', boards, 'admin@test.com')
    }).toThrow('exceeds maximum of 50')
  })

  it('rejects URL exceeding 2048 characters', () => {
    const storage = storageWithTeam()
    const longUrl = 'https://example.com/' + 'a'.repeat(2040)
    expect(() => {
      teamStore.updateTeamBoards(storage, 'team_abc', [{ url: longUrl, name: '' }], 'admin@test.com')
    }).toThrow('exceeds maximum length of 2048')
  })

  it('truncates name to 200 characters', () => {
    const storage = storageWithTeam()
    const longName = 'A'.repeat(300)
    const result = teamStore.updateTeamBoards(storage, 'team_abc', [{ url: 'https://example.com/board/1', name: longName }], 'admin@test.com')
    expect(result[0].name).toHaveLength(200)
  })

  it('creates an audit log entry with correct fields', () => {
    const storage = storageWithTeam()
    const boards = [{ url: 'https://jira.example.com/board/new', name: 'New Board' }]

    teamStore.updateTeamBoards(storage, 'team_abc', boards, 'admin@test.com')

    const log = storage._data['audit-log.json']
    expect(log.entries).toHaveLength(1)
    const entry = log.entries[0]
    expect(entry.action).toBe('team.boards.update')
    expect(entry.actor).toBe('admin@test.com')
    expect(entry.entityType).toBe('team')
    expect(entry.entityId).toBe('team_abc')
    expect(entry.entityLabel).toBe('Platform')
    expect(entry.field).toBe('boards')
    expect(entry.oldValue).toEqual([{ url: 'https://jira.example.com/board/old', name: 'Old Board' }])
    expect(entry.newValue).toEqual([{ url: 'https://jira.example.com/board/new', name: 'New Board' }])
  })
})
