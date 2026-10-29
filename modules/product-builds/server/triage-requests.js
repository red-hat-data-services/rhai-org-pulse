/**
 * RPM and channel requests.
 *
 * Authenticated POST endpoints behind the RPM Requests and Channel Requests
 * tabs of AIPCC-E Requests. Neither request type has automation, so each one
 * validates the form, verifies the related Jira issue, files an Epic in the
 * configured Jira project (PACKAGE_REQUEST_JIRA_PROJECT, default RHAI) with
 * the AIPCC Ecosystems component, and assigns it to the triage owner
 * (REQUEST_TRIAGE_ASSIGNEE_EMAIL, default Einat Pacifici).
 *
 * Delivery dates must be at least TRIAGE_LEAD_BUSINESS_DAYS business days
 * out. This is a planning floor, not a published SLA, so error messages only
 * name the earliest date.
 *
 * The register function accepts an optional `deps` argument
 * ({ jiraClient, isDemoMode, now }) so tests can mock Jira.
 */

const { createJiraClient } = require('../../../shared/server/jira');
const {
  SECURITY_NAME,
  EPIC_NAME_FIELD,
  trimmed,
  validateCommonFields,
  sanitizeTeamLabel,
  adfText,
  adfLink,
  adfLabel,
  adfDocument,
  findAccountIdByEmail,
  createIssueWithReporterFallback,
  validateRelatedIssue,
  resolveJiraProjectConfig,
  selectFilingProject,
  checkRateLimit,
  recordSubmission,
  beginSubmission,
  endSubmission,
  isDemoMode,
  requesterEmail,
  objectBody
} = require('./request-common');

const TRIAGE_LEAD_BUSINESS_DAYS = 20;
const COMPONENT_NAME = 'AIPCC Ecosystems';
const DEFAULT_TRIAGE_ASSIGNEE_EMAIL = 'epacific@redhat.com';
const DEFAULT_TARGET_VERSION_FIELD = 'customfield_10855';
const FILED_LABEL = 'org-pulse-filed';
const SUMMARY_MAX_LENGTH = 255;
const FREE_TEXT_MAX_LENGTH = 200;
const MAX_CHANNELS = 100;
const RPM_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._+-]*$/;
const RPM_VERSION_RE = /^[a-zA-Z0-9._+~^-]+$/;
const CHANNEL_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._+-]*$/;
const HTTP_URL_RE = /^https?:\/\//i;

function dateMessage(earliest) {
  return `Delivery date must be on or after ${earliest}`;
}

function optionalStringArray(value, field, errors, label) {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value) || value.some(v => typeof v !== 'string' || !v.trim())) {
    errors[field] = `${label} must be an array of strings or null`;
    return null;
  }
  return value.map(v => v.trim());
}

function truncateSummary(summary) {
  return summary.length > SUMMARY_MAX_LENGTH ? summary.slice(0, SUMMARY_MAX_LENGTH - 3) + '...' : summary;
}

// --- RPM requests ---

/**
 * Validate an RPM request body.
 * @returns {{ valid: boolean, errors: object, request: object }}
 */
function validateRpmRequest(body, opts = {}) {
  const now = opts.now || new Date();
  const errors = {};
  const common = validateCommonFields(body, errors, {
    now,
    businessDays: TRIAGE_LEAD_BUSINESS_DAYS,
    dateMessage
  });

  const rpmName = trimmed(body.rpm_name);
  if (!RPM_NAME_RE.test(rpmName)) {
    errors.rpm_name = 'RPM name must match ' + RPM_NAME_RE.source;
  }

  const version = trimmed(body.version);
  if (version && !RPM_VERSION_RE.test(version)) {
    errors.version = 'Version must match ' + RPM_VERSION_RE.source;
  }

  const sourceUrl = trimmed(body.source_url);
  const sourceDetails = trimmed(body.source_details);
  if (sourceUrl && !HTTP_URL_RE.test(sourceUrl)) {
    errors.source_url = 'Source URL must be an HTTP or HTTPS URL';
  } else if (!sourceUrl && !sourceDetails) {
    errors.source_url = 'Provide a source URL or describe where the RPM comes from';
  }

  let channels = [];
  if (!Array.isArray(body.channels) || body.channels.length === 0) {
    errors.channels = 'Select at least one channel';
  } else if (body.channels.length > MAX_CHANNELS) {
    errors.channels = `Select at most ${MAX_CHANNELS} channels`;
  } else {
    const seen = new Set();
    for (const item of body.channels) {
      const name = typeof item === 'string' ? item.trim() : '';
      if (!CHANNEL_NAME_RE.test(name)) {
        errors.channels = 'Each channel must be a channel name from the Channels list';
        break;
      }
      if (!seen.has(name)) {
        seen.add(name);
        channels.push(name);
      }
    }
  }

  const releaseTarget = optionalStringArray(body.release_target, 'release_target', errors, 'Release target');
  const releaseCommitment = trimmed(body.release_commitment);

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    request: {
      ...common,
      rpmName,
      version,
      sourceUrl,
      sourceDetails,
      channels,
      releaseTarget,
      releaseCommitment
    }
  };
}

function buildRpmSummary(request) {
  return truncateSummary(request.rpmName + (request.version ? ' ' + request.version : '') + ' RPM request');
}

function buildRpmDescription(request, requesterEmailAddress, jiraHost) {
  const sourceLine = [adfLabel('Source: ')];
  if (request.sourceUrl) sourceLine.push(adfLink(request.sourceUrl, request.sourceUrl));
  if (request.sourceUrl && request.sourceDetails) sourceLine.push(adfText(' '));
  if (request.sourceDetails) sourceLine.push(adfText(request.sourceDetails));
  sourceLine.push(adfText(' '));

  const lines = [
    [adfLabel('Team: '), adfText(request.team + ' ')],
    [adfLabel('RPM: '), adfText(request.rpmName + (request.version ? ' ' + request.version : '') + ' ')],
    [adfLabel('Requester: '), adfText(requesterEmailAddress + ' ')],
    sourceLine,
    [adfLabel('Channels: '), adfText(request.channels.join(', ') + ' ')],
    [adfLabel('Justification: '), adfText(request.justification + ' ')],
    [adfLabel('Target Date: '), adfText(request.deliveryTimeline + ' ')],
    relatedLine(request, jiraHost),
    [adfLabel('Release Commitment: '), adfText((request.releaseCommitment || 'N/A') + ' ')]
  ];
  if (request.releaseTarget && request.releaseTarget.length > 0) {
    lines.push([adfLabel('Release target: '), adfText(request.releaseTarget.join(', ') + ' ')]);
  }
  return adfDocument('RPM Request', lines);
}

// --- Channel requests ---

/**
 * Validate a channel request body. Torch version, accelerator and OS are
 * free text: a new channel asks AIPCC to support something it does not
 * build yet, so there is no fixed list to choose from.
 */
function validateChannelRequest(body, opts = {}) {
  const now = opts.now || new Date();
  const errors = {};
  const common = validateCommonFields(body, errors, {
    now,
    businessDays: TRIAGE_LEAD_BUSINESS_DAYS,
    dateMessage
  });

  const fields = {
    torchVersion: ['torch_version', 'Torch version'],
    accelerator: ['accelerator', 'Accelerator'],
    os: ['os', 'Operating system']
  };
  const values = {};
  for (const [key, [field, label]] of Object.entries(fields)) {
    const value = trimmed(body[field]);
    if (!value) {
      errors[field] = `${label} is required`;
    } else if (value.length > FREE_TEXT_MAX_LENGTH) {
      errors[field] = `${label} must be at most ${FREE_TEXT_MAX_LENGTH} characters`;
    }
    values[key] = value;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    request: { ...common, ...values }
  };
}

function buildChannelSummary(request) {
  return truncateSummary(`New channel request: torch ${request.torchVersion}, ${request.accelerator}, ${request.os}`);
}

function buildChannelDescription(request, requesterEmailAddress, jiraHost) {
  return adfDocument('Channel Request', [
    [adfLabel('Team: '), adfText(request.team + ' ')],
    [adfLabel('Requester: '), adfText(requesterEmailAddress + ' ')],
    [adfLabel('Torch version: '), adfText(request.torchVersion + ' ')],
    [adfLabel('Accelerator: '), adfText(request.accelerator + ' ')],
    [adfLabel('Operating system: '), adfText(request.os + ' ')],
    [adfLabel('Justification: '), adfText(request.justification + ' ')],
    [adfLabel('Target Date: '), adfText(request.deliveryTimeline + ' ')],
    relatedLine(request, jiraHost)
  ]);
}

// --- Shared Epic building ---

function relatedLine(request, jiraHost) {
  return [
    adfLabel('Related Jira Ticket: '),
    adfLink(request.jiraId, jiraHost + '/browse/' + request.jiraId),
    adfText(' ')
  ];
}

const REQUEST_TYPES = {
  rpm: {
    label: 'RPM request',
    labels: ['rpm-request', FILED_LABEL],
    logPrefix: '[rpm-requests]',
    validate: validateRpmRequest,
    buildSummary: buildRpmSummary,
    buildDescription: buildRpmDescription
  },
  channel: {
    label: 'channel request',
    labels: ['channel-request', FILED_LABEL],
    logPrefix: '[channel-requests]',
    validate: validateChannelRequest,
    buildSummary: buildChannelSummary,
    buildDescription: buildChannelDescription
  }
};

function buildTriageEpicFields(type, request, requesterEmailAddress, { jiraHost, reporterAccountId, jiraProject, epicNameField } = {}) {
  const config = REQUEST_TYPES[type];
  const summary = config.buildSummary(request);
  const fields = {
    project: { key: jiraProject },
    issuetype: { name: 'Epic' },
    summary,
    description: config.buildDescription(request, requesterEmailAddress, jiraHost),
    labels: [...config.labels, sanitizeTeamLabel(request.team)],
    duedate: request.deliveryTimeline,
    security: { name: SECURITY_NAME },
    components: [{ name: COMPONENT_NAME }],
    [epicNameField || EPIC_NAME_FIELD]: summary
  };
  if (reporterAccountId) fields.reporter = { accountId: reporterAccountId };
  return fields;
}

function resolveTriageAssigneeEmail(secrets) {
  const value = trimmed(secrets && secrets.REQUEST_TRIAGE_ASSIGNEE_EMAIL).toLowerCase();
  return value || DEFAULT_TRIAGE_ASSIGNEE_EMAIL;
}

/**
 * Assign the Epic to the triage owner. Non-fatal: the Epic is already filed,
 * so a lookup or permission failure is reported rather than raised.
 */
async function assignToTriageOwner(jira, issueKey, assigneeEmail, logPrefix) {
  const accountId = await findAccountIdByEmail(jira, assigneeEmail, { logPrefix, purpose: 'triage assignee' });
  if (!accountId) return { assigned: false, email: assigneeEmail, reason: 'assignee_not_found' };
  try {
    await jira.jiraRequest(`/rest/api/3/issue/${encodeURIComponent(issueKey)}/assignee`, {
      method: 'PUT',
      body: { accountId }
    });
    return { assigned: true, email: assigneeEmail };
  } catch (err) {
    console.warn(`${logPrefix} Failed to assign ${issueKey} (non-fatal):`, err.message);
    return { assigned: false, email: assigneeEmail, error: err.message };
  }
}

// --- Route registration ---

/**
 * @param {import('express').Router} router
 * @param {{ secrets?: Record<string, string>, resolveSecret?: Function, requireAuth?: Function }} context
 * @param {{ jiraClient?: object, isDemoMode?: Function|boolean, now?: Function }} [deps]
 */
module.exports = function registerTriageRequestRoutes(router, context, deps = {}) {
  const secrets = (context && context.secrets) || {};
  const jiraProjectConfig = resolveJiraProjectConfig(secrets);
  const assigneeEmail = resolveTriageAssigneeEmail(secrets);
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

  function handler(type) {
    const config = REQUEST_TYPES[type];
    const { logPrefix } = config;

    return async function(req, res) {
      let pendingKey = null;
      try {
        const email = requesterEmail(req);
        if (!email) {
          return res.status(401).json({ error: 'Authentication required. No user email available.' });
        }
        const body = objectBody(req);
        if (!body) {
          return res.status(400).json({ error: 'Request body must be a JSON object' });
        }

        const now = deps.now ? deps.now() : new Date();
        const validation = config.validate(body, { now });
        if (!validation.valid) {
          return res.status(422).json({ error: 'Validation failed', fields: validation.errors });
        }
        const request = validation.request;
        const jiraProject = selectFilingProject(request.project, jiraProjectConfig);

        // The cooldown slot is consumed only once Jira confirms creation, so
        // aborted requests can be retried immediately.
        const rateKey = type + ':' + email;
        const limit = checkRateLimit(rateKey, Date.now());
        if (!limit.allowed) {
          return res.status(429).json({
            error: `Rate limited: one ${config.label} per user per 60 seconds`,
            retry_after_seconds: limit.retryAfterSeconds
          });
        }
        if (!beginSubmission(rateKey)) {
          return res.status(429).json({
            error: `A ${config.label} for this user is already being processed`,
            retry_after_seconds: 1
          });
        }
        pendingKey = rateKey;

        if (isDemoMode(deps)) {
          recordSubmission(rateKey);
          return res.status(200).json({
            status: 'created',
            demo: true,
            requester: email,
            summary: config.buildSummary(request),
            jira: { key: jiraProject + '-DEMO', url: null, project: jiraProject },
            reporter_set: false,
            assignee: { assigned: false, email: assigneeEmail, reason: 'demo mode' }
          });
        }

        if (!deps.jiraClient && (!secrets.JIRA_EMAIL || !secrets.JIRA_TOKEN)) {
          return res.status(503).json({ error: 'Jira is not configured (JIRA_EMAIL/JIRA_TOKEN missing)' });
        }
        const jira = getJira();
        const jiraHost = jira.JIRA_HOST;

        let related = null;
        try {
          related = await validateRelatedIssue(jira, request.jiraId);
        } catch (err) {
          console.warn(`${logPrefix} Related issue lookup failed:`, err.message);
        }
        if (!related) {
          return res.status(422).json({
            error: 'Validation failed',
            fields: { jira_id: `Related Jira issue ${request.jiraId} was not found or could not be verified` }
          });
        }

        const reporterAccountId = await findAccountIdByEmail(jira, email, { logPrefix, purpose: 'requester' });

        let created;
        let fields;
        try {
          ({ created, fields } = await createIssueWithReporterFallback(
            jira,
            reporter => buildTriageEpicFields(type, request, email, { jiraHost, reporterAccountId: reporter, jiraProject }),
            reporterAccountId,
            logPrefix
          ));
        } catch (err) {
          console.error(`${logPrefix} Jira Epic creation failed:`, err.message);
          return res.status(502).json({ error: 'Failed to create Jira Epic: ' + err.message });
        }
        const epicKey = created.key;
        recordSubmission(rateKey);

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
            console.warn(`${logPrefix} Failed to set release target (non-fatal):`, err.message);
          }
        }

        const assignee = await assignToTriageOwner(jira, epicKey, assigneeEmail, logPrefix);

        const response = {
          status: 'created',
          requester: email,
          summary: fields.summary,
          jira: {
            key: epicKey,
            id: created.id || null,
            url: jiraHost + '/browse/' + epicKey,
            summary: fields.summary,
            project: jiraProject
          },
          related_issue: related,
          reporter_set: Boolean(fields.reporter),
          assignee
        };
        if (type === 'rpm') response.release_target_set = releaseTargetSet;
        return res.status(201).json(response);
      } catch (err) {
        console.error(`${logPrefix} Unexpected error:`, err.message);
        return res.status(500).json({ error: `Failed to process ${config.label}` });
      } finally {
        if (pendingKey) endSubmission(pendingKey);
      }
    };
  }

  /**
   * @openapi
   * /api/modules/product-builds/rpm-requests:
   *   post:
   *     tags: [Package Requests]
   *     summary: Submit an RPM request
   *     description: >-
   *       Authenticated endpoint behind the RPM Requests tab. Validates the
   *       request, verifies the related Jira issue, and files an Epic in the
   *       project chosen in the form (RHAI; RHAISTRAT falls back to the
   *       default), or in PACKAGE_REQUEST_JIRA_PROJECT when that is set. The
   *       Epic gets the rpm-request and org-pulse-filed labels, a team label,
   *       Red Hat Employee security and the AIPCC Ecosystems component, the
   *       release target field when provided, and is assigned to
   *       REQUEST_TRIAGE_ASSIGNEE_EMAIL (default epacific@redhat.com) for
   *       manual triage. Assignment and release target failures are
   *       non-fatal. One RPM request per user per 60 seconds.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [team, rpm_name, channels, jira_id, justification, delivery_timeline]
   *             properties:
   *               team:
   *                 type: string
   *               project:
   *                 type: string
   *                 enum: [RHAISTRAT, RHAI]
   *                 nullable: true
   *               rpm_name:
   *                 type: string
   *                 description: RPM package name
   *               version:
   *                 type: string
   *                 nullable: true
   *               source_url:
   *                 type: string
   *                 nullable: true
   *                 description: HTTP(S) URL of the RPM source. Required unless source_details is given.
   *               source_details:
   *                 type: string
   *                 nullable: true
   *                 description: Free text describing where the RPM comes from
   *               channels:
   *                 type: array
   *                 items:
   *                   type: string
   *                 description: Names of the existing channels that need the RPM
   *               jira_id:
   *                 type: string
   *                 description: Related Jira issue key (must exist)
   *               justification:
   *                 type: string
   *               delivery_timeline:
   *                 type: string
   *                 format: date
   *                 description: Desired delivery date (YYYY-MM-DD), at least 20 business days (Monday to Friday, UTC) from today
   *               release_target:
   *                 type: array
   *                 items:
   *                   type: string
   *                 nullable: true
   *               release_commitment:
   *                 type: string
   *     responses:
   *       200:
   *         description: Deterministic demo-mode success
   *       201:
   *         description: Epic created; assignee reports whether the triage owner was assigned
   *       400:
   *         description: Request body is not a JSON object
   *       401:
   *         description: Unauthenticated (no user email available)
   *       422:
   *         description: Validation failed (per-field errors)
   *       429:
   *         description: A request is in flight or the user is within the 60-second cooldown
   *       502:
   *         description: Jira Epic creation failed
   *       503:
   *         description: Jira is not configured
   */
  router.post('/rpm-requests', requireAuth, handler('rpm'));

  /**
   * @openapi
   * /api/modules/product-builds/channel-requests:
   *   post:
   *     tags: [Package Requests]
   *     summary: Submit a new channel request
   *     description: >-
   *       Authenticated endpoint behind the Channel Requests tab. Validates the
   *       request, verifies the related Jira issue, and files an Epic in the
   *       project chosen in the form (RHAI; RHAISTRAT falls back to the
   *       default), or in PACKAGE_REQUEST_JIRA_PROJECT when that is set. The
   *       Epic gets the channel-request and org-pulse-filed labels, a team
   *       label, Red Hat Employee security and the AIPCC Ecosystems
   *       component, and is assigned to REQUEST_TRIAGE_ASSIGNEE_EMAIL
   *       (default epacific@redhat.com) for manual triage. Assignment failure
   *       is non-fatal. One channel request per user per 60 seconds.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [team, torch_version, accelerator, os, jira_id, justification, delivery_timeline]
   *             properties:
   *               team:
   *                 type: string
   *               project:
   *                 type: string
   *                 enum: [RHAISTRAT, RHAI]
   *                 nullable: true
   *               torch_version:
   *                 type: string
   *                 description: Free text, at most 200 characters
   *               accelerator:
   *                 type: string
   *                 description: Accelerator and version, free text, at most 200 characters
   *               os:
   *                 type: string
   *                 description: Operating system, free text, at most 200 characters
   *               jira_id:
   *                 type: string
   *                 description: Related Jira issue key (must exist), typically the approved STRAT
   *               justification:
   *                 type: string
   *               delivery_timeline:
   *                 type: string
   *                 format: date
   *                 description: Desired delivery date (YYYY-MM-DD), at least 20 business days (Monday to Friday, UTC) from today
   *     responses:
   *       200:
   *         description: Deterministic demo-mode success
   *       201:
   *         description: Epic created; assignee reports whether the triage owner was assigned
   *       400:
   *         description: Request body is not a JSON object
   *       401:
   *         description: Unauthenticated (no user email available)
   *       422:
   *         description: Validation failed (per-field errors)
   *       429:
   *         description: A request is in flight or the user is within the 60-second cooldown
   *       502:
   *         description: Jira Epic creation failed
   *       503:
   *         description: Jira is not configured
   */
  router.post('/channel-requests', requireAuth, handler('channel'));
};

module.exports._testExports = {
  TRIAGE_LEAD_BUSINESS_DAYS,
  COMPONENT_NAME,
  DEFAULT_TRIAGE_ASSIGNEE_EMAIL,
  REQUEST_TYPES,
  validateRpmRequest,
  validateChannelRequest,
  buildRpmSummary,
  buildChannelSummary,
  buildRpmDescription,
  buildChannelDescription,
  buildTriageEpicFields,
  resolveTriageAssigneeEmail,
  assignToTriageOwner
};
