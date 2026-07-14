const { createJiraClient } = require('../../../shared/server/jira');

const DEFAULTS = {
  targetVersionField: 'customfield_10855',
  sizeField: 'customfield_10795',
  cacheTtl: 3_600_000,
  jiraProject: 'AIPCC',
  epicLabels: ['dashboard-filed', 'package'],
};

let _cfg = { ...DEFAULTS };
let _cache = null;
let _cacheTime = 0;

// --- ADF parsing ---

function extractAdfText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (node.type === 'text') return node.text || '';
  if (!node.content || !Array.isArray(node.content)) return '';
  return node.content.map(extractAdfText).join('');
}

function extractJiraLinks(node) {
  const links = [];
  if (!node) return links;
  if (node.type === 'inlineCard' && node.attrs && node.attrs.url) {
    const m = node.attrs.url.match(/atlassian\.net\/browse\/([A-Z]+-\d+)/);
    if (m) links.push(m[1]);
  }
  if (node.type === 'text' && node.marks) {
    for (const mark of node.marks) {
      if (mark.type === 'link' && mark.attrs && mark.attrs.href) {
        const m = mark.attrs.href.match(/atlassian\.net\/browse\/([A-Z]+-\d+)/);
        if (m) links.push(m[1]);
      }
    }
  }
  if (node.content && Array.isArray(node.content)) {
    for (const child of node.content) {
      links.push(...extractJiraLinks(child));
    }
  }
  return links;
}

function parseDescriptionFields(rawDesc) {
  const result = { targetDate: null, release: null, relatedTicket: null, team: null, requester: null };
  if (!rawDesc) return result;

  const text = extractAdfText(rawDesc);

  const dateMatch = text.match(/Target Date:?\s*(\d{4}-\d{2}-\d{2})/) ||
                    text.match(/Target Date:?\s*(\S+)/);
  if (dateMatch) result.targetDate = dateMatch[1];

  const releaseMatch = text.match(/Release Commitment:?\s*(.+?)(?:Testing|Default|$)/);
  if (releaseMatch) {
    const versionMatch = releaseMatch[1].match(/(\d+\.\d+\s*(?:EA\s*\d+|GA))/i);
    if (versionMatch) {
      result.release = versionMatch[1].trim();
    } else if (releaseMatch[1].trim() !== 'N/A') {
      result.release = releaseMatch[1].trim();
    }
  }

  const jiraLinks = extractJiraLinks(rawDesc);
  if (jiraLinks.length > 0) {
    result.relatedTicket = jiraLinks[0];
  } else {
    const ticketMatch = text.match(/Related Jira Ticket:?\s*([A-Z]+-\d+)/) ||
                        text.match(/([A-Z]{2,}-\d+)/);
    if (ticketMatch) result.relatedTicket = ticketMatch[1];
  }

  const teamMatch = text.match(/Team:?\s*(.+?)(?:Package|$)/);
  if (teamMatch) result.team = teamMatch[1].trim();

  const requesterMatch = text.match(/Requester:?\s*(\S+@\S+)/);
  if (requesterMatch) result.requester = requesterMatch[1];

  return result;
}

// --- Risk and lead time ---

function computeRisk(targetDateStr) {
  if (!targetDateStr) return { days_overdue: null, risk: 'no_date' };
  const target = new Date(targetDateStr + 'T00:00:00Z');
  if (isNaN(target.getTime())) return { days_overdue: null, risk: 'no_date' };

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const days = Math.round((today - target) / 86_400_000);

  if (days > 0) return { days_overdue: days, risk: 'overdue' };
  if (days >= -7) return { days_overdue: days, risk: 'at_risk' };
  return { days_overdue: days, risk: 'on_track' };
}

function computeLeadTime(targetDateStr, createdStr) {
  if (!targetDateStr || !createdStr) return { lead_time: null, lead_time_flag: null };
  const target = new Date(targetDateStr);
  const created = new Date(createdStr);
  if (isNaN(target.getTime()) || isNaN(created.getTime())) return { lead_time: null, lead_time_flag: null };
  const days = Math.round((target - created) / 86_400_000);
  let flag = null;
  if (days <= 3) flag = 'critical';
  else if (days <= 7) flag = 'tight';
  return { lead_time: days, lead_time_flag: flag };
}

// --- Target version extraction ---

function extractTargetVersions(field) {
  if (!field) return [];
  if (Array.isArray(field)) return field.map(v => (v && v.name) || '').filter(Boolean);
  if (field && typeof field === 'object' && field.name) return [field.name];
  return [];
}

// --- Main data builder ---

const RISK_PRIORITY = { overdue: 0, at_risk: 1, on_track: 2, no_date: 3 };
const CHILDREN_CONCURRENCY = 10;
const JIRA_KEY_RE = /^[A-Z]+-\d+$/;

async function buildReleaseTracker(jira) {
  const labels = _cfg.epicLabels.map(l => `"${l}"`).join(', ');
  const jql = `project = ${_cfg.jiraProject} AND issuetype = Epic AND labels in (${labels}) AND status not in (Closed, Done)`;
  const fields = [
    'key', 'summary', 'status', 'assignee', 'description',
    'duedate', 'created', 'fixVersions',
    _cfg.targetVersionField, _cfg.sizeField,
  ].join(',');

  const epics = await jira.fetchAllJqlResults(jql, fields);

  const childrenJql = key => `"Epic Link" = ${key}`;
  const childFields = 'key,summary,status';

  // Fetch children in batches to avoid overwhelming JIRA
  const packages = [];
  for (let i = 0; i < epics.length; i += CHILDREN_CONCURRENCY) {
    const batch = epics.slice(i, i + CHILDREN_CONCURRENCY);
    const childResults = await Promise.all(
      batch.map(epic =>
        JIRA_KEY_RE.test(epic.key)
          ? jira.fetchAllJqlResults(childrenJql(epic.key), childFields, { maxResults: 100 }).catch(() => [])
          : Promise.resolve([])
      )
    );
    for (let j = 0; j < batch.length; j++) {
      const epic = batch[j];
      const children = childResults[j];
      const f = epic.fields || {};
      const descFields = parseDescriptionFields(f.description);
      const targetDate = f.duedate || descFields.targetDate;
      const { days_overdue, risk } = computeRisk(targetDate);
      const { lead_time, lead_time_flag } = computeLeadTime(targetDate, f.created);

      const targetVersions = extractTargetVersions(f[_cfg.targetVersionField]);
      const fixVersions = f.fixVersions || [];
      const sizeRaw = f[_cfg.sizeField];

      packages.push({
        key: epic.key,
        package: f.summary || '',
        status: (f.status && f.status.name) || '',
        status_category: (f.status && f.status.statusCategory && f.status.statusCategory.key) || 'undefined',
        assignee: (f.assignee && f.assignee.displayName) || 'Unassigned',
        target_date: targetDate || null,
        created: f.created ? f.created.slice(0, 10) : null,
        release: targetVersions[0] || null,
        fix_version: (fixVersions[0] && fixVersions[0].name) || null,
        related_ticket: descFields.relatedTicket || null,
        team: descFields.team || null,
        size: (sizeRaw && typeof sizeRaw === 'object') ? sizeRaw.value : (sizeRaw || null),
        days_overdue,
        risk,
        lead_time,
        lead_time_flag,
        children: children.map(c => ({
          key: c.key,
          status: (c.fields && c.fields.status && c.fields.status.name) || '',
          status_category: (c.fields && c.fields.status && c.fields.status.statusCategory && c.fields.status.statusCategory.key) || 'undefined',
          summary: (c.fields && c.fields.summary) || '',
        })),
      });
    }
  }

  packages.sort((a, b) => {
    const pa = RISK_PRIORITY[a.risk] ?? 3;
    const pb = RISK_PRIORITY[b.risk] ?? 3;
    if (pa !== pb) return pa - pb;
    const da = a.days_overdue ?? -Infinity;
    const db = b.days_overdue ?? -Infinity;
    return db - da;
  });

  const counts = { overdue: 0, at_risk: 0, on_track: 0, no_date: 0 };
  for (const p of packages) counts[p.risk] = (counts[p.risk] || 0) + 1;

  return {
    generated_at: new Date().toISOString(),
    total: packages.length,
    ...counts,
    packages,
  };
}

// --- Route registration ---

/**
 * @param {import('express').Router} router
 * @param {{ secrets?: Record<string, string>, resolveSecret?: Function, requireAdmin: Function }} context
 */
module.exports = function registerPackageTrackerRoutes(router, context) {
  if (context.resolveSecret) {
    const tvf = context.resolveSecret('TRACKER_TARGET_VERSION_FIELD');
    if (tvf) _cfg.targetVersionField = tvf;
    const sf = context.resolveSecret('TRACKER_SIZE_FIELD');
    if (sf) _cfg.sizeField = sf;
  }

  let _jira;
  function getJira() {
    if (!_jira) {
      _jira = createJiraClient({
        email: (context.secrets && context.secrets.JIRA_EMAIL) || '',
        token: (context.secrets && context.secrets.JIRA_TOKEN) || '',
      });
    }
    return _jira;
  }

  /**
   * @openapi
   * /api/modules/product-builds/package-tracker:
   *   get:
   *     tags: [Package Tracker]
   *     summary: Get package release tracker data
   *     description: Returns all open AIPCC package EPICs with risk assessment, due dates, release versions, and child issues. Cached for 1 hour.
   *     parameters:
   *       - name: refresh
   *         in: query
   *         schema:
   *           type: string
   *           enum: ['true']
   *         description: Force cache refresh
   *     responses:
   *       200:
   *         description: Package tracker data with risk summary and package list
   *       500:
   *         description: Failed to fetch tracker data
   */
  router.get('/package-tracker', async function(req, res) {
    const forceRefresh = req.query.refresh === 'true';
    const now = Date.now();

    if (!forceRefresh && _cache && (now - _cacheTime) < _cfg.cacheTtl) {
      return res.json(_cache);
    }

    try {
      _cache = await buildReleaseTracker(getJira());
      _cacheTime = Date.now();
      res.json(_cache);
    } catch (err) {
      console.error('[package-tracker] Failed to build tracker:', err.message);
      if (_cache) {
        return res.json(_cache);
      }
      res.status(500).json({ error: 'Failed to fetch package tracker data' });
    }
  });

  /**
   * @openapi
   * /api/modules/product-builds/package-tracker/refresh:
   *   post:
   *     tags: [Package Tracker]
   *     summary: Force refresh package tracker data (admin only)
   *     responses:
   *       200:
   *         description: Refreshed package tracker data
   *       500:
   *         description: Refresh failed
   */
  router.post('/package-tracker/refresh', context.requireAdmin, async function(req, res) {
    try {
      _cache = await buildReleaseTracker(getJira());
      _cacheTime = Date.now();
      res.json(_cache);
    } catch (err) {
      console.error('[package-tracker] Refresh failed:', err.message);
      res.status(500).json({ error: 'Refresh failed' });
    }
  });
};

module.exports._testExports = {
  extractAdfText, extractJiraLinks, parseDescriptionFields,
  computeRisk, computeLeadTime, extractTargetVersions,
};
