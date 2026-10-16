const yaml = require('js-yaml');
const { createJiraClient } = require('../../../shared/server/jira');
const { gitlabFor } = require('./release-epic');

// Keep these queries aligned with readiness-detector/constants.py.
const SCAN_JQL = 'project in (AIPCC, RHAI) AND issuetype = Epic AND labels = release-automation AND status != Closed';
const ALL_CHILD_TASKS_JQL = epicKey => (
  `project in (AIPCC, RHAI) AND issuetype = Task AND (parent = ${epicKey} OR "Epic Link" = ${epicKey})`
);
const MARKER_TRIGGERED = 'PipelineRun triggered:';
const CONSOLE_BASE_URL = process.env.CLAUDIO_CONSOLE_BASE_URL
  || 'https://console-openshift-console.apps.mpp-e1-preprod.syvu.p1.openshiftapps.com';
const SUMO_UI_BASE_URL = process.env.SUMOLOGIC_UI_BASE_URL || 'https://rhcorporate.sumologic.com';
const DNS_LABEL = /^[a-z0-9](?:[-a-z0-9]*[a-z0-9])?$/;
const JIRA_KEY_PATTERN = /\b(?:AIPCC|RHAI)-\d+\b/g;
const COMMENT_CACHE_TTL = 60000;
const PAYLOAD_CACHE_TTL = 60000;
const pipelineRunCommentCache = new Map();

// Stale-while-revalidate: a cached value is served immediately even when
// expired, while a background rebuild refreshes it. The dashboard stays fast
// at the cost of briefly serving data that is up to one cycle old.
function createPayloadCache(ttl = PAYLOAD_CACHE_TTL) {
  let entry = null;
  let generation = 0;

  function refresh(builder, { background = false } = {}) {
    const currentGeneration = generation;
    const previous = entry?.value ? entry : null;
    const promise = builder()
      .then(value => {
        if (generation === currentGeneration) {
          entry = { value, expiresAt: Date.now() + ttl };
        }
        return value;
      })
      .catch(err => {
        if (generation === currentGeneration) entry = previous;
        if (background) {
          console.error('[release-status] Background refresh failed, serving cached data:', err.message);
          return previous?.value;
        }
        throw err;
      });
    entry = { promise };
    return promise;
  }

  const buildCached = async function (builder) {
    if (entry?.value && entry.expiresAt > Date.now()) return entry.value;
    if (entry?.promise) return entry.promise;
    if (entry?.value) {
      const stale = entry.value;
      refresh(builder, { background: true });
      return stale;
    }
    return refresh(builder);
  };
  buildCached.invalidate = () => {
    entry = null;
    generation += 1;
  };
  return buildCached;
}

const EPIC_FIELDS = 'key,summary,status,labels,description,assignee,created,updated';
const CHILD_FIELDS = 'key,summary,status,labels,issuetype,created,updated';
const PRODUCT_GROUPS = [
  { key: 'rhaiis', label: 'RHAII' },
  { key: 'rhel-ai', label: 'RHEL AI' },
  { key: 'base-images', label: 'Base Images' },
];
const PRODUCT_LABELS = {
  torch: 'Torch',
  guidellm: 'GuideLLM',
  docling: 'Docling',
  'ai-hub': 'AI Hub',
  'agentic-base-images': 'Agentic Base Images',
};

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

function productLabel(key) {
  if (PRODUCT_LABELS[key]) return PRODUCT_LABELS[key];
  return key.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function groupEpics(epics) {
  const grouped = PRODUCT_GROUPS.map(group => ({ ...group, epics: [] }));
  const groupsByKey = new Map(grouped.map(group => [group.key, group]));
  const dynamicGroups = new Map();

  for (const epic of epics) {
    let key = productGroup(epic.details.product, epic.summary);
    if (!key) key = String(epic.details.product || '').trim().toLowerCase().replace(/[_\s]/g, '-') || 'other';
    let group = groupsByKey.get(key) || dynamicGroups.get(key);
    if (!group) {
      group = { key, label: key === 'other' ? 'Other' : productLabel(key), epics: [] };
      dynamicGroups.set(key, group);
    }
    group.epics.push(epic);
  }

  const dynamic = [...dynamicGroups.values()].sort((left, right) => left.label.localeCompare(right.label));
  return [...grouped, ...dynamic];
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

// Verified against live Sumo on 2026-10-16: the MP+ pod logs land in
// _index=rh_paas_preprod _sourceCategory=openshift as JSON that is not
// auto-parsed, so the kubernetes.* fields need an explicit json operator.
// (The %"-field" form from the aipcc-claudio user guide no longer works.)
function sumoLogsUrl({ namespace, name, triggered_at }) {
  const query = [
    '_index=rh_paas_preprod _sourceCategory=openshift',
    '| json "kubernetes.namespace_name" as ns',
    '| json "kubernetes.pod_name" as pod',
    '| json "message" as log_message nodrop',
    `| where ns="${namespace}" and pod matches "${name}*"`,
    '| fields _messagetime, log_message',
  ].join('\n');
  const params = new URLSearchParams({ query });
  let start = '-7d';
  if (triggered_at) {
    const triggered = Date.parse(triggered_at.endsWith('Z') ? triggered_at : `${triggered_at}Z`);
    if (!Number.isNaN(triggered)) {
      const hours = Math.max(1, Math.ceil((Date.now() - (triggered - 15 * 60 * 1000)) / 3600000));
      start = hours >= 48 ? `-${Math.ceil(hours / 24)}d` : `-${hours}h`;
    }
  }
  params.set('startTime', start);
  return `${SUMO_UI_BASE_URL}/log-search/create?${params.toString()}`;
}

// Keep the marker and namespace/name validation aligned with
// readiness-detector/scripts/epic_parser.py: the newest comment carrying the
// marker wins, and a malformed reference yields no link.
function parsePipelineRunRef(comments) {
  const ordered = [...(comments || [])].sort((left, right) =>
    String(right.created || '').localeCompare(String(left.created || '')));
  for (const comment of ordered) {
    const body = extractAdfText(comment.body);
    const markerIndex = body.indexOf(MARKER_TRIGGERED);
    if (markerIndex === -1) continue;
    const reference = body.slice(markerIndex + MARKER_TRIGGERED.length).trim().split(/\s+/)[0] || '';
    const separator = reference.indexOf('/');
    const namespace = separator === -1 ? '' : reference.slice(0, separator);
    const name = separator === -1 ? '' : reference.slice(separator + 1);
    if (!namespace || !name || name.includes('/')) continue;
    if (!DNS_LABEL.test(namespace) || !DNS_LABEL.test(name)) continue;
    const at = body.match(/at (\d{4}-\d{2}-\d{2}T[\d:.]+Z?)/);
    const triggered_at = at ? at[1] : null;
    return {
      namespace,
      name,
      url: `${CONSOLE_BASE_URL}/k8s/ns/${namespace}/tekton.dev~v1~PipelineRun/${name}`,
      logs_url: sumoLogsUrl({ namespace, name, triggered_at }),
      triggered_at,
    };
  }
  return null;
}

async function fetchPipelineRunRef(jira, key) {
  if (typeof jira.jiraRequest !== 'function') return null;
  const cached = pipelineRunCommentCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const payload = await jira.jiraRequest(`/rest/api/3/issue/${key}/comment?maxResults=100&orderBy=-created`);
  const value = parsePipelineRunRef(payload?.comments);
  pipelineRunCommentCache.set(key, { value, expiresAt: Date.now() + COMMENT_CACHE_TTL });
  return value;
}

function fetchPipelineRunRefs(jira, keys) {
  const refs = new Map();
  const pending = [...keys];
  async function fetchNext() {
    for (;;) {
      const key = pending.shift();
      if (!key) return;
      try {
        refs.set(key, await fetchPipelineRunRef(jira, key));
      } catch (err) {
        console.error(`[release-status] Failed to fetch comments for ${key}:`, err.message);
      }
    }
  }
  return Promise.all(Array.from({ length: Math.min(6, pending.length) }, fetchNext)).then(() => refs);
}

function jiraKeysIn(text) {
  return new Set([...String(text || '').matchAll(JIRA_KEY_PATTERN)].map(match => match[0]));
}

function matchMergeRequests(keys, mergeRequests) {
  const wanted = new Set(keys);
  const byIid = new Map();
  for (const mr of mergeRequests || []) {
    const referenced = [...jiraKeysIn(mr.title), ...jiraKeysIn(mr.source_branch)];
    if (!referenced.some(key => wanted.has(key))) continue;
    if (!byIid.has(mr.iid)) byIid.set(mr.iid, mr);
  }
  return [...byIid.values()].sort((left, right) =>
    String(right.created_at || '').localeCompare(String(left.created_at || '')));
}

const RELEASE_TITLE_PATTERN = /release/i;
const FALLBACK_WINDOW_BEFORE_MS = 15 * 60 * 1000;
const FALLBACK_WINDOW_AFTER_MS = 4 * 60 * 60 * 1000;

function parseTimestamp(value) {
  if (!value) return NaN;
  return Date.parse(value.endsWith('Z') ? value : `${value}Z`);
}

function sameProduct(text, product) {
  if (!product) return false;
  const group = productGroup(text, text);
  if (group !== null && group === productGroup(product)) return true;
  const normalize = value => String(value || '').toLowerCase().replace(/[-_\s]/g, '');
  return normalize(text).includes(normalize(product));
}

function versionIn(text, version) {
  if (!version) return false;
  const escaped = String(version).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\d.])${escaped}(?![\\d.])`).test(String(text || ''));
}

function titleMentionsRelease(text, { product, version }) {
  if (!RELEASE_TITLE_PATTERN.test(text)) return false;
  if (!version) return false;
  if (!sameProduct(text, product)) return false;
  return versionIn(text, version);
}

// Older flows keyed their MRs to the epic instead of the readiness card, so
// key matching leaves them invisible. Attribute such MRs to the card whose
// PipelineRun was executing when the MR was filed: the title must mention the
// epic's product, version, and "release", and the creation time must fall in
// the card's run window.
function attributeMergeRequests(epic, cards, pipelineRunRefs, mergeRequests, claimedIids) {
  const claims = new Map();
  const candidates = [...(mergeRequests || [])]
    .filter(mr => !claimedIids.has(mr.iid))
    .sort((left, right) => String(left.created_at || '').localeCompare(String(right.created_at || '')));
  for (const mr of candidates) {
    if (!titleMentionsRelease(mr.title, epic.details)) continue;
    const created = parseTimestamp(mr.created_at);
    if (Number.isNaN(created)) continue;
    let best = null;
    for (const card of cards) {
      const triggered = parseTimestamp(pipelineRunRefs.get(card.key)?.triggered_at);
      if (Number.isNaN(triggered)) continue;
      if (created < triggered - FALLBACK_WINDOW_BEFORE_MS) continue;
      if (created > triggered + FALLBACK_WINDOW_AFTER_MS) continue;
      if (!best || triggered > best.triggered) best = { card, triggered };
    }
    if (best) claims.set(mr.iid, best.card.key);
  }
  return claims;
}

function isVersionBumpCard(child) {
  return /bump/i.test(child.summary || '');
}

function matchVersionBumpMergeRequests(epic, card, mergeRequests, claimedIids) {
  const versions = String(card.summary || '').match(/\d+\.\d+(?:\.\d+)?/g) || [];
  if (!versions.length || !epic.details.product) return [];
  const matches = [];
  for (const mr of mergeRequests || []) {
    if (claimedIids.has(mr.iid)) continue;
    if (!/bump/i.test(mr.title)) continue;
    if (!sameProduct(mr.title, epic.details.product)) continue;
    if (!versions.some(version => versionIn(mr.title, version) || versionIn(mr.source_branch, version))) continue;
    matches.push(mr);
  }
  return matches.sort((left, right) =>
    String(right.created_at || '').localeCompare(String(left.created_at || '')));
}

function buildReleaseLinks(epics, { jira, gitlab } = {}) {
  return (async () => {
    let mergeRequests = [];
    if (gitlab) {
      try {
        mergeRequests = await gitlab.listMergeRequests();
      } catch (err) {
        console.error('[release-status] Failed to fetch PMC merge requests:', err.message);
      }
    }

    const childKeys = epics.flatMap(epic => epic.children.map(child => child.key));
    const pipelineRunRefs = await fetchPipelineRunRefs(jira, childKeys);

    const claimedIids = new Set();
    const links = {};
    for (const epic of epics) {
      const cardMrs = new Map();
      for (const child of epic.children) {
        const keyMrs = matchMergeRequests([child.key], mergeRequests);
        cardMrs.set(child.key, keyMrs);
        for (const mr of keyMrs) claimedIids.add(mr.iid);
      }

      const fallbackCards = epic.children.filter(child =>
        cardMrs.get(child.key).length === 0 && pipelineRunRefs.get(child.key)?.triggered_at);
      const claims = attributeMergeRequests(epic, fallbackCards, pipelineRunRefs, mergeRequests, claimedIids);
      for (const [iid, cardKey] of claims) {
        const mr = mergeRequests.find(item => item.iid === iid);
        cardMrs.set(cardKey, [...cardMrs.get(cardKey), mr]);
      }

      for (const child of epic.children) {
        if (cardMrs.get(child.key).length > 0 || !isVersionBumpCard(child)) continue;
        const bumpMrs = matchVersionBumpMergeRequests(epic, child, mergeRequests, claimedIids);
        if (bumpMrs.length) {
          cardMrs.set(child.key, bumpMrs);
          for (const mr of bumpMrs) claimedIids.add(mr.iid);
        }
      }

      const epicLinks = {
        merge_requests: matchMergeRequests(
          [epic.key, ...epic.children.map(child => child.key)],
          mergeRequests
        ),
        pipeline_runs: [],
      };
      for (const child of epic.children) {
        const ref = pipelineRunRefs.get(child.key) || null;
        links[child.key] = {
          merge_requests: cardMrs.get(child.key),
          pipeline_run: ref,
        };
        if (ref) epicLinks.pipeline_runs.push(ref);
      }
      epicLinks.merge_requests = [...new Map(
        [...epicLinks.merge_requests, ...epic.children.flatMap(child => cardMrs.get(child.key))]
          .map(mr => [mr.iid, mr])
      ).values()].sort((left, right) =>
        String(right.created_at || '').localeCompare(String(left.created_at || '')));
      epicLinks.pipeline_runs.sort((left, right) =>
        String(right.triggered_at || '').localeCompare(String(left.triggered_at || '')));
      links[epic.key] = epicLinks;
    }
    return links;
  })();
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

const releaseStatusPayloadCache = createPayloadCache();
const releaseLinksPayloadCache = createPayloadCache();

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

  function optionalGitlab() {
    try {
      return gitlabFor(context);
    } catch {
      return null;
    }
  }

  /**
   * @openapi
   * /api/modules/product-builds/release-status:
   *   get:
   *     tags: [Product Builds]
   *     summary: Get ongoing release epics and child cards
   *     description: Queries Jira using the release-readiness detector's open release epic and child task queries. Served from a stale-while-revalidate cache. Links are fetched separately from /release-status/links so this response renders fast.
   *     responses:
   *       200:
   *         description: Release epics grouped by product with child card status and labels
   *       500:
   *         description: Failed to fetch release status from Jira
   */
  router.get('/release-status', async function(req, res) {
    try {
      res.json(await releaseStatusPayloadCache(() => buildReleaseStatus(getJira())));
    } catch (err) {
      console.error('[release-status] Failed to fetch Jira data:', err.message);
      res.status(500).json({ error: 'Failed to fetch release status from Jira' });
    }
  });

  /**
   * @openapi
   * /api/modules/product-builds/release-status/links:
   *   get:
   *     tags: [Product Builds]
   *     summary: Get PipelineRun and merge request links for the ongoing release epics
   *     description: Returns a map keyed by Jira issue key. Each readiness card carries the PipelineRun that triggered it (from the readiness-detector comment, with OpenShift console and Sumo Logic log links) and the matching PMC merge requests; each epic carries the aggregated links. Served from a stale-while-revalidate cache.
   *     responses:
   *       200:
   *         description: Map of issue key to PipelineRun and merge request links
   *       500:
   *         description: Failed to fetch release links
   */
  router.get('/release-status/links', async function(req, res) {
    try {
      const links = await releaseLinksPayloadCache(async () => {
        const status = await releaseStatusPayloadCache(() => buildReleaseStatus(getJira()));
        const epics = status.groups.flatMap(group => group.epics);
        return buildReleaseLinks(epics, { jira: getJira(), gitlab: optionalGitlab() });
      });
      res.json({ links });
    } catch (err) {
      console.error('[release-status] Failed to fetch release links:', err.message);
      res.status(500).json({ error: 'Failed to fetch release links' });
    }
  });
};

module.exports.invalidateReleaseStatusCaches = () => {
  releaseStatusPayloadCache.invalidate();
  releaseLinksPayloadCache.invalidate();
};

module.exports._testExports = {
  SCAN_JQL,
  ALL_CHILD_TASKS_JQL,
  MARKER_TRIGGERED,
  CONSOLE_BASE_URL,
  SUMO_UI_BASE_URL,
  parseMetadata,
  productGroup,
  transformEpic,
  groupEpics,
  parsePipelineRunRef,
  sumoLogsUrl,
  fetchPipelineRunRef,
  jiraKeysIn,
  matchMergeRequests,
  attributeMergeRequests,
  titleMentionsRelease,
  isVersionBumpCard,
  matchVersionBumpMergeRequests,
  buildReleaseLinks,
  buildReleaseStatus,
  createPayloadCache,
  clearPipelineRunCommentCache: () => pipelineRunCommentCache.clear(),
};
