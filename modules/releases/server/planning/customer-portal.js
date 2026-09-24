/**
 * Red Hat Customer Portal case lookup used as a fallback for customer names.
 *
 * Authentication follows the Red Hat offline-token flow. Access tokens and
 * case results are cached in memory so report refreshes do not repeatedly hit
 * the support API.
 */

var TOKEN_URL = 'https://sso.redhat.com/auth/realms/redhat-external/protocol/openid-connect/token'
var CASE_API_V3_BASE_URL = 'https://api.access.redhat.com/support/v3/cases'
var CASE_API_V1_BASE_URL = 'https://api.access.redhat.com/support/v1/cases'
var ACCOUNT_API_V1_BASE_URL = 'https://api.access.redhat.com/support/v1/accounts'
var TOKEN_EXPIRY_SKEW_MS = 30 * 1000
var CASE_CACHE_TTL_MS = 6 * 60 * 60 * 1000

/**
 * Extract unique eight-digit support case numbers from the Jira issue property.
 * The Forge app currently stores them under value.value as a comma-separated
 * string, but accepting arrays and URLs keeps this tolerant of format changes.
 *
 * @param {*} propertyValue - sfdc-cases-links issue property or its value
 * @returns {string[]}
 */
function extractLinkedCaseNumbers(propertyValue) {
  var value = propertyValue
  if (value && typeof value === 'object' && !Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, 'value')) {
    value = value.value
  }

  var text
  if (Array.isArray(value)) {
    text = value.join(' ')
  } else if (value === null || value === undefined) {
    text = ''
  } else if (typeof value === 'object') {
    text = JSON.stringify(value)
  } else {
    text = String(value)
  }

  var matches = text.match(/\b\d{8}\b/g) || []
  var seen = {}
  return matches.filter(function(caseNumber) {
    if (seen[caseNumber]) return false
    seen[caseNumber] = true
    return true
  })
}

function firstNonEmptyString(values) {
  for (var i = 0; i < values.length; i++) {
    if (typeof values[i] === 'string' && values[i].trim()) return values[i].trim()
  }
  return ''
}

/**
 * Read the account/customer display name from supported REST response shapes.
 * Keeping this parser isolated makes a CRM response-shape change non-fatal.
 *
 * @param {object|null} payload - Customer Portal case API response
 * @returns {string}
 */
function extractCustomerName(payload) {
  if (!payload || typeof payload !== 'object') return ''

  var containers = [payload, payload.case, payload.caseDetails, payload.data]
  if (payload.data && typeof payload.data === 'object') {
    containers.push(payload.data.case, payload.data.caseDetails)
  }

  for (var i = 0; i < containers.length; i++) {
    var item = containers[i]
    if (!item || typeof item !== 'object') continue
    var account = item.account || item.customerAccount || item.customer
    var accountName = account && typeof account === 'object'
      ? firstNonEmptyString([account.name, account.displayName, account.accountName, account.account_name])
      : ''
    var directName = firstNonEmptyString([
      item.accountName,
      item.account_name,
      item.customerName,
      item.customer_name
    ])
    if (accountName || directName) return accountName || directName
  }

  return ''
}

/**
 * Create an authenticated, cached Customer Portal case client.
 *
 * @param {object} options
 * @param {string} options.offlineToken
 * @param {Function} [options.fetchImpl]
 * @param {Function} [options.now]
 * @param {string} [options.tokenUrl]
 * @param {string} [options.caseApiBaseUrl]
 * @param {string[]} [options.caseApiBaseUrls]
 * @returns {{isConfigured: Function, getCustomerName: Function}}
 */
function createCustomerPortalClient(options) {
  options = options || {}
  var offlineToken = options.offlineToken || ''
  var fetchImpl = options.fetchImpl || fetch
  var now = options.now || Date.now
  var tokenUrl = options.tokenUrl || TOKEN_URL
  var configuredCaseApiBaseUrls = options.caseApiBaseUrls || (options.caseApiBaseUrl
    ? [options.caseApiBaseUrl]
    : [CASE_API_V1_BASE_URL, CASE_API_V3_BASE_URL])
  var caseApiBaseUrls = configuredCaseApiBaseUrls.map(function(baseUrl) {
    return baseUrl.replace(/\/$/, '')
  })
  var cachedToken = { value: '', expiresAt: 0 }
  var pendingTokenRequest = null
  var caseCache = new Map()
  var pendingCases = new Map()

  function isConfigured() {
    return !!offlineToken
  }

  async function getAccessToken() {
    if (!offlineToken) return ''
    if (cachedToken.value && cachedToken.expiresAt > now()) return cachedToken.value
    if (pendingTokenRequest) return pendingTokenRequest

    pendingTokenRequest = (async function() {
      try {
        var response = await fetchImpl(tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: 'rhsm-api',
            refresh_token: offlineToken
          }),
          signal: AbortSignal.timeout(15000)
        })
        if (!response.ok) throw new Error('Customer Portal token request failed (' + response.status + ')')

        var data = await response.json()
        if (!data.access_token) throw new Error('Customer Portal token response did not include an access token')
        var expiresIn = Number(data.expires_in) || 900
        cachedToken = {
          value: data.access_token,
          expiresAt: now() + Math.max(0, expiresIn * 1000 - TOKEN_EXPIRY_SKEW_MS)
        }
        return cachedToken.value
      } finally {
        pendingTokenRequest = null
      }
    })()

    return pendingTokenRequest
  }

  async function fetchAccountName(token, accountRef) {
    try {
      var response = await fetchImpl(
        ACCOUNT_API_V1_BASE_URL + '/' + encodeURIComponent(accountRef),
        {
          headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
          signal: AbortSignal.timeout(15000)
        }
      )
      if (!response.ok) return ''
      var data = await response.json()
      return firstNonEmptyString([data.name, data.accountName, data.displayName]) || ''
    } catch {
      return ''
    }
  }

  async function fetchCustomerName(caseNumber) {
    var token = await getAccessToken()
    if (!token) return ''

    for (var i = 0; i < caseApiBaseUrls.length; i++) {
      var hasFallback = i < caseApiBaseUrls.length - 1
      var response
      try {
        response = await fetchImpl(caseApiBaseUrls[i] + '/' + encodeURIComponent(caseNumber), {
          headers: {
            Authorization: 'Bearer ' + token,
            Accept: 'application/json'
          },
          signal: AbortSignal.timeout(15000)
        })
      } catch (err) {
        if (hasFallback) continue
        throw err
      }
      if (hasFallback && (response.status === 401 || response.status === 404)) continue
      if (response.status === 404) return ''
      if (!response.ok) throw new Error('Customer Portal case request failed (' + response.status + ')')
      var caseData = await response.json()
      var name = extractCustomerName(caseData)
      if (!name && caseData && caseData.accountNumberRef) {
        name = await fetchAccountName(token, caseData.accountNumberRef)
      }
      return name
    }

    return ''
  }

  async function getCustomerName(caseNumber) {
    if (!/^\d{8}$/.test(String(caseNumber || '')) || !offlineToken) return ''
    var cached = caseCache.get(caseNumber)
    if (cached && cached.expiresAt > now()) return cached.value
    if (pendingCases.has(caseNumber)) return pendingCases.get(caseNumber)

    var pending = fetchCustomerName(caseNumber).then(function(customerName) {
      caseCache.set(caseNumber, { value: customerName, expiresAt: now() + CASE_CACHE_TTL_MS })
      return customerName
    }).finally(function() {
      pendingCases.delete(caseNumber)
    })
    pendingCases.set(caseNumber, pending)
    return pending
  }

  return { isConfigured: isConfigured, getCustomerName: getCustomerName }
}

module.exports = {
  TOKEN_URL,
  CASE_API_BASE_URL: CASE_API_V3_BASE_URL,
  CASE_API_V3_BASE_URL,
  CASE_API_V1_BASE_URL,
  ACCOUNT_API_V1_BASE_URL,
  extractLinkedCaseNumbers,
  extractCustomerName,
  createCustomerPortalClient
}
