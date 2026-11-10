/** Resolve recorded run associations and exclude Jira tickets labelled Internal. */
const INTERNAL_LABEL = 'rca-scope-internal';
const LABEL_FILTER = `(labels IS EMPTY OR labels NOT IN ("${INTERNAL_LABEL}"))`;
const CACHE_MS = 60_000;
const MAX_CACHE_KEYS = 2000;
const JIRA_BATCH_SIZE = 100;
const LOOKUP_TIMEOUT_MS = 10_000;

const identity = (row) => JSON.stringify([row.suite, row.invocationId]);
const unavailable = (row) => ({ ...row, bugTickets: { status: 'unavailable' } });

/** Read every matching OpenSearch page without broadening the supplied run scope. */
async function readAll(search, index, body, isClosed) {
  const results = [];
  let after;
  do {
    if (isClosed()) throw new Error('Request closed');
    const response = await search(index, { ...body, size: 500, ...(after ? { search_after: after } : {}) });
    if (response.timed_out || response._shards?.failed) throw new Error('Incomplete search');
    const hits = response.hits?.hits;
    if (!Array.isArray(hits)) throw new Error('Invalid search response');
    results.push(...hits.map(hit => hit._source || {}));
    after = hits.length === 500 ? hits.at(-1)?.sort : null;
    if (hits.length === 500 && !after) throw new Error('Missing search cursor');
  } while (after);
  return results;
}

/** Bound the page's wait for Jira, including shared-client retries. */
async function withinDeadline(task) {
  let timer;
  try {
    return await Promise.race([
      task,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Jira lookup timed out')), LOOKUP_TIMEOUT_MS); })
    ]);
  } finally { clearTimeout(timer); }
}

/** Cache only verified label decisions, isolated to the configured Jira client. */
function createBugTickets({ getJiraClient }) {
  const cache = new Map();
  let cachedClient;
  let generation = 0;

  /** Fetch labels in bounded batches; missing or inaccessible tickets stay unknown. */
  async function labelsFor(keys, refresh) {
    const client = getJiraClient();
    if (client !== cachedClient) { cache.clear(); cachedClient = client; }
    const decisions = new Map();
    const pending = [];
    for (const key of keys) {
      const entry = !refresh && cache.get(key);
      if (entry && entry.expiresAt > Date.now()) decisions.set(key, entry.eligible);
      else pending.push(key);
    }
    const current = ++generation;
    for (let offset = 0; offset < pending.length; offset += JIRA_BATCH_SIZE) {
      const batch = pending.slice(offset, offset + JIRA_BATCH_SIZE);
      const wanted = new Set(batch);
      const verified = new Map();
      const seenTokens = new Set();
      let token;
      do {
        const page = await client.jiraRequest('/rest/api/3/search/jql', {
          method: 'POST',
          body: {
            jql: `key IN (${batch.join(', ')})`, fields: ['labels'], maxResults: JIRA_BATCH_SIZE,
            ...(token ? { nextPageToken: token } : {})
          }
        });
        if (!Array.isArray(page.issues)) throw new Error('Invalid Jira response');
        for (const issue of page.issues) {
          const key = issue.key;
          const labels = issue.fields?.labels;
          if (wanted.has(key) && Array.isArray(labels) && labels.every(label => typeof label === 'string')) {
            verified.set(key, !labels.includes(INTERNAL_LABEL));
          }
        }
        token = page.isLast === false ? page.nextPageToken : null;
        if (page.isLast === false && (!token || seenTokens.has(token))) throw new Error('Incomplete Jira pagination');
        if (token) seenTokens.add(token);
      } while (token);
      for (const [key, eligible] of verified) {
        decisions.set(key, eligible);
        if ((cache.get(key)?.generation || 0) <= current && cachedClient === client) {
          cache.delete(key);
          cache.set(key, { eligible, generation: current, expiresAt: Date.now() + CACHE_MS });
        }
      }
      while (cache.size > MAX_CACHE_KEYS) cache.delete(cache.keys().next().value);
    }
    return { decisions, host: client.JIRA_HOST };
  }

  /** Enrich only one displayed page; never infer Internal scope from RCA category. */
  return async function bugTickets(rows, { search, refresh = false, isClosed = () => false }) {
    if (!rows.length) return rows;
    try {
      const executionRows = await readAll(search, 'workflow-executions', {
        query: { bool: { should: rows.map(row => ({ bool: { filter: [
          { term: { telemetry_suite: row.suite } }, { term: { invocation_id: row.invocationId } }
        ] } })), minimum_should_match: 1 } },
        sort: [{ timestamp: 'asc' }, { execution_id: 'asc' }],
        _source: ['telemetry_suite', 'invocation_id', 'workflow']
      }, isClosed);
      const scopes = new Map(rows.map(row => [identity(row), { workflows: new Set(), keys: new Set(), unknown: false }]));
      for (const execution of executionRows) {
        const scope = scopes.get(identity({ suite: execution.telemetry_suite, invocationId: execution.invocation_id }));
        if (!scope) continue;
        if (typeof execution.workflow === 'string' && execution.workflow) scope.workflows.add(execution.workflow);
        else scope.unknown = true;
      }
      const findings = await readAll(search, 'workflow-root-causes', {
        query: { bool: { filter: [
          { terms: { run_id: [...new Set(rows.map(row => row.invocationId))] } },
          { exists: { field: 'bug_key' } }
        ] } },
        sort: [{ timestamp: 'asc' }, { root_cause_id: 'asc' }],
        _source: ['run_id', 'workflow', 'impacted_workflows', 'bug_key']
      }, isClosed);
      for (const finding of findings) {
        const workflows = [finding.workflow, ...(Array.isArray(finding.impacted_workflows) ? finding.impacted_workflows : [])]
          .filter(value => typeof value === 'string' && value);
        for (const row of rows) {
          if (finding.run_id !== row.invocationId) continue;
          const scope = scopes.get(identity(row));
          if (!workflows.length) { scope.unknown = true; continue; }
          if (!workflows.some(workflow => scope.workflows.has(workflow))) continue;
          const key = typeof finding.bug_key === 'string' ? finding.bug_key.trim().toUpperCase() : '';
          if (!key) continue;
          if (!/^[A-Z][A-Z0-9_]*-\d+$/.test(key)) { scope.unknown = true; continue; }
          scope.keys.add(key);
        }
      }
      const keys = [...new Set([...scopes.values()].flatMap(scope => [...scope.keys]))].sort();
      let decisions = new Map();
      let host;
      if (keys.length) {
        try { ({ decisions, host } = await withinDeadline(labelsFor(keys, refresh))); }
        catch { /* Unverified labels remain unknown; metadata and other row states survive. */ }
      }
      if (isClosed()) return rows.map(unavailable);
      return rows.map(row => {
        const scope = scopes.get(identity(row));
        if (!scope.workflows.size || scope.unknown || [...scope.keys].some(key => !decisions.has(key))) return unavailable(row);
        const eligible = [...scope.keys].filter(key => decisions.get(key)).sort();
        if (!eligible.length) return { ...row, bugTickets: { status: 'empty' } };
        const url = new URL('/issues/', host);
        if (url.protocol !== 'https:' || url.username || url.password) return unavailable(row);
        url.searchParams.set('jql', `key IN (${eligible.join(', ')}) AND ${LABEL_FILTER}`);
        return { ...row, bugTickets: { status: 'ready', url: url.href } };
      });
    } catch { return rows.map(unavailable); }
  };
}

module.exports = { createBugTickets };
