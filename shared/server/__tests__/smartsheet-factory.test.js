import { describe, it, expect } from 'vitest'

const { createSmartsheetClient } = require('../smartsheet')

describe('createSmartsheetClient', () => {
  it('creates a client with apiToken and default sheetId', () => {
    const client = createSmartsheetClient({ apiToken: 'test-token' })
    expect(client.isConfigured()).toBe(true)
    expect(client.SMARTSHEET_SHEET_ID).toBe('3025228340193156')
    expect(client.discoverReleases).toBeInstanceOf(Function)
    expect(client.discoverReleasesWithFreezes).toBeInstanceOf(Function)
    expect(client.discoverReleasesPartial).toBeInstanceOf(Function)
  })

  it('creates a client with custom sheetId', () => {
    const client = createSmartsheetClient({ apiToken: 'tok', sheetId: 'custom-123' })
    expect(client.SMARTSHEET_SHEET_ID).toBe('custom-123')
  })

  it('coerces undefined apiToken to empty string', () => {
    const client = createSmartsheetClient({ apiToken: undefined })
    expect(client.isConfigured()).toBe(false)
  })

  it('isConfigured returns false with no token', () => {
    const client = createSmartsheetClient({})
    expect(client.isConfigured()).toBe(false)
  })

  it('two instances with different credentials are independent', () => {
    const client1 = createSmartsheetClient({ apiToken: 'tok1', sheetId: 'sheet1' })
    const client2 = createSmartsheetClient({ apiToken: 'tok2', sheetId: 'sheet2' })

    expect(client1.SMARTSHEET_SHEET_ID).toBe('sheet1')
    expect(client2.SMARTSHEET_SHEET_ID).toBe('sheet2')
    expect(client1.isConfigured()).toBe(true)
    expect(client2.isConfigured()).toBe(true)
  })

  it('fetchSheet throws when not configured', async () => {
    const client = createSmartsheetClient({})
    await expect(client.discoverReleases()).rejects.toThrow('not available')
  })
})
