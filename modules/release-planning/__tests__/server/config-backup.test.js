import { describe, it, expect, vi } from 'vitest'
const { backupConfig } = require('../../server/config-backup')

function createMocks(configData, releaseFiles, existingBackupFiles) {
  const store = {}
  if (configData) {
    store['release-planning/config.json'] = configData
  }
  if (releaseFiles) {
    for (const v in releaseFiles) {
      store['release-planning/releases/' + v + '.json'] = releaseFiles[v]
    }
  }
  return {
    readFromStorage: vi.fn(function(key) {
      return store[key] ? JSON.parse(JSON.stringify(store[key])) : null
    }),
    writeToStorage: vi.fn(),
    listStorageFiles: vi.fn().mockReturnValue(existingBackupFiles || []),
    deleteFromStorage: vi.fn()
  }
}

describe('backupConfig', () => {
  it('creates a timestamped backup bundling config and per-release files', () => {
    const config = { releases: { '3.5': { release: '3.5' } } }
    const releaseData = { release: '3.5', bigRocks: [{ name: 'A', priority: 1 }] }
    const { readFromStorage, writeToStorage, listStorageFiles, deleteFromStorage } =
      createMocks(config, { '3.5': releaseData }, [])

    backupConfig(readFromStorage, writeToStorage, listStorageFiles, deleteFromStorage)

    expect(readFromStorage).toHaveBeenCalledWith('release-planning/config.json')
    expect(readFromStorage).toHaveBeenCalledWith('release-planning/releases/3.5.json')
    expect(writeToStorage).toHaveBeenCalledTimes(1)

    const [key, data] = writeToStorage.mock.calls[0]
    expect(key).toMatch(/^release-planning\/config-backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/)
    expect(key).toMatch(/\.json$/)
    expect(data.config).toEqual(config)
    expect(data.releases['3.5']).toEqual(releaseData)
  })

  it('does nothing when config.json is null', () => {
    const { readFromStorage, writeToStorage, listStorageFiles, deleteFromStorage } =
      createMocks(null, null, [])

    backupConfig(readFromStorage, writeToStorage, listStorageFiles, deleteFromStorage)

    expect(writeToStorage).not.toHaveBeenCalled()
  })

  it('handles missing listStorageFiles gracefully', () => {
    const config = { releases: {} }
    const { readFromStorage, writeToStorage } = createMocks(config)

    backupConfig(readFromStorage, writeToStorage, null, vi.fn())

    expect(writeToStorage).toHaveBeenCalledTimes(1)
  })

  it('bundles multiple per-release files', () => {
    const config = { releases: { '3.5': { release: '3.5' }, '3.6': { release: '3.6' } } }
    const { readFromStorage, writeToStorage, listStorageFiles, deleteFromStorage } =
      createMocks(config, {
        '3.5': { release: '3.5', bigRocks: [{ name: 'A' }] },
        '3.6': { release: '3.6', bigRocks: [{ name: 'B' }] }
      }, [])

    backupConfig(readFromStorage, writeToStorage, listStorageFiles, deleteFromStorage)

    const data = writeToStorage.mock.calls[0][1]
    expect(data.releases['3.5'].bigRocks[0].name).toBe('A')
    expect(data.releases['3.6'].bigRocks[0].name).toBe('B')
  })

  it('prunes old backups when more than 10 exist', () => {
    const config = { releases: {} }
    const existingFiles = Array.from({ length: 12 }, (_, i) => {
      const num = String(i).padStart(2, '0')
      return `config-backup-2026-04-${num}T12-00-00-000Z.json`
    })

    const { readFromStorage, writeToStorage, listStorageFiles, deleteFromStorage } =
      createMocks(config, null, existingFiles)

    backupConfig(readFromStorage, writeToStorage, listStorageFiles, deleteFromStorage)

    expect(deleteFromStorage).toHaveBeenCalledTimes(2)
    expect(deleteFromStorage.mock.calls[0][0]).toContain('config-backup-2026-04-00')
    expect(deleteFromStorage.mock.calls[1][0]).toContain('config-backup-2026-04-01')
  })

  it('does not prune when 10 or fewer backups exist', () => {
    const config = { releases: {} }
    const existingFiles = Array.from({ length: 9 }, (_, i) =>
      `config-backup-2026-04-0${i + 1}T12-00-00-000Z.json`
    )

    const { readFromStorage, writeToStorage, listStorageFiles, deleteFromStorage } =
      createMocks(config, null, existingFiles)

    backupConfig(readFromStorage, writeToStorage, listStorageFiles, deleteFromStorage)

    expect(deleteFromStorage).not.toHaveBeenCalled()
  })

  it('ignores non-backup files when pruning', () => {
    const config = { releases: {} }
    const existingFiles = [
      'config.json',
      'pm-users.json',
      'config-backup-2026-04-01T12-00-00-000Z.json',
      'config-backup-2026-04-02T12-00-00-000Z.json',
      'something-else.txt'
    ]

    const { readFromStorage, writeToStorage, listStorageFiles, deleteFromStorage } =
      createMocks(config, null, existingFiles)

    backupConfig(readFromStorage, writeToStorage, listStorageFiles, deleteFromStorage)

    expect(deleteFromStorage).not.toHaveBeenCalled()
  })

  it('handles listStorageFiles error gracefully', () => {
    const config = { releases: {} }
    const { readFromStorage, writeToStorage } = createMocks(config)
    const listStorageFiles = vi.fn().mockImplementation(() => { throw new Error('disk error') })

    expect(() => backupConfig(readFromStorage, writeToStorage, listStorageFiles, vi.fn())).not.toThrow()
    expect(writeToStorage).toHaveBeenCalledTimes(1)
  })
})
