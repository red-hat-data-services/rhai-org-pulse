/** Read-only OpenSearch client for workflow-validation telemetry. */

const DEFAULT_URL = 'http://localhost:9200';
const DEFAULT_TIMEOUT_MS = 15_000;
const RUNS_INDEX = 'workflow-executions';
const TASKS_INDEX = 'workflow-task-executions';
const BUGS_INDEX = 'workflow-root-causes';

function getOpenSearchConfig(secrets = {}, env = process.env) {
  const rawUrl = String(env.WORKFLOW_VALIDATION_OPENSEARCH_URL || DEFAULT_URL).replace(/\/+$/, '');
  let parsedUrl;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    throw new Error('WORKFLOW_VALIDATION_OPENSEARCH_URL must be a valid HTTP(S) URL');
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
    throw new Error('WORKFLOW_VALIDATION_OPENSEARCH_URL must be a credential-free HTTP(S) URL');
  }
  const url = parsedUrl.href.replace(/\/+$/, '');
  const username = secrets.WORKFLOW_VALIDATION_OPENSEARCH_USERNAME || '';
  const password = secrets.WORKFLOW_VALIDATION_OPENSEARCH_PASSWORD || '';
  return { url, username, password, authenticated: !!(username && password) };
}

function createOpenSearchClient(config = {}, fetchImpl = fetch) {
  const url = String(config.url || DEFAULT_URL).replace(/\/+$/, '');
  const username = config.username || '';
  const password = config.password || '';
  const timeoutMs = config.timeoutMs || DEFAULT_TIMEOUT_MS;
  if ((username && !password) || (!username && password)) {
    throw new Error('OpenSearch username and password must be configured together');
  }

  function requestHeaders() {
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (username && password) {
      headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
    }
    return headers;
  }

  async function request(path, options = {}) {
    let response;
    try {
      response = await fetchImpl(`${url}${path}`, {
        ...options,
        headers: { ...requestHeaders(), ...(options.headers || {}) },
        signal: options.signal || AbortSignal.timeout(timeoutMs)
      });
    } catch (err) {
      const wrapped = new Error(`Cannot reach OpenSearch: ${err.message}`);
      wrapped.code = 'OS_UNREACHABLE';
      throw wrapped;
    }
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const wrapped = new Error(`OpenSearch request failed with ${response.status}: ${body.slice(0, 300)}`);
      wrapped.code = response.status === 401 || response.status === 403 ? 'OS_AUTH' : 'OS_ERROR';
      wrapped.status = response.status;
      throw wrapped;
    }
    return response.json();
  }

  const search = (index, body) => request(`/${index}/_search`, {
    method: 'POST', body: JSON.stringify(body)
  });

  async function status() {
    const count = async (index) => (await request(`/${index}/_count`)).count;
    const [executions, tasks, rootCauses] = await Promise.all([
      count(RUNS_INDEX), count(TASKS_INDEX), count(BUGS_INDEX)
    ]);
    return { executions, tasks, rootCauses };
  }

  return { search, status };
}

function boolQuery(filter, must) {
  const bool = {};
  if (filter.length) bool.filter = filter;
  if (must.length) bool.must = must;
  return Object.keys(bool).length ? { bool } : { match_all: {} };
}

function timestampRange(q = {}) {
  if (!q.dateFrom && !q.dateTo) return null;
  const range = {};
  if (q.dateFrom) range.gte = q.dateFrom;
  if (q.dateTo) {
    range.lte = /^\d{4}-\d{2}-\d{2}$/.test(q.dateTo)
      ? `${q.dateTo}T23:59:59.999Z`
      : q.dateTo;
  }
  return { range: { timestamp: range } };
}

function commonFilters(q = {}, { includeVerdict = true } = {}) {
  const filter = [];
  const must = [];
  if (q.version) filter.push({ term: { rhoai_version: q.version } });
  if (includeVerdict && q.verdict === 'UNSUCCESSFUL') {
    filter.push({ terms: { verdict: ['FAIL', 'ERROR'] } });
  } else if (includeVerdict && q.verdict) {
    filter.push({ term: { verdict: q.verdict } });
  }
  if (q.provider) filter.push({ term: { inference_provider: q.provider } });
  if (q.model) filter.push({ term: { model: q.model } });
  if (q.workflow) filter.push({ term: { workflow: q.workflow } });
  if (q.testSuite) filter.push({ term: { telemetry_suite: q.testSuite } });
  if (q.invocationId) filter.push({ term: { invocation_id: q.invocationId } });
  const dateFilter = timestampRange(q);
  if (dateFilter) filter.push(dateFilter);
  return { filter, must };
}

function runFilters(q = {}) {
  const { filter, must } = commonFilters(q);
  if (q.q) {
    const value = `*${String(q.q).replace(/[\\*?]/g, '\\$&')}*`;
    must.push({ bool: { should: [
      { wildcard: { workflow: { value, case_insensitive: true } } },
      { wildcard: { workflow_label: { value, case_insensitive: true } } }
    ], minimum_should_match: 1 } });
  }
  return boolQuery(filter, must);
}

function bugFilters(q = {}) {
  const filter = [];
  const must = [];
  if (q.version) filter.push({ term: { rhoai_version: q.version } });
  if (q.testSuite) filter.push({ term: { telemetry_suite: q.testSuite } });
  if (q.category) filter.push({ term: { category: q.category } });
  if (q.action) filter.push({ term: { action: q.action } });
  if (q.opened === 'true' || q.opened === 'false') filter.push({ term: { opened: q.opened === 'true' } });
  if (q.workflow) {
    filter.push({ bool: { should: [
      { term: { workflow: q.workflow } },
      { term: { impacted_workflows: q.workflow } }
    ], minimum_should_match: 1 } });
  }
  const dateFilter = timestampRange(q);
  if (dateFilter) filter.push(dateFilter);
  if (q.q) {
    const value = `*${String(q.q).replace(/[\\*?]/g, '\\$&')}*`;
    must.push({ bool: { should: [
      { match: { error_summary: q.q } },
      { match: { reasoning: q.q } },
      { wildcard: { bug_key: { value, case_insensitive: true } } },
      { wildcard: { workflow: { value, case_insensitive: true } } },
      { wildcard: { component: { value, case_insensitive: true } } },
      { wildcard: { rhoaieng_component: { value, case_insensitive: true } } }
    ], minimum_should_match: 1 } });
  }
  return boolQuery(filter, must);
}

function taskFilters(q = {}) {
  // A workflow execution verdict is not a task status. The route layer joins
  // verdict-filtered executions to task documents through execution_id.
  const { filter, must } = commonFilters(q, { includeVerdict: false });
  if (q.q) must.push({ match: { reason: q.q } });
  return boolQuery(filter, must);
}

module.exports = {
  RUNS_INDEX, TASKS_INDEX, BUGS_INDEX,
  getOpenSearchConfig, createOpenSearchClient,
  runFilters, taskFilters, bugFilters, timestampRange
};
