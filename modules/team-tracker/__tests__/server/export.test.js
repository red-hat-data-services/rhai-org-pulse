import { describe, it, expect } from 'vitest'

const { buildMapping } = require('../../../../shared/server/anonymize')

// We test the export hook by calling it with mock addFile and storage
const teamTrackerExport = require('../../server/export')

// Old-format roster for buildMapping (expects { vp, orgs: { key: { leader, members } } })
const FIXTURE_ROSTER = {
  vp: { name: 'Demo VP', uid: 'demovp', title: 'VP of Engineering' },
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

// Registry-format fixture for storage (what readRosterFull reads)
const FIXTURE_REGISTRY = {
  meta: {
    generatedAt: '2026-01-15T00:00:00.000Z',
    provider: 'test',
    orgRoots: ['achen'],
    vp: { name: 'Demo VP', uid: 'demovp' }
  },
  people: {
    achen: {
      uid: 'achen', name: 'Alice Chen', email: 'achen@example.com',
      title: 'Senior Engineering Manager', orgRoot: 'achen',
      github: { username: 'alicechen', source: 'ldap' },
      gitlab: { username: 'alicechen', source: 'ldap' },
      status: 'active', firstSeenAt: '2026-01-01T00:00:00.000Z',
      lastSeenAt: '2026-01-15T00:00:00.000Z', inactiveSince: null
    },
    bsmith: {
      uid: 'bsmith', name: 'Bob Smith', email: 'bsmith@example.com',
      title: 'Senior Software Engineer', orgRoot: 'achen',
      github: { username: 'bobsmith', source: 'ldap' },
      gitlab: { username: 'bobsmith', source: 'ldap' },
      status: 'active', firstSeenAt: '2026-01-01T00:00:00.000Z',
      lastSeenAt: '2026-01-15T00:00:00.000Z', inactiveSince: null
    }
  }
}

const FIXTURE_CONFIG = {
  orgRoots: [{ uid: 'achen', name: 'Alice Chen', displayName: 'Alice Chen' }]
}

function registryStorage(extra = {}) {
  return {
    'team-data/registry.json': FIXTURE_REGISTRY,
    'team-data/config.json': FIXTURE_CONFIG,
    ...extra
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

describe('teamTrackerExport', () => {
  it('anonymizes roster data', async () => {
    const files = []
    const addFile = (path, data) => files.push({ path, data })
    const storage = makeStorage(registryStorage())
    const mapping = buildMapping(FIXTURE_ROSTER)

    await teamTrackerExport(addFile, storage, mapping)

    const rosterFile = files.find(f => f.path === 'org-roster-full.json')
    expect(rosterFile).toBeDefined()

    // VP name should be anonymized
    expect(rosterFile.data.vp.name).not.toBe('Demo VP')
    expect(rosterFile.data.vp.name).toMatch(/^Person \d+$/)

    // Org keys should be anonymized (org keys that aren't roster UIDs get "former" mappings)
    expect(rosterFile.data.orgs['demoorg1']).toBeUndefined()
    const orgKeys = Object.keys(rosterFile.data.orgs)
    expect(orgKeys.length).toBe(1)
    expect(orgKeys[0]).not.toBe('demoorg1')

    // Leader name should be anonymized
    const org = rosterFile.data.orgs[orgKeys[0]]
    expect(org.leader.name).not.toBe('Alice Chen')
    expect(org.leader.name).toMatch(/^Person \d+$/)
  })

  it('anonymizes people files with renamed filenames', async () => {
    const files = []
    const addFile = (path, data) => files.push({ path, data })
    const storage = makeStorage(registryStorage({
      'people/bob_smith.json': {
        jiraDisplayName: 'Bob Smith',
        fetchedAt: '2026-03-10T12:00:00.000Z',
        resolved: {
          count: 5,
          issues: [
            { key: 'DEMO-101', summary: 'Real summary', type: 'Story', status: 'Done' }
          ]
        },
        inProgress: { count: 0, issues: [] }
      }
    }))
    const mapping = buildMapping(FIXTURE_ROSTER)

    await teamTrackerExport(addFile, storage, mapping)

    const peopleFiles = files.filter(f => f.path.startsWith('people/'))
    expect(peopleFiles.length).toBe(1)

    const pf = peopleFiles[0]
    // Filename should not contain real name
    expect(pf.path).not.toContain('bob_smith')
    expect(pf.path).toMatch(/^people\/person_\d+\.json$/)

    // jiraDisplayName should be anonymized
    expect(pf.data.jiraDisplayName).not.toBe('Bob Smith')

    // Issue keys should be anonymized
    expect(pf.data.resolved.issues[0].key).not.toBe('DEMO-101')
    expect(pf.data.resolved.issues[0].key).toMatch(/^TEST\d+-101$/)

    // Issue summaries should be anonymized
    expect(pf.data.resolved.issues[0].summary).not.toBe('Real summary')
  })

  it('anonymizes github-contributions.json', async () => {
    const files = []
    const addFile = (path, data) => files.push({ path, data })
    const storage = makeStorage(registryStorage({
      'github-contributions.json': {
        users: {
          bobsmith: { username: 'bobsmith', totalContributions: 245 }
        },
        fetchedAt: '2026-03-10T12:00:00.000Z'
      }
    }))
    const mapping = buildMapping(FIXTURE_ROSTER)

    await teamTrackerExport(addFile, storage, mapping)

    const ghFile = files.find(f => f.path === 'github-contributions.json')
    expect(ghFile).toBeDefined()
    expect(ghFile.data.users['bobsmith']).toBeUndefined()
    const fakeUsername = Object.keys(ghFile.data.users)[0]
    expect(fakeUsername).toMatch(/^ghuser-/)
    expect(ghFile.data.users[fakeUsername].username).toBe(fakeUsername)
  })

  it('anonymizes gitlab-contributions.json', async () => {
    const files = []
    const addFile = (path, data) => files.push({ path, data })
    const storage = makeStorage(registryStorage({
      'gitlab-contributions.json': {
        users: {
          bobsmith: { username: 'bobsmith', totalContributions: 198 }
        },
        fetchedAt: '2026-03-10T12:00:00.000Z'
      }
    }))
    const mapping = buildMapping(FIXTURE_ROSTER)

    await teamTrackerExport(addFile, storage, mapping)

    const glFile = files.find(f => f.path === 'gitlab-contributions.json')
    expect(glFile).toBeDefined()
    expect(glFile.data.users['bobsmith']).toBeUndefined()
    const fakeUsername = Object.keys(glFile.data.users)[0]
    expect(fakeUsername).toMatch(/^gluser-/)
  })

  it('anonymizes github-history.json', async () => {
    const files = []
    const addFile = (path, data) => files.push({ path, data })
    const storage = makeStorage(registryStorage({
      'github-history.json': {
        users: { bobsmith: { '2026-01': 72 } },
        fetchedAt: '2026-03-10T12:00:00.000Z'
      }
    }))
    const mapping = buildMapping(FIXTURE_ROSTER)

    await teamTrackerExport(addFile, storage, mapping)

    const histFile = files.find(f => f.path === 'github-history.json')
    expect(histFile).toBeDefined()
    expect(histFile.data.users['bobsmith']).toBeUndefined()
    const fakeKey = Object.keys(histFile.data.users)[0]
    expect(fakeKey).toMatch(/^ghuser-/)
    expect(histFile.data.users[fakeKey]['2026-01']).toBe(72)
  })

  it('anonymizes jira-name-map.json', async () => {
    const files = []
    const addFile = (path, data) => files.push({ path, data })
    const storage = makeStorage(registryStorage({
      'jira-name-map.json': {
        'Bob Smith': { accountId: 'real-account-id', displayName: 'Bob Smith' }
      }
    }))
    const mapping = buildMapping(FIXTURE_ROSTER)

    await teamTrackerExport(addFile, storage, mapping)

    const jnmFile = files.find(f => f.path === 'jira-name-map.json')
    expect(jnmFile).toBeDefined()
    expect(jnmFile.data['Bob Smith']).toBeUndefined()
    const fakeKey = Object.keys(jnmFile.data)[0]
    expect(fakeKey).toMatch(/^Person \d+$/)
    expect(jnmFile.data[fakeKey].accountId).toMatch(/^fake-account-/)
    expect(jnmFile.data[fakeKey].displayName).toMatch(/^Person \d+$/)
  })

  it('anonymizes sync config', async () => {
    const files = []
    const addFile = (path, data) => files.push({ path, data })
    const storage = makeStorage(registryStorage({
      'team-data/config.json': {
        orgRoots: [{ uid: 'achen', name: 'Alice Chen' }],
        googleSheetId: 'real-sheet-id',
        githubOrgs: ['real-org'],
        gitlabGroups: ['real-group']
      }
    }))
    const mapping = buildMapping(FIXTURE_ROSTER)

    await teamTrackerExport(addFile, storage, mapping)

    const configFile = files.find(f => f.path === 'roster-sync-config.json')
    expect(configFile).toBeDefined()
    expect(configFile.data.orgRoots[0].uid).not.toBe('achen')
    expect(configFile.data.orgRoots[0].name).not.toBe('Alice Chen')
    expect(configFile.data.googleSheetId).toBe('placeholder-sheet-id')
    expect(configFile.data.githubOrgs[0]).toMatch(/^example-org-/)
    expect(configFile.data.gitlabGroups[0]).toMatch(/^example-group-/)
  })

  it('maintains cross-file referential integrity', async () => {
    const files = []
    const addFile = (path, data) => files.push({ path, data })
    const storage = makeStorage(registryStorage({
      'people/bob_smith.json': {
        jiraDisplayName: 'Bob Smith',
        resolved: { count: 0, issues: [] },
        inProgress: { count: 0, issues: [] }
      },
      'github-contributions.json': {
        users: { bobsmith: { username: 'bobsmith', totalContributions: 10 } },
        fetchedAt: '2026-01-01'
      }
    }))
    const mapping = buildMapping(FIXTURE_ROSTER)

    await teamTrackerExport(addFile, storage, mapping)

    // Find the fake name for Bob Smith in the roster
    const rosterFile = files.find(f => f.path === 'org-roster-full.json')
    const orgKey = Object.keys(rosterFile.data.orgs)[0]
    const bobFakeName = rosterFile.data.orgs[orgKey].members[0].name
    const bobFakeGithub = rosterFile.data.orgs[orgKey].members[0].githubUsername

    // People file should use the same fake name
    const peopleFile = files.find(f => f.path.startsWith('people/'))
    expect(peopleFile.data.jiraDisplayName).toBe(bobFakeName)

    // GitHub contributions should use the same fake GitHub username
    const ghFile = files.find(f => f.path === 'github-contributions.json')
    expect(ghFile.data.users[bobFakeGithub]).toBeDefined()
  })

  it('does not leak original PII', async () => {
    const files = []
    const addFile = (path, data) => files.push({ path, data })
    const storage = makeStorage(registryStorage({
      'people/bob_smith.json': {
        jiraDisplayName: 'Bob Smith',
        resolved: {
          count: 1,
          issues: [{ key: 'DEMO-101', summary: 'Real task', type: 'Story', status: 'Done' }]
        },
        inProgress: { count: 0, issues: [] }
      }
    }))
    const mapping = buildMapping(FIXTURE_ROSTER)

    await teamTrackerExport(addFile, storage, mapping)

    const allContent = JSON.stringify(files)
    expect(allContent).not.toContain('Bob Smith')
    expect(allContent).not.toContain('Alice Chen')
    expect(allContent).not.toContain('bsmith')
    expect(allContent).not.toContain('achen')
    expect(allContent).not.toContain('bobsmith')
    expect(allContent).not.toContain('alicechen')
    expect(allContent).not.toContain('achen@example.com')
  })
})
