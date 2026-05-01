/**
 * Product Pages OAuth token manager and API client.
 *
 * Auth modes (auto-detected):
 * 1. OAuth client credentials: PRODUCT_PAGES_CLIENT_ID + PRODUCT_PAGES_CLIENT_SECRET
 * 2. Personal token fallback: PRODUCT_PAGES_TOKEN
 * 3. No auth: returns null, callers skip API calls
 */

let cachedToken = { token: null, expiresAt: 0 }
let pendingTokenRequest = null

let productsCache = { products: null, expiresAt: 0 }

/**
 * Returns a Bearer token string, or null if no auth is configured.
 * Caches OAuth tokens in memory and deduplicates concurrent requests.
 */
async function getProductPagesToken(config) {
  const clientId = process.env.PRODUCT_PAGES_CLIENT_ID || ''
  const clientSecret = process.env.PRODUCT_PAGES_CLIENT_SECRET || ''
  const personalToken = process.env.PRODUCT_PAGES_TOKEN || ''

  // OAuth client credentials flow
  if (clientId && clientSecret) {
    if (cachedToken.token && cachedToken.expiresAt > Date.now()) {
      return cachedToken.token
    }
    if (pendingTokenRequest) {
      return pendingTokenRequest
    }

    pendingTokenRequest = (async () => {
      const tokenUrl = config?.productPagesTokenUrl ||
        'https://auth.redhat.com/auth/realms/EmployeeIDP/protocol/openid-connect/token'
      try {
        const response = await fetch(tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret
          }),
          signal: AbortSignal.timeout(15000)
        })

        if (!response.ok) {
          const body = await response.text().catch(() => '')
          if (response.status === 401) {
            console.error(`[product-pages] SSO credential failure (HTTP 401): invalid_client. Verify PRODUCT_PAGES_CLIENT_ID. Body: ${body}`)
          } else {
            console.error(`[product-pages] SSO token endpoint error (HTTP ${response.status}): ${body}`)
          }
          throw new Error(`SSO token request failed (${response.status})`)
        }

        const data = await response.json()
        const expiresIn = data.expires_in || 300
        cachedToken = {
          token: data.access_token,
          expiresAt: Date.now() + (expiresIn - 30) * 1000
        }
        return cachedToken.token
      } finally {
        pendingTokenRequest = null
      }
    })()

    return pendingTokenRequest
  }

  // Personal token fallback
  if (personalToken) {
    return personalToken
  }

  // No auth configured
  return null
}

/**
 * Extracts the GA date from a Product Pages release object.
 *
 * The `ga_date` top-level field is often unreliable — it can point to the EA1
 * date instead of the actual GA. `major_milestones` has the correct GA date
 * when present.
 *
 * Priority:
 * 1. major_milestones entry matching /\bGA\b/ but NOT /\bEA\b/
 * 2. all_ga_tasks entry matching /\bGA\b/ but NOT /\bEA\b/
 * 3. all_ga_tasks with main:true
 * 4. ga_date field (fallback — may be EA1 date)
 * 5. all_ga_tasks last entry
 * 6. null
 */
function extractGaDate(release) {
  const gaNotEa = /\bGA\b/i
  const eaPattern = /\bEA\d?\b/i

  // Priority 1: major_milestones with GA (not EA) in name
  const milestones = release.major_milestones
  if (Array.isArray(milestones) && milestones.length > 0) {
    let lastGaMilestone = null
    for (const m of milestones) {
      const name = m.name || ''
      if (gaNotEa.test(name) && !eaPattern.test(name)) {
        lastGaMilestone = m
      }
    }
    if (lastGaMilestone?.date_finish) return lastGaMilestone.date_finish
  }

  const tasks = release.all_ga_tasks
  if (Array.isArray(tasks) && tasks.length > 0) {
    // Priority 2: all_ga_tasks with GA (not EA) in name
    let lastGaTask = null
    for (const t of tasks) {
      const name = t.name || ''
      if (gaNotEa.test(name) && !eaPattern.test(name)) {
        lastGaTask = t
      }
    }
    if (lastGaTask?.date_finish) return lastGaTask.date_finish

    // Priority 3: entry with main: true
    const mainTask = tasks.find(t => t.main === true)
    if (mainTask?.date_finish) return mainTask.date_finish
  }

  // Priority 4: ga_date field (may be EA1 date — last resort from top-level fields)
  if (release.ga_date) return release.ga_date

  // Priority 5: last task's date_finish
  if (Array.isArray(tasks) && tasks.length > 0) {
    const lastTask = tasks[tasks.length - 1]
    if (lastTask?.date_finish) return lastTask.date_finish
  }

  return null
}

/**
 * Extracts the code freeze date from a Product Pages release object.
 * Searches major_milestones and all_ga_tasks for entries matching
 * "code freeze" (case-insensitive, with optional hyphen/space).
 *
 * For EA-specific releases, pass an optional eaTag (e.g. "EA1") to prefer
 * a milestone scoped to that EA over a generic one.
 */
function extractCodeFreezeDate(release, eaTag) {
  const freezePattern = /code[.\-_\s]*freeze/i

  const milestones = release.major_milestones
  if (Array.isArray(milestones) && milestones.length > 0) {
    let bestMatch = null
    for (const m of milestones) {
      if (m.draft) continue
      const name = m.name || ''
      if (!freezePattern.test(name)) continue
      if (eaTag && new RegExp(`\\b${eaTag}\\b`, 'i').test(name)) {
        return m.date_finish || null
      }
      bestMatch = m
    }
    if (bestMatch?.date_finish) return bestMatch.date_finish
  }

  const tasks = release.all_ga_tasks
  if (Array.isArray(tasks) && tasks.length > 0) {
    let bestMatch = null
    for (const t of tasks) {
      const name = t.name || ''
      if (!freezePattern.test(name)) continue
      if (eaTag && new RegExp(`\\b${eaTag}\\b`, 'i').test(name)) {
        return t.date_finish || null
      }
      bestMatch = t
    }
    if (bestMatch?.date_finish) return bestMatch.date_finish
  }

  return null
}

/**
 * Returns the auth status string for the settings UI badge.
 */
function getAuthStatus() {
  const clientId = process.env.PRODUCT_PAGES_CLIENT_ID || ''
  const clientSecret = process.env.PRODUCT_PAGES_CLIENT_SECRET || ''
  const personalToken = process.env.PRODUCT_PAGES_TOKEN || ''

  if (clientId && clientSecret) return 'oauth'
  if (personalToken) return 'token'
  return 'none'
}

// Exclude phases where the release is already shipped or end-of-life.
// Known phases: 100=Planning, 200=Development, 230=Early Access, 350=Testing,
// 400=Launch, 500=Update, 600=Maintenance, 1000=Unsupported/EOL
const EXCLUDED_PHASES = new Set([600, 1000]) // Maintenance, Unsupported

const RELEASE_MILESTONE_PATTERN = /\b(EA\d?|GA)\b/i

/**
 * Expands a single Product Pages release into discrete EA/GA entries when
 * the release's major_milestones contain EA1, EA2, GA sub-releases.
 *
 * Products like rhoai already have separate releases per EA (rhoai-3.4.EA1,
 * rhoai-3.4.EA2, rhoai-3.4), so those pass through as a single entry.
 * Products like rhelai and RHAIIS bundle EA/GA as milestones within one
 * release — those get expanded here.
 */
function expandReleaseMilestones(r, productName) {
  const milestones = r.major_milestones
  if (!Array.isArray(milestones) || milestones.length === 0) return null

  // Only consider non-draft milestones that are EA/GA release events
  // Exclude noise like "rpms release 1 month before the 3.4 GA"
  const releaseMilestones = milestones.filter(m => {
    if (m.draft) return false
    const name = m.name || ''
    if (!RELEASE_MILESTONE_PATTERN.test(name)) return false
    // Must be an EA release or a standalone GA milestone
    const isEaRelease = /\bEA\d?\b/i.test(name) && /release|GA\b/i.test(name)
    // GA milestone: short name ending in "GA" (e.g. "rhelai-3.4 GA", "rhaiis-3.4 GA")
    // Exclude long descriptive milestones that just happen to mention GA
    const isGa = /\bGA\s*$/i.test(name) && !/\bEA\d?\b/i.test(name) && name.split(/\s+/).length <= 4
    return isEaRelease || isGa
  })

  // If there's only one milestone (just GA), don't expand — the main entry is fine
  if (releaseMilestones.length <= 1) return null

  // Deduplicate by release number (RHAIIS has both "EA1 release" and "EA1 GA" milestones)
  const byNumber = new Map()
  for (const m of releaseMilestones) {
    const num = milestoneToReleaseNumber(r.shortname, m.name)
    // Keep the latest date for each release number
    if (!byNumber.has(num) || m.date_finish > byNumber.get(num).date_finish) {
      byNumber.set(num, m)
    }
  }

  return [...byNumber.entries()].map(([releaseNumber, m]) => {
    const eaMatch = (m.name || '').match(/\b(EA\d?)\b/i)
    const eaTag = eaMatch ? eaMatch[1] : null
    return {
      productName,
      releaseNumber,
      dueDate: m.date_finish,
      codeFreezeDate: extractCodeFreezeDate(r, eaTag) || null
    }
  })
}

/**
 * Derives a release number from the parent shortname and milestone name.
 * e.g. (rhelai-3.4, "rhelai-3.4 EA1 release") → "rhelai-3.4.EA1"
 *      (rhelai-3.4, "rhelai-3.4 GA") → "rhelai-3.4"
 *      (RHAIIS-3.4, "rhaiis-3.4 EA2 GA") → "RHAIIS-3.4.EA2"
 *
 * Prevents duplicate EA tags when shortname already includes the EA suffix.
 */
function milestoneToReleaseNumber(shortname, milestoneName) {
  const eaMatch = milestoneName.match(/\b(EA\d?)\b/i)
  if (eaMatch) {
    const eaTag = eaMatch[1].toUpperCase()
    // Check if shortname already ends with this EA tag (case-insensitive)
    const endsWithEa = new RegExp(`[.\\-_]${eaTag}$`, 'i').test(shortname)
    if (endsWithEa) {
      // Already has the EA tag, return as-is
      return shortname
    }
    return `${shortname}.${eaTag}`
  }
  // GA milestone → use the parent shortname as-is
  return shortname
}

/**
 * Fetches releases for given product shortnames from Product Pages API.
 * Makes one request per shortname with server-side filtering.
 * Returns normalized release objects: { productName, releaseNumber, dueDate }
 */
async function fetchProductsByShortname(shortnames, config) {
  let token = await getProductPagesToken(config)
  if (!token) {
    console.warn('[product-pages] No auth configured, skipping Product Pages API calls')
    return []
  }

  const baseUrl = (config.productPagesBaseUrl || 'https://productpages.redhat.com').replace(/\/+$/, '')
  const releases = []

  for (let i = 0; i < shortnames.length; i++) {
    const shortname = shortnames[i]
    try {
      const url = `${baseUrl}/api/v7/releases/?product__shortname=${encodeURIComponent(shortname)}`
      let response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`
        },
        signal: AbortSignal.timeout(30000)
      })

      // Retry once on 401 — token may have expired mid-loop
      if (response.status === 401) {
        cachedToken = { token: null, expiresAt: 0 }
        token = await getProductPagesToken(config)
        if (!token) break
        response = await fetch(url, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`
          },
          signal: AbortSignal.timeout(30000)
        })
      }

      if (!response.ok) {
        console.error(`[product-pages] API error for product "${shortname}" (HTTP ${response.status})`)
        continue
      }

      const payload = await response.json()
      const rows = Array.isArray(payload) ? payload : (payload.releases || payload.items || [])

      for (const r of rows) {
        if (r.canceled) continue
        if (EXCLUDED_PHASES.has(r.phase)) continue

        const productName = r.product_name || r.product_shortname || shortname

        // Try to expand into discrete EA/GA entries from milestones
        const expanded = expandReleaseMilestones(r, productName)
        if (expanded) {
          for (const entry of expanded) {
            if (entry.dueDate) releases.push(entry)
          }
          continue
        }

        // Single-milestone or no-milestone release — use extractGaDate
        const gaDate = extractGaDate(r)
        if (!gaDate) continue

        releases.push({
          productName,
          releaseNumber: r.shortname || r.name || '',
          dueDate: gaDate,
          codeFreezeDate: extractCodeFreezeDate(r) || null
        })
      }
    } catch (err) {
      console.error(`[product-pages] Failed to fetch releases for "${shortname}":`, err.message)
    }

    // Small delay between requests to avoid rate limiting
    if (i < shortnames.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }

  return releases
}

/**
 * Fetches the full product list from Product Pages for settings UI autocomplete.
 * Cached in memory for 1 hour.
 */
async function fetchAllProducts(config) {
  if (productsCache.products && productsCache.expiresAt > Date.now()) {
    return productsCache.products
  }

  const token = await getProductPagesToken(config)
  if (!token) {
    return []
  }

  const baseUrl = (config.productPagesBaseUrl || 'https://productpages.redhat.com').replace(/\/+$/, '')
  try {
    const response = await fetch(`${baseUrl}/api/v7/products/`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`
      },
      signal: AbortSignal.timeout(30000)
    })

    if (!response.ok) {
      console.error(`[product-pages] Products API error (HTTP ${response.status})`)
      return []
    }

    const payload = await response.json()
    const rows = Array.isArray(payload) ? payload : (payload.products || payload.items || [])
    const products = rows
      .map(p => ({ shortname: p.shortname || '', name: p.name || '' }))
      .filter(p => p.shortname)
      .sort((a, b) => a.shortname.localeCompare(b.shortname))

    productsCache = {
      products,
      expiresAt: Date.now() + 60 * 60 * 1000 // 1 hour
    }

    return products
  } catch (err) {
    console.error('[product-pages] Failed to fetch products:', err.message)
    return []
  }
}

function _resetForTesting() {
  cachedToken = { token: null, expiresAt: 0 }
  pendingTokenRequest = null
  productsCache = { products: null, expiresAt: 0 }
}

module.exports = {
  getProductPagesToken,
  fetchProductsByShortname,
  fetchAllProducts,
  getAuthStatus,
  extractGaDate,
  extractCodeFreezeDate,
  milestoneToReleaseNumber,
  _resetForTesting
}
