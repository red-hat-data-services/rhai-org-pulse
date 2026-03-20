import { describe, it, expect, vi } from 'vitest'
import { loadConfig, saveConfig, getProjectKeys } from '../config'

function createMockStorage(data = {}) {
  const store = { ...data }
  return {
    readFromStorage: vi.fn((key) => store[key] || null),
    writeToStorage: vi.fn((key, value) => { store[key] = value })
  }
}

describe('jira sync config', () => {
  it('loadConfig returns null when no config exists', () => {
    const storage = createMockStorage()
    expect(loadConfig(storage)).toBeNull()
  })

  it('loadConfig returns stored config', () => {
    const config = { projectKeys: ['RHOAIENG'], lastConfigChangedAt: '2026-01-01T00:00:00Z' }
    const storage = createMockStorage({ 'jira-sync-config.json': config })
    expect(loadConfig(storage)).toEqual(config)
  })

  it('saveConfig writes config to storage', () => {
    const storage = createMockStorage()
    const config = { projectKeys: ['ODH'], lastConfigChangedAt: '2026-01-01T00:00:00Z' }
    saveConfig(storage, config)
    expect(storage.writeToStorage).toHaveBeenCalledWith('jira-sync-config.json', config)
  })

  it('getProjectKeys returns empty array when no config', () => {
    const storage = createMockStorage()
    expect(getProjectKeys(storage)).toEqual([])
  })

  it('getProjectKeys returns project keys from config', () => {
    const storage = createMockStorage({
      'jira-sync-config.json': { projectKeys: ['RHOAIENG', 'ODH'] }
    })
    expect(getProjectKeys(storage)).toEqual(['RHOAIENG', 'ODH'])
  })
})
