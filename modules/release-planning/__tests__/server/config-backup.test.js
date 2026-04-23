import { describe, it, expect, vi } from 'vitest'
const { backupConfig } = require('../../server/config-backup')

function createMocks(config, existingFiles) {
  return {
    readFromStorage: vi.fn().mockReturnValue(config),
    writeToStorage: vi.fn(),
    listStorageFiles: vi.fn().mockReturnValue(existingFiles || []),
    deleteFromStorage: vi.fn()
  }
}

describe('backupConfig', () => {
  it('creates a timestamped backup of config.json', () => {
    const config = { releases: { '3.5': { bigRocks: [] } } }
    const { readFromStorage, writeToStorage, listStorageFiles, deleteFromStorage } = createMocks(config, [])

    backupConfig(readFromStorage, writeToStorage, listStorageFiles, deleteFromStorage)

    expect(readFromStorage).toHaveBeenCalledWith('release-planning/config.json')
    expect(writeToStorage).toHaveBeenCalledTimes(1)

    const [key, data] = writeToStorage.mock.calls[0]
    expect(key).toMatch(/^release-planning\/config-backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/)
    expect(key).toMatch(/\.json$/)
    expect(data).toEqual(config)
  })

  it('does nothing when config.json is null', () => {
    const { readFromStorage, writeToStorage, listStorageFiles, deleteFromStorage } = createMocks(null, [])

    backupConfig(readFromStorage, writeToStorage, listStorageFiles, deleteFromStorage)

    expect(writeToStorage).not.toHaveBeenCalled()
  })

  it('handles missing listStorageFiles gracefully', () => {
    const config = { releases: {} }
    const readFromStorage = vi.fn().mockReturnValue(config)
    const writeToStorage = vi.fn()
    const deleteFromStorage = vi.fn()

    backupConfig(readFromStorage, writeToStorage, null, deleteFromStorage)

    expect(writeToStorage).toHaveBeenCalledTimes(1)
  })

  it('prunes old backups when more than 10 exist', () => {
    const config = { releases: {} }
    const existingFiles = Array.from({ length: 12 }, (_, i) => {
      const num = String(i).padStart(2, '0')
      return `config-backup-2026-04-${num}T12-00-00-000Z.json`
    })

    const { readFromStorage, writeToStorage, listStorageFiles, deleteFromStorage } = createMocks(config, existingFiles)

    backupConfig(readFromStorage, writeToStorage, listStorageFiles, deleteFromStorage)

    // listStorageFiles returns 12 files. 12 > 10, so it deletes 2 oldest via deleteFromStorage.
    expect(deleteFromStorage).toHaveBeenCalledTimes(2)
    // The two oldest should be deleted
    expect(deleteFromStorage.mock.calls[0][0]).toContain('config-backup-2026-04-00')
    expect(deleteFromStorage.mock.calls[1][0]).toContain('config-backup-2026-04-01')
  })

  it('does not prune when 10 or fewer backups exist', () => {
    const config = { releases: {} }
    const existingFiles = Array.from({ length: 9 }, (_, i) =>
      `config-backup-2026-04-0${i + 1}T12-00-00-000Z.json`
    )

    const { readFromStorage, writeToStorage, listStorageFiles, deleteFromStorage } = createMocks(config, existingFiles)

    backupConfig(readFromStorage, writeToStorage, listStorageFiles, deleteFromStorage)

    // Only the backup write, no prune deletes
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

    const { readFromStorage, writeToStorage, listStorageFiles, deleteFromStorage } = createMocks(config, existingFiles)

    backupConfig(readFromStorage, writeToStorage, listStorageFiles, deleteFromStorage)

    // Only 2 backup files found, well under 10, no pruning
    expect(deleteFromStorage).not.toHaveBeenCalled()
  })

  it('handles listStorageFiles error gracefully', () => {
    const config = { releases: {} }
    const readFromStorage = vi.fn().mockReturnValue(config)
    const writeToStorage = vi.fn()
    const listStorageFiles = vi.fn().mockImplementation(() => { throw new Error('disk error') })
    const deleteFromStorage = vi.fn()

    // Should not throw
    expect(() => backupConfig(readFromStorage, writeToStorage, listStorageFiles, deleteFromStorage)).not.toThrow()
    // Backup was still written
    expect(writeToStorage).toHaveBeenCalledTimes(1)
  })
})
