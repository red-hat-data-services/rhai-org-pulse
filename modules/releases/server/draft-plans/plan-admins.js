/**
 * Draft Plans plan-admin allowlist (freeze / Final GA / reset)
 * and UI/API viewer allowlist (who can see Draft Plans at all).
 * Keep emails + fallback display names in sync with product owners.
 */

var DEFAULT_PLAN_ADMIN_EMAILS = ['emarion@redhat.com', 'trozell@redhat.com']

/** Preview gate: who can see the Draft Plans tab and call draft-plans APIs. */
var DEFAULT_VIEWER_EMAILS = ['emarion@redhat.com']

var DEFAULT_PLAN_ADMIN_NAMES_BY_EMAIL = {
  'emarion@redhat.com': 'Emarion',
  'trozell@redhat.com': 'Tiffany Rozell'
}

function normalizeEmail(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

function normalizeName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

function namesMatch(a, b) {
  return normalizeName(a) === normalizeName(b) && normalizeName(a) !== ''
}

function loadAdminEmails(config) {
  if (config && Array.isArray(config.planAdminEmails) && config.planAdminEmails.length > 0) {
    return config.planAdminEmails.map(normalizeEmail).filter(Boolean)
  }
  return DEFAULT_PLAN_ADMIN_EMAILS.slice()
}

function loadViewerEmails(config) {
  if (config && Array.isArray(config.draftPlansViewerEmails) && config.draftPlansViewerEmails.length > 0) {
    return config.draftPlansViewerEmails.map(normalizeEmail).filter(Boolean)
  }
  return DEFAULT_VIEWER_EMAILS.slice()
}

function emailInList(email, list) {
  var e = normalizeEmail(email)
  if (!e) return false
  for (var i = 0; i < list.length; i++) {
    if (normalizeEmail(list[i]) === e) return true
  }
  return false
}

function isPlanAdminEmail(email, adminEmails) {
  return emailInList(email, adminEmails || DEFAULT_PLAN_ADMIN_EMAILS)
}

function isDraftPlansViewerEmail(email, viewerEmails) {
  return emailInList(email, viewerEmails || DEFAULT_VIEWER_EMAILS)
}

function isPlanAdminName(name, adminNames) {
  var list = adminNames || Object.values(DEFAULT_PLAN_ADMIN_NAMES_BY_EMAIL)
  for (var i = 0; i < list.length; i++) {
    if (namesMatch(name, list[i])) return true
  }
  return false
}

/**
 * Resolve display names for Acting-as (roster preferred, then fallback map).
 * @param {string[]} adminEmails
 * @param {object[]} people roster rows
 */
function resolvePlanAdminNames(adminEmails, people) {
  var names = []
  var seen = {}
  for (var i = 0; i < adminEmails.length; i++) {
    var email = normalizeEmail(adminEmails[i])
    var person = null
    if (people && people.length) {
      for (var p = 0; p < people.length; p++) {
        if (people[p].email && normalizeEmail(people[p].email) === email) {
          person = people[p]
          break
        }
      }
    }
    var name =
      (person && (person.jiraDisplayName || person.name)) ||
      DEFAULT_PLAN_ADMIN_NAMES_BY_EMAIL[email] ||
      (email ? email.split('@')[0] : null)
    if (!name) continue
    var key = normalizeName(name)
    if (seen[key]) continue
    seen[key] = true
    names.push(name)
  }
  return names
}

module.exports = {
  DEFAULT_PLAN_ADMIN_EMAILS,
  DEFAULT_VIEWER_EMAILS,
  DEFAULT_PLAN_ADMIN_NAMES_BY_EMAIL,
  loadAdminEmails,
  loadViewerEmails,
  isPlanAdminEmail,
  isDraftPlansViewerEmail,
  isPlanAdminName,
  resolvePlanAdminNames,
  namesMatch
}
