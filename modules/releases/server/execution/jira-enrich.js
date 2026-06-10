/**
 * Jira batch enrichment for the unified feature store.
 *
 * Fetches Jira fields for a batch of feature keys and discovers
 * linked epics via parent/Epic Link queries. Returns a Map of
 * key -> enriched fields for the merge layer.
 */

const {
  CUSTOM_FIELDS,
  serializeField,
  computeRiceStatus
} = require('../../server/hygiene/jira-fetch');
const { deriveHumanReviewStatus, extractSignOffInfo } = require('./ai-review-fields');

const BATCH_SIZE = 40;
const THROTTLE_MS = 1000;

// Fields to fetch for enrichment (matches hygiene Pass 1 + priority + parent)
const ENRICH_FIELDS = [
  'summary', 'status', 'assignee', 'fixVersions', 'components',
  'labels', 'priority', 'issuelinks', 'created', 'updated', 'parent',
  CUSTOM_FIELDS.team,
  CUSTOM_FIELDS.releaseType,
  CUSTOM_FIELDS.statusSummary,
  CUSTOM_FIELDS.colorStatus,
  CUSTOM_FIELDS.docsRequired,
  CUSTOM_FIELDS.targetEnd,
  CUSTOM_FIELDS.productManager,
  CUSTOM_FIELDS.reach,
  CUSTOM_FIELDS.impact,
  CUSTOM_FIELDS.confidence,
  CUSTOM_FIELDS.effort,
  CUSTOM_FIELDS.riceScore
].join(',');

function sleep(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

function batch(arr, size) {
  const batches = [];
  for (let i = 0; i < arr.length; i += size) {
    batches.push(arr.slice(i, i + size));
  }
  return batches;
}

/**
 * Extract issue links into a normalized array.
 * @param {Array} issueLinks - Raw issuelinks from Jira
 * @returns {Array<{ type: string, direction: string, linkedKey: string, linkedSummary: string, linkedStatus: string }>}
 */
function extractIssueLinks(issueLinks) {
  if (!Array.isArray(issueLinks)) return [];

  const result = [];
  for (let i = 0; i < issueLinks.length; i++) {
    const link = issueLinks[i];
    const type = link.type ? link.type.name : '';

    if (link.outwardIssue) {
      result.push({
        type,
        direction: 'outward',
        linkedKey: link.outwardIssue.key,
        linkedSummary: (link.outwardIssue.fields && link.outwardIssue.fields.summary) || '',
        linkedStatus: (link.outwardIssue.fields && link.outwardIssue.fields.status && link.outwardIssue.fields.status.name) || ''
      });
    }
    if (link.inwardIssue) {
      result.push({
        type,
        direction: 'inward',
        linkedKey: link.inwardIssue.key,
        linkedSummary: (link.inwardIssue.fields && link.inwardIssue.fields.summary) || '',
        linkedStatus: (link.inwardIssue.fields && link.inwardIssue.fields.status && link.inwardIssue.fields.status.name) || ''
      });
    }
  }
  return result;
}

/**
 * Check if a feature is blocked by unresolved inward "Blocks" links.
 * @param {Array} issueLinks - Raw issuelinks from Jira
 * @returns {boolean}
 */
function checkIsBlocked(issueLinks) {
  if (!Array.isArray(issueLinks)) return false;
  const closedStatuses = ['Closed', 'Resolved', 'Done'];

  for (let i = 0; i < issueLinks.length; i++) {
    const link = issueLinks[i];
    if (!link.inwardIssue) continue;
    const type = link.type || {};
    if (type.name !== 'Blocks' && type.inward !== 'is blocked by') continue;
    const linkedStatus = link.inwardIssue.fields &&
      link.inwardIssue.fields.status &&
      link.inwardIssue.fields.status.name;
    if (closedStatuses.indexOf(linkedStatus) === -1) {
      return true;
    }
  }
  return false;
}

/**
 * Find the first RHAIRFE-* clones link key.
 * @param {Array} issueLinks - Raw issuelinks from Jira
 * @returns {string|null}
 */
function findLinkedRfeKey(issueLinks) {
  if (!Array.isArray(issueLinks)) return null;

  for (let i = 0; i < issueLinks.length; i++) {
    const link = issueLinks[i];
    if (!link.outwardIssue) continue;
    const type = link.type || {};
    if (type.outward === 'clones' || type.name === 'Cloners') {
      if (link.outwardIssue.key && link.outwardIssue.key.startsWith('RHAIRFE-')) {
        return link.outwardIssue.key;
      }
    }
  }
  return null;
}

/**
 * Transform a raw Jira issue into enrichment fields for the unified feature store.
 * Unlike hygiene's transformIssue, this preserves object shapes for assignee/pm.
 * @param {object} rawIssue - Raw Jira issue
 * @returns {object} Enriched fields
 */
function transformForEnrichment(rawIssue) {
  const fields = rawIssue.fields || {};
  const renderedFields = rawIssue.renderedFields || {};

  // Components as array of names
  const components = [];
  if (fields.components && Array.isArray(fields.components)) {
    for (let i = 0; i < fields.components.length; i++) {
      if (fields.components[i].name) components.push(fields.components[i].name);
    }
  }

  // Fix versions as array of names
  const fixVersions = [];
  if (fields.fixVersions && Array.isArray(fields.fixVersions)) {
    for (let i = 0; i < fields.fixVersions.length; i++) {
      if (fields.fixVersions[i].name) fixVersions.push(fields.fixVersions[i].name);
    }
  }

  // Labels
  const labels = Array.isArray(fields.labels) ? fields.labels : [];

  // Assignee as object (NOT string like hygiene does)
  const assignee = fields.assignee
    ? { displayName: fields.assignee.displayName, accountId: fields.assignee.accountId }
    : null;

  // PM as object
  const pmField = fields[CUSTOM_FIELDS.productManager];
  const pm = pmField
    ? { displayName: pmField.displayName || null }
    : null;

  // Status Summary: prefer rendered HTML
  const statusSummary = renderedFields[CUSTOM_FIELDS.statusSummary] ||
    serializeField(fields[CUSTOM_FIELDS.statusSummary]);

  const colorStatus = serializeField(fields[CUSTOM_FIELDS.colorStatus]);

  const issueLinksNormalized = extractIssueLinks(fields.issuelinks);
  const isBlocked = checkIsBlocked(fields.issuelinks);
  const linkedRfeKey = findLinkedRfeKey(fields.issuelinks);

  // Derive humanReviewStatus from labels (no changelog needed)
  const humanReviewStatus = deriveHumanReviewStatus(labels);

  return {
    key: rawIssue.key,
    summary: fields.summary || '',
    status: fields.status ? fields.status.name : null,
    statusCategory: fields.status && fields.status.statusCategory
      ? fields.status.statusCategory.name
      : null,
    colorStatus,
    ownerStatusColor: colorStatus, // backward compat alias
    statusSummary,
    priority: fields.priority ? fields.priority.name : null,
    assignee,
    pm,
    team: serializeField(fields[CUSTOM_FIELDS.team]),
    releaseType: serializeField(fields[CUSTOM_FIELDS.releaseType]),
    fixVersions,
    labels,
    components,
    docsRequired: serializeField(fields[CUSTOM_FIELDS.docsRequired]),
    targetEnd: fields[CUSTOM_FIELDS.targetEnd] || null,
    riceScore: fields[CUSTOM_FIELDS.riceScore] || null,
    riceStatus: computeRiceStatus(fields),
    isBlocked,
    linkedRfeKey,
    issueLinks: issueLinksNormalized,
    created: fields.created || null,
    updated: fields.updated || null,
    // AI review enrichment: humanReviewStatus derived from labels
    aiReview: {
      humanReviewStatus
    }
  };
}

/**
 * Batch-enrich features from Jira.
 * @param {string[]} keys - Feature issue keys
 * @param {Function} jiraRequestFn - Bound jiraRequest
 * @param {Function} fetchAllJqlResultsFn - Bound fetchAllJqlResults
 * @returns {Promise<Map<string, object>>} Map of key -> enriched fields
 */
async function enrichFeatures(keys, jiraRequestFn, fetchAllJqlResultsFn) {
  if (!keys || keys.length === 0) return new Map();

  const result = new Map();
  const batches = batch(keys, BATCH_SIZE);

  for (let bi = 0; bi < batches.length; bi++) {
    if (bi > 0) await sleep(THROTTLE_MS);

    const batchKeys = batches[bi];
    const jql = 'key in (' + batchKeys.map(k => '"' + k + '"').join(', ') + ')';

    try {
      const issues = await fetchAllJqlResultsFn(jiraRequestFn, jql, ENRICH_FIELDS, {
        expand: 'renderedFields'
      });

      for (let i = 0; i < issues.length; i++) {
        const enriched = transformForEnrichment(issues[i]);
        result.set(enriched.key, enriched);
      }
    } catch (err) {
      console.warn(
        '[jira-enrich] Batch ' + (bi + 1) + '/' + batches.length + ' failed:',
        err.message,
        'Keys:', batchKeys.join(', ')
      );
    }
  }

  // Fetch epics in parallel batches
  const epicMap = await fetchEpicsForFeatures(keys, jiraRequestFn, fetchAllJqlResultsFn);

  // Attach epics to enriched results
  for (const [key, epics] of epicMap) {
    const enriched = result.get(key);
    if (enriched) {
      enriched.epics = epics;
    }
  }

  // Ensure epics array exists for all enriched features
  for (const [, enriched] of result) {
    if (!enriched.epics) {
      enriched.epics = [];
    }
  }

  return result;
}

const SIGN_OFF_BATCH_SIZE = 20;

/**
 * Targeted sign-off detection pass for features that have aiReview data,
 * humanReviewStatus === 'approved', but lack approvedBy/approvedAt.
 * Fetches only labels + changelog for a small subset of features.
 *
 * @param {string[]} keys - Feature keys to check
 * @param {object} storage - Storage abstraction
 * @param {Function} jiraRequestFn
 * @param {Function} fetchAllJqlResultsFn
 * @returns {Promise<Map<string, { approvedBy: string, approvedAt: string }>>}
 */
async function fetchSignOffDetails(keys, storage, jiraRequestFn, fetchAllJqlResultsFn) {
  const DATA_PREFIX = 'releases/execution';
  const signOffMap = new Map();

  // Filter to only keys that need sign-off backfill
  const needsSignOff = [];
  for (let i = 0; i < keys.length; i++) {
    const feature = storage.readFromStorage(DATA_PREFIX + '/features/' + keys[i] + '.json');
    if (!feature || !feature.aiReview) continue;
    if (feature.aiReview.humanReviewStatus === 'approved' &&
        !feature.aiReview.approvedBy && !feature.aiReview.approvedAt) {
      needsSignOff.push(keys[i]);
    }
  }

  if (needsSignOff.length === 0) return signOffMap;

  console.log('[jira-enrich] Sign-off detection pass for ' + needsSignOff.length + ' features');

  const batches = batch(needsSignOff, SIGN_OFF_BATCH_SIZE);
  for (let bi = 0; bi < batches.length; bi++) {
    if (bi > 0) await sleep(THROTTLE_MS);

    const batchKeys = batches[bi];
    const jql = 'key in (' + batchKeys.map(function(k) { return '"' + k + '"'; }).join(', ') + ')';

    try {
      const issues = await fetchAllJqlResultsFn(jiraRequestFn, jql, 'labels', {
        expand: 'changelog'
      });

      for (let i = 0; i < issues.length; i++) {
        const issue = issues[i];
        const info = extractSignOffInfo(issue.changelog);
        if (info) {
          signOffMap.set(issue.key, info);
        }
      }
    } catch (err) {
      console.warn('[jira-enrich] Sign-off batch ' + (bi + 1) + '/' + batches.length + ' failed:', err.message);
    }
  }

  return signOffMap;
}

/**
 * Discover epics linked to feature keys via parent/Epic Link.
 * @param {string[]} featureKeys - Feature issue keys
 * @param {Function} jiraRequestFn
 * @param {Function} fetchAllJqlResultsFn
 * @returns {Promise<Map<string, Array<{ key: string, summary: string, status: string }>>>}
 */
async function fetchEpicsForFeatures(featureKeys, jiraRequestFn, fetchAllJqlResultsFn) {
  if (!featureKeys || featureKeys.length === 0) return new Map();

  const epicMap = new Map();
  const batches = batch(featureKeys, BATCH_SIZE);

  for (let bi = 0; bi < batches.length; bi++) {
    if (bi > 0) await sleep(THROTTLE_MS);

    const batchKeys = batches[bi];
    const keyList = batchKeys.map(k => '"' + k + '"').join(', ');
    const jql = '("Epic Link" in (' + keyList + ') OR parent in (' + keyList + '))';
    const fields = 'summary,status,parent,customfield_10014';

    try {
      const children = await fetchAllJqlResultsFn(jiraRequestFn, jql, fields);

      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const childFields = child.fields || {};

        // Determine parent key via parent field or Epic Link custom field
        const parentKey = (childFields.parent ? childFields.parent.key : null) ||
          childFields.customfield_10014 || null;

        if (parentKey && batchKeys.indexOf(parentKey) !== -1) {
          if (!epicMap.has(parentKey)) {
            epicMap.set(parentKey, []);
          }
          epicMap.get(parentKey).push({
            key: child.key,
            summary: childFields.summary || '',
            status: childFields.status ? childFields.status.name : ''
          });
        }
      }
    } catch (err) {
      console.warn(
        '[jira-enrich] Epic discovery batch ' + (bi + 1) + '/' + batches.length + ' failed:',
        err.message
      );
    }
  }

  return epicMap;
}

/**
 * Discover features from Jira via configurable JQL.
 * @param {string} jql - JQL query
 * @param {Function} jiraRequestFn
 * @param {Function} fetchAllJqlResultsFn
 * @returns {Promise<Array<object>>} Array of enriched feature objects
 */
async function discoverFeatures(jql, jiraRequestFn, fetchAllJqlResultsFn) {
  const issues = await fetchAllJqlResultsFn(jiraRequestFn, jql, ENRICH_FIELDS, {
    expand: 'renderedFields'
  });

  const results = [];
  for (let i = 0; i < issues.length; i++) {
    results.push(transformForEnrichment(issues[i]));
  }
  return results;
}

module.exports = {
  enrichFeatures,
  fetchEpicsForFeatures,
  fetchSignOffDetails,
  discoverFeatures,
  transformForEnrichment,
  extractIssueLinks,
  checkIsBlocked,
  findLinkedRfeKey,
  ENRICH_FIELDS,
  BATCH_SIZE,
  THROTTLE_MS
};
