/**
 * Jira Taxonomy platform extension — server routes.
 * Browse components sourced from the field-options store and submit new
 * component requests via proxy to Google Form.
 *
 * Mounted as a module-views extension targeting team-tracker.
 * Routes are served at /api/modules/team-tracker/jira-components*.
 *
 * The Jira component sync itself lives in core's field-options-sync engine.
 * This extension provides: (1) a read endpoint that reshapes rich field-options
 * data into the browse-friendly format, and (2) the Google Form submission proxy.
 */

const crypto = require('crypto');
const { appendAuditEntry } = require('../../../shared/server/audit-log');

// Google Form: "RHAI Component Request"
// Form ID: 19eEmOqZ1_VA5U0oibZprzr1rgn5b3Jsa9Vk3XSa0ysE
// Published URL: https://docs.google.com/forms/d/e/1FAIpQLSc0wnopIa3UOaunMfy4SNuLtWfOa8FcPmcMKwJuBxZVQtZycg/formResponse
//
// To find/update entry IDs: open the Google Form in edit mode,
// View > Source, search for "entry." — each form field has a numeric ID.
// Alternatively, inspect the live form's HTML input elements.
var FORM_ENTRY = {
  PRE_REQUEST_CONFIRMATION: 'entry.1824675397',  // checkbox (repeated)
  PROPOSED_NAME:            'entry.785780764',    // text
  DESCRIPTION:              'entry.819357237',    // paragraph
  JUSTIFICATION:            'entry.9653251',      // paragraph
  OWNING_PM:                'entry.1227842864',   // text
  PM_DIRECTOR_APPROVAL:     'entry.2007074061',   // text
  ENGINEERING_TEAM:         'entry.600587289',    // text
  COMPONENT_LEAD:           'entry.1930553058',   // text
  LEADERSHIP_ALIGNMENT:     'entry.744210354'     // checkbox (repeated)
};
var GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSc0wnopIa3UOaunMfy4SNuLtWfOa8FcPmcMKwJuBxZVQtZycg/formResponse';

const COMPONENT_OPTIONS_NAME = 'component';
var SUBMISSIONS_LOG_KEY = 'component-requests-log.json';
// Rate limiting: per-user cooldown (1 submission per 60 seconds)
var rateLimitMap = new Map();

module.exports = function registerJiraTaxonomyRoutes(router, context) {
  const storage = context.storage;
  const requireScope = context.requireScope;
  const readFromStorage = storage.readFromStorage;
  const writeToStorage = storage.writeToStorage;
  var DEMO_MODE = process.env.DEMO_MODE === 'true';

  /**
   * Build the component browse response from the field-options store.
   * Reads the "component" option set and reshapes richValues into the
   * component array format expected by the taxonomy browse UI.
   */
  async function buildComponentResponse() {
    const data = await readFromStorage('team-data/field-options/' + COMPONENT_OPTIONS_NAME + '.json');
    if (!data || !data.values) {
      return { fetchedAt: null, project: null, components: [], source: null };
    }

    const richValues = data.richValues || {};
    const components = data.values.map(function(name) {
      const rich = richValues[name] || {};
      return {
        id: rich.id || '',
        name: name,
        description: rich.description || '',
        lead: rich.lead || null,
        assigneeType: rich.assigneeType || 'PROJECT_DEFAULT'
      };
    });

    return {
      fetchedAt: data.syncedAt || data.updatedAt || null,
      project: data.sourceProject || null,
      components: components,
      source: data.source || null
    };
  }

  /**
   * Resolve the submitter's canonical @redhat.com email.
   * Uses roster registry lookup by userUid, falls back to req.userEmail.
   */
  async function resolveSubmitterEmail(req) {
    if (req.userUid) {
      try {
        var registry = await readFromStorage('team-data/registry.json');
        if (registry && registry.people && registry.people[req.userUid]) {
          var personEmail = registry.people[req.userUid].email;
          if (personEmail) return personEmail;
        }
      } catch (err) {
        console.warn('[jira-taxonomy] Failed to resolve email from registry:', err.message);
      }
    }
    return req.userEmail || 'unknown';
  }

  // ─── GET /jira-components ───

  /**
   * @openapi
   * /api/modules/team-tracker/jira-components:
   *   get:
   *     tags: ['TT: Jira Taxonomy']
   *     summary: List Jira components for the taxonomy browser
   *     description: Returns components from the field-options store, enriched with descriptions and leads from Jira sync.
   *     responses:
   *       200:
   *         description: Component list
   */
  router.get('/jira-components', requireScope('team-tracker:read'), async function(req, res) {
    try {
      var result = await buildComponentResponse();
      res.json(result);
    } catch (err) {
      console.error('[jira-taxonomy] Error building component response:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ─── POST /jira-components/request ───

  /**
   * @openapi
   * /api/modules/team-tracker/jira-components/request:
   *   post:
   *     tags: ['TT: Jira Taxonomy']
   *     summary: Submit a new component request
   *     description: Proxies the request to the Google Form and maintains a local submission log.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *     responses:
   *       200:
   *         description: Request submitted successfully
   *       400:
   *         description: Validation error
   *       429:
   *         description: Rate limit exceeded
   *       502:
   *         description: Google Form submission failed (saved locally)
   */
  router.post('/jira-components/request', requireScope('team-tracker:write'), async function(req, res) {
    try {
      // Rate limiting: 1 submission per 60 seconds per user
      var userEmail = req.userEmail || 'anonymous';
      var now = Date.now();
      var lastSubmission = rateLimitMap.get(userEmail);
      if (lastSubmission && (now - lastSubmission) < 60000) {
        var retryAfter = Math.ceil((60000 - (now - lastSubmission)) / 1000);
        res.set('Retry-After', String(retryAfter));
        return res.status(429).json({ error: 'Rate limit exceeded. Please wait before submitting another request.', retryAfter: retryAfter });
      }

      var body = req.body || {};

      // Validation
      var errors = [];
      if (!Array.isArray(body.preRequestConfirmation) || body.preRequestConfirmation.length !== 4) {
        errors.push('preRequestConfirmation must have exactly 4 items');
      } else if (!body.preRequestConfirmation.every(function(item) { return typeof item === 'string'; })) {
        errors.push('preRequestConfirmation items must be strings');
      }
      if (!body.proposedName || typeof body.proposedName !== 'string' || !body.proposedName.trim()) {
        errors.push('proposedName is required');
      } else if (body.proposedName.length > 200) {
        errors.push('proposedName must be 200 characters or fewer');
      }
      if (!body.description || typeof body.description !== 'string' || !body.description.trim()) {
        errors.push('description is required');
      } else if (body.description.length > 2000) {
        errors.push('description must be 2000 characters or fewer');
      }
      if (!body.justification || typeof body.justification !== 'string' || !body.justification.trim()) {
        errors.push('justification is required');
      } else if (body.justification.length > 2000) {
        errors.push('justification must be 2000 characters or fewer');
      }
      if (!body.owningPm || typeof body.owningPm !== 'string' || !body.owningPm.trim()) {
        errors.push('owningPm is required');
      } else if (body.owningPm.length > 200) {
        errors.push('owningPm must be 200 characters or fewer');
      }
      if (!body.pmDirectorApproval || typeof body.pmDirectorApproval !== 'string' || !body.pmDirectorApproval.trim()) {
        errors.push('pmDirectorApproval is required');
      } else if (body.pmDirectorApproval.length > 200) {
        errors.push('pmDirectorApproval must be 200 characters or fewer');
      }
      if (!body.engineeringTeamAndManager || typeof body.engineeringTeamAndManager !== 'string' || !body.engineeringTeamAndManager.trim()) {
        errors.push('engineeringTeamAndManager is required');
      } else if (body.engineeringTeamAndManager.length > 200) {
        errors.push('engineeringTeamAndManager must be 200 characters or fewer');
      }
      if (!body.componentLead || typeof body.componentLead !== 'string' || !body.componentLead.trim()) {
        errors.push('componentLead is required');
      } else if (body.componentLead.length > 200) {
        errors.push('componentLead must be 200 characters or fewer');
      }
      if (!Array.isArray(body.leadershipAlignment) || body.leadershipAlignment.length !== 2) {
        errors.push('leadershipAlignment must have exactly 2 items');
      } else if (!body.leadershipAlignment.every(function(item) { return typeof item === 'string'; })) {
        errors.push('leadershipAlignment items must be strings');
      }

      if (errors.length > 0) {
        return res.status(400).json({ error: 'Validation failed', details: errors });
      }

      // Resolve submitter email
      var submitterEmail = await resolveSubmitterEmail(req);

      // Create submission log entry
      var submissionId = crypto.randomUUID();
      var submission = {
        id: submissionId,
        submittedAt: new Date().toISOString(),
        submittedBy: submitterEmail,
        googleFormStatus: 'pending',
        payload: body
      };

      // Write initial log entry (pending)
      var log = await readFromStorage(SUBMISSIONS_LOG_KEY) || { submissions: [] };
      log.submissions.push(submission);
      await writeToStorage(SUBMISSIONS_LOG_KEY, log);

      // Update rate limit
      rateLimitMap.set(userEmail, now);

      // Demo mode: skip Google Form POST
      if (DEMO_MODE) {
        submission.googleFormStatus = 'success';
        var demoLog = await readFromStorage(SUBMISSIONS_LOG_KEY) || { submissions: [] };
        var demoEntry = demoLog.submissions.find(function(s) { return s.id === submissionId; });
        if (demoEntry) demoEntry.googleFormStatus = 'success';
        await writeToStorage(SUBMISSIONS_LOG_KEY, demoLog);

        appendAuditEntry(storage, {
          action: 'components.request-submitted',
          actor: submitterEmail,
          entityType: 'component-request',
          entityId: submissionId,
          detail: 'Component request submitted (demo mode)',
          newValue: { proposedName: body.proposedName, googleFormStatus: 'success' }
        });

        return res.json({ success: true, submittedBy: submitterEmail, demo: true });
      }

      // Build Google Form URL-encoded body
      var formParams = new URLSearchParams();
      // Pre-request confirmation (repeated checkbox entries)
      for (var i = 0; i < body.preRequestConfirmation.length; i++) {
        formParams.append(FORM_ENTRY.PRE_REQUEST_CONFIRMATION, body.preRequestConfirmation[i]);
      }
      formParams.append(FORM_ENTRY.PROPOSED_NAME, body.proposedName);
      formParams.append(FORM_ENTRY.DESCRIPTION, body.description);
      formParams.append(FORM_ENTRY.JUSTIFICATION, body.justification);
      formParams.append(FORM_ENTRY.OWNING_PM, body.owningPm);
      formParams.append(FORM_ENTRY.PM_DIRECTOR_APPROVAL, body.pmDirectorApproval);
      formParams.append(FORM_ENTRY.ENGINEERING_TEAM, body.engineeringTeamAndManager);
      formParams.append(FORM_ENTRY.COMPONENT_LEAD, body.componentLead);
      // Leadership alignment (repeated checkbox entries)
      for (var j = 0; j < body.leadershipAlignment.length; j++) {
        formParams.append(FORM_ENTRY.LEADERSHIP_ALIGNMENT, body.leadershipAlignment[j]);
      }

      // POST to Google Form
      var googleFormStatus = 'failed';
      try {
        var response = await fetch(GOOGLE_FORM_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formParams.toString()
        });

        if (response.ok) {
          googleFormStatus = 'success';
        } else {
          var responseBody = await response.text().catch(function() { return ''; });
          console.error('[jira-taxonomy] Google Form returned non-200:', response.status, responseBody);
        }
      } catch (fetchErr) {
        console.error('[jira-taxonomy] Google Form fetch failed:', fetchErr.message);
      }

      // Update submission log with final status
      var updatedLog = await readFromStorage(SUBMISSIONS_LOG_KEY) || { submissions: [] };
      var entry = updatedLog.submissions.find(function(s) { return s.id === submissionId; });
      if (entry) entry.googleFormStatus = googleFormStatus;
      await writeToStorage(SUBMISSIONS_LOG_KEY, updatedLog);

      // Audit log
      appendAuditEntry(storage, {
        action: 'components.request-submitted',
        actor: submitterEmail,
        entityType: 'component-request',
        entityId: submissionId,
        detail: 'Component request submitted',
        newValue: { proposedName: body.proposedName, googleFormStatus: googleFormStatus }
      });

      if (googleFormStatus === 'success') {
        return res.json({ success: true, submittedBy: submitterEmail });
      } else {
        return res.status(502).json({
          error: 'Failed to submit to Google Form, but your request has been saved locally. An admin can retrieve it.',
          submittedBy: submitterEmail,
          savedLocally: true
        });
      }
    } catch (err) {
      console.error('[jira-taxonomy] Error submitting request:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });
};
