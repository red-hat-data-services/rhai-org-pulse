/**
 * Shared version name normalization for the releases module.
 *
 * Handles all observed Jira version naming conventions:
 *   {ver} {phase} {PRODUCT} RELEASE   — "3.5 EA1 RHOAI RELEASE"
 *   {ver} {phase} {PRODUCT}            — "2.25.9 GA RHOAI"
 *   {ver} {PRODUCT} Release            — "2.25.8 RHAII Release"
 *   {PRODUCT}-{ver}                    — "RHAII-3.5", "rhoai-3.4"
 *   {PRODUCT}-{ver} {phase}            — "RHAIIS-3.4 EA2", "RHELAI-3.4 EA-1"
 *   {PRODUCT}-{ver}.{phase}            — "rhoai-3.4.EA1"
 *   {PRODUCT} {ver}                    — "RHAIIS 3.0", "RHEL AI 2.22.0"
 *   {PRODUCT} {ver} {phase}            — "RHAIIS 3.0 GA", "RHOAI 3.3.4 GA"
 *   {PRODUCT}_{ver}                    — "RHOAI_2.20.0"
 *
 * Canonical output: lowercase, all separators collapsed to spaces,
 * product-first, GA stripped. e.g. "rhoai 3 5 ea1".
 */

var PRODUCTS = ['rhaiis', 'rhoai', 'rhelai', 'rhaii', 'rhai'];
var PRODUCTS_RE = PRODUCTS.join('|');

var PRODUCT_ALIASES = {
  rhaii: 'rhaiis',
  rhai: 'rhoai'
};

/**
 * Strip ".z" z-stream suffix from version strings.
 * "rhoai-3.5.z" → "rhoai-3.5", "rhoai-3.5.z.EA1" → "rhoai-3.5.EA1"
 */
function stripZStream(value) {
  if (!value) return value;
  return String(value).replace(/\.z\b/gi, '');
}

/**
 * Normalize a version name to a canonical form for fuzzy matching.
 *
 * All known naming conventions collapse to: "{product} {ver} [{phase}]"
 * with spaces as separators, lowercase, GA stripped, "release" stripped.
 *
 * @param {string} name - Raw version name from Jira or config
 * @returns {string} Normalized form (empty string for empty input)
 */
function normalizeVersionName(name) {
  if (name == null) return '';
  var s = String(name).toLowerCase().trim();
  if (!s) return s;

  // Multi-word product names → single token
  s = s.replace(/\brhel\s+ai\b/g, 'rhelai');

  // Strip .z suffixes (Product Pages z-stream convention)
  s = s.replace(/\.z(?=$|[.\s])/g, '');

  // Normalize EA-1 → EA1 (hyphen in EA tag)
  s = s.replace(/\bea-(\d)/g, 'ea$1');

  // Collapse all separators to spaces
  s = s.replace(/[-._]+/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();

  // Strip trailing "release"
  s = s.replace(/\s+release$/, '').trim();

  // Rearrange version-first patterns to canonical product-first form

  // {ver} {phase} {product}  — e.g. "3 5 ea1 rhoai"
  var m = new RegExp(
    '^(\\d+(?:\\s+\\d+)*)\\s+(ga|ea\\d+)\\s+(' + PRODUCTS_RE + ')$'
  ).exec(s);
  if (m) {
    return m[2] === 'ga'
      ? m[3] + ' ' + m[1]
      : m[3] + ' ' + m[1] + ' ' + m[2];
  }

  // {ver} {product}  — e.g. "2 25 8 rhaii"
  m = new RegExp(
    '^(\\d+(?:\\s+\\d+)*)\\s+(' + PRODUCTS_RE + ')$'
  ).exec(s);
  if (m) {
    return m[2] + ' ' + m[1];
  }

  // Strip trailing "ga" from product-first patterns
  // "{product} {ver} ga" → "{product} {ver}"
  m = new RegExp(
    '^(' + PRODUCTS_RE + ')(\\s+\\d[\\d\\s]*)\\s+ga$'
  ).exec(s);
  if (m) {
    return (m[1] + m[2]).trim();
  }

  return s;
}

/**
 * Normalize a product name to its canonical form.
 * "RHAII" → "rhaiis", "rhai" → "rhoai", "RHEL AI" → "rhelai"
 */
function normalizeProductName(name) {
  var lower = String(name || '').trim().toLowerCase();
  lower = lower.replace(/\brhel\s+ai\b/g, 'rhelai');
  return PRODUCT_ALIASES[lower] || lower;
}

/**
 * Parse a version name into structured components.
 * Returns null if the version name doesn't match any known pattern.
 *
 * @param {string} name - Raw version name
 * @returns {{ product: string, version: string, phase: string|null }|null}
 */
function parseVersionComponents(name) {
  var s = normalizeVersionName(name);
  if (!s) return null;

  var m = new RegExp(
    '^(' + PRODUCTS_RE + ')\\s+(\\d+(?:\\s+\\d+)*)(?:\\s+(ea\\d+))?$'
  ).exec(s);
  if (m) {
    return {
      product: m[1],
      version: m[2].replace(/\s+/g, '.'),
      phase: m[3] ? m[3].toUpperCase() : null
    };
  }

  return null;
}

/**
 * Extract the product prefix from a version name.
 * Handles all naming conventions including version-first RHAISTRAT format.
 *
 * @param {string} versionName - Raw version name
 * @returns {string|null} Lowercase product prefix, or null if unrecognized
 */
function extractProduct(versionName) {
  var components = parseVersionComponents(versionName);
  return components ? components.product : null;
}

/**
 * Check if two version names refer to the same logical release.
 */
function isVersionEquivalent(a, b) {
  var na = normalizeVersionName(a);
  var nb = normalizeVersionName(b);
  return na !== '' && na === nb;
}

/**
 * Validate a version string for use as a route parameter.
 * Allows spaces (required by current RHAISTRAT format) while
 * preventing path traversal and injection.
 *
 * @param {string} version - Version string to validate
 * @returns {boolean}
 */
function isValidVersionParam(version) {
  if (!version || typeof version !== 'string') return false;
  if (version.length > 80) return false;
  var RESERVED = ['__proto__', 'constructor', 'prototype'];
  if (RESERVED.indexOf(version) !== -1) return false;
  if (/[/\\]/.test(version)) return false;
  if (/\.\./.test(version)) return false;
  return /^[a-zA-Z0-9 ._-]{1,80}$/.test(version);
}

module.exports = {
  stripZStream,
  normalizeVersionName,
  normalizeProductName,
  parseVersionComponents,
  extractProduct,
  isVersionEquivalent,
  isValidVersionParam,
  PRODUCT_ALIASES,
  KNOWN_PRODUCTS: PRODUCTS
};
