/**
 * Google Doc import orchestration.
 *
 * Ties together doc parsing (google-docs.js), validation (validation.js),
 * and config persistence (config.js) for the import flow.
 */

const googleDocs = require('../../../shared/server/google-docs')
const { validateBigRock } = require('./validation')
const { getConfig } = require('./config')

/**
 * Parse a Google Doc URL or ID to extract the document ID.
 */
function parseDocId(input) {
  if (!input || typeof input !== 'string') return null
  input = input.trim()

  // Full URL: https://docs.google.com/document/d/{ID}/...
  const urlMatch = input.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/)
  if (urlMatch) return urlMatch[1]

  // Raw ID (alphanumeric + hyphens + underscores, typical length 44)
  if (/^[a-zA-Z0-9_-]{10,}$/.test(input)) return input

  return null
}

/**
 * Fetch and parse a Google Doc, returning Big Rocks for preview.
 */
async function previewDocImport(docIdOrUrl) {
  const docId = parseDocId(docIdOrUrl)
  if (!docId) {
    throw Object.assign(new Error('Invalid Google Doc URL or ID'), { statusCode: 400 })
  }

  try {
    const doc = await googleDocs.fetchDocument(docId)
    return googleDocs.extractBigRocksFromDoc(doc)
  } catch (err) {
    if (err.statusCode) throw err

    // Google API errors
    if (err.code === 403 || err.code === 404) {
      const email = googleDocs.getServiceAccountEmail()
      if (email) {
        console.error('[release-planning] Document access denied. Share with:', email)
      }
      throw Object.assign(
        new Error('Cannot access this document. Ensure the document is shared with the service account.'),
        { statusCode: 403, shareWith: email || undefined }
      )
    }
    throw Object.assign(
      new Error('Failed to fetch document: ' + (err.message || 'Unknown error')),
      { statusCode: 502 }
    )
  }
}

function normalizeRock(data, priority) {
  return {
    priority: priority,
    name: (data.name || '').trim(),
    fullName: data.fullName || '',
    pillar: data.pillar || '',
    state: data.state || '',
    owner: data.owner || '',
    architect: data.architect || '',
    outcomeKeys: data.outcomeKeys || [],
    notes: data.notes || '',
    description: data.description || ''
  }
}

/**
 * Execute the import: validate each rock via validateBigRock, then batch-write
 * all changes in a single config read-modify-write cycle.
 *
 * @param {Function} readFromStorage
 * @param {Function} writeToStorage
 * @param {string} version - Release version
 * @param {string} docIdOrUrl - Google Doc URL or ID (retained for logging/audit)
 * @param {string} mode - "replace" or "append"
 * @param {object} parsedDoc - Pre-fetched parse result from previewDocImport
 * @returns {object} { imported, skipped, skippedNames, validationErrors, mode, bigRocks }
 */
function executeDocImport(readFromStorage, writeToStorage, version, docIdOrUrl, mode, parsedDoc) {
  const parsedRocks = parsedDoc.bigRocks

  if (parsedRocks.length === 0) {
    throw Object.assign(
      new Error('No Big Rocks could be extracted from this document.'),
      { statusCode: 422 }
    )
  }

  const config = getConfig(readFromStorage)
  if (!config.releases[version]) {
    throw Object.assign(new Error('Release ' + version + ' not found'), { statusCode: 404 })
  }

  const bigRocks = mode === 'replace' ? [] : (config.releases[version].bigRocks || []).slice()
  const existingNames = new Set(bigRocks.map(function(r) { return r.name }))

  let imported = 0
  let skipped = 0
  const skippedNames = []
  const validationErrors = []

  for (let j = 0; j < parsedRocks.length; j++) {
    const rock = parsedRocks[j]

    if (mode === 'append' && existingNames.has(rock.name)) {
      skipped++
      skippedNames.push(rock.name)
      continue
    }

    const validation = validateBigRock(rock, {
      existingNames: Array.from(existingNames)
    })
    if (!validation.valid) {
      validationErrors.push({ name: rock.name, errors: validation.errors })
      skipped++
      skippedNames.push(rock.name)
      continue
    }

    bigRocks.push(normalizeRock(rock, bigRocks.length + 1))
    existingNames.add(rock.name)
    imported++
  }

  for (let i = 0; i < bigRocks.length; i++) {
    bigRocks[i].priority = i + 1
  }

  config.releases[version].bigRocks = bigRocks
  writeToStorage('release-planning/config.json', config)

  return {
    imported: imported,
    skipped: skipped,
    skippedNames: skippedNames.length > 0 ? skippedNames : undefined,
    validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
    mode: mode,
    bigRocks: bigRocks
  }
}

module.exports = { previewDocImport: previewDocImport, executeDocImport: executeDocImport, parseDocId: parseDocId }
