import { describe, it, expect } from 'vitest'
import {
  analyzeFixVersionHistory,
  validateCommitmentConfig,
  resolvePlanningFreezeDate,
  getConfiguredVersions,
  findPhaseConfig,
  buildFeatureFromIssue,
  loadCommitmentConfig
} from '../../../server/delivery/commitment.js'

describe('analyzeFixVersionHistory', () => {
  const targetVersions = ['rhoai-3.4.EA1', 'RHAIIS-3.4 EA1']
  const freezeDate = new Date('2026-02-15T23:59:59.999Z').getTime()

  it('marks feature as committed when created before freeze with matching fixVersion and no changelog', () => {
    const issue = {
      key: 'RHOAIENG-100',
      fields: {
        fixVersions: [{ name: 'rhoai-3.4.EA1' }],
        created: '2026-01-10T10:00:00.000Z'
      },
      changelog: { histories: [] }
    }

    const result = analyzeFixVersionHistory(issue, targetVersions, freezeDate)

    expect(result.hadAtFreeze).toBe(true)
    expect(result.addedAfterFreeze).toBe(false)
    expect(result.removedAfterFreeze).toBe(false)
  })

  it('marks feature as added when created after freeze with matching fixVersion and no changelog', () => {
    const issue = {
      key: 'RHOAIENG-101',
      fields: {
        fixVersions: [{ name: 'rhoai-3.4.EA1' }],
        created: '2026-03-01T10:00:00.000Z'
      },
      changelog: { histories: [] }
    }

    const result = analyzeFixVersionHistory(issue, targetVersions, freezeDate)

    expect(result.hadAtFreeze).toBe(false)
    expect(result.addedAfterFreeze).toBe(true)
    expect(result.removedAfterFreeze).toBe(false)
  })

  it('marks feature as committed when fixVersion was added before freeze via changelog', () => {
    const issue = {
      key: 'RHOAIENG-102',
      fields: {
        fixVersions: [{ name: 'rhoai-3.4.EA1' }],
        created: '2026-01-05T10:00:00.000Z'
      },
      changelog: {
        histories: [
          {
            created: '2026-01-20T10:00:00.000Z',
            items: [{ field: 'Fix Version', fromString: null, toString: 'rhoai-3.4.EA1' }]
          }
        ]
      }
    }

    const result = analyzeFixVersionHistory(issue, targetVersions, freezeDate)

    expect(result.hadAtFreeze).toBe(true)
    expect(result.addedAfterFreeze).toBe(false)
  })

  it('marks feature as added when fixVersion was added after freeze via changelog', () => {
    const issue = {
      key: 'RHOAIENG-103',
      fields: {
        fixVersions: [{ name: 'rhoai-3.4.EA1' }],
        created: '2026-01-05T10:00:00.000Z'
      },
      changelog: {
        histories: [
          {
            created: '2026-03-01T10:00:00.000Z',
            items: [{ field: 'Fix Version', fromString: null, toString: 'rhoai-3.4.EA1' }]
          }
        ]
      }
    }

    const result = analyzeFixVersionHistory(issue, targetVersions, freezeDate)

    expect(result.hadAtFreeze).toBe(false)
    expect(result.addedAfterFreeze).toBe(true)
  })

  it('marks feature as removed when fixVersion was present at freeze then removed', () => {
    const issue = {
      key: 'RHOAIENG-104',
      fields: {
        fixVersions: [],
        created: '2026-01-05T10:00:00.000Z'
      },
      changelog: {
        histories: [
          {
            created: '2026-01-10T10:00:00.000Z',
            items: [{ field: 'Fix Version', fromString: null, toString: 'rhoai-3.4.EA1' }]
          },
          {
            created: '2026-03-05T10:00:00.000Z',
            items: [{ field: 'Fix Version', fromString: 'rhoai-3.4.EA1', toString: null }]
          }
        ]
      }
    }

    const result = analyzeFixVersionHistory(issue, targetVersions, freezeDate)

    expect(result.hadAtFreeze).toBe(true)
    expect(result.removedAfterFreeze).toBe(true)
  })

  it('handles case-insensitive version name matching', () => {
    const issue = {
      key: 'RHOAIENG-105',
      fields: {
        fixVersions: [{ name: 'RHOAI-3.4.EA1' }],
        created: '2026-01-10T10:00:00.000Z'
      },
      changelog: { histories: [] }
    }

    const result = analyzeFixVersionHistory(issue, targetVersions, freezeDate)

    expect(result.hadAtFreeze).toBe(true)
  })

  it('handles feature with no changelog at all', () => {
    const issue = {
      key: 'RHOAIENG-106',
      fields: {
        fixVersions: [{ name: 'rhoai-3.4.EA1' }],
        created: '2026-01-10T10:00:00.000Z'
      }
    }

    const result = analyzeFixVersionHistory(issue, targetVersions, freezeDate)

    expect(result.hadAtFreeze).toBe(true)
    expect(result.addedAfterFreeze).toBe(false)
    expect(result.removedAfterFreeze).toBe(false)
  })

  it('handles version added then removed then re-added across freeze boundary', () => {
    const issue = {
      key: 'RHOAIENG-107',
      fields: {
        fixVersions: [{ name: 'rhoai-3.4.EA1' }],
        created: '2026-01-01T10:00:00.000Z'
      },
      changelog: {
        histories: [
          {
            created: '2026-01-10T10:00:00.000Z',
            items: [{ field: 'Fix Version', fromString: null, toString: 'rhoai-3.4.EA1' }]
          },
          {
            created: '2026-01-20T10:00:00.000Z',
            items: [{ field: 'Fix Version', fromString: 'rhoai-3.4.EA1', toString: null }]
          },
          {
            created: '2026-03-01T10:00:00.000Z',
            items: [{ field: 'Fix Version', fromString: null, toString: 'rhoai-3.4.EA1' }]
          }
        ]
      }
    }

    const result = analyzeFixVersionHistory(issue, targetVersions, freezeDate)

    expect(result.hadAtFreeze).toBe(false)
    expect(result.addedAfterFreeze).toBe(true)
  })

  it('handles feature with non-matching fixVersion in changelog', () => {
    const issue = {
      key: 'RHOAIENG-108',
      fields: {
        fixVersions: [{ name: 'rhoai-3.4.EA1' }, { name: 'other-version' }],
        created: '2026-01-10T10:00:00.000Z'
      },
      changelog: {
        histories: [
          {
            created: '2026-01-15T10:00:00.000Z',
            items: [{ field: 'Fix Version', fromString: null, toString: 'other-version' }]
          }
        ]
      }
    }

    const result = analyzeFixVersionHistory(issue, targetVersions, freezeDate)

    expect(result.hadAtFreeze).toBe(true)
  })

  it('uses Fix Version/s field name variant', () => {
    const issue = {
      key: 'RHOAIENG-109',
      fields: {
        fixVersions: [{ name: 'rhoai-3.4.EA1' }],
        created: '2026-01-01T10:00:00.000Z'
      },
      changelog: {
        histories: [
          {
            created: '2026-01-10T10:00:00.000Z',
            items: [{ field: 'Fix Version/s', fromString: null, toString: 'rhoai-3.4.EA1' }]
          }
        ]
      }
    }

    const result = analyzeFixVersionHistory(issue, targetVersions, freezeDate)

    expect(result.hadAtFreeze).toBe(true)
  })
})

describe('validateCommitmentConfig', () => {
  it('returns null for a valid config', () => {
    const config = {
      releases: [
        {
          version: '3.4',
          phases: {
            EA1: { fixVersions: ['rhoai-3.4.EA1'] },
            GA: { fixVersions: ['rhoai-3.4'] }
          }
        }
      ]
    }

    expect(validateCommitmentConfig(config)).toBeNull()
  })

  it('rejects config without releases array', () => {
    expect(validateCommitmentConfig({})).toBe('releases must be an array')
    expect(validateCommitmentConfig({ releases: 'bad' })).toBe('releases must be an array')
  })

  it('rejects release without version', () => {
    const config = { releases: [{ phases: {} }] }
    expect(validateCommitmentConfig(config)).toContain('must have a version string')
  })

  it('rejects invalid version format', () => {
    const config = { releases: [{ version: 'abc', phases: {} }] }
    expect(validateCommitmentConfig(config)).toContain('must be in X.Y format')
  })

  it('rejects invalid phase name', () => {
    const config = {
      releases: [{ version: '3.4', phases: { BETA: { fixVersions: ['v1'] } } }]
    }
    expect(validateCommitmentConfig(config)).toContain('invalid phase "BETA"')
  })

  it('rejects empty fixVersions array', () => {
    const config = {
      releases: [{ version: '3.4', phases: { EA1: { fixVersions: [] } } }]
    }
    expect(validateCommitmentConfig(config)).toContain('non-empty fixVersions')
  })

  it('rejects non-string fixVersion entries', () => {
    const config = {
      releases: [{ version: '3.4', phases: { EA1: { fixVersions: [123] } } }]
    }
    expect(validateCommitmentConfig(config)).toContain('non-empty strings')
  })

  it('rejects invalid planningFreezeOverride format', () => {
    const config = {
      releases: [{
        version: '3.4',
        phases: {
          EA1: { fixVersions: ['v1'], planningFreezeOverride: 'bad-date' }
        }
      }]
    }
    expect(validateCommitmentConfig(config)).toContain('YYYY-MM-DD')
  })

  it('accepts valid planningFreezeOverride', () => {
    const config = {
      releases: [{
        version: '3.4',
        phases: {
          EA1: { fixVersions: ['v1'], planningFreezeOverride: '2026-02-15' }
        }
      }]
    }
    expect(validateCommitmentConfig(config)).toBeNull()
  })
})

describe('resolvePlanningFreezeDate', () => {
  const registry = {
    releases: [
      { id: 'rhoai-3.4.ea1', milestones: { planningFreeze: '2026-02-01' } },
      { id: 'rhoai-3.4.ea2', milestones: { planningFreeze: '2026-04-01' } },
      { id: 'rhoai-3.4', milestones: { planningFreeze: '2026-06-01' } },
      { id: 'rhelai-3.4.ea1', milestones: { planningFreeze: '2026-02-15' } }
    ]
  }

  it('finds planning freeze date for EA1 phase', () => {
    const result = resolvePlanningFreezeDate(registry, '3.4', 'EA1', null)
    expect(result).toBe('2026-02-01')
  })

  it('finds planning freeze date for GA phase (excludes EA entries)', () => {
    const result = resolvePlanningFreezeDate(registry, '3.4', 'GA', null)
    expect(result).toBe('2026-06-01')
  })

  it('uses planningFreezeOverride from phase config when provided', () => {
    const phaseConfig = { fixVersions: ['v1'], planningFreezeOverride: '2026-03-15' }
    const result = resolvePlanningFreezeDate(registry, '3.4', 'EA1', phaseConfig)
    expect(result).toBe('2026-03-15')
  })

  it('returns null when no matching registry entries have planningFreeze', () => {
    const emptyRegistry = {
      releases: [
        { id: 'rhoai-3.4.ea1', milestones: {} }
      ]
    }
    const result = resolvePlanningFreezeDate(emptyRegistry, '3.4', 'EA1', null)
    expect(result).toBeNull()
  })

  it('returns null for a version with no registry entries', () => {
    const result = resolvePlanningFreezeDate(registry, '9.9', 'EA1', null)
    expect(result).toBeNull()
  })
})

describe('getConfiguredVersions', () => {
  it('returns sorted versions with their phases', () => {
    const config = {
      releases: [
        { version: '3.5', phases: { EA1: { fixVersions: ['v1'] }, GA: { fixVersions: ['v2'] } } },
        { version: '3.4', phases: { EA1: { fixVersions: ['v3'] } } }
      ]
    }

    const result = getConfiguredVersions(config)

    expect(result).toEqual([
      { version: '3.4', phases: ['EA1'] },
      { version: '3.5', phases: ['EA1', 'GA'] }
    ])
  })

  it('returns empty array for config with no releases', () => {
    expect(getConfiguredVersions({ releases: [] })).toEqual([])
  })

  it('skips releases with no valid phases', () => {
    const config = {
      releases: [{ version: '3.4', phases: {} }]
    }
    expect(getConfiguredVersions(config)).toEqual([])
  })
})

describe('loadCommitmentConfig', () => {
  it('uses the persisted config when one exists', async () => {
    const storedConfig = {
      releases: [
        { version: '9.9', phases: { GA: { fixVersions: ['rhoai-9.9'] } } }
      ]
    }

    await expect(loadCommitmentConfig(async () => storedConfig)).resolves.toEqual(storedConfig)
  })

  it('falls back to the bundled release config when storage is empty', async () => {
    const config = await loadCommitmentConfig(async () => null)

    expect(getConfiguredVersions(config).map(function (entry) { return entry.version })).toEqual([
      '3.4',
      '3.5',
      '3.6',
      '3.7'
    ])
  })
})

describe('findPhaseConfig', () => {
  const config = {
    releases: [
      {
        version: '3.4',
        phases: {
          EA1: { fixVersions: ['rhoai-3.4.EA1', 'RHAIIS-3.4 EA1'] },
          GA: { fixVersions: ['rhoai-3.4'] }
        }
      }
    ]
  }

  it('finds the phase config for a matching version and phase', () => {
    const result = findPhaseConfig(config, '3.4', 'EA1')
    expect(result).toEqual({ fixVersions: ['rhoai-3.4.EA1', 'RHAIIS-3.4 EA1'] })
  })

  it('returns null for a non-existent version', () => {
    expect(findPhaseConfig(config, '9.9', 'EA1')).toBeNull()
  })

  it('returns null for a non-existent phase', () => {
    expect(findPhaseConfig(config, '3.4', 'EA2')).toBeNull()
  })
})

describe('buildFeatureFromIssue', () => {
  it('extracts feature fields from a Jira issue', () => {
    const issue = {
      key: 'RHOAIENG-123',
      fields: {
        summary: 'Test feature',
        status: { name: 'In Progress' },
        components: [{ name: 'Dashboard' }, { name: 'API' }],
        fixVersions: [{ name: 'rhoai-3.4.EA1' }],
        customfield_18834: { displayName: 'John Doe' }
      }
    }

    const result = buildFeatureFromIssue(issue)

    expect(result).toEqual({
      key: 'RHOAIENG-123',
      summary: 'Test feature',
      status: 'In Progress',
      components: ['Dashboard', 'API'],
      deliveryOwner: 'John Doe',
      fixVersions: ['rhoai-3.4.EA1']
    })
  })

  it('handles missing fields gracefully', () => {
    const issue = {
      key: 'RHOAIENG-456',
      fields: {
        summary: null,
        status: null,
        components: null,
        fixVersions: null,
        customfield_18834: null
      }
    }

    const result = buildFeatureFromIssue(issue)

    expect(result.key).toBe('RHOAIENG-456')
    expect(result.summary).toBe('')
    expect(result.status).toBe('Unknown')
    expect(result.components).toEqual([])
    expect(result.fixVersions).toEqual([])
    expect(result.deliveryOwner).toBeNull()
  })
})
