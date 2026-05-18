/**
 * T-shirt size parser.
 *
 * Extracts t-shirt sizing from Jira feature descriptions.
 * The description may be a string (v2 API) or ADF object (v3 API).
 *
 * Tries multiple patterns in priority order:
 *   1. Explicit label: "T-Shirt Size: XL" or "Size: M"
 *   2. Complexity/effort label: "Complexity: M" or "Effort: L"
 */

var VALID_SIZES = ['XS', 'S', 'M', 'L', 'XL']

/**
 * Extract plain text from an ADF (Atlassian Document Format) node.
 * @param {object} node - ADF node
 * @returns {string}
 */
function adfToText(node) {
  if (!node) return ''
  if (typeof node === 'string') return node
  if (node.type === 'text') return node.text || ''
  if (Array.isArray(node.content)) {
    return node.content.map(adfToText).join('')
  }
  return ''
}

/**
 * Parse t-shirt size from a Jira description.
 * @param {*} description - String or ADF object
 * @returns {string|null} One of 'XS', 'S', 'M', 'L', 'XL', or null
 */
function parseTshirtSize(description) {
  if (!description) return null

  var text
  if (typeof description === 'string') {
    text = description
  } else if (description.type === 'doc') {
    text = adfToText(description)
  } else {
    return null
  }

  // Pattern 1: "T-Shirt Size: XL" or "Size: M" (case-insensitive)
  // NOTE: Alternation order matters -- put longer alternatives first (XS, XL)
  // so "XS" and "XL" match before the single-letter "S" or "L" can greedily
  // consume the first character. Use a lookahead instead of \b after the match
  // to avoid false positives like "Size: Small" capturing "S" from "Small".
  var sizeMatch = text.match(/(?:t-?shirt\s+)?size\s*[:=]\s*(XS|XL|S|M|L)(?=[\s,;.\-)\]|]|$)/i)
  if (sizeMatch) {
    return sizeMatch[1].toUpperCase()
  }

  // Pattern 2: "Complexity: M" or "Effort: L"
  var complexityMatch = text.match(/(?:complexity|effort)\s*[:=]\s*(XS|XL|S|M|L)(?=[\s,;.\-)\]|]|$)/i)
  if (complexityMatch) {
    return complexityMatch[1].toUpperCase()
  }

  return null
}

module.exports = {
  parseTshirtSize: parseTshirtSize,
  adfToText: adfToText,
  VALID_SIZES: VALID_SIZES
}
