import { describe, it, expect } from 'vitest'

const { buildMapping } = require('../../../../shared/server/anonymize')
const featureTrafficExport = require('../../server/export')

const FIXTURE_ROSTER = {
  vp: { name: 'Demo VP', uid: 'demovp' },
  orgs: {
    demoorg1: {
      leader: {
        name: 'Alice Chen', uid: 'achen', email: 'achen@example.com',
        githubUsername: 'alicechen', gitlabUsername: 'alicechen'
      },
      members: []
    }
  }
}

function makeStorage(data = {}) {
  return {
    readFromStorage(key) {
      return data[key] ? JSON.parse(JSON.stringify(data[key])) : null
    },
    writeToStorage() {},
    listStorageFiles(dir) {
      return Object.keys(data)
        .filter(k => k.startsWith(dir + '/') || k.startsWith(dir))
        .map(k => k.split('/').pop())
    }
  }
}

describe('featureTrafficExport', () => {
  it('anonymizes index.json feature keys and summaries', async () => {
    const files = []
    const addFile = (path, data) => files.push({ path, data })
    const mapping = buildMapping(FIXTURE_ROSTER)

    const storage = makeStorage({
      'feature-traffic/index.json': {
        fetchedAt: '2026-01-01',
        featureCount: 1,
        features: [
          { key: 'RHAISTRAT-123', summary: 'Real feature summary', status: 'In Progress' }
        ]
      }
    })

    await featureTrafficExport(addFile, storage, mapping)

    const indexFile = files.find(f => f.path === 'feature-traffic/index.json')
    expect(indexFile).toBeDefined()
    expect(indexFile.data.features[0].key).not.toBe('RHAISTRAT-123')
    expect(indexFile.data.features[0].summary).not.toBe('Real feature summary')
  })

  it('anonymizes feature detail files', async () => {
    const files = []
    const addFile = (path, data) => files.push({ path, data })
    const mapping = buildMapping(FIXTURE_ROSTER)

    const storage = makeStorage({
      'feature-traffic/index.json': {
        fetchedAt: '2026-01-01',
        featureCount: 1,
        features: [{ key: 'RHAISTRAT-1', summary: 'Test' }]
      },
      'feature-traffic/features/RHAISTRAT-1.json': {
        key: 'RHAISTRAT-1',
        summary: 'Real summary',
        epics: [
          { key: 'EPIC-1', summary: 'Epic summary', assignee: 'Alice Chen', accountId: 'acc123' }
        ]
      }
    })

    await featureTrafficExport(addFile, storage, mapping)

    const featureFile = files.find(f => f.path.startsWith('feature-traffic/features/') && f.path !== 'feature-traffic/features/RHAISTRAT-1.json')
    expect(featureFile).toBeDefined()
    expect(featureFile.data.key).not.toBe('RHAISTRAT-1')
    expect(featureFile.data.epics[0].key).not.toBe('EPIC-1')
    expect(featureFile.data.epics[0].assignee).not.toBe('Alice Chen')
    expect(featureFile.data.epics[0].accountId).not.toBe('acc123')
  })

  it('skips export when no index.json exists', async () => {
    const files = []
    const addFile = (path, data) => files.push({ path, data })
    const mapping = buildMapping(FIXTURE_ROSTER)
    const storage = makeStorage({})

    await featureTrafficExport(addFile, storage, mapping)

    expect(files).toHaveLength(0)
  })

  it('preserves non-PII fields', async () => {
    const files = []
    const addFile = (path, data) => files.push({ path, data })
    const mapping = buildMapping(FIXTURE_ROSTER)

    const storage = makeStorage({
      'feature-traffic/index.json': {
        fetchedAt: '2026-01-01',
        schemaVersion: '1.0',
        featureCount: 1,
        features: [
          { key: 'RHAISTRAT-1', summary: 'Test', status: 'In Progress', health: 'green', completionPct: 75 }
        ]
      }
    })

    await featureTrafficExport(addFile, storage, mapping)

    const indexFile = files.find(f => f.path === 'feature-traffic/index.json')
    expect(indexFile.data.fetchedAt).toBe('2026-01-01')
    expect(indexFile.data.schemaVersion).toBe('1.0')
    expect(indexFile.data.features[0].status).toBe('In Progress')
    expect(indexFile.data.features[0].health).toBe('green')
    expect(indexFile.data.features[0].completionPct).toBe(75)
  })
})
