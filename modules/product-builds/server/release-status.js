const yaml = require('js-yaml');
const { createJiraClient } = require('../../../shared/server/jira');

// Keep these queries aligned with readiness-detector/constants.py.
const SCAN_JQL = 'project = AIPCC AND issuetype = Epic AND labels = release-automation AND status != Closed';
const ALL_CHILD_TASKS_JQL = epicKey => (
  `project = AIPCC AND issuetype = Task AND (parent = ${epicKey} OR "Epic Link" = ${epicKey})`
);

const EPIC_FIELDS = 'key,summary,status,labels,description,assignee,created,updated';
const CHILD_FIELDS = 'key,summary,status,labels,issuetype,created,updated';
const PRODUCT_GROUPS = [
  { key: 'rhaiis', label: 'RHAII' },
  { key: 'rhel-ai', label: 'RHEL AI' },
  { key: 'base-images', label: 'Base Images' },
];

function extractAdfText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (node.type === 'text') return node.text || '';
  if (!Array.isArray(node.content)) return '';
  return node.content.map(extractAdfText).join('');
}

function walkAdf(node, type, result = []) {
  if (!node || typeof node !== 'object') return result;
  if (node.type === type) result.push(node);
  for (const child of node.content || []) walkAdf(child, type, result);
  return result;
}

function parseMetadata(description) {
  if (!description) return {};

  const blocks = typeof description === 'object' ? walkAdf(description, 'codeBlock') : [];
  const candidates = blocks
    .filter(block => ['yaml', 'yml', ''].includes(block.attrs?.language || ''))
    .map(extractAdfText);
  const text = typeof description === 'string' ? description : extractAdfText(description);
  const fenced = text.match(/```(?:yaml|yml)?\s*\n([\s\S]*?)```/);
  if (fenced) candidates.push(fenced[1]);

  for (const candidate of candidates) {
    try {
      const parsed = yaml.load(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      // A malformed description should not hide an otherwise visible epic.
    }
  }
  return {};
}

function productGroup(product, summary = '') {
  const value = String(product || '').toLowerCase().replace(/[_\s]/g, '-');
  if (value === 'rhaii' || value === 'rhaiis' || value.includes('rhaiis')) return 'rhaiis';
  if (value === 'rhelai' || value === 'rhel-ai' || value.includes('rhel-ai')) return 'rhel-ai';
  if (value === 'baseimages' || value === 'base-images' || value.includes('base-image')) return 'base-images';

  const summaryValue = summary.toLowerCase();
  if (summaryValue.includes('rhaiis') || summaryValue.includes('rhaii')) return 'rhaiis';
  if (summaryValue.includes('rhel ai') || summaryValue.includes('rhel-ai')) return 'rhel-ai';
  if (summaryValue.includes('base image')) return 'base-images';
  return null;
}

function statusDetails(status) {
  return {
    name: status?.name || '',
    category: status?.statusCategory?.key || null,
  };
}

function transformEpic(issue, children) {
  const fields = issue.fields || {};
  const metadata = parseMetadata(fields.description);
  return {
    key: issue.key,
    summary: fields.summary || '',
    status: statusDetails(fields.status),
    labels: Array.isArray(fields.labels) ? fields.labels : [],
    assignee: fields.assignee?.displayName || 'Unassigned',
    created: fields.created || null,
    updated: fields.updated || null,
    details: {
      product: metadata.product || null,
      version: metadata.version == null ? null : String(metadata.version),
      branch: metadata.branch == null ? null : String(metadata.branch),
      release_type: metadata.release_type || null,
      advisory_type: metadata.advisory_type || null,
      target: metadata.target || null,
      tenant: metadata.tenant || null,
      application: metadata.application || null,
    },
    children: children.map(transformChild),
  };
}

function transformChild(issue) {
  const fields = issue.fields || {};
  return {
    key: issue.key,
    summary: fields.summary || '',
    status: statusDetails(fields.status),
    labels: Array.isArray(fields.labels) ? fields.labels : [],
    issue_type: fields.issuetype?.name || 'Task',
    created: fields.created || null,
    updated: fields.updated || null,
  };
}

function groupEpics(epics) {
  const grouped = PRODUCT_GROUPS.map(group => ({ ...group, epics: [] }));
  const groupsByKey = new Map(grouped.map(group => [group.key, group]));

  for (const epic of epics) {
    const key = productGroup(epic.details.product, epic.summary);
    const group = groupsByKey.get(key);
    if (group) group.epics.push(epic);
  }

  return grouped;
}

async function buildReleaseStatus(jira) {
  const rawEpics = await jira.fetchAllJqlResults(SCAN_JQL, EPIC_FIELDS, { maxResults: 100 });
  const epics = await Promise.all(rawEpics.map(async issue => {
    const children = await jira.fetchAllJqlResults(
      ALL_CHILD_TASKS_JQL(issue.key),
      CHILD_FIELDS,
      { maxResults: 100 }
    );
    return transformEpic(issue, children);
  }));

  const groups = groupEpics(epics);

  return {
    groups,
    total: groups.reduce((total, group) => total + group.epics.length, 0),
    generated_at: new Date().toISOString(),
  };
}

module.exports = function registerReleaseStatusRoutes(router, context) {
  let jira;
  function getJira() {
    if (!jira) {
      jira = createJiraClient({
        email: (context.secrets && context.secrets.JIRA_EMAIL) || '',
        token: (context.secrets && context.secrets.JIRA_TOKEN) || '',
      });
    }
    return jira;
  }

  /**
   * @openapi
   * /api/modules/product-builds/release-status:
   *   get:
   *     tags: [Product Builds]
   *     summary: Get ongoing release epics and child cards
   *     description: Queries Jira using the release-readiness detector's open release epic and child task queries.
   *     responses:
   *       200:
   *         description: Release epics grouped by product with child card status and labels
   *       500:
   *         description: Failed to fetch release status from Jira
   */
  router.get('/release-status', async function(req, res) {
    try {
      res.json(await buildReleaseStatus(getJira()));
    } catch (err) {
      console.error('[release-status] Failed to fetch Jira data:', err.message);
      res.status(500).json({ error: 'Failed to fetch release status from Jira' });
    }
  });
};

module.exports._testExports = {
  SCAN_JQL,
  ALL_CHILD_TASKS_JQL,
  parseMetadata,
  productGroup,
  transformEpic,
  groupEpics,
  buildReleaseStatus,
};
