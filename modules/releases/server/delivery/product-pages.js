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

// Module-level secrets, set once via init()
let _secrets = {}

function init(secrets) {
  _secrets = secrets || {}
}

/**
 * Returns a Bearer token string, or null if no auth is configured.
 * Caches OAuth tokens in memory and deduplicates concurrent requests.
 */
async function getProductPagesToken(config) {
  const clientId = _secrets.PRODUCT_PAGES_CLIENT_ID || ''
  const clientSecret = _secrets.PRODUCT_PAGES_CLIENT_SECRET || ''
  const personalToken = _secrets.PRODUCT_PAGES_TOKEN || ''

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
 * Extracts the due date for any Product Pages release — GA or EA.
 *
 * RHOAI publishes separate Product Pages rows per phase (rhoai-3.5.EA1,
 * rhoai-3.5.EA2, rhoai-3.5), unlike RHELAI/RHAII which bundle phases as
 * milestones in one row and go through expandReleaseMilestones().
 *
 * For EA-specific releases (shortname contains EA1, EA2, etc.), searches
 * milestones matching that EA tag first, since extractGaDate() intentionally
 * skips EA milestones.  Falls back to extractGaDate() for GA releases.
 */
function extractReleaseDueDate(release) {
  const shortname = release.shortname || release.name || ''
  const eaMatch = shortname.match(/\b(EA\d?)\b/i)

  if (eaMatch) {
    const eaTag = eaMatch[1]
    const eaPattern = new RegExp(`\\b${eaTag}\\b`, 'i')

    const milestones = release.major_milestones
    if (Array.isArray(milestones)) {
      for (const m of milestones) {
        if (m.draft) continue
        if (eaPattern.test(m.name || '') && m.date_finish) {
          return m.date_finish
        }
      }
    }

    const tasks = release.all_ga_tasks
    if (Array.isArray(tasks)) {
      for (const t of tasks) {
        if (eaPattern.test(t.name || '') && t.date_finish) {
          return t.date_finish
        }
      }
    }

    // ga_date on EA releases often holds the EA target date
    if (release.ga_date) return release.ga_date
  }

  return extractGaDate(release)
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
 * Extracts the feature freeze date from a Product Pages release object.
 * Searches major_milestones and all_ga_tasks for entries matching
 * "feature freeze" (case-insensitive, with optional hyphen/space).
 *
 * For EA-specific releases, pass an optional eaTag (e.g. "EA1") to prefer
 * a milestone scoped to that EA over a generic one.
 */
function extractFeatureFreezeDate(release, eaTag) {
  const freezePattern = /feature[.\-_\s]*freeze/i

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
  const clientId = _secrets.PRODUCT_PAGES_CLIENT_ID || ''
  const clientSecret = _secrets.PRODUCT_PAGES_CLIENT_SECRET || ''
  const personalToken = _secrets.PRODUCT_PAGES_TOKEN || ''

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
    // GA milestone: name ending in "GA" or "GA Release" without EA tag.
    // Matches "rhelai-3.4 GA", "RHAI-3.5 GA Release", but not
    // "rpms release 1 month before the 3.4 GA" (too long) or
    // "RHAII-3.5 GA final RC available" (doesn't end in GA/Release).
    const hasNoEa = !/\bEA\d?\b/i.test(name)
    const isGa = hasNoEa && (
      (/\bGA\s*$/i.test(name) && name.split(/\s+/).length <= 4) ||
      /\bGA\s+Release\s*$/i.test(name)
    )
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
      codeFreezeDate: extractCodeFreezeDate(r, eaTag) || null,
      featureFreezeDate: extractFeatureFreezeDate(r, eaTag) || null
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
            if (entry.dueDate) {
              entry._expanded = true
              releases.push(entry)
            }
          }
          continue
        }

        // Single-milestone or no-milestone release (e.g. RHOAI per-phase rows)
        const dueDate = extractReleaseDueDate(r)
        if (!dueDate) continue

        const releaseNumber = r.shortname || r.name || ''
        const eaMatch = releaseNumber.match(/\b(EA\d?)\b/i)
        const eaTag = eaMatch ? eaMatch[1] : null
        releases.push({
          productName,
          releaseNumber,
          dueDate,
          codeFreezeDate: extractCodeFreezeDate(r, eaTag) || null,
          featureFreezeDate: extractFeatureFreezeDate(r, eaTag) || null
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

  // De-duplicate: when a product has both a parent release (rhoai-3.5) that
  // gets expanded into EA entries AND individual EA releases (rhoai-3.5.EA1),
  // the expanded entries inherit the parent's generic Feature Freeze date
  // which is wrong for EA milestones. Prefer individual releases over expanded.
  const deduped = new Map()
  for (const entry of releases) {
    const key = (entry.releaseNumber || '').toLowerCase().replace(/[\s._-]+/g, '')
    const existing = deduped.get(key)
    if (!existing) {
      deduped.set(key, entry)
      continue
    }
    // Individual (non-expanded) entries always win over expanded ones
    if (existing._expanded && !entry._expanded) {
      deduped.set(key, entry)
    } else if (!existing._expanded && entry._expanded) {
      // Keep existing individual entry
    } else if (entry.featureFreezeDate && (!existing.featureFreezeDate || entry.featureFreezeDate < existing.featureFreezeDate)) {
      deduped.set(key, entry)
    }
  }

  // Strip the internal flag before returning
  const result = [...deduped.values()]
  for (const entry of result) {
    delete entry._expanded
  }
  return result
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

/**
 * Fetches accurate feature freeze dates from Product Pages schedule tasks.
 *
 * The releases list endpoint provides only major_milestones which lack
 * EA-specific feature freeze entries. This function fetches the detailed
 * schedule for each release entity to find granular freeze dates per EA.
 *
 * Strategy per product:
 *  1. Try to find an exact EA release (e.g. rhoai-3.5.EA1) — its schedule
 *     should contain a generic "Feature Freeze" task.
 *  2. Fall back to the parent release (e.g. rhelai-3.5) — its schedule
 *     should contain EA-scoped tasks like "EA1 Feature Freeze".
 *
 * @param {string} portfolioVersion  e.g. "3.5.EA1", "3.5"
 * @param {string[]} productShortnames  e.g. ['rhoai', 'rhelai', 'RHAII']
 * @param {object}  config  { productPagesBaseUrl }
 * @param {string}  [freezeType='feature']  'feature' or 'code'
 * @returns {Promise<{ byProduct: Object<string,string>, earliest: string|null }>}
 */
async function fetchFeatureFreezeDatesFromSchedule(portfolioVersion, productShortnames, config, freezeType) {
  var _freezeType = freezeType || 'feature'
  const version = Array.isArray(portfolioVersion) ? portfolioVersion[0] : portfolioVersion
  const versionStr = String(version || '')
  if (!versionStr) return { byProduct: {}, earliest: null }

  const token = await getProductPagesToken(config)
  if (!token) {
    console.warn('[product-pages] fetchFeatureFreezeDatesFromSchedule: no auth token available')
    return { byProduct: {}, earliest: null }
  }

  const baseUrl = (config.productPagesBaseUrl || 'https://productpages.redhat.com').replace(/\/+$/, '')

  const eaMatch = versionStr.match(/\b(EA\d?)\b/i)
  const eaTag = eaMatch ? eaMatch[1].toUpperCase() : null
  let baseVersion = versionStr
  if (eaMatch) {
    baseVersion = versionStr.slice(0, eaMatch.index).replace(/[\s._-]+$/, '') +
      versionStr.slice(eaMatch.index + eaMatch[0].length).replace(/^[\s._-]+/, '')
  }
  baseVersion = baseVersion.replace(/^[\s.]+/, '').replace(/[\s.]+$/, '')

  const byProduct = {}
  let earliest = null
  const headers = { Accept: 'application/json', Authorization: `Bearer ${token}` }

  for (const shortname of productShortnames) {
    try {
      const releasesUrl = `${baseUrl}/api/v7/releases/?product__shortname=${encodeURIComponent(shortname)}`
      let relResponse = await fetch(releasesUrl, { headers, signal: AbortSignal.timeout(15000) })

      // Retry once on 401 — token may have expired
      if (relResponse.status === 401) {
        cachedToken = { token: null, expiresAt: 0 }
        const newToken = await getProductPagesToken(config)
        if (newToken) {
          headers.Authorization = `Bearer ${newToken}`
          relResponse = await fetch(releasesUrl, { headers, signal: AbortSignal.timeout(15000) })
        }
      }

      if (!relResponse.ok) {
        console.warn(`[product-pages] Releases API returned HTTP ${relResponse.status} for "${shortname}"`)
        continue
      }

      const relPayload = await relResponse.json()
      const rows = Array.isArray(relPayload) ? relPayload : (relPayload.results || relPayload.releases || relPayload.items || [])

      // Build search candidates in priority order: exact EA release, then parent
      const candidates = []
      if (eaTag) {
        candidates.push(`${shortname}-${baseVersion}.${eaTag}`)
        candidates.push(`${shortname}-${baseVersion}${eaTag}`)
        candidates.push(`${shortname}-${baseVersion} ${eaTag}`)
      }
      candidates.push(`${shortname}-${baseVersion}`)

      let releaseId = null
      let matchedShortname = null
      let matchedExactEa = false

      for (const candidate of candidates) {
        const norm = candidate.toLowerCase().replace(/[\s._-]+/g, '')
        for (const r of rows) {
          if (!r.id) continue
          const rn = (r.shortname || '').toLowerCase().replace(/[\s._-]+/g, '')
          if (rn === norm) {
            releaseId = r.id
            matchedShortname = r.shortname || candidate
            matchedExactEa = eaTag ? /ea\d?/i.test(r.shortname || '') : false
            break
          }
        }
        if (releaseId) break
      }

      if (!releaseId) {
        console.warn(`[product-pages] No release entity found for "${shortname}" matching version "${versionStr}"`)
        continue
      }

      console.log(`[product-pages] Found release entity ${releaseId} ("${matchedShortname}") for "${shortname}", exactEa=${matchedExactEa}`)

      const freezeQuery = _freezeType + ' freeze'
      const schedUrl = `${baseUrl}/api/v7/schedule-tasks/?entity_id=${releaseId}&q=${encodeURIComponent(freezeQuery)}`
      const schedResponse = await fetch(schedUrl, { headers, signal: AbortSignal.timeout(15000) })
      if (!schedResponse.ok) {
        console.warn(`[product-pages] Schedule tasks API returned HTTP ${schedResponse.status} for entity ${releaseId}`)
        continue
      }

      const schedPayload = await schedResponse.json()
      const tasks = Array.isArray(schedPayload)
        ? schedPayload
        : (schedPayload.data || schedPayload.results || schedPayload.result || [])

      const freezePattern = new RegExp(_freezeType + '[.\\-_\\s]*freeze', 'i')
      let bestDate = null

      for (const task of tasks) {
        if (task.draft) continue
        const name = task.name || ''
        if (!freezePattern.test(name)) continue

        if (eaTag && !matchedExactEa) {
          // Parent release: look for EA-specific freeze tasks
          const nameUpper = name.toUpperCase()
          const eaIdx = nameUpper.indexOf(eaTag)
          if (eaIdx !== -1) {
            const before = eaIdx === 0 || /\W/.test(name[eaIdx - 1])
            const after = eaIdx + eaTag.length >= name.length || /\W/.test(name[eaIdx + eaTag.length])
            if (before && after) {
              bestDate = task.date_finish || null
              break
            }
          }
        }
        // For exact EA releases, or as a generic fallback
        if (!bestDate && task.date_finish) {
          bestDate = task.date_finish
        }
      }

      if (bestDate) {
        const key = (matchedExactEa ? matchedShortname : `${shortname}-${baseVersion}${eaTag ? '.' + eaTag : ''}`).toLowerCase()
        byProduct[key] = bestDate
        if (!earliest || bestDate < earliest) earliest = bestDate
        console.log(`[product-pages] ${_freezeType} freeze date for "${key}": ${bestDate}`)
      } else {
        console.warn(`[product-pages] No "${freezeQuery}" task found in ${tasks.length} schedule tasks for entity ${releaseId} ("${matchedShortname}")`)
        if (tasks.length > 0) {
          console.warn(`[product-pages] Task names: ${tasks.slice(0, 5).map(t => t.name).join(', ')}`)
        }
      }
    } catch (err) {
      console.error(`[product-pages] Schedule fetch failed for "${shortname}":`, err.message)
    }
  }

  return { byProduct, earliest }
}

function _resetForTesting() {
  cachedToken = { token: null, expiresAt: 0 }
  pendingTokenRequest = null
  productsCache = { products: null, expiresAt: 0 }
}

module.exports = {
  init,
  getProductPagesToken,
  fetchProductsByShortname,
  fetchFeatureFreezeDatesFromSchedule,
  fetchAllProducts,
  getAuthStatus,
  extractGaDate,
  extractReleaseDueDate,
  extractCodeFreezeDate,
  extractFeatureFreezeDate,
  expandReleaseMilestones,
  milestoneToReleaseNumber,
  _resetForTesting
}
