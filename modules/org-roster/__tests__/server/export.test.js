import { describe, it, expect } from 'vitest'

const { buildMapping } = require('../../../../shared/server/anonymize')
const orgRosterExport = require('../../server/export')

const FIXTURE_ROSTER = {
  vp: { name: 'Demo VP', uid: 'demovp' },
  orgs: {
    demoorg1: {
      leader: {
        name: 'Alice Chen', uid: 'achen', email: 'achen@example.com',
        githubUsername: 'alicechen', gitlabUsername: 'alicechen'
      },
      members: [
        {
          name: 'Bob Smith', uid: 'bsmith', email: 'bsmith@example.com',
          githubUsername: 'bobsmith', gitlabUsername: 'bobsmith'
        }
      ]
    }
  }
}

function makeStorage(data = {}) {
  return {
    readFromStorage(key) {
      return data[key] !== undefined ? JSON.parse(JSON.stringify(data[key])) : null
    },
    writeToStorage() {},
    listStorageFiles(dir) {
      return Object.keys(data)
        .filter(k => k.startsWith(dir + '/') && k.endsWith('.json'))
        .map(k => k.slice(dir.length + 1))
    }
  }
}

describe('orgRosterExport', () => {
  it('anonymizes org-roster/config.json orgNameMapping keys and values', async () => {
    const files = []
    const addFile = (path, data) => files.push({ path, data })
    const mapping = buildMapping(FIXTURE_ROSTER)
    const storage = makeStorage({
      'org-roster/config.json': {
        teamBoardsTab: 'Scrum Team Boards',
        jiraProject: 'RHAIRFE',
        orgNameMapping: {
          achen: 'Alice Chen'
        }
      }
    })

    await orgRosterExport(addFile, storage, mapping)

    const configFile = files.find(f => f.path === 'org-roster/config.json')
    expect(configFile).toBeDefined()

    // orgNameMapping keys (UIDs) should be anonymized
    expect(configFile.data.orgNameMapping['achen']).toBeUndefined()
    const keys = Object.keys(configFile.data.orgNameMapping)
    expect(keys.length).toBe(1)
    expect(keys[0]).toMatch(/^person\d+$/)

    // orgNameMapping values (names) should be anonymized
    expect(Object.values(configFile.data.orgNameMapping)[0]).toMatch(/^Person \d+$/)

    // jiraProject should be anonymized
    expect(configFile.data.jiraProject).toBe('TESTPROJECT')

    // Non-PII fields preserved
    expect(configFile.data.teamBoardsTab).toBe('Scrum Team Boards')
  })

  it('anonymizes org-roster/teams-metadata.json', async () => {
    const files = []
    const addFile = (path, data) => files.push({ path, data })
    const mapping = buildMapping(FIXTURE_ROSTER)

    // Add Alice Chen's name to the mapping as an "org" display name too
    // In real usage, org names in teams-metadata are display names from sheets, not mapped names
    const storage = makeStorage({
      'org-roster/teams-metadata.json': {
        fetchedAt: '2026-03-24T12:00:00Z',
        teams: [
          {
            org: 'Demo Org 1',
            name: 'Platform',
            boardUrls: ['https://redhat.atlassian.net/boards/100'],
            pms: ['Alice Chen']
          }
        ],
        boardNames: { 'https://redhat.atlassian.net/boards/100': 'Platform Board' }
      }
    })

    await orgRosterExport(addFile, storage, mapping)

    const metaFile = files.find(f => f.path === 'org-roster/teams-metadata.json')
    expect(metaFile).toBeDefined()

    const team = metaFile.data.teams[0]

    // PMs should be anonymized
    expect(team.pms[0]).not.toBe('Alice Chen')
    expect(team.pms[0]).toMatch(/^Person \d+$/)

    // Board URLs should be anonymized
    expect(team.boardUrls[0]).toMatch(/^https:\/\/jira\.example\.com/)

    // boardNames should be cleared
    expect(metaFile.data.boardNames).toEqual({})

    // Team name preserved (not PII)
    expect(team.name).toBe('Platform')
  })

  it('passes through components.json as-is', async () => {
    const files = []
    const addFile = (path, data) => files.push({ path, data })
    const mapping = buildMapping(FIXTURE_ROSTER)
    const components = {
      components: { 'Platform Core': ['Platform'] }
    }
    const storage = makeStorage({ 'org-roster/components.json': components })

    await orgRosterExport(addFile, storage, mapping)

    const compFile = files.find(f => f.path === 'org-roster/components.json')
    expect(compFile).toBeDefined()
    expect(compFile.data).toEqual(components)
  })

  it('anonymizes rfe-backlog.json composite keys', async () => {
    const files = []
    const addFile = (path, data) => files.push({ path, data })
    const mapping = buildMapping(FIXTURE_ROSTER)

    // Add the org display name to mapping so anonymizeValue can find it
    mapping.nameToFake['Demo Org 1'] = 'Fake Org 1'

    const storage = makeStorage({
      'org-roster/rfe-backlog.json': {
        fetchedAt: '2026-03-24T12:00:00Z',
        byComponent: { 'Platform Core': { count: 12 } },
        byTeam: { 'Demo Org 1::Platform': { count: 20 } }
      }
    })

    await orgRosterExport(addFile, storage, mapping)

    const rfeFile = files.find(f => f.path === 'org-roster/rfe-backlog.json')
    expect(rfeFile).toBeDefined()

    // Original composite key should not exist
    expect(rfeFile.data.byTeam['Demo Org 1::Platform']).toBeUndefined()

    // New key should have anonymized org part
    const keys = Object.keys(rfeFile.data.byTeam)
    expect(keys.length).toBe(1)
    expect(keys[0]).toContain('::Platform')
    expect(keys[0]).not.toContain('Demo Org 1')

    // byComponent preserved (component names are not PII)
    expect(rfeFile.data.byComponent).toEqual({ 'Platform Core': { count: 12 } })
  })

  it('passes through sync-status.json as-is', async () => {
    const files = []
    const addFile = (path, data) => files.push({ path, data })
    const mapping = buildMapping(FIXTURE_ROSTER)
    const syncStatus = { lastSyncAt: '2026-03-24', status: 'success' }
    const storage = makeStorage({ 'org-roster/sync-status.json': syncStatus })

    await orgRosterExport(addFile, storage, mapping)

    const ssFile = files.find(f => f.path === 'org-roster/sync-status.json')
    expect(ssFile).toBeDefined()
    expect(ssFile.data).toEqual(syncStatus)
  })

  it('handles missing files gracefully', async () => {
    const files = []
    const addFile = (path, data) => files.push({ path, data })
    const mapping = buildMapping(FIXTURE_ROSTER)
    const storage = makeStorage({})

    await orgRosterExport(addFile, storage, mapping)

    // No files should be added since nothing exists
    expect(files.length).toBe(0)
  })
})
