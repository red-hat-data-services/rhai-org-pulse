/**
 * Google Docs API auth, document fetch, and Big Rock extraction.
 *
 * Parallel to google-sheets.js but uses the Docs API v1 with
 * documents.readonly scope. Maintains its own cachedAuth instance
 * (same service account key file, different scope).
 */

const { google } = require('googleapis')
const fs = require('fs')

let cachedAuth = null

function getDocsAuth() {
  if (cachedAuth) return cachedAuth
  var keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || '/etc/secrets/google-sa-key.json'
  if (!fs.existsSync(keyFile)) {
    throw Object.assign(
      new Error('Google Docs integration is not available. The service account key file is not configured.'),
      { statusCode: 503 }
    )
  }
  cachedAuth = new google.auth.GoogleAuth({
    keyFile: keyFile,
    scopes: ['https://www.googleapis.com/auth/documents.readonly']
  })
  console.log('[google-docs] Docs API auth configured, key file:', keyFile)
  return cachedAuth
}

function isDocsConfigured() {
  var keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || '/etc/secrets/google-sa-key.json'
  return fs.existsSync(keyFile)
}

function getServiceAccountEmail() {
  var keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || '/etc/secrets/google-sa-key.json'
  try {
    var key = JSON.parse(fs.readFileSync(keyFile, 'utf-8'))
    return key.client_email || null
  } catch {
    return null
  }
}

async function fetchDocument(docId) {
  var auth = getDocsAuth()
  var docs = google.docs({ version: 'v1', auth: auth })
  var response = await docs.documents.get({ documentId: docId })
  return response.data
}

// ─── Parsing ───

var OUTCOME_KEY_RE = /RHAISTRAT-\d+/g
var STATE_RE = /\((continue from [\d.]+|new for [\d.]+)\)/i
var NAME_CLEANUP_RE = /\s*\((?:continue|new)\s+(?:from|for)\s+[\d.]+\)/i

function extractText(paragraph) {
  return (paragraph.elements || [])
    .map(function(e) { return (e.textRun && e.textRun.content) || '' })
    .join('')
    .trim()
}

function extractOutcomeKeys(text) {
  var matches = text.match(OUTCOME_KEY_RE)
  return matches ? Array.from(new Set(matches)) : []
}

function parseTopLevelItem(text, priority) {
  // Extract state
  var stateMatch = text.match(STATE_RE)
  var state = stateMatch ? stateMatch[1] : ''

  // Extract outcome keys from the top-level line itself
  var outcomeKeys = extractOutcomeKeys(text)

  // Extract name: everything before the state parenthetical or "Outcome:"
  var name = text
    .replace(NAME_CLEANUP_RE, '')
    .replace(/\s*\[?Outcome[:\s].*$/i, '')
    .replace(OUTCOME_KEY_RE, '')
    .replace(/\s*Outcome\s*$/i, '')
    .trim()

  // Build fullName from the original text (cleaned up)
  var fullName = text
    .replace(/\s*\[?Outcome[:\s].*$/i, '')
    .replace(OUTCOME_KEY_RE, '')
    .replace(/\s*Outcome\s*$/i, '')
    .trim()

  return {
    priority: priority,
    name: name,
    fullName: fullName,
    pillar: '',
    state: state,
    owner: '',
    outcomeKeys: outcomeKeys,
    notes: '',
    description: ''
  }
}

/**
 * Get the nesting level from a bullet property.
 * Google Docs API omits nestingLevel when it is 0.
 * Only nested items (level 1+) have the property set.
 */
function getNestingLevel(bullet) {
  return bullet.nestingLevel || 0
}

/**
 * Extract Big Rocks from a Google Docs API document response.
 *
 * Walks body.content[] looking for paragraphs with a bullet property
 * where nestingLevel is 0 (top-level list items). Each top-level item
 * becomes a Big Rock. Nested items contribute their outcome keys to
 * the parent Big Rock.
 */
function extractBigRocksFromDoc(doc) {
  var body = doc.body || {}
  var content = body.content || []
  var title = doc.title || ''
  var bigRocks = []
  var warnings = []

  var currentRock = null
  var currentListId = null
  var priority = 0

  for (var i = 0; i < content.length; i++) {
    var element = content[i]
    if (element.paragraph) {
      var para = element.paragraph
      var text = extractText(para)
      var bullet = para.bullet

      if (bullet && getNestingLevel(bullet) === 0) {
        // New top-level list item = new Big Rock
        if (currentRock) {
          bigRocks.push(currentRock)
        }
        priority++
        currentListId = bullet.listId
        currentRock = parseTopLevelItem(text, priority)
      } else if (bullet && getNestingLevel(bullet) > 0 && bullet.listId === currentListId && currentRock) {
        // Child item of current Big Rock -- look for outcome keys
        var keys = extractOutcomeKeys(text)
        for (var j = 0; j < keys.length; j++) {
          if (!currentRock.outcomeKeys.includes(keys[j])) {
            currentRock.outcomeKeys.push(keys[j])
          }
        }
      }
    }
  }

  // Don't forget the last rock
  if (currentRock) {
    bigRocks.push(currentRock)
  }

  // Generate warnings for rocks without outcome keys
  for (var k = 0; k < bigRocks.length; k++) {
    if (bigRocks[k].outcomeKeys.length === 0) {
      warnings.push("Big Rock #" + bigRocks[k].priority + " '" + bigRocks[k].name + "' has no outcome key")
    }
  }

  return { title: title, bigRocks: bigRocks, warnings: warnings }
}

module.exports = {
  getDocsAuth: getDocsAuth,
  isDocsConfigured: isDocsConfigured,
  getServiceAccountEmail: getServiceAccountEmail,
  fetchDocument: fetchDocument,
  extractBigRocksFromDoc: extractBigRocksFromDoc,
  // Exported for testing
  extractText: extractText,
  extractOutcomeKeys: extractOutcomeKeys,
  parseTopLevelItem: parseTopLevelItem,
  getNestingLevel: getNestingLevel
}
