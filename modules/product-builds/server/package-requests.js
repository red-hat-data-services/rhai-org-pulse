/**
 * Package update requests.
 *
 * Authenticated POST endpoint that validates a package update request,
 * verifies the related Jira issue, checks for recent duplicates, validates
 * PyPI sources, warns when the package is already in a production index,
 * files an AIPCC Epic, and triggers the package onboarding GitLab pipeline.
 *
 * All external operations (Jira, PyPI, package indexes, GitLab) go through
 * small module-level functions. The register function accepts an optional
 * `deps` argument ({ jiraClient, fetch, fetchIndex, isDemoMode, now }) so
 * tests can mock them without live credentials.
 */

const { createJiraClient } = require('../../../shared/server/jira');
const {
  PACKAGE_NAME_RE,
  VERSION_RE,
  fetchIndex,
  getBaseUrl,
  getVariants,
  getProductVersions,
  pMap,
  MAX_CONCURRENT_FETCHES
} = require('./package-index');

const AIPCC_PROJECT = 'AIPCC';
const EPIC_LABELS = ['package', 'dashboard-filed'];
const SECURITY_NAME = 'Red Hat Employee';
const COMPONENT_NAME = 'Accelerator Enablement';
const EPIC_NAME_FIELD = 'customfield_10011';
const DEFAULT_TARGET_VERSION_FIELD = 'customfield_10855';
const PACKAGE_ONBOARDING_PROJECT = 'redhat%2Frhel-ai%2Fcore%2Fpackage-onboarding';
const PACKAGE_ONBOARDING_BASE_URL = 'https://gitlab.com';

const JIRA_KEY_RE = /^[A-Z][A-Z0-9]+-\d+$/;
const SAFE_IDENTIFIER_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PACKAGE_SOURCES = ['pypi', 'git', 'other'];
const MIN_LEAD_TIME_DAYS = 8;
const DUPLICATE_LOOKBACK_DAYS = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;
const EXTERNAL_TIMEOUT_MS = 30_000;
const PYPI_JSON_BASE = 'https://pypi.org/pypi';

// --- Validation ---

function isAtLeastDaysFromToday(dateStr, minDays, now = new Date()) {
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00Z');
  if (isNaN(target.getTime())) return false;
  return Math.round((target - today) / 86_400_000) >= minDays;
}

/**
 * Validate a package request body.
 * @param {object} body - Parsed JSON request body
 * @param {{ now?: Date }} [opts]
 * @returns {{ valid: boolean, errors: object, request: object }}
 */
function validateRequest(body, opts = {}) {
  const now = opts.now || new Date();
  const errors = {};

  const team = typeof body.team === 'string' ? body.team.trim() : '';
  if (!team) {
    errors.team = 'Team is required';
  }

  const packageName = typeof body.package_name === 'string' ? body.package_name.trim() : '';
  if (!PACKAGE_NAME_RE.test(packageName)) {
    errors.package_name = 'Package name must match ' + PACKAGE_NAME_RE.source;
  }

  let extras = null;
  if (body.extras !== null && body.extras !== undefined) {
    if (!Array.isArray(body.extras)) {
      errors.extras = 'Extras must be an array of identifiers or null';
    } else {
      const seen = new Set();
      extras = [];
      for (const item of body.extras) {
        const value = typeof item === 'string' ? item.trim() : '';
        if (!SAFE_IDENTIFIER_RE.test(value)) {
          errors.extras = 'Each extra must be a safe identifier (letters, digits, dot, underscore, dash; no spaces)';
          break;
        }
        const key = value.toLowerCase();
        if (seen.has(key)) {
          errors.extras = `Extras must not contain duplicates (${value})`;
          break;
        }
        seen.add(key);
        extras.push(value);
      }
    }
  }

  const source = body.package_source;
  if (!PACKAGE_SOURCES.includes(source)) {
    errors.package_source = 'Package source must be one of: ' + PACKAGE_SOURCES.join(', ');
  }

  let sourceUrl = '';
  if (body.source_url !== null && body.source_url !== undefined) {
    sourceUrl = typeof body.source_url === 'string' ? body.source_url.trim() : '';
  }
  if (source === 'git' || source === 'other') {
    if (!sourceUrl) {
      errors.source_url = 'Source URL is required for git and other package sources';
    } else if (!/^https?:\/\//i.test(sourceUrl)) {
      errors.source_url = 'Source URL must be an HTTP or HTTPS URL';
    }
  }

  let version = '';
  if (body.version !== null && body.version !== undefined) {
    version = typeof body.version === 'string' ? body.version.trim() : '';
  }
  if (version && !VERSION_RE.test(version)) {
    errors.version = 'Version must match ' + VERSION_RE.source;
  }

  const otherHardware = typeof body.other_hardware === 'string' ? body.other_hardware.trim() : '';
  const hardwareAck = body.hardware_defaults_acknowledged === true;
  if (!otherHardware && !hardwareAck) {
    errors.other_hardware = 'Provide other hardware details or acknowledge the hardware defaults';
  }

  const jiraId = typeof body.jira_id === 'string' ? body.jira_id.trim() : '';
  if (!JIRA_KEY_RE.test(jiraId)) {
    errors.jira_id = 'Jira key must match ' + JIRA_KEY_RE.source;
  }

  const justification = typeof body.justification === 'string' ? body.justification.trim() : '';
  if (!justification) {
    errors.justification = 'Justification is required';
  }

  const deliveryTimeline = typeof body.delivery_timeline === 'string' ? body.delivery_timeline.trim() : '';
  if (!DATE_RE.test(deliveryTimeline)) {
    errors.delivery_timeline = 'Delivery timeline must be a date in YYYY-MM-DD format';
  } else if (!isAtLeastDaysFromToday(deliveryTimeline, MIN_LEAD_TIME_DAYS, now)) {
    errors.delivery_timeline = `Delivery timeline must be at least ${MIN_LEAD_TIME_DAYS} calendar days from today`;
  }

  let releaseTarget = null;
  if (body.release_target !== null && body.release_target !== undefined) {
    if (!Array.isArray(body.release_target) ||
        body.release_target.some(v => typeof v !== 'string' || !v.trim())) {
      errors.release_target = 'Release target must be an array of version strings or null';
    } else {
      releaseTarget = body.release_target.map(v => v.trim());
    }
  }

  const releaseCommitment = typeof body.release_commitment === 'string' ? body.release_commitment.trim() : '';

  const testingRequirements = typeof body.testing_requirements === 'string' ? body.testing_requirements.trim() : '';
  const testingAck = body.testing_defaults_acknowledged === true;
  if (!testingRequirements && !testingAck) {
    errors.testing_requirements = 'Provide testing requirements or acknowledge the testing defaults';
  }

  let backportVersions = null;
  if (body.backport_versions !== null && body.backport_versions !== undefined) {
    if (!Array.isArray(body.backport_versions) ||
        body.backport_versions.some(v => typeof v !== 'string' || !v.trim())) {
      errors.backport_versions = 'Backport versions must be an array of version strings or null';
    } else {
      backportVersions = body.backport_versions.map(v => v.trim());
    }
  }

  const skipProductionCheck = body.skip_production_check === true;

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    request: {
      team,
      packageName,
      extras,
      source,
      sourceUrl,
      version,
      otherHardware,
      hardwareAck,
      jiraId,
      justification,
      deliveryTimeline,
      releaseTarget,
      releaseCommitment,
      testingRequirements,
      testingAck,
      backportVersions,
      skipProductionCheck
    }
  };
}

// --- Jira payload building ---

function buildEpicSummary(packageName, extras) {
  const suffix = extras && extras.length > 0 ? '[' + extras.join(',') + ']' : '';
  return packageName + suffix + ' package update request';
}

function buildEpicName(packageName) {
  return packageName + ' package update request';
}

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

/**
 * Build the ADF description for the Jira Epic. Label casing matches the
 * package-tracker description parser (Team, Requester, Target Date,
 * Release Commitment, Related Jira Ticket).
 */
function buildAdfDescription(request, requesterEmail, jiraHost) {
  const lines = [];

  lines.push([
    adfLabel('Team: '),
    adfText(request.team + ' ')
  ]);

  const extrasSuffix = request.extras && request.extras.length > 0
    ? '[' + request.extras.join(',') + ']'
    : '';
  lines.push([
    adfLabel('Package: '),
    adfText(request.packageName + extrasSuffix + (request.version ? ' ' + request.version : '') + ' ')
  ]);

  lines.push([
    adfLabel('Requester: '),
    adfText(requesterEmail + ' ')
  ]);

  const sourceLine = [
    adfLabel('Package source: '),
    adfText(request.source)
  ];
  if (request.sourceUrl) {
    sourceLine.push(adfLink(request.sourceUrl, request.sourceUrl));
  }
  sourceLine.push(adfText(' '));
  lines.push(sourceLine);

  if (request.otherHardware) {
    lines.push([
      adfLabel('Other hardware: '),
      adfText(request.otherHardware + ' ')
    ]);
  }

  lines.push([
    adfLabel('Hardware defaults acknowledged: '),
    adfText((request.hardwareAck ? 'yes' : 'no') + ' ')
  ]);

  lines.push([
    adfLabel('Justification: '),
    adfText(request.justification + ' ')
  ]);

  lines.push([
    adfLabel('Target Date: '),
    adfText(request.deliveryTimeline + ' ')
  ]);

  lines.push([
    adfLabel('Related Jira Ticket: '),
    adfLink(request.jiraId, jiraHost + '/browse/' + request.jiraId),
    adfText(' ')
  ]);

  lines.push([
    adfLabel('Release Commitment: '),
    adfText((request.releaseCommitment || 'N/A') + ' ')
  ]);

  lines.push([
    adfLabel('Testing requirements: '),
    adfText((request.testingRequirements || 'N/A') + ' ')
  ]);

  lines.push([
    adfLabel('Testing defaults acknowledged: '),
    adfText((request.testingAck ? 'yes' : 'no') + ' ')
  ]);

  if (request.releaseTarget && request.releaseTarget.length > 0) {
    lines.push([
      adfLabel('Release target: '),
      adfText(request.releaseTarget.join(', ') + ' ')
    ]);
  }

  if (request.backportVersions && request.backportVersions.length > 0) {
    lines.push([
      adfLabel('Backport versions: '),
      adfText(request.backportVersions.join(', ') + ' ')
    ]);
  }

  return {
    type: 'doc',
    version: 1,
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [adfText('Package Update Request')] },
      ...lines.map(adfParagraph)
    ]
  };
}

/**
 * Build the fields payload for creating the AIPCC Epic.
 */
function buildEpicFields(request, requesterEmail, { jiraHost, reporterAccountId, epicNameField } = {}) {
  const fields = {
    project: { key: AIPCC_PROJECT },
    issuetype: { name: 'Epic' },
    summary: buildEpicSummary(request.packageName, request.extras),
    description: buildAdfDescription(request, requesterEmail, jiraHost),
    labels: [...EPIC_LABELS, sanitizeTeamLabel(request.team)],
    duedate: request.deliveryTimeline,
    security: { name: SECURITY_NAME },
    components: [{ name: COMPONENT_NAME }],
    [epicNameField || EPIC_NAME_FIELD]: buildEpicName(request.packageName)
  };
  if (reporterAccountId) {
    fields.reporter = { accountId: reporterAccountId };
  }
  return fields;
}

function buildDuplicateJql(packageName) {
  return `project = ${AIPCC_PROJECT} AND issuetype = Epic ` +
    `AND labels in ("package", "dashboard-filed") ` +
    `AND summary ~ "*${packageName}*" ` +
    `AND created >= -${DUPLICATE_LOOKBACK_DAYS}d AND statusCategory != Done`;
}

// --- External operations (injectable for tests) ---

/**
 * Resolve the requester's Jira accountId via user search.
 * Non-fatal: returns null when the user cannot be resolved.
 */
async function findReporterAccountId(jira, email) {
  try {
    const params = new URLSearchParams({ query: email, maxResults: '10' });
    const data = await jira.jiraRequest(`/rest/api/3/user/search?${params}`);
    const users = (data && data.users) || [];
    const match = users.find(u => u && u.email && u.email.toLowerCase() === email.toLowerCase());
    return match ? match.accountId : null;
  } catch (err) {
    console.warn('[package-requests] Jira user search failed:', err.message);
    return null;
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
 * Search for recent duplicate package update request Epics.
 */
async function findDuplicateRequests(jira, packageName, jiraHost) {
  const issues = await jira.fetchAllJqlResults(
    buildDuplicateJql(packageName),
    'key,summary,status,created,updated',
    { maxResults: 50 }
  );
  return issues.map(issue => ({
    key: issue.key,
    summary: (issue.fields && issue.fields.summary) || '',
    status: (issue.fields && issue.fields.status && issue.fields.status.name) || '',
    created: (issue.fields && issue.fields.created) || null,
    url: jiraHost + '/browse/' + issue.key
  }));
}

/**
 * Validate that the package exists on PyPI via its JSON API.
 * @returns {Promise<{found: boolean}>}
 */
async function checkPypiPackage(packageName, fetchFn) {
  const url = PYPI_JSON_BASE + '/' + encodeURIComponent(packageName) + '/json';
  const response = await fetchFn(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(EXTERNAL_TIMEOUT_MS)
  });
  if (response.ok) return { found: true };
  if (response.status === 404) return { found: false };
  throw new Error(`PyPI API returned HTTP ${response.status}`);
}

/**
 * Check production package indexes for the package.
 * @returns {Promise<Array<{product_version: string, variant: string, index_url: string, files: string[]}>>}
 */
async function checkProductionIndexes(packageName, opts = {}) {
  const indexFetch = opts.fetchIndexFn || fetchIndex;
  const base = (opts.baseUrl || getBaseUrl()).replace(/\/+$/, '');
  const variants = opts.variants || getVariants();
  const productVersions = opts.productVersions || getProductVersions();

  const tasks = [];
  for (const pv of productVersions) {
    for (const variant of variants) {
      // Production index suffix is '' (see ALL_REPO_TYPES in package-index.js)
      const indexUrl = `${base}/${pv}/${variant}/simple/`;
      tasks.push({ pv, variant, indexUrl });
    }
  }

  const results = await pMap(tasks, async (task) => {
    try {
      const raw = await indexFetch(task.indexUrl, packageName);
      if (raw && raw.found && Array.isArray(raw.files) && raw.files.length > 0) {
        return {
          product_version: task.pv,
          variant: task.variant,
          index_url: task.indexUrl,
          files: raw.files.map(f => f.filename).slice(0, 10)
        };
      }
      return null;
    } catch {
      return null;
    }
  }, MAX_CONCURRENT_FETCHES);

  return results.filter(Boolean);
}

function getGitLabConfig() {
  return {
    gitlabBaseUrl: PACKAGE_ONBOARDING_BASE_URL,
    gitlabProject: PACKAGE_ONBOARDING_PROJECT
  };
}

function getGitlabToken(secrets) {
  return (secrets && (secrets.GITLAB_TOKEN || secrets.NIGHTLY_PIPELINE_GITLAB_TOKEN)) || null;
}

function buildPipelineVariables(request, epicKey) {
  const packageName = request.extras && request.extras.length > 0
    ? request.packageName + '[' + request.extras.join(',') + ']'
    : request.packageName;
  const variables = {
    PACKAGE_NAME: packageName,
    JIRA_TICKET_ID: epicKey
  };
  if (request.version) variables.PACKAGE_VERSION = request.version;
  return variables;
}

/**
 * Trigger the package onboarding GitLab pipeline.
 * @returns {Promise<{triggered: boolean, pipeline_id: number|null, web_url: string|null}>}
 */
async function triggerOnboardingPipeline({ gitlabBaseUrl, gitlabProject, token, variables, fetchFn }) {
  const fetchImpl = fetchFn || fetch;
  const url = `${gitlabBaseUrl}/api/v4/projects/${gitlabProject}/pipelines`;
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      'PRIVATE-TOKEN': token,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({ ref: 'main', variables }),
    signal: AbortSignal.timeout(EXTERNAL_TIMEOUT_MS)
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`GitLab pipeline trigger failed (${response.status}): ${text.slice(0, 200)}`);
  }
  const data = await response.json();
  return { triggered: true, pipeline_id: data.id || null, web_url: data.web_url || null };
}

// --- In-memory rate limiting: one submission per user per 60 seconds ---

const _lastSubmission = new Map();

function checkRateLimit(email, now = Date.now()) {
  const key = String(email).toLowerCase();
  const last = _lastSubmission.get(key);
  if (last !== undefined && now - last < RATE_LIMIT_WINDOW_MS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((RATE_LIMIT_WINDOW_MS - (now - last)) / 1000)
    };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

function recordSubmission(email, now = Date.now()) {
  _lastSubmission.set(String(email).toLowerCase(), now);
  if (_lastSubmission.size > 1000) {
    for (const [key, ts] of _lastSubmission) {
      if (now - ts >= RATE_LIMIT_WINDOW_MS) _lastSubmission.delete(key);
    }
  }
}

function isDemoMode(deps) {
  if (deps && typeof deps.isDemoMode === 'function') return deps.isDemoMode() === true;
  if (deps && typeof deps.isDemoMode === 'boolean') return deps.isDemoMode;
  return process.env.DEMO_MODE === 'true';
}

// --- Route registration ---

/**
 * @param {import('express').Router} router
 * @param {{ secrets?: Record<string, string>, resolveSecret?: Function, requireAuth?: Function }} context
 * @param {{ jiraClient?: object, fetch?: Function, fetchIndex?: Function, isDemoMode?: Function|boolean, now?: Function }} [deps]
 */
module.exports = function registerPackageRequestRoutes(router, context, deps = {}) {
  const secrets = (context && context.secrets) || {};
  const fetchImpl = deps.fetch || fetch;
  const noopAuth = function (_req, _res, next) { next(); };
  const requireAuth = (context && context.requireAuth) || noopAuth;

  let _jira;
  function getJira() {
    if (deps.jiraClient) return deps.jiraClient;
    if (!_jira) {
      _jira = createJiraClient({
        email: secrets.JIRA_EMAIL || '',
        token: secrets.JIRA_TOKEN || ''
      });
    }
    return _jira;
  }

  /**
   * @openapi
   * /api/modules/product-builds/package-requests:
   *   post:
   *     tags: [Package Requests]
   *     summary: Submit a package update request
   *     description: >-
   *       Authenticated endpoint that validates a package update request,
   *       verifies the related Jira issue, checks for recent duplicate
   *       requests, validates PyPI sources, and warns when the package is
   *       already present in a production index. On success it files an AIPCC
   *       Epic with its required Epic Name field, due date, team label, Red Hat
   *       Employee security, and Accelerator Enablement component, sets the
   *       release target field when provided, and triggers the
   *       redhat/rhel-ai/core/package-onboarding GitLab pipeline. Pipeline
   *       failure is non-fatal.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [team, package_name, package_source, jira_id, justification, delivery_timeline]
   *             properties:
   *               team:
   *                 type: string
   *                 description: Requesting team name
   *               package_name:
   *                 type: string
   *                 description: Python package name
   *               extras:
   *                 type: array
   *                 items:
   *                   type: string
   *                 nullable: true
   *                 description: Optional extras (e.g. cu12)
   *               package_source:
   *                 type: string
   *                 enum: [pypi, git, other]
   *               source_url:
   *                 type: string
   *                 nullable: true
   *                 description: Required HTTP(S) URL for git/other sources
   *               version:
   *                 type: string
   *                 nullable: true
   *               other_hardware:
   *                 type: string
   *                 description: Hardware beyond the defaults, or empty when acknowledging defaults
   *               hardware_defaults_acknowledged:
   *                 type: boolean
   *               jira_id:
   *                 type: string
   *                 description: Related Jira issue key (must exist)
   *               justification:
   *                 type: string
   *               delivery_timeline:
   *                 type: string
   *                 format: date
   *                 description: Desired delivery date (YYYY-MM-DD), at least 8 calendar days out
   *               release_target:
   *                 type: array
   *                 items:
   *                   type: string
   *                 nullable: true
   *                 description: Target product versions
   *               release_commitment:
   *                 type: string
   *               testing_requirements:
   *                 type: string
   *                 description: Testing beyond the defaults, or empty when acknowledging defaults
   *               testing_defaults_acknowledged:
   *                 type: boolean
   *               backport_versions:
   *                 type: array
   *                 items:
   *                   type: string
   *                 nullable: true
   *               skip_production_check:
   *                 type: boolean
   *                 description: Skip the production index presence check
   *     responses:
   *       200:
   *         description: Warning when the package is already in a production index (no Epic created), or deterministic demo-mode success
   *       201:
   *         description: Epic created; onboarding pipeline triggered (or failure reported non-fatally)
   *       400:
   *         description: Request body is not a JSON object
   *       401:
   *         description: Unauthenticated (no user email available)
   *       409:
   *         description: A recent duplicate request exists (existing_tickets returned)
   *       422:
   *         description: Validation failed (per-field errors)
   *       429:
   *         description: >-
   *           Rate limited (one submission per user per 60 seconds). The limit
   *           slot is only consumed when a submission actually proceeds to Epic
   *           creation, so a 200 production-presence warning does not block an
   *           immediate retry with skip_production_check:true.
   *       502:
   *         description: Jira Epic creation or PyPI validation failed
   *       503:
   *         description: Jira is not configured
   */
  router.post('/package-requests', requireAuth, async function(req, res) {
    try {
      const email = String(req.userEmail || (req.user && req.user.email) || '').toLowerCase().trim();
      if (!email) {
        return res.status(401).json({ error: 'Authentication required. No user email available.' });
      }

      if (req.body !== undefined && req.body !== null &&
          (typeof req.body !== 'object' || Array.isArray(req.body))) {
        return res.status(400).json({ error: 'Request body must be a JSON object' });
      }
      const body = (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) ? req.body : {};

      const now = deps.now ? deps.now() : new Date();
      const validation = validateRequest(body, { now });
      if (!validation.valid) {
        return res.status(422).json({ error: 'Validation failed', fields: validation.errors });
      }
      const request = validation.request;

      // Rate limit gate only. The slot is consumed when the request actually
      // proceeds to Epic creation (or completes in demo mode), so aborting
      // responses (422/409/502/503) and the 200 production-presence warning
      // do not block an immediate retry.
      const limit = checkRateLimit(email, Date.now());
      if (!limit.allowed) {
        return res.status(429).json({
          error: 'Rate limited: one package request per user per 60 seconds',
          retry_after_seconds: limit.retryAfterSeconds
        });
      }

      if (isDemoMode(deps)) {
        recordSubmission(email);
        return res.status(200).json({
          status: 'created',
          demo: true,
          requester: email,
          summary: buildEpicSummary(request.packageName, request.extras),
          jira: { key: 'AIPCC-DEMO', url: null },
          pipeline: { triggered: false, reason: 'demo mode' }
        });
      }

      if (!deps.jiraClient && (!secrets.JIRA_EMAIL || !secrets.JIRA_TOKEN)) {
        return res.status(503).json({ error: 'Jira is not configured (JIRA_EMAIL/JIRA_TOKEN missing)' });
      }
      const jira = getJira();
      const jiraHost = jira.JIRA_HOST;

      // Verify the related Jira issue before doing anything else.
      let related = null;
      try {
        related = await validateRelatedIssue(jira, request.jiraId);
      } catch (err) {
        console.warn('[package-requests] Related issue lookup failed:', err.message);
      }
      if (!related) {
        return res.status(422).json({
          error: 'Validation failed',
          fields: { jira_id: `Related Jira issue ${request.jiraId} was not found or could not be verified` }
        });
      }

      // Check recent duplicates (fail open on search errors).
      let duplicates = [];
      try {
        duplicates = await findDuplicateRequests(jira, request.packageName, jiraHost);
      } catch (err) {
        console.warn('[package-requests] Duplicate search failed:', err.message);
      }
      if (duplicates.length > 0) {
        return res.status(409).json({
          error: 'A recent package update request already exists for this package',
          existing_tickets: duplicates
        });
      }

      // Validate PyPI sources via the PyPI JSON API.
      if (request.source === 'pypi') {
        let pypi;
        try {
          pypi = await checkPypiPackage(request.packageName, fetchImpl);
        } catch (err) {
          return res.status(502).json({ error: 'PyPI validation failed: ' + err.message });
        }
        if (!pypi.found) {
          return res.status(422).json({
            error: 'Validation failed',
            fields: { package_source: `Package "${request.packageName}" was not found on PyPI` }
          });
        }
      }

      // Check production indexes; warn instead of creating a duplicate Epic.
      if (!request.skipProductionCheck) {
        const foundIn = await checkProductionIndexes(request.packageName, {
          fetchIndexFn: deps.fetchIndex,
          baseUrl: deps.indexBaseUrl,
          variants: deps.indexVariants,
          productVersions: deps.indexProductVersions
        });
        if (foundIn.length > 0) {
          return res.status(200).json({
            status: 'warning',
            warning: 'package_already_in_production',
            package_name: request.packageName,
            found_in: foundIn,
            message: 'This package is already present in at least one production index. Review before filing a duplicate request.',
            skipped: true
          });
        }
      }

      // All gates passed; this submission proceeds to Epic creation.
      recordSubmission(email);

      // Resolve the reporter from the authenticated email (non-fatal).
      const reporterAccountId = await findReporterAccountId(jira, email);

      // Create the AIPCC Epic.
      const fields = buildEpicFields(request, email, { jiraHost, reporterAccountId });
      let created;
      try {
        created = await jira.jiraRequest('/rest/api/3/issue', { method: 'POST', body: { fields } });
      } catch (err) {
        console.error('[package-requests] Jira Epic creation failed:', err.message);
        return res.status(502).json({ error: 'Failed to create Jira Epic: ' + err.message });
      }
      const epicKey = created.key;

      // Set the release target custom field when present (non-fatal).
      let releaseTargetSet = false;
      if (request.releaseTarget && request.releaseTarget.length > 0) {
        const targetField = (context && context.resolveSecret)
          ? (context.resolveSecret('TRACKER_TARGET_VERSION_FIELD') || DEFAULT_TARGET_VERSION_FIELD)
          : DEFAULT_TARGET_VERSION_FIELD;
        try {
          await jira.jiraRequest(`/rest/api/3/issue/${encodeURIComponent(epicKey)}`, {
            method: 'PUT',
            body: { fields: { [targetField]: request.releaseTarget.map(v => ({ name: v })) } }
          });
          releaseTargetSet = true;
        } catch (err) {
          console.warn('[package-requests] Failed to set release target (non-fatal):', err.message);
        }
      }

      // Trigger the package onboarding GitLab pipeline (non-fatal).
      let pipeline;
      const gitlabToken = getGitlabToken(secrets);
      if (!gitlabToken) {
        pipeline = { triggered: false, reason: 'gitlab_token_not_configured' };
      } else {
        const gitlab = getGitLabConfig();
        try {
          pipeline = await triggerOnboardingPipeline({
            gitlabBaseUrl: gitlab.gitlabBaseUrl,
            gitlabProject: gitlab.gitlabProject,
            token: gitlabToken,
            variables: buildPipelineVariables(request, epicKey),
            fetchFn: deps.fetch
          });
        } catch (err) {
          console.warn('[package-requests] Pipeline trigger failed (non-fatal):', err.message);
          pipeline = { triggered: false, error: err.message };
        }
      }

      res.status(201).json({
        status: 'created',
        requester: email,
        summary: fields.summary,
        jira: {
          key: epicKey,
          id: created.id || null,
          url: jiraHost + '/browse/' + epicKey,
          summary: fields.summary
        },
        related_issue: related,
        release_target_set: releaseTargetSet,
        pipeline
      });
    } catch (err) {
      console.error('[package-requests] Unexpected error:', err.message);
      res.status(500).json({ error: 'Failed to process package request' });
    }
  });
};

module.exports._testExports = {
  validateRequest,
  isAtLeastDaysFromToday,
  buildEpicSummary,
  buildEpicName,
  sanitizeTeamLabel,
  buildAdfDescription,
  buildEpicFields,
  buildDuplicateJql,
  buildPipelineVariables,
  checkPypiPackage,
  checkProductionIndexes,
  findDuplicateRequests,
  validateRelatedIssue,
  findReporterAccountId,
  triggerOnboardingPipeline,
  getGitLabConfig,
  getGitlabToken,
  checkRateLimit,
  recordSubmission,
  isDemoMode,
  _lastSubmission,
  AIPCC_PROJECT,
  SECURITY_NAME,
  COMPONENT_NAME,
  EPIC_NAME_FIELD,
  JIRA_KEY_RE,
  RATE_LIMIT_WINDOW_MS
};
