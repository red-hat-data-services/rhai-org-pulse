/** Resolve recorded run associations and exclude Jira tickets labelled Internal. */
const { readAll } = require('./opensearch');
const INTERNAL_LABEL = 'rca-scope-internal';
const LABEL_FILTER = `(labels IS EMPTY OR labels NOT IN ("${INTERNAL_LABEL}"))`;
const CACHE_MS = 60_000;
const MAX_CACHE_KEYS = 2000;
const JIRA_BATCH_SIZE = 100;
const LOOKUP_TIMEOUT_MS = 10_000;

const identity = (row) => JSON.stringify([row.suite, row.invocationId]);

/** Build the same Jira search for a row or a summary of verified keys. */
function bugSearchUrl(host, keys) {
  if (!keys.length) return null;
  try {
    const url = new URL('/issues/', host);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    url.searchParams.set('jql', `key IN (${keys.join(', ')}) AND ${LABEL_FILTER}`);
    return url.href;
  } catch { return null; }
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
  async function labelsFor(keys, refresh, lookup) {
    const client = getJiraClient();
    if (client !== cachedClient) { cache.clear(); cachedClient = client; }
    lookup.host = client.JIRA_HOST;
    const { decisions } = lookup;
    const pending = [];
    for (const key of keys) {
      const entry = !refresh && cache.get(key);
      if (entry && entry.expiresAt > Date.now()) decisions.set(key, entry.eligible);
      else pending.push(key);
    }
    const current = ++generation;
    for (let offset = 0; offset < pending.length; offset += JIRA_BATCH_SIZE) {
      if (lookup.stopped) return;
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
        // A timed-out lookup must not publish late results or start more requests.
        if (lookup.stopped) return;
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
  }

  /** Resolve a bounded set of runs; never infer Internal scope from RCA category. */
  return async function bugTickets(rows, { search, refresh = false, isClosed = () => false, includeKeys = false }) {
    if (!rows.length) return rows;
    const result = (row, bugTickets, keys) => {
      const complete = bugTickets.status !== 'unavailable';
      return { ...row, bugTickets, ...(includeKeys ? { bugs: complete ? keys.length : null,
        hasBugs: keys.length ? true : complete ? false : null, _bugKeys: keys, _bugKeysIncomplete: !complete } : {}) };
    };
    const unavailable = (row, keys = []) => result(row, { status: 'unavailable' }, keys);
    try {
      const executionRows = await readAll(search, 'workflow-executions', {
        query: { bool: { should: rows.map(row => ({ bool: { filter: [
          { term: { telemetry_suite: row.suite } }, { term: { invocation_id: row.invocationId } }
        ] } })), minimum_should_match: 1 } },
        sort: [{ timestamp: 'asc' }, { execution_id: 'asc' }],
        _source: ['telemetry_suite', 'invocation_id', 'workflow']
      }, isClosed);
      const scopes = new Map(rows.map(row => [identity(row), { workflows: new Set(), keys: new Set(), unknown: false }]));
      const byInvocation = new Map();
      for (const row of rows) {
        if (!byInvocation.has(row.invocationId)) byInvocation.set(row.invocationId, []);
        byInvocation.get(row.invocationId).push(row);
      }
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
        for (const row of byInvocation.get(finding.run_id) || []) {
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
      // Completed batches and cache hits remain readable if a later batch fails.
      const lookup = { decisions: new Map(), stopped: false };
      if (keys.length) {
        try { await withinDeadline(labelsFor(keys, refresh, lookup)); }
        catch { /* Unverified labels remain unknown; metadata and other row states survive. */ }
        finally { lookup.stopped = true; }
      }
      const { decisions, host } = lookup;
      if (isClosed()) return rows.map(row => unavailable(row));
      return rows.map(row => {
        const scope = scopes.get(identity(row));
        const eligible = [...scope.keys].filter(key => decisions.get(key)).sort();
        if (!scope.workflows.size || scope.unknown || [...scope.keys].some(key => !decisions.has(key))) return unavailable(row, eligible);
        if (!eligible.length) return result(row, { status: 'empty' }, []);
        const url = bugSearchUrl(host, eligible);
        if (!url) return unavailable(row);
        return result(row, { status: 'ready', url }, eligible);
      });
    } catch { return rows.map(row => unavailable(row)); }
  };
}

module.exports = { createBugTickets, bugSearchUrl };
