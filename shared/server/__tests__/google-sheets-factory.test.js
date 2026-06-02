import { describe, it, expect } from 'vitest'

const { createGoogleSheetsClient } = require('../google-sheets')

describe('createGoogleSheetsClient', () => {
  it('creates a client with default key file path', () => {
    const client = createGoogleSheetsClient()
    expect(client.discoverSheetNames).toBeInstanceOf(Function)
    expect(client.fetchRawSheet).toBeInstanceOf(Function)
  })

  it('creates a client with custom key file path', () => {
    const client = createGoogleSheetsClient({ keyFile: '/custom/path/key.json' })
    expect(client.discoverSheetNames).toBeInstanceOf(Function)
    expect(client.fetchRawSheet).toBeInstanceOf(Function)
  })

  it('two instances are independent', () => {
    const client1 = createGoogleSheetsClient({ keyFile: '/path/a.json' })
    const client2 = createGoogleSheetsClient({ keyFile: '/path/b.json' })
    expect(client1.discoverSheetNames).not.toBe(client2.discoverSheetNames)
  })
})
