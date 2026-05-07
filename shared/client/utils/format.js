/**
 * Format an ISO date string for display.
 *
 * @param {string|null|undefined} iso - ISO 8601 date string
 * @param {Object} [options]
 * @param {string} [options.fallback='Never'] - Value to return when iso is falsy
 * @param {boolean} [options.includeTime=true] - When true uses toLocaleString (date + time),
 *   when false uses toLocaleDateString (date only)
 * @returns {string}
 */
export function formatDate(iso, options) {
  var fallback = (options && options.fallback != null) ? options.fallback : 'Never'
  var includeTime = (options && options.includeTime != null) ? options.includeTime : true

  if (!iso) return fallback
  if (includeTime) {
    return new Date(iso).toLocaleString()
  }
  return new Date(iso).toLocaleDateString()
}
