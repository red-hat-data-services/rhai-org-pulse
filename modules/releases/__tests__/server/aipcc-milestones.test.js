import { describe, expect, it, vi } from 'vitest'

const {
  parseSpreadsheet,
  createAipccMilestonesService,
  STORAGE_KEY
} = require('../../server/aipcc-milestones')
const { findUserTokens, listConnectedGoogleUsers } = require('../../server/google-user-sheets')

function storageWith(initial = null) {
  let value = initial
  return {
    readFromStorage: vi.fn(async () => value),
    writeToStorage: vi.fn(async (key, data) => { value = data })
  }
}

describe('AIPCC milestone spreadsheet parser', () => {
  it('groups releases and phases and resolves dates across a year boundary', () => {
    const releases = parseSpreadsheet([
      ['RH AI 3.6 EA1', '', '', '', ''],
      ['Planning', '', '', '', ''],
      ['', 'Feature complete', '20-Nov', '15-Dec', ''],
      ['Release', '', '', '', ''],
      ['', 'Early access', '', '12-Jan', '28 days']
    ], new Date('2026-12-15T12:00:00'))

    expect(releases).toHaveLength(1)
    expect(releases[0].phases).toHaveLength(2)
    expect(releases[0].phases[1].milestones[0].targetDate).toBe('2027-01-12')
  })

  it('parses Google serial dates and labels Z-stream milestones with their version', () => {
    const releases = parseSpreadsheet([
      ['Z streams', '', '', '', ''],
      ['Release', '', '', '', ''],
      ['3.5.2', 'Push to production', '', 46300, '']
    ], new Date('2026-10-05T12:00:00'))

    expect(releases[0].phases[0].milestones[0]).toMatchObject({
      name: '3.5.2 Push to production',
      targetDate: '2026-10-05'
    })
  })
})

describe('AIPCC milestone service', () => {
  it('fetches live sheet data and persists the normalized schedule', async () => {
    const fetchRawSheet = vi.fn().mockResolvedValue({
      headers: ['Release', 'Milestone', 'Start', 'Target', 'Notes'],
      rows: [['RH AI 3.6 GA', '', '', '', ''], ['Release', '', '', '', ''], ['', 'GA', '', '14-Sep', '']]
    })
    const storage = storageWith()
    const service = createAipccMilestonesService({ storage, secrets: {}, googleSheetsClient: { fetchRawSheet } })

    const result = await service.refresh()

    expect(result.milestoneCount).toBe(1)
    expect(result.cacheStatus).toBe('refreshed')
    expect(storage.writeToStorage).toHaveBeenCalledWith(STORAGE_KEY, expect.objectContaining({ milestoneCount: 1 }))
  })

  it('serves stored data when Google Sheets is unavailable', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetchRawSheet = async () => { throw new Error('offline') }
    const stored = { fetchedAt: '2020-01-01T00:00:00.000Z', releases: [], milestoneCount: 1 }
    const service = createAipccMilestonesService({ storage: storageWith(stored), secrets: {}, googleSheetsClient: { fetchRawSheet } })

    const result = await service.getData()
    expect(result).toMatchObject({ cacheStatus: 'stale', warning: 'offline' })
  })

  it('fails a forced refresh instead of presenting stored data as refreshed', async () => {
    const fetchRawSheet = async () => { throw new Error('offline') }
    const stored = { fetchedAt: '2020-01-01T00:00:00.000Z', releases: [], milestoneCount: 1 }
    const service = createAipccMilestonesService({ storage: storageWith(stored), secrets: {}, googleSheetsClient: { fetchRawSheet } })

    await expect(service.refresh()).rejects.toThrow('offline')
  })
})

describe('Org Pulse Google user lookup', () => {
  it('reuses existing tokens even when a legacy email key has mixed case', () => {
    const tokens = { refresh_token: 'refresh-token' }
    expect(findUserTokens({ 'User@RedHat.com': tokens }, 'user@redhat.com')).toBe(tokens)
  })

  it('lists only Org Pulse users with reusable Google credentials', async () => {
    const storage = {
      readFromStorage: vi.fn().mockResolvedValue({
        'reader@redhat.com': { refresh_token: 'refresh-token' },
        'expired@redhat.com': {},
        'viewer@redhat.com': { access_token: 'access-token' }
      })
    }
    await expect(listConnectedGoogleUsers(storage)).resolves.toEqual([
      'reader@redhat.com',
      'viewer@redhat.com'
    ])
  })
})
