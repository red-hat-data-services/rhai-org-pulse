/**
 * Google Doc import orchestration.
 *
 * Ties together doc parsing (google-docs.js), validation (validation.js),
 * and config persistence (config.js) for the import flow.
 */

var googleDocs = require('../../../shared/server/google-docs')
var { validateBigRock } = require('./validation')
var { getConfig, saveBigRock, deleteBigRock } = require('./config')

/**
 * Parse a Google Doc URL or ID to extract the document ID.
 */
function parseDocId(input) {
  if (!input || typeof input !== 'string') return null
  input = input.trim()

  // Full URL: https://docs.google.com/document/d/{ID}/...
  var urlMatch = input.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/)
  if (urlMatch) return urlMatch[1]

  // Raw ID (alphanumeric + hyphens + underscores, typical length 44)
  if (/^[a-zA-Z0-9_-]{10,}$/.test(input)) return input

  return null
}

/**
 * Fetch and parse a Google Doc, returning Big Rocks for preview.
 */
async function previewDocImport(docIdOrUrl) {
  var docId = parseDocId(docIdOrUrl)
  if (!docId) {
    throw Object.assign(new Error('Invalid Google Doc URL or ID'), { statusCode: 400 })
  }

  try {
    var doc = await googleDocs.fetchDocument(docId)
    return googleDocs.extractBigRocksFromDoc(doc)
  } catch (err) {
    if (err.statusCode) throw err

    // Google API errors
    if (err.code === 403 || err.code === 404) {
      var email = googleDocs.getServiceAccountEmail()
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

/**
 * Execute the import: validate each rock via validateBigRock, and persist
 * through saveBigRock / deleteBigRock CRUD functions.
 *
 * This ensures all imported data passes through the same validation and
 * persistence code path as manual CRUD operations.
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
  var parsedRocks = parsedDoc.bigRocks

  if (parsedRocks.length === 0) {
    throw Object.assign(
      new Error('No Big Rocks could be extracted from this document.'),
      { statusCode: 422 }
    )
  }

  var config = getConfig(readFromStorage)
  if (!config.releases[version]) {
    throw Object.assign(new Error('Release ' + version + ' not found'), { statusCode: 404 })
  }

  var existingRocks = config.releases[version].bigRocks || []
  var imported = 0
  var skipped = 0
  var skippedNames = []
  var validationErrors = []

  if (mode === 'replace') {
    // Delete all existing rocks first (reverse order to avoid index shift)
    for (var i = existingRocks.length - 1; i >= 0; i--) {
      deleteBigRock(readFromStorage, writeToStorage, version, existingRocks[i].name)
    }
  }

  // Build the set of names already present (for duplicate + uniqueness checks)
  var currentRocks = getConfig(readFromStorage).releases[version].bigRocks || []
  var existingNames = new Set(currentRocks.map(function(r) { return r.name }))

  for (var j = 0; j < parsedRocks.length; j++) {
    var rock = parsedRocks[j]

    // Skip duplicates in append mode
    if (mode === 'append' && existingNames.has(rock.name)) {
      skipped++
      skippedNames.push(rock.name)
      continue
    }

    // Validate through the same validator used by CRUD endpoints
    var validation = validateBigRock(rock, {
      existingNames: Array.from(existingNames)
    })
    if (!validation.valid) {
      validationErrors.push({ name: rock.name, errors: validation.errors })
      skipped++
      skippedNames.push(rock.name)
      continue
    }

    // Persist through the standard CRUD function
    saveBigRock(readFromStorage, writeToStorage, version, null, rock)
    existingNames.add(rock.name)
    imported++
  }

  // Read back the final state (authoritative)
  var finalConfig = getConfig(readFromStorage)
  var finalRocks = finalConfig.releases[version].bigRocks || []

  return {
    imported: imported,
    skipped: skipped,
    skippedNames: skippedNames.length > 0 ? skippedNames : undefined,
    validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
    mode: mode,
    bigRocks: finalRocks
  }
}

module.exports = { previewDocImport: previewDocImport, executeDocImport: executeDocImport, parseDocId: parseDocId }
