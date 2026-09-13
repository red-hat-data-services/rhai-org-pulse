import { describe, it, expect, vi } from 'vitest'

var {
  TOKEN_URL,
  CASE_API_BASE_URL,
  CASE_API_V1_BASE_URL,
  extractLinkedCaseNumbers,
  extractCustomerName,
  createCustomerPortalClient
} = require('../../../server/planning/customer-portal')

function jsonResponse(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status: status,
    json: vi.fn().mockResolvedValue(data)
  }
}

describe('extractLinkedCaseNumbers', function() {
  it('extracts and deduplicates case numbers from the Jira property shape', function() {
    var property = { value: '04523117, 04528409, 04523117' }
    expect(extractLinkedCaseNumbers(property)).toEqual(['04523117', '04528409'])
  })

  it('accepts portal URLs and arrays', function() {
    var value = [
      'https://access.redhat.com/support/cases/#/case/04523117',
      '04528409'
    ]
    expect(extractLinkedCaseNumbers(value)).toEqual(['04523117', '04528409'])
  })

  it('returns an empty array for missing or malformed values', function() {
    expect(extractLinkedCaseNumbers(null)).toEqual([])
    expect(extractLinkedCaseNumbers({ value: 'not a case' })).toEqual([])
  })
})

describe('extractCustomerName', function() {
  it('reads the account name from the v3 case response', function() {
    expect(extractCustomerName({
      caseNumber: '04523117',
      account: { accountNumber: '5598345', name: 'Canadian Imperial Bank Of Commerce' }
    })).toBe('Canadian Imperial Bank Of Commerce')
  })

  it('supports wrapped and direct account-name response shapes', function() {
    expect(extractCustomerName({ data: { case: { accountName: 'Example Corp' } } })).toBe('Example Corp')
  })

  it('returns an empty string when no account name exists', function() {
    expect(extractCustomerName({ caseNumber: '04523117' })).toBe('')
  })
})

describe('createCustomerPortalClient', function() {
  it('is disabled and makes no requests when the offline token is absent', async function() {
    var fetchImpl = vi.fn()
    var client = createCustomerPortalClient({ fetchImpl: fetchImpl })

    expect(client.isConfigured()).toBe(false)
    await expect(client.getCustomerName('04523117')).resolves.toBe('')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('exchanges the offline token, fetches the case, and caches the customer name', async function() {
    var fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: 'access-token', expires_in: 900 }))
      .mockResolvedValueOnce(jsonResponse(200, {
        account: { name: 'Canadian Imperial Bank Of Commerce' }
      }))
    var client = createCustomerPortalClient({
      offlineToken: 'offline-token',
      fetchImpl: fetchImpl
    })

    await expect(client.getCustomerName('04523117')).resolves.toBe('Canadian Imperial Bank Of Commerce')
    await expect(client.getCustomerName('04523117')).resolves.toBe('Canadian Imperial Bank Of Commerce')

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(fetchImpl.mock.calls[0][0]).toBe(TOKEN_URL)
    expect(fetchImpl.mock.calls[0][1].body.get('grant_type')).toBe('refresh_token')
    expect(fetchImpl.mock.calls[0][1].body.get('client_id')).toBe('rhsm-api')
    expect(fetchImpl.mock.calls[0][1].body.get('refresh_token')).toBe('offline-token')
    expect(fetchImpl.mock.calls[1][0]).toBe(CASE_API_BASE_URL + '/04523117')
    expect(fetchImpl.mock.calls[1][1].headers.Authorization).toBe('Bearer access-token')
  })

  it('falls back to the v1 case API when v3 rejects the valid access token', async function() {
    var fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: 'access-token', expires_in: 900 }))
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(jsonResponse(200, {
        accountName: 'Canadian Imperial Bank Of Commerce'
      }))
    var client = createCustomerPortalClient({
      offlineToken: 'offline-token',
      fetchImpl: fetchImpl
    })

    await expect(client.getCustomerName('04523117')).resolves.toBe('Canadian Imperial Bank Of Commerce')

    expect(fetchImpl).toHaveBeenCalledTimes(3)
    expect(fetchImpl.mock.calls[1][0]).toBe(CASE_API_BASE_URL + '/04523117')
    expect(fetchImpl.mock.calls[2][0]).toBe(CASE_API_V1_BASE_URL + '/04523117')
    expect(fetchImpl.mock.calls[2][1].headers.Authorization).toBe('Bearer access-token')
  })

  it('returns an empty string for a case the portal does not contain', async function() {
    var fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: 'access-token', expires_in: 900 }))
      .mockResolvedValueOnce(jsonResponse(404, {}))
      .mockResolvedValueOnce(jsonResponse(404, {}))
    var client = createCustomerPortalClient({ offlineToken: 'offline-token', fetchImpl: fetchImpl })

    await expect(client.getCustomerName('04523117')).resolves.toBe('')
    expect(fetchImpl.mock.calls[2][0]).toBe(CASE_API_V1_BASE_URL + '/04523117')
  })
})
