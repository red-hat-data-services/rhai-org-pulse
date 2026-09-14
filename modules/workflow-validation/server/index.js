/**
 * Workflow Validation module — server routes.
 *
 * Read-only proxy over workflow execution, task execution, and root-cause indices.
 * All heavy aggregation happens in OpenSearch; these handlers just
 * shape query bodies and project the response for the UI.
 */

const {
  RUNS_INDEX,
  TASKS_INDEX,
  BUGS_INDEX,
  getOpenSearchConfig,
  createOpenSearchClient,
  runFilters,
  bugFilters
} = require('./opensearch');

/** Wrap an async handler so OpenSearch connectivity errors become clean HTTP responses. */
function safe(handler) {
  return async function (req, res) {
    try {
      await handler(req, res);
    } catch (err) {
      if (err.code === 'BAD_REQUEST') {
        return res.status(400).json({ error: err.message, code: err.code });
      }
      if (err.code === 'OS_UNREACHABLE') {
        return res.status(503).json({ error: err.message, code: 'OS_UNREACHABLE' });
      }
      if (err.code === 'OS_AUTH') {
        return res.status(502).json({ error: 'OpenSearch authentication failed', code: 'OS_AUTH' });
      }
      return res.status(502).json({ error: err.message || 'OpenSearch query failed' });
    }
  };
}

const bucketList = (agg) => (agg && agg.buckets ? agg.buckets : []);
const valueOrNull = (agg) => agg?.value ?? null;

function decodeCursor(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (!Array.isArray(parsed)) throw new Error('not an array');
    return parsed;
  } catch {
    const err = new Error('Invalid pagination cursor');
    err.code = 'BAD_REQUEST';
    throw err;
  }
}

const encodeCursor = (sort) => sort ? Buffer.from(JSON.stringify(sort)).toString('base64url') : null;

function addFilter(query, clause) {
  if (!clause) return query;
  if (query.match_all) return { bool: { filter: [clause] } };
  const bool = { ...(query.bool || {}) };
  bool.filter = [...(bool.filter || []), clause];
  return { bool };
}

module.exports = function registerRoutes(router, context) {
  const { requireAuth } = context;
  const openSearchConfig = getOpenSearchConfig(context.secrets);
  const openSearch = createOpenSearchClient(openSearchConfig);
  const osSearch = openSearch.search;

  if (context.registerSecretValidator) {
    context.registerSecretValidator('WORKFLOW_VALIDATION_OPENSEARCH_PASSWORD', async function() {
      try {
        await openSearch.status();
        return { valid: true, message: 'Read-only OpenSearch indices are reachable' };
      } catch (err) {
        const message = err.code === 'OS_AUTH'
          ? 'OpenSearch rejected the read-only credentials'
          : 'OpenSearch indices are not reachable';
        return { valid: false, message };
      }
    });
  }

  if (context.registerDiagnostics) {
    context.registerDiagnostics(async function() {
      try {
        const counts = await openSearch.status();
        return {
          status: 'ok',
          endpoint: openSearchConfig.url,
          authenticationConfigured: openSearchConfig.authenticated,
          indices: counts
        };
      } catch (err) {
        return {
          status: 'unavailable',
          endpoint: openSearchConfig.url,
          authenticationConfigured: openSearchConfig.authenticated,
          errorCode: err.code || 'OS_ERROR'
        };
      }
    });
  }

  async function searchAll(index, body, pageSize = 500) {
    const hits = [];
    let searchAfter;
    do {
      const response = await osSearch(index, {
        ...body,
        size: pageSize,
        ...(searchAfter ? { search_after: searchAfter } : {})
      });
      const page = response.hits?.hits || [];
      hits.push(...page);
      searchAfter = page.length === pageSize ? page.at(-1)?.sort : null;
    } while (searchAfter);
    return hits;
  }

  async function executionLinks(q) {
    const hits = await searchAll(RUNS_INDEX, {
      query: runFilters(q),
      sort: [{ timestamp: 'asc' }, { execution_id: 'asc' }],
      _source: ['execution_id', 'run_id', 'workflow']
    });
    return hits.map((hit) => hit._source || {});
  }

  async function rootCauseQuery(q) {
    let query = bugFilters(q);
    if (q.verdict || q.provider || q.model) {
      const links = await executionLinks({ ...q, q: '' });
      const runIds = [...new Set(links.map((link) => link.run_id).filter(Boolean))];
      const workflows = [...new Set(links.map((link) => link.workflow).filter(Boolean))];
      const correlation = runIds.length ? { bool: { filter: [
        { terms: { run_id: runIds } },
        ...(workflows.length ? [{ bool: { should: [
          { terms: { workflow: workflows } }
        ], minimum_should_match: 1 } }] : [])
      ] } } : null;
      query = correlation
        ? addFilter(query, correlation)
        : { match_none: {} };
    }
    return query;
  }

  async function productBugFindings(q, { runIds = [], workflows = [] } = {}) {
    if (!runIds.length && !workflows.length) return [];
    const bugParams = { ...q, q: '', category: '', action: '', opened: '' };
    let query = addFilter(bugFilters(bugParams), { term: { category: 'PRODUCT_BUG' } });
    if (runIds.length) query = addFilter(query, { terms: { run_id: runIds } });
    if (workflows.length) {
      query = addFilter(query, { bool: { should: [
        { terms: { workflow: workflows } }
      ], minimum_should_match: 1 } });
    }
    const hits = await searchAll(BUGS_INDEX, {
      query,
      sort: [{ timestamp: 'desc' }, { root_cause_id: 'asc' }],
      _source: [
        'root_cause_id', 'run_id', 'workflow', 'impacted_workflows',
        'category', 'action', 'opened', 'bug_key', 'jira_url', 'status', 'error_summary'
      ]
    });
    return hits.map((hit) => ({ id: hit._id, ...hit._source }));
  }

  function productBugsForTest(findings, test) {
    return findings.filter((finding) => (!test.run_id || finding.run_id === test.run_id) && (
      !test.workflow || finding.workflow === test.workflow
    ));
  }

  async function sumInfraCost(query) {
    let total = 0;
    let after;
    do {
      const response = await osSearch(RUNS_INDEX, {
        size: 0,
        query,
        aggs: {
          runs: {
            composite: {
              size: 1000,
              sources: [{ runId: { terms: { field: 'run_id' } } }],
              ...(after ? { after } : {})
            },
            aggs: { infraCost: { max: { field: 'infra_cost_usd' } } }
          }
        }
      });
      const aggregation = response.aggregations?.runs;
      for (const bucket of bucketList(aggregation)) {
        if (bucket.infraCost?.value != null) total += bucket.infraCost.value;
      }
      after = aggregation?.after_key;
    } while (after);
    const coverage = await osSearch(RUNS_INDEX, {
      size: 0,
      query,
      aggs: {
        values: { value_count: { field: 'infra_cost_usd' } },
        linkable: { filter: { exists: { field: 'run_id' } }, aggs: {
          values: { value_count: { field: 'infra_cost_usd' } }
        } }
      }
    });
    const values = coverage.aggregations?.values?.value || 0;
    const linkable = coverage.aggregations?.linkable?.values?.value || 0;
    return values > 0 && values === linkable ? total : null;
  }

  /**
   * @openapi
   * /api/modules/workflow-validation/status:
   *   get:
   *     summary: OpenSearch connectivity and document counts
   *     tags: [Workflow Validation]
   *     responses:
   *       200: { description: Status with run/bug counts }
   *       503: { description: OpenSearch unreachable }
   */
  router.get('/status', requireAuth, safe(async function (req, res) {
    const status = await openSearch.status();
    res.json({ ok: true, ...status });
  }));

  /**
   * @openapi
   * /api/modules/workflow-validation/filters:
   *   get:
   *     summary: Distinct values for the filter bar (versions, providers, workflows)
   *     tags: [Workflow Validation]
   *     responses:
   *       200: { description: Filter option lists }
   */
  router.get('/filters', requireAuth, safe(async function (req, res) {
    const body = {
      size: 0,
      aggs: {
        versions: { terms: { field: 'rhoai_version', size: 100 } },
        providers: { terms: { field: 'inference_provider', size: 20 } },
        models: { terms: { field: 'model', size: 30 } },
        workflows: {
          terms: { field: 'workflow', size: 100, order: { _key: 'asc' } },
          aggs: { label: { terms: { field: 'workflow_label', size: 1 } } }
        }
      }
    };
    const r = await osSearch(RUNS_INDEX, body);
    const a = r.aggregations || {};
    res.json({
      versions: bucketList(a.versions).map((b) => ({ value: b.key, count: b.doc_count })),
      providers: bucketList(a.providers).map((b) => ({ value: b.key, count: b.doc_count })),
      models: bucketList(a.models).map((b) => ({ value: b.key, count: b.doc_count })),
      workflows: bucketList(a.workflows).map((b) => ({
        value: b.key,
        label: b.label?.buckets?.[0]?.key || b.key,
        count: b.doc_count
      }))
    });
  }));

  /**
   * @openapi
   * /api/modules/workflow-validation/overview:
   *   get:
   *     summary: Headline KPIs across runs and bugs (respects filters)
   *     tags: [Workflow Validation]
   *     parameters:
   *       - { in: query, name: version, schema: { type: string } }
   *       - { in: query, name: verdict, schema: { type: string, enum: [PASS, FAIL, ERROR, UNSUCCESSFUL] } }
   *       - { in: query, name: provider, schema: { type: string } }
   *       - { in: query, name: q, schema: { type: string }, description: Partial test or workflow name }
   *       - { in: query, name: dateFrom, schema: { type: string, format: date } }
   *       - { in: query, name: dateTo, schema: { type: string, format: date } }
   *     responses:
   *       200: { description: KPI object }
   */
  router.get('/overview', requireAuth, safe(async function (req, res) {
    const runsBody = {
      size: 0,
      query: runFilters(req.query),
      aggs: {
        runs: { value_count: { field: 'execution_id' } },
        pass_rate: { avg: { field: 'passed_int' } },
        passed: { filter: { term: { passed: true } } },
        failed: { filter: { term: { verdict: 'FAIL' } } },
        errors: { filter: { term: { verdict: 'ERROR' } } },
        tasks_total: { sum: { field: 'tasks_total' } },
        tasks_total_count: { value_count: { field: 'tasks_total' } },
        tasks_passed: { sum: { field: 'tasks_passed' } },
        tasks_passed_count: { value_count: { field: 'tasks_passed' } },
        tasks_failed: { sum: { field: 'tasks_failed' } },
        tasks_failed_count: { value_count: { field: 'tasks_failed' } },
        ai_cost: { sum: { field: 'cost_usd' } },
        ai_cost_count: { value_count: { field: 'cost_usd' } },
        avg_duration: { avg: { field: 'duration_s' } },
        turns: { sum: { field: 'num_turns' } },
        turns_count: { value_count: { field: 'num_turns' } },
        workflows: { cardinality: { field: 'workflow' } },
        versions: { cardinality: { field: 'rhoai_version' } }
      }
    };
    const bugsBody = {
      size: 0,
      query: addFilter(await rootCauseQuery(req.query), { term: { category: 'PRODUCT_BUG' } }),
      aggs: {
        total: { value_count: { field: 'root_cause_id' } },
        opened: { filter: { term: { opened: true } } },
        distinct_jira: { cardinality: { field: 'bug_key' } }
      }
    };
    const [runsR, bugsR, infraCost] = await Promise.all([
      osSearch(RUNS_INDEX, runsBody),
      osSearch(BUGS_INDEX, bugsBody),
      sumInfraCost(runsBody.query)
    ]);
    const ra = runsR.aggregations || {};
    const ba = bugsR.aggregations || {};
    const runCount = ra.runs?.value || 0;
    const completeSum = (sum, count) => count?.value === runCount ? valueOrNull(sum) : null;
    res.json({
      runs: {
        total: runCount,
        passRate: ra.pass_rate?.value ?? null,
        passed: ra.passed?.doc_count || 0,
        failed: ra.failed?.doc_count || 0,
        errors: ra.errors?.doc_count || 0,
        tasksTotal: completeSum(ra.tasks_total, ra.tasks_total_count),
        tasksPassed: completeSum(ra.tasks_passed, ra.tasks_passed_count),
        tasksFailed: completeSum(ra.tasks_failed, ra.tasks_failed_count),
        aiCost: completeSum(ra.ai_cost, ra.ai_cost_count),
        infraCost,
        avgDuration: valueOrNull(ra.avg_duration),
        turns: completeSum(ra.turns, ra.turns_count),
        workflows: ra.workflows?.value || 0,
        versions: ra.versions?.value || 0
      },
      bugs: {
        total: ba.total?.value || 0,
        opened: ba.opened?.doc_count || 0,
        distinctJira: ba.distinct_jira?.value || 0
      }
    });
  }));

  /**
   * @openapi
   * /api/modules/workflow-validation/charts:
   *   get:
   *     summary: Aggregations powering the dashboard charts (respects filters)
   *     tags: [Workflow Validation]
   *     parameters:
   *       - { in: query, name: version, schema: { type: string } }
   *       - { in: query, name: verdict, schema: { type: string } }
   *       - { in: query, name: provider, schema: { type: string } }
   *       - { in: query, name: dateFrom, schema: { type: string, format: date } }
   *       - { in: query, name: dateTo, schema: { type: string, format: date } }
   *     responses:
   *       200: { description: Chart series }
   */
  router.get('/charts', requireAuth, safe(async function (req, res) {
    const rootCauseFilter = await rootCauseQuery(req.query);
    const runsBody = {
      size: 0,
      query: runFilters(req.query),
      aggs: {
        over_time: {
          date_histogram: { field: 'timestamp', calendar_interval: 'day', min_doc_count: 1 },
          aggs: { verdict: { terms: { field: 'verdict' } } }
        },
        by_version: {
          terms: { field: 'rhoai_version', size: 50, order: { _key: 'asc' } },
          aggs: {
            pass_rate: { avg: { field: 'passed_int' } },
            runs: { value_count: { field: 'execution_id' } }
          }
        },
        by_workflow: {
          terms: { field: 'workflow', size: 100, order: { runs: 'desc' } },
          aggs: {
            runs: { value_count: { field: 'execution_id' } },
            pass_rate: { avg: { field: 'passed_int' } },
            ai_cost: { sum: { field: 'cost_usd' } },
            ai_cost_count: { value_count: { field: 'cost_usd' } },
            avg_dur: { avg: { field: 'duration_s' } },
            bugs: { sum: { field: 'bug_count' } },
            bugs_count: { value_count: { field: 'bug_count' } },
            label: { terms: { field: 'workflow_label', size: 1 } }
          }
        },
        by_provider: { terms: { field: 'inference_provider', size: 20 } }
      }
    };
    const bugsBody = {
      size: 0,
      query: rootCauseFilter,
      aggs: {
        by_category: { terms: { field: 'category', size: 20 } },
        by_action: { terms: { field: 'action', size: 20 } },
        by_component: { terms: { field: 'rhoaieng_component', size: 20 } }
      }
    };
    const failedTestsBody = {
      size: 5,
      query: addFilter(runFilters(req.query), { terms: { verdict: ['FAIL', 'ERROR'] } }),
      sort: [{ timestamp: 'desc' }, { execution_id: 'asc' }],
      _source: [
        'execution_id', 'run_id', 'workflow', 'workflow_label', 'rhoai_version',
        'timestamp', 'verdict', 'tasks_passed', 'tasks_failed', 'cost_usd'
      ]
    };
    const recentTestsBody = {
      size: 8,
      query: runFilters(req.query),
      sort: [{ timestamp: 'desc' }, { execution_id: 'asc' }],
      _source: [
        'execution_id', 'run_id', 'workflow', 'workflow_label', 'rhoai_version',
        'timestamp', 'verdict', 'tasks_passed', 'tasks_failed', 'cost_usd'
      ]
    };
    const recentProductBugsBody = {
      size: 5,
      query: addFilter(addFilter(rootCauseFilter,
        { term: { category: 'PRODUCT_BUG' } }),
      { term: { opened: true } }),
      sort: [{ timestamp: 'desc' }, { root_cause_id: 'asc' }],
      collapse: { field: 'bug_key' },
      _source: [
        'root_cause_id', 'bug_key', 'jira_url', 'error_summary',
        'workflow', 'rhoai_version', 'timestamp', 'severity', 'status'
      ]
    };
    const [runsR, bugsR, failedTestsR, recentTestsR, recentProductBugsR] = await Promise.all([
      osSearch(RUNS_INDEX, runsBody),
      osSearch(BUGS_INDEX, bugsBody),
      osSearch(RUNS_INDEX, failedTestsBody),
      osSearch(RUNS_INDEX, recentTestsBody),
      osSearch(BUGS_INDEX, recentProductBugsBody)
    ]);
    const failedTestHits = failedTestsR.hits?.hits || [];
    const recentTestHits = recentTestsR.hits?.hits || [];
    const dashboardTestHits = [...failedTestHits, ...recentTestHits];
    const dashboardRunIds = [...new Set(dashboardTestHits.map((hit) => hit._source?.run_id).filter(Boolean))];
    const dashboardWorkflows = [...new Set(dashboardTestHits.map((hit) => hit._source?.workflow).filter(Boolean))];
    let productBugHits = [];
    if (dashboardRunIds.length) {
      const issueParams = { ...req.query, q: '', category: '', action: '', opened: '' };
      let issueQuery = bugFilters(issueParams);
      issueQuery = addFilter(issueQuery, { terms: { run_id: dashboardRunIds } });
      issueQuery = addFilter(issueQuery, { term: { category: 'PRODUCT_BUG' } });
      if (dashboardWorkflows.length) {
        issueQuery = addFilter(issueQuery, { bool: { should: [
          { terms: { workflow: dashboardWorkflows } }
        ], minimum_should_match: 1 } });
      }
      const productBugsR = await osSearch(BUGS_INDEX, {
        size: 100,
        query: issueQuery,
        sort: [{ timestamp: 'desc' }, { root_cause_id: 'asc' }],
        _source: [
          'root_cause_id', 'run_id', 'workflow', 'impacted_workflows',
          'category', 'action', 'opened', 'bug_key', 'jira_url', 'status'
        ]
      });
      productBugHits = productBugsR.hits?.hits || [];
    }
    const a = runsR.aggregations || {};
    const b = bugsR.aggregations || {};
    const productBugsForTest = (run) => productBugHits
      .map((hit) => ({ id: hit._id, ...hit._source }))
      .filter((issue) => issue.run_id === run.run_id && (
        !run.workflow || issue.workflow === run.workflow
      ));
    res.json({
      overTime: bucketList(a.over_time).map((bkt) => ({
        date: bkt.key_as_string || bkt.key,
        total: bkt.doc_count,
        pass: (bucketList(bkt.verdict).find((v) => v.key === 'PASS') || {}).doc_count || 0,
        fail: (bucketList(bkt.verdict).find((v) => v.key === 'FAIL') || {}).doc_count || 0,
        error: (bucketList(bkt.verdict).find((v) => v.key === 'ERROR') || {}).doc_count || 0
      })),
      byVersion: bucketList(a.by_version).map((bkt) => ({
        version: bkt.key,
        runs: bkt.runs?.value || 0,
        passRate: bkt.pass_rate?.value ?? null
      })),
      byWorkflow: bucketList(a.by_workflow).map((bkt) => ({
        workflow: bkt.key,
        workflowLabel: bkt.label?.buckets?.[0]?.key || bkt.key,
        runs: bkt.runs?.value || 0,
        passRate: bkt.pass_rate?.value ?? null,
        aiCost: bkt.ai_cost_count?.value === bkt.doc_count ? valueOrNull(bkt.ai_cost) : null,
        avgDuration: valueOrNull(bkt.avg_dur),
        bugs: bkt.bugs_count?.value === bkt.doc_count ? valueOrNull(bkt.bugs) : null
      })),
      byProvider: bucketList(a.by_provider).map((bkt) => ({ provider: bkt.key, runs: bkt.doc_count })),
      bugsByCategory: bucketList(b.by_category).map((bkt) => ({ category: bkt.key, count: bkt.doc_count })),
      bugsByAction: bucketList(b.by_action).map((bkt) => ({ action: bkt.key, count: bkt.doc_count })),
      bugsByComponent: bucketList(b.by_component).map((bkt) => ({ component: bkt.key, count: bkt.doc_count })),
      failedTests: failedTestHits.map((hit) => {
        const test = { id: hit._id, ...hit._source };
        return { ...test, productBugs: productBugsForTest(test) };
      }),
      recentTests: recentTestHits.map((hit) => {
        const test = { id: hit._id, ...hit._source };
        return { ...test, productBugs: productBugsForTest(test) };
      }),
      recentProductBugs: (recentProductBugsR.hits?.hits || []).map((hit) => ({
        id: hit._id,
        ...hit._source
      }))
    });
  }));

  /**
   * @openapi
   * /api/modules/workflow-validation/runs:
   *   get:
   *     summary: Paginated list of test runs (newest first, respects filters)
   *     tags: [Workflow Validation]
   *     parameters:
   *       - { in: query, name: version, schema: { type: string } }
   *       - { in: query, name: verdict, schema: { type: string } }
   *       - { in: query, name: provider, schema: { type: string } }
   *       - { in: query, name: q, schema: { type: string }, description: Partial test or workflow name }
   *       - { in: query, name: dateFrom, schema: { type: string, format: date } }
   *       - { in: query, name: dateTo, schema: { type: string, format: date } }
   *       - { in: query, name: cursor, schema: { type: string }, description: Opaque search-after cursor }
   *       - { in: query, name: size, schema: { type: integer, default: 25 } }
   *     responses:
   *       200: { description: Runs page }
   */
  router.get('/runs', requireAuth, safe(async function (req, res) {
    const size = Math.min(parseInt(req.query.size, 10) || 25, 200);
    const searchAfter = decodeCursor(req.query.cursor);
    const sortableFields = {
      timestamp: 'timestamp', verdict: 'verdict', workflow: 'workflow',
      version: 'rhoai_version', tasks: 'tasks_passed', duration: 'duration_s'
    };
    const sortBy = sortableFields[req.query.sortBy] || 'timestamp';
    const sortDir = req.query.sortDir === 'asc' ? 'asc' : 'desc';
    const body = {
      size: size + 1,
      track_total_hits: true,
      query: runFilters(req.query),
      sort: [{ [sortBy]: { order: sortDir, missing: '_last' } }, { execution_id: 'asc' }],
      ...(searchAfter ? { search_after: searchAfter } : {}),
      _source: [
        'schema_version', 'identity_version', 'execution_id', 'invocation_id', 'run_id',
        'workflow', 'workflow_label', 'rhoai_version',
        'verdict', 'tasks_total', 'tasks_passed', 'tasks_failed',
        'cost_usd', 'infra_cost_usd', 'duration_s', 'num_turns', 'model',
        'inference_provider', 'bug_count', 'timestamp'
      ]
    };
    const r = await osSearch(RUNS_INDEX, body);
    const hits = r.hits?.hits || [];
    const pageHits = hits.slice(0, size);
    const runs = pageHits.map((h) => ({ id: h._id, ...h._source }));
    const productBugs = await productBugFindings(req.query, {
      runIds: [...new Set(runs.map((run) => run.run_id).filter(Boolean))],
      workflows: [...new Set(runs.map((run) => run.workflow).filter(Boolean))]
    });
    res.json({
      total: r.hits?.total?.value || 0,
      size,
      nextCursor: hits.length > size ? encodeCursor(pageHits.at(-1)?.sort) : null,
      runs: runs.map((run) => ({ ...run, productBugs: productBugsForTest(productBugs, run) }))
    });
  }));

  /**
   * @openapi
   * /api/modules/workflow-validation/runs/{executionId}:
   *   get:
   *     summary: Single run with its task list and linked bugs
   *     tags: [Workflow Validation]
   *     parameters:
   *       - { in: path, name: executionId, required: true, schema: { type: string } }
   *     responses:
   *       200: { description: Run detail }
   *       404: { description: Run not found }
   */
  router.get('/runs/:executionId', requireAuth, safe(async function (req, res) {
    const executionId = req.params.executionId;
    const runR = await osSearch(RUNS_INDEX, {
      size: 1,
      query: { term: { execution_id: executionId } }
    });
    const hit = (runR.hits?.hits || [])[0];
    if (!hit) return res.status(404).json({ error: `Run not found: ${executionId}` });
    const run = { id: hit._id, ...hit._source };

    const taskHits = await searchAll(TASKS_INDEX, {
      query: { term: { execution_id: executionId } },
      sort: [{ ordinal: 'asc' }, { task_execution_id: 'asc' }]
    });
    const tasks = taskHits.map((taskHit) => ({ id: taskHit._id, ...taskHit._source }));

    let bugs = [];
    if (run.run_id) {
      const bugHits = await searchAll(BUGS_INDEX, {
        query: { bool: { filter: [
          { term: { run_id: run.run_id } },
          ...(run.workflow ? [{ term: { workflow: run.workflow } }] : [])
        ] } },
        sort: [{ timestamp: 'desc' }, { root_cause_id: 'asc' }]
      });
      bugs = bugHits.map((h) => ({ id: h._id, ...h._source }));
    }
    res.json({ run, tasks, bugs });
  }));

  /**
   * @openapi
   * /api/modules/workflow-validation/bugs:
   *   get:
   *     summary: Paginated bug list with KPIs and breakdowns (respects filters)
   *     tags: [Workflow Validation]
   *     parameters:
   *       - { in: query, name: version, schema: { type: string } }
   *       - { in: query, name: category, schema: { type: string } }
   *       - { in: query, name: action, schema: { type: string } }
   *       - { in: query, name: opened, schema: { type: boolean } }
   *       - { in: query, name: q, schema: { type: string }, description: Failure summary text }
   *       - { in: query, name: dateFrom, schema: { type: string, format: date } }
   *       - { in: query, name: dateTo, schema: { type: string, format: date } }
   *       - { in: query, name: cursor, schema: { type: string }, description: Opaque search-after cursor }
   *       - { in: query, name: size, schema: { type: integer, default: 50 } }
   *     responses:
   *       200: { description: Bugs page with KPIs }
   */
  router.get('/bugs', requireAuth, safe(async function (req, res) {
    const size = Math.min(parseInt(req.query.size, 10) || 50, 200);
    const searchAfter = decodeCursor(req.query.cursor);
    const query = await rootCauseQuery(req.query);
    const body = {
      size: size + 1,
      track_total_hits: true,
      query,
      sort: [{ timestamp: 'desc' }, { root_cause_id: 'asc' }],
      ...(searchAfter ? { search_after: searchAfter } : {}),
      aggs: {
        total: { value_count: { field: 'root_cause_id' } },
        opened: { filter: { term: { opened: true } } },
        distinct_jira: { cardinality: { field: 'bug_key' } },
        by_category: { terms: { field: 'category', size: 20 } },
        by_action: { terms: { field: 'action', size: 20 } }
      }
    };
    const r = await osSearch(BUGS_INDEX, body);
    const a = r.aggregations || {};
    const hits = r.hits?.hits || [];
    const pageHits = hits.slice(0, size);
    const occurrenceRunIds = [...new Set(pageHits.map((hit) => hit._source?.run_id).filter(Boolean))];
    const linkedExecutions = occurrenceRunIds.length ? await searchAll(RUNS_INDEX, {
      query: { terms: { run_id: occurrenceRunIds } },
      sort: [{ timestamp: 'desc' }, { execution_id: 'asc' }],
      _source: ['execution_id', 'run_id', 'workflow']
    }) : [];
    const executionByOccurrence = new Map();
    for (const execution of linkedExecutions) {
      const source = execution._source || {};
      const key = `${source.run_id || ''}\u0000${source.workflow || ''}`;
      if (!executionByOccurrence.has(key)) executionByOccurrence.set(key, source.execution_id || execution._id);
    }
    res.json({
      total: r.hits?.total?.value || 0,
      size,
      nextCursor: hits.length > size ? encodeCursor(pageHits.at(-1)?.sort) : null,
      kpis: {
        total: a.total?.value || 0,
        opened: a.opened?.doc_count || 0,
        distinctJira: a.distinct_jira?.value || 0
      },
      byCategory: bucketList(a.by_category).map((b) => ({ category: b.key, count: b.doc_count })),
      byAction: bucketList(a.by_action).map((b) => ({ action: b.key, count: b.doc_count })),
      bugs: pageHits.map((h) => {
        const bug = h._source || {};
        const executionId = executionByOccurrence.get(`${bug.run_id || ''}\u0000${bug.workflow || ''}`);
        return { id: h._id, ...bug, ...(executionId ? { execution_id: executionId } : {}) };
      })
    });
  }));

  /**
   * @openapi
   * /api/modules/workflow-validation/workflows:
   *   get:
   *     summary: Per-workflow rollup — pass rate, latest result, cost, bugs (respects filters)
   *     tags: [Workflow Validation]
   *     parameters:
   *       - { in: query, name: version, schema: { type: string } }
   *       - { in: query, name: verdict, schema: { type: string } }
   *       - { in: query, name: q, schema: { type: string }, description: Partial workflow name }
   *       - { in: query, name: dateFrom, schema: { type: string, format: date } }
   *       - { in: query, name: dateTo, schema: { type: string, format: date } }
   *     responses:
   *       200: { description: Workflow rollup list }
   */
  router.get('/workflows', requireAuth, safe(async function (req, res) {
    const query = runFilters(req.query);
    const workflowBuckets = [];
    let after;
    do {
      const response = await osSearch(RUNS_INDEX, {
        size: 0,
        query,
        aggs: {
          by_workflow: {
            composite: {
              size: 200,
              sources: [{ workflow: { terms: { field: 'workflow' } } }],
              ...(after ? { after } : {})
            },
            aggs: {
              pass_rate: { avg: { field: 'passed_int' } },
              avg_dur: { avg: { field: 'duration_s' } },
              ai_cost: { sum: { field: 'cost_usd' } },
              ai_cost_count: { value_count: { field: 'cost_usd' } },
              bugs: { sum: { field: 'bug_count' } },
              bugs_count: { value_count: { field: 'bug_count' } },
              tags: { terms: { field: 'tags', size: 20 } },
              latest: { top_hits: {
                size: 1,
                sort: [{ timestamp: 'desc' }],
                _source: ['execution_id', 'workflow_label', 'verdict', 'timestamp', 'rhoai_version', 'tasks_passed', 'tasks_total']
              } }
            }
          }
        }
      });
      const aggregation = response.aggregations?.by_workflow;
      workflowBuckets.push(...bucketList(aggregation));
      after = aggregation?.after_key;
    } while (after);

    const tagCounts = new Map();
    for (const workflowBucket of workflowBuckets) {
      for (const tag of bucketList(workflowBucket.tags)) {
        tagCounts.set(tag.key, (tagCounts.get(tag.key) || 0) + tag.doc_count);
      }
    }
    const workflowRows = workflowBuckets.map((bkt) => {
      const latest = bkt.latest?.hits?.hits?.[0]?._source || {};
      return {
        workflow: bkt.key.workflow,
        workflowLabel: latest.workflow_label || bkt.key.workflow,
        tags: bucketList(bkt.tags).map((tag) => tag.key),
        runs: bkt.doc_count,
        passRate: bkt.pass_rate?.value ?? null,
        avgDuration: valueOrNull(bkt.avg_dur),
        aiCost: bkt.ai_cost_count?.value === bkt.doc_count ? valueOrNull(bkt.ai_cost) : null,
        bugs: bkt.bugs_count?.value === bkt.doc_count ? valueOrNull(bkt.bugs) : null,
        latestVerdict: latest.verdict || null,
        latestVersion: latest.rhoai_version || null,
        latestTimestamp: latest.timestamp || null,
        latestExecutionId: latest.execution_id || null
      };
    });
    const trendProductBugs = await productBugFindings(req.query, {
      workflows: workflowRows.map((row) => row.workflow).filter(Boolean)
    });
    res.json({
      tags: [...tagCounts].sort(([a], [b]) => a.localeCompare(b)).map(([tag, count]) => ({ tag, count })),
      workflows: workflowRows.map((row) => ({
        ...row,
        productBugs: productBugsForTest(trendProductBugs, row)
      })).sort((a, b) => b.runs - a.runs || a.workflow.localeCompare(b.workflow))
    });
  }));

  /**
   * @openapi
   * /api/modules/workflow-validation/workflow-history:
   *   get:
   *     summary: Full run history + linked bugs for a single workflow
   *     tags: [Workflow Validation]
   *     parameters:
   *       - { in: query, name: workflow, required: true, schema: { type: string } }
   *       - { in: query, name: version, schema: { type: string } }
   *       - { in: query, name: dateFrom, schema: { type: string, format: date } }
   *       - { in: query, name: dateTo, schema: { type: string, format: date } }
   *     responses:
   *       200: { description: Workflow history }
   *       400: { description: Missing workflow param }
   */
  router.get('/workflow-history', requireAuth, safe(async function (req, res) {
    const workflow = req.query.workflow;
    if (!workflow) return res.status(400).json({ error: 'workflow query param is required' });

    const runHits = await searchAll(RUNS_INDEX, {
      query: runFilters({ ...req.query, workflow, q: '', verdict: '' }),
      sort: [{ timestamp: 'asc' }, { execution_id: 'asc' }],
      _source: [
        'execution_id', 'run_id', 'rhoai_version', 'verdict', 'timestamp',
        'duration_s', 'tasks_total', 'tasks_passed', 'tasks_failed',
        'cost_usd', 'model', 'cluster_name', 'classification', 'confidence', 'workflow', 'workflow_label'
      ]
    });
    const runs = runHits.map((h) => ({ id: h._id, ...h._source }));

    let bugs = [];
    const runIds = [...new Set(runs.map((r) => r.run_id).filter(Boolean))];
    if (runIds.length) {
      const bugHits = await searchAll(BUGS_INDEX, {
        query: {
          bool: { filter: [
            { terms: { run_id: runIds } },
            { term: { workflow } }
          ] }
        },
        sort: [{ timestamp: 'desc' }, { root_cause_id: 'asc' }]
      });
      bugs = bugHits.map((h) => ({ id: h._id, ...h._source }));
    }

    const passed = runs.filter((r) => r.verdict === 'PASS').length;
    const failed = runs.filter((r) => r.verdict === 'FAIL').length;
    const errors = runs.filter((r) => r.verdict === 'ERROR').length;
    const decided = passed + failed;
    res.json({
      workflow,
      workflowLabel: runs.find((run) => run.workflow_label)?.workflow_label || workflow,
      summary: {
        runs: runs.length,
        passed,
        failed,
        errors,
        passRate: decided ? passed / decided : null,
        latestVerdict: runs.length ? runs[runs.length - 1].verdict : null
      },
      runs,
      bugs
    });
  }));

  /**
   * @openapi
   * /api/modules/workflow-validation/ci-runs:
   *   get:
   *     summary: Distinct CI runs (run_id) with version, date, workflow count, pass rate
   *     tags: [Workflow Validation]
   *     responses:
   *       200: { description: CI run list (newest first) }
   */
  router.get('/ci-runs', requireAuth, safe(async function (req, res) {
    const buckets = [];
    let after;
    do {
      const response = await osSearch(RUNS_INDEX, {
        size: 0,
        aggs: {
          runs: {
            composite: {
              size: 200,
              sources: [{ runId: { terms: { field: 'run_id' } } }],
              ...(after ? { after } : {})
            },
            aggs: {
              latest: { max: { field: 'timestamp' } },
              pass_rate: { avg: { field: 'passed_int' } },
              ver: { terms: { field: 'rhoai_version', size: 1 } }
            }
          }
        }
      });
      const aggregation = response.aggregations?.runs;
      buckets.push(...bucketList(aggregation));
      after = aggregation?.after_key;
    } while (after);
    res.json({
      ciRuns: buckets.map((b) => ({
        runId: b.key.runId,
        version: b.ver?.buckets?.[0]?.key || null,
        workflows: b.doc_count,
        passRate: b.pass_rate?.value ?? null,
        timestamp: b.latest?.value_as_string || null,
        timestampMs: b.latest?.value ?? null
      })).sort((a, b) => (b.timestampMs || 0) - (a.timestampMs || 0))
    });
  }));

  /**
   * @openapi
   * /api/modules/workflow-validation/compare-versions:
   *   get:
   *     summary: Available RHOAI version cohorts for comparison
   *     tags: [Workflow Validation]
   *     responses:
   *       200: { description: Version cohorts with execution and test counts }
   */
  router.get('/compare-versions', requireAuth, safe(async function (req, res) {
    const buckets = [];
    let after;
    do {
      const response = await osSearch(RUNS_INDEX, {
        size: 0,
        aggs: { versions: { composite: {
          size: 200,
          sources: [{ version: { terms: { field: 'rhoai_version' } } }],
          ...(after ? { after } : {})
        }, aggs: {
          tests: { cardinality: { field: 'workflow' } },
          latest: { max: { field: 'timestamp' } }
        } } }
      });
      const aggregation = response.aggregations?.versions;
      buckets.push(...bucketList(aggregation));
      after = aggregation?.after_key;
    } while (after);
    res.json({ versions: buckets.map((bucket) => ({
      version: bucket.key.version,
      executions: bucket.doc_count,
      tests: bucket.tests?.value || 0,
      latestTimestamp: bucket.latest?.value_as_string || null,
      latestTimestampMs: bucket.latest?.value || 0
    })).sort((a, b) => b.latestTimestampMs - a.latestTimestampMs) });
  }));

  /**
   * @openapi
   * /api/modules/workflow-validation/version-compare:
   *   get:
   *     summary: Compare aggregate test results between two RHOAI versions
   *     tags: [Workflow Validation]
   *     parameters:
   *       - { in: query, name: baseline, required: true, schema: { type: string } }
   *       - { in: query, name: target, required: true, schema: { type: string } }
   *     responses:
   *       200: { description: Version comparison by test }
   *       400: { description: Missing versions }
   */
  router.get('/version-compare', requireAuth, safe(async function (req, res) {
    const { baseline, target } = req.query;
    if (!baseline || !target) return res.status(400).json({ error: 'Both baseline and target versions are required' });

    const resultsByTest = async (version) => {
      const rows = [];
      let after;
      do {
        const response = await osSearch(RUNS_INDEX, {
          size: 0,
          query: runFilters({ version }),
          aggs: {
            tests: {
              composite: {
                size: 200,
                sources: [{ workflow: { terms: { field: 'workflow' } } }],
                ...(after ? { after } : {})
              },
              aggs: {
                passed: { filter: { term: { passed: true } } },
                failed: { filter: { term: { verdict: 'FAIL' } } },
                errors: { filter: { term: { verdict: 'ERROR' } } },
                latest: {
                  top_hits: {
                    size: 1,
                    sort: [{ timestamp: 'desc' }, { execution_id: 'asc' }],
                    _source: [
                      'execution_id', 'run_id', 'workflow', 'workflow_label', 'rhoai_version',
                      'verdict', 'timestamp', 'tasks_passed', 'tasks_failed'
                    ]
                  }
                }
              }
            }
          }
        });
        const aggregation = response.aggregations?.tests;
        for (const bucket of bucketList(aggregation)) {
          const hit = bucket.latest?.hits?.hits?.[0];
          if (hit) {
            const passed = bucket.passed?.doc_count || 0;
            const failed = bucket.failed?.doc_count || 0;
            const errors = bucket.errors?.doc_count || 0;
            const knownOutcomes = passed + failed + errors;
            rows.push({
            workflow: bucket.key.workflow,
            workflow_label: hit._source.workflow_label,
            executions: bucket.doc_count,
            passed,
            failed,
            errors,
            unknown: bucket.doc_count - knownOutcomes,
            passRate: knownOutcomes ? passed / knownOutcomes : null,
            latest: { id: hit._id, ...hit._source }
            });
          }
        }
        after = aggregation?.after_key;
      } while (after);
      return rows;
    };

    const [baselineRows, targetRows] = await Promise.all([resultsByTest(baseline), resultsByTest(target)]);
    const mapA = new Map(baselineRows.map((row) => [row.workflow, row]));
    const mapB = new Map(targetRows.map((row) => [row.workflow, row]));
    const workflows = [...new Set([...mapA.keys(), ...mapB.keys()])].sort();
    const targetProductBugs = await productBugFindings({ version: target }, { workflows: [...mapB.keys()] });
    const classify = (a, b) => {
      if (a && !b) return 'not-in-target';
      if (!a && b) return 'not-in-baseline';
      if (a.passRate == null || b.passRate == null) return 'insufficient-data';
      if (a.executions < 2 || b.executions < 2) return 'insufficient-data';
      if (b.passRate > a.passRate) return 'higher';
      if (b.passRate < a.passRate) return 'lower';
      return b.passRate === 1 ? 'same-passing' : 'same';
    };
    const rows = workflows.map((workflow) => {
      const a = mapA.get(workflow);
      const b = mapB.get(workflow);
      return {
        workflow,
        workflowLabel: b?.workflow_label || a?.workflow_label || workflow,
        baseline: a || null,
        target: b ? { ...b, productBugs: productBugsForTest(targetProductBugs, b) } : null,
        passRateChange: a?.passRate != null && b?.passRate != null ? b.passRate - a.passRate : null,
        change: classify(a, b)
      };
    });
    const tally = rows.reduce((counts, row) => {
      counts[row.change] = (counts[row.change] || 0) + 1;
      return counts;
    }, {});
    res.json({
      baseline: { version: baseline, tests: baselineRows.length },
      target: { version: target, tests: targetRows.length },
      rows,
      tally
    });
  }));

  /**
   * @openapi
   * /api/modules/workflow-validation/compare:
   *   get:
   *     summary: Diff two CI runs by workflow verdict (fixed / regressed / unchanged)
   *     tags: [Workflow Validation]
   *     parameters:
   *       - { in: query, name: a, required: true, schema: { type: string }, description: baseline run_id }
   *       - { in: query, name: b, required: true, schema: { type: string }, description: target run_id }
   *     responses:
   *       200: { description: Comparison result }
   *       400: { description: Missing run ids }
   */
  router.get('/compare', requireAuth, safe(async function (req, res) {
    const { a, b } = req.query;
    if (!a || !b) return res.status(400).json({ error: 'Both a and b run ids are required' });

    const fetchRun = async (runId) => {
      const hits = await searchAll(RUNS_INDEX, {
        query: { term: { run_id: runId } },
        sort: [{ timestamp: 'asc' }, { execution_id: 'asc' }],
        _source: ['execution_id', 'workflow', 'workflow_label', 'verdict', 'rhoai_version', 'timestamp', 'duration_s', 'cost_usd', 'tasks_passed', 'tasks_total']
      });
      return hits.map((h) => ({ id: h._id, ...h._source }));
    };
    const [runsA, runsB] = await Promise.all([fetchRun(a), fetchRun(b)]);

    const meta = (runId, rows) => ({
      runId,
      version: rows[0]?.rhoai_version || null,
      timestamp: rows[0]?.timestamp || null,
      workflows: rows.length
    });
    const mapA = new Map(runsA.map((r) => [r.workflow, r]));
    const mapB = new Map(runsB.map((r) => [r.workflow, r]));
    const keys = [...new Set([...mapA.keys(), ...mapB.keys()])].sort();

    const classify = (va, vb) => {
      if (va && !vb) return 'removed';
      if (!va && vb) return 'added';
      if (va === 'FAIL' && vb === 'PASS') return 'fixed';
      if (va === 'PASS' && vb === 'FAIL') return 'regressed';
      if (va === vb) return va === 'PASS' ? 'same-pass' : 'same-fail';
      return 'changed';
    };

    const rows = keys.map((wf) => {
      const ra = mapA.get(wf);
      const rb = mapB.get(wf);
      return {
        workflow: wf,
        workflowLabel: rb?.workflow_label || ra?.workflow_label || wf,
        a: ra ? ra.verdict : null,
        b: rb ? rb.verdict : null,
        change: classify(ra?.verdict, rb?.verdict),
        aRunKey: ra?.id || null,
        bRunKey: rb?.id || null
      };
    });

    const tally = rows.reduce((acc, r) => { acc[r.change] = (acc[r.change] || 0) + 1; return acc; }, {});
    res.json({ a: meta(a, runsA), b: meta(b, runsB), rows, tally });
  }));
};
