/**
 * Helpers shared by the AIPCC-E request endpoints (Python package, RPM and
 * channel requests): business-day date checks, Jira project selection,
 * requester and assignee lookup, team options, rate limiting and ADF
 * building blocks.
 */

const DEFAULT_JIRA_PROJECT = 'RHAI';
const JIRA_PROJECT_KEY_RE = /^[A-Z][A-Z0-9]+$/;
const JIRA_KEY_RE = /^[A-Z][A-Z0-9]+-\d+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SECURITY_NAME = 'Red Hat Employee';
const EPIC_NAME_FIELD = 'customfield_10011';
// Jira accounts are keyed by @redhat.com. The OAuth proxy may present the
// requester under AUTH_EMAIL_DOMAIN (e.g. user@cluster.local), so the local
// part is re-homed onto this domain before any Jira lookup.
const JIRA_EMAIL_DOMAIN = 'redhat.com';
const RATE_LIMIT_WINDOW_MS = 60_000;
const TEAM_OPTIONS_CACHE_TTL_MS = 5 * 60_000;
const TEAM_PROJECTS = ['RHAISTRAT', 'RHAI'];
// Projects that expose the Epic issue type on their create screen. RHAISTRAT
// does not, so requests for RHAISTRAT teams fall back to the default project.
const FILING_PROJECTS = ['RHAI'];
const RHAI_TEAM_OPTIONS = [
  'Accelerator Enablement',
  'AIPCC Ecosystems',
  'AIPCC Productization',
  'Development Platform',
  'Model Validation'
].map(name => ({ value: name, label: name }));
const DEMO_TEAM_OPTIONS = {
  RHAISTRAT: [{ value: 'AI Core Platform', label: 'AI Core Platform' }],
  RHAI: RHAI_TEAM_OPTIONS
};

// --- Dates ---

/**
 * Earliest allowed delivery date (YYYY-MM-DD): `businessDays` weekdays
 * after today, counted in UTC. Public holidays are not excluded.
 */
function earliestBusinessDate(businessDays, now = new Date()) {
  const date = new Date(now);
  date.setUTCHours(0, 0, 0, 0);
  let added = 0;
  while (added < businessDays) {
    date.setUTCDate(date.getUTCDate() + 1);
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) added++;
  }
  return date.toISOString().slice(0, 10);
}

// Date.parse rolls impossible dates over (2026-02-31 becomes 2026-03-03), so round-trip the value.
function isCalendarDate(dateStr) {
  if (!DATE_RE.test(dateStr)) return false;
  const date = new Date(dateStr + 'T00:00:00Z');
  return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === dateStr;
}

function isOnOrAfterBusinessDays(dateStr, businessDays, now = new Date()) {
  if (!isCalendarDate(dateStr)) return false;
  return dateStr >= earliestBusinessDate(businessDays, now);
}

// --- Field validation shared by every request form ---

function trimmed(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Validate the team project chosen in the form. Returns the upper-cased
 * project, or null when unset or invalid (an error is recorded when invalid).
 */
function validateTeamProject(body, errors) {
  if (body.project === null || body.project === undefined || body.project === '') return null;
  const project = typeof body.project === 'string' ? body.project.trim().toUpperCase() : '';
  if (!TEAM_PROJECTS.includes(project)) {
    errors.project = 'Project must be one of: ' + TEAM_PROJECTS.join(', ');
    return null;
  }
  return project;
}

/**
 * Validate the fields every AIPCC-E request requires: team, related Jira
 * key, business justification and a delivery date at least `businessDays`
 * business days out. `dateMessage(earliest)` builds the too-early error.
 */
function validateCommonFields(body, errors, { now, businessDays, dateMessage }) {
  const team = trimmed(body.team);
  if (!team) errors.team = 'Team is required';

  const project = validateTeamProject(body, errors);

  const jiraId = trimmed(body.jira_id);
  if (!JIRA_KEY_RE.test(jiraId)) {
    errors.jira_id = 'Jira key must match ' + JIRA_KEY_RE.source;
  }

  const justification = trimmed(body.justification);
  if (!justification) errors.justification = 'Justification is required';

  const deliveryTimeline = trimmed(body.delivery_timeline);
  if (!isCalendarDate(deliveryTimeline)) {
    errors.delivery_timeline = 'Delivery timeline must be a valid date in YYYY-MM-DD format';
  } else if (!isOnOrAfterBusinessDays(deliveryTimeline, businessDays, now)) {
    errors.delivery_timeline = dateMessage(earliestBusinessDate(businessDays, now));
  }

  return { team, project, jiraId, justification, deliveryTimeline };
}

// --- Jira payload building ---

function sanitizeTeamLabel(team) {
  const slug = String(team || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return 'team-' + (slug || 'unknown');
}

function adfText(t) {
  return { type: 'text', text: String(t) };
}

function adfLink(text, href) {
  return { type: 'text', text: String(text), marks: [{ type: 'link', attrs: { href: String(href) } }] };
}

function adfLabel(t) {
  return { type: 'text', text: String(t), marks: [{ type: 'strong' }] };
}

function adfParagraph(content) {
  return { type: 'paragraph', content };
}

function adfDocument(heading, lines) {
  return {
    type: 'doc',
    version: 1,
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [adfText(heading)] },
      ...lines.map(adfParagraph)
    ]
  };
}

// --- Jira lookups ---

/**
 * Map an authenticated identity onto the Jira email domain.
 * user@cluster.local (AUTH_EMAIL_DOMAIN) becomes user@redhat.com; addresses
 * already on the Jira domain are returned lowercased and trimmed.
 */
function normalizeRequesterEmail(email) {
  const value = String(email || '').toLowerCase().trim();
  const at = value.indexOf('@');
  if (at <= 0) return value;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (!domain || domain === JIRA_EMAIL_DOMAIN) return value;
  return local + '@' + JIRA_EMAIL_DOMAIN;
}

/**
 * Resolve a Jira accountId from an email via user search.
 * Matches on emailAddress when Jira exposes it; when the profile hides the
 * address and the search returns exactly one Atlassian account, that account
 * is used. Non-fatal: returns null when the user cannot be resolved.
 */
async function findAccountIdByEmail(jira, email, { logPrefix = '[requests]', purpose = 'requester' } = {}) {
  try {
    const params = new URLSearchParams({ query: email, maxResults: '10' });
    const data = await jira.jiraRequest(`/rest/api/3/user/search?${params}`);
    const users = (Array.isArray(data) ? data : []).filter(u => u && u.accountId);
    const match = users.find(u => u.emailAddress &&
      u.emailAddress.toLowerCase() === email.toLowerCase());
    if (match) return match.accountId;
    const candidates = users.filter(u => u.accountType === 'atlassian' && u.active !== false);
    if (candidates.length === 1 && !candidates[0].emailAddress) {
      return candidates[0].accountId;
    }
    console.warn(`${logPrefix} No Jira account matched ${purpose} ${email}`);
    return null;
  } catch (err) {
    console.warn(`${logPrefix} Jira user search failed:`, err.message);
    return null;
  }
}

/**
 * True when Jira rejected issue creation because of the reporter field
 * (typically the service account lacks the Modify Reporter permission).
 */
function isReporterRejection(err) {
  const msg = String((err && err.message) || '');
  return /Jira API error \(400\)/.test(msg) && /"reporter"/i.test(msg);
}

/**
 * Create a Jira issue. When Jira rejects the reporter field, retry once
 * without it so the request is still filed.
 * @param {(reporterAccountId: string|null) => object} buildFields
 * @returns {Promise<{created: object, fields: object}>}
 */
async function createIssueWithReporterFallback(jira, buildFields, reporterAccountId, logPrefix = '[requests]') {
  let fields = buildFields(reporterAccountId);
  try {
    const created = await jira.jiraRequest('/rest/api/3/issue', { method: 'POST', body: { fields } });
    return { created, fields };
  } catch (err) {
    if (!fields.reporter || !isReporterRejection(err)) throw err;
    console.warn(`${logPrefix} Jira rejected the reporter field; retrying without it:`, err.message);
    fields = buildFields(null);
    const created = await jira.jiraRequest('/rest/api/3/issue', { method: 'POST', body: { fields } });
    return { created, fields };
  }
}

/**
 * Verify the related Jira issue exists.
 * @returns {Promise<{key: string, summary: string}|null>}
 */
async function validateRelatedIssue(jira, jiraId) {
  const data = await jira.jiraRequest(
    `/rest/api/3/issue/${encodeURIComponent(jiraId)}?fields=summary,status`
  );
  if (!data || !data.key) return null;
  return { key: data.key, summary: (data.fields && data.fields.summary) || '' };
}

/**
 * Jira project that receives request Epics. Read from the
 * PACKAGE_REQUEST_JIRA_PROJECT secret declared in module.json; falls back to
 * RHAI when unset or not a valid project key.
 */
function resolveJiraProjectConfig(secrets) {
  const raw = secrets && secrets.PACKAGE_REQUEST_JIRA_PROJECT;
  const value = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  if (!value) return { project: DEFAULT_JIRA_PROJECT, locked: false };
  if (!JIRA_PROJECT_KEY_RE.test(value)) {
    console.warn(`[requests] Ignoring invalid PACKAGE_REQUEST_JIRA_PROJECT "${raw}"; using ${DEFAULT_JIRA_PROJECT}`);
    return { project: DEFAULT_JIRA_PROJECT, locked: false };
  }
  // An explicit value pins every request to that project (test projects,
  // reorganisations) regardless of the project chosen in the form.
  return { project: value, locked: true };
}

function resolveJiraProject(secrets) {
  return resolveJiraProjectConfig(secrets).project;
}

/**
 * Pick the project an Epic is filed in: the operator-pinned project when
 * PACKAGE_REQUEST_JIRA_PROJECT is set, otherwise the project chosen in the
 * form when it can hold Epics, otherwise the default.
 */
function selectFilingProject(requestProject, config) {
  if (config && config.locked) return config.project;
  if (requestProject && FILING_PROJECTS.includes(requestProject)) return requestProject;
  return (config && config.project) || DEFAULT_JIRA_PROJECT;
}

const _teamOptionsCache = new Map();

async function getTeamOptions(jira, project, now = Date.now()) {
  const cached = _teamOptionsCache.get(project);
  if (cached && now - cached.fetchedAt < TEAM_OPTIONS_CACHE_TTL_MS) {
    return cached.options;
  }

  const data = await jira.jiraRequest(
    `/rest/api/3/project/${encodeURIComponent(project)}/components`
  );
  const names = new Set();
  for (const component of Array.isArray(data) ? data : []) {
    const name = String((component && component.name) || '').trim();
    if (name) names.add(name);
  }
  const options = Array.from(names)
    .sort((a, b) => a.localeCompare(b))
    .map(name => ({ value: name, label: name }));
  _teamOptionsCache.set(project, { fetchedAt: now, options });
  return options;
}

// --- In-memory rate limiting: one submission per key per 60 seconds ---
// Python package requests key on the requester email; other request types
// prefix it (e.g. "rpm:user@redhat.com") so each form has its own cooldown.

const _lastSubmission = new Map();
const _pendingSubmissions = new Set();

function checkRateLimit(key, now = Date.now()) {
  const id = String(key).toLowerCase();
  const last = _lastSubmission.get(id);
  if (last !== undefined && now - last < RATE_LIMIT_WINDOW_MS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((RATE_LIMIT_WINDOW_MS - (now - last)) / 1000)
    };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

function recordSubmission(key, now = Date.now()) {
  _lastSubmission.set(String(key).toLowerCase(), now);
  if (_lastSubmission.size > 1000) {
    for (const [id, ts] of _lastSubmission) {
      if (now - ts >= RATE_LIMIT_WINDOW_MS) _lastSubmission.delete(id);
    }
  }
}

function beginSubmission(key) {
  const id = String(key).toLowerCase();
  if (_pendingSubmissions.has(id)) return false;
  _pendingSubmissions.add(id);
  return true;
}

function endSubmission(key) {
  _pendingSubmissions.delete(String(key).toLowerCase());
}

function isDemoMode(deps) {
  if (deps && typeof deps.isDemoMode === 'function') return deps.isDemoMode() === true;
  if (deps && typeof deps.isDemoMode === 'boolean') return deps.isDemoMode;
  return process.env.DEMO_MODE === 'true';
}

/**
 * Authenticated requester email mapped onto the Jira domain, or '' when the
 * request carries no identity.
 */
function requesterEmail(req) {
  const authEmail = String(req.userEmail || (req.user && req.user.email) || '').toLowerCase().trim();
  return authEmail ? normalizeRequesterEmail(authEmail) : '';
}

/**
 * Parsed JSON object body, or null when the body is present but not an
 * object (arrays and primitives are rejected).
 */
function objectBody(req) {
  if (req.body === undefined || req.body === null) return {};
  if (typeof req.body !== 'object' || Array.isArray(req.body)) return null;
  return req.body;
}

module.exports = {
  DEFAULT_JIRA_PROJECT,
  JIRA_PROJECT_KEY_RE,
  JIRA_KEY_RE,
  DATE_RE,
  SECURITY_NAME,
  EPIC_NAME_FIELD,
  RATE_LIMIT_WINDOW_MS,
  TEAM_OPTIONS_CACHE_TTL_MS,
  TEAM_PROJECTS,
  FILING_PROJECTS,
  DEMO_TEAM_OPTIONS,
  earliestBusinessDate,
  isCalendarDate,
  isOnOrAfterBusinessDays,
  trimmed,
  validateTeamProject,
  validateCommonFields,
  sanitizeTeamLabel,
  adfText,
  adfLink,
  adfLabel,
  adfParagraph,
  adfDocument,
  normalizeRequesterEmail,
  findAccountIdByEmail,
  isReporterRejection,
  createIssueWithReporterFallback,
  validateRelatedIssue,
  resolveJiraProjectConfig,
  resolveJiraProject,
  selectFilingProject,
  getTeamOptions,
  _teamOptionsCache,
  checkRateLimit,
  recordSubmission,
  beginSubmission,
  endSubmission,
  _lastSubmission,
  _pendingSubmissions,
  isDemoMode,
  requesterEmail,
  objectBody
};
