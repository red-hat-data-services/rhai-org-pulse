/**
 * OpenSearch access layer for the Workflow Validation module.
 *
 * The app is a display layer: OpenSearch holds the pre-computed run/bug
 * documents (loaded by an external pipeline). We proxy read-only aggregation
 * and search queries server-side so the browser never talks to OpenSearch
 * directly (avoids CORS and keeps the endpoint private).
 *
 * OPENSEARCH_URL is non-secret configuration — the local POC cluster has the
 * security plugin disabled (plain HTTP, no auth).
 */

const OS_URL = (process.env.OPENSEARCH_URL || 'http://localhost:9200').replace(/\/$/, '');

const RUNS_INDEX = 'workflow-executions';
const TASKS_INDEX = 'workflow-task-executions';
const BUGS_INDEX = 'workflow-root-causes';

/**
 * Execute a `_search` against an OpenSearch index.
 * @param {string} index
 * @param {object} body Query DSL body
 * @returns {Promise<object>} Parsed response
 */
async function osSearch(index, body) {
  let res;
  try {
    res = await fetch(`${OS_URL}/${index}/_search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (err) {
    const e = new Error(`Cannot reach OpenSearch at ${OS_URL}: ${err.message}`);
    e.code = 'OS_UNREACHABLE';
    throw e;
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const e = new Error(`OpenSearch ${res.status} on ${index}: ${text.slice(0, 300)}`);
    e.code = 'OS_ERROR';
    e.status = res.status;
    throw e;
  }
  return res.json();
}

/** Simple connectivity + doc-count probe. */
async function osStatus() {
  const count = async (index) => {
    const res = await fetch(`${OS_URL}/${index}/_count`);
    if (!res.ok) throw new Error(`count ${index} -> ${res.status}`);
    const json = await res.json();
    return json.count;
  };
  const [executions, tasks, rootCauses] = await Promise.all([
    count(RUNS_INDEX), count(TASKS_INDEX), count(BUGS_INDEX)
  ]);
  return { url: OS_URL, executions, tasks, rootCauses };
}

/**
 * Build the shared bool.filter/must clauses for the RUNS index from query params.
 * @param {object} q Express req.query
 */
function runFilters(q = {}) {
  const filter = [];
  const must = [];
  if (q.version) filter.push({ term: { rhoai_version: q.version } });
  if (q.verdict) filter.push({ term: { verdict: q.verdict } });
  if (q.provider) filter.push({ term: { inference_provider: q.provider } });
  if (q.model) filter.push({ term: { model: q.model } });
  if (q.workflow) filter.push({ term: { workflow_label: q.workflow } });
  if (q.dateFrom || q.dateTo) {
    const range = {};
    if (q.dateFrom) range.gte = q.dateFrom;
    if (q.dateTo) range.lte = q.dateTo;
    filter.push({ range: { timestamp: range } });
  }
  if (q.q) must.push({ match: { summary_text: q.q } });
  const bool = {};
  if (filter.length) bool.filter = filter;
  if (must.length) bool.must = must;
  return Object.keys(bool).length ? { bool } : { match_all: {} };
}

/** Build bool query for the BUGS index (subset of run filters that apply). */
function bugFilters(q = {}) {
  const filter = [];
  const must = [];
  if (q.version) filter.push({ term: { rhoai_version: q.version } });
  if (q.category) filter.push({ term: { category: q.category } });
  if (q.action) filter.push({ term: { action: q.action } });
  if (q.opened === 'true') filter.push({ term: { opened: true } });
  if (q.workflow) filter.push({ term: { workflow: q.workflow } });
  if (q.dateFrom || q.dateTo) {
    const range = {};
    if (q.dateFrom) range.gte = q.dateFrom;
    if (q.dateTo) range.lte = q.dateTo;
    filter.push({ range: { timestamp: range } });
  }
  if (q.q) must.push({ match: { error_summary: q.q } });
  const bool = {};
  if (filter.length) bool.filter = filter;
  if (must.length) bool.must = must;
  return Object.keys(bool).length ? { bool } : { match_all: {} };
}

/** Filters for independently indexed task executions. */
function taskFilters(q = {}) {
  const filter = [];
  const must = [];
  if (q.version) filter.push({ term: { rhoai_version: q.version } });
  if (q.verdict) filter.push({ term: { status: q.verdict } });
  if (q.provider) filter.push({ term: { inference_provider: q.provider } });
  if (q.model) filter.push({ term: { model: q.model } });
  if (q.workflow) filter.push({ term: { workflow_label: q.workflow } });
  if (q.dateFrom || q.dateTo) {
    const range = {};
    if (q.dateFrom) range.gte = q.dateFrom;
    if (q.dateTo) range.lte = q.dateTo;
    filter.push({ range: { timestamp: range } });
  }
  if (q.q) must.push({ match: { reason: q.q } });
  const bool = {};
  if (filter.length) bool.filter = filter;
  if (must.length) bool.must = must;
  return Object.keys(bool).length ? { bool } : { match_all: {} };
}

module.exports = {
  OS_URL,
  RUNS_INDEX,
  TASKS_INDEX,
  BUGS_INDEX,
  osSearch,
  osStatus,
  runFilters,
  taskFilters,
  bugFilters
};
