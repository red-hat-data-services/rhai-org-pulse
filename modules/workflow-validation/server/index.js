/**
 * Workflow Validation module — server routes.
 *
 * Read-only proxy over the `workflow-runs` and `workflow-bugs` OpenSearch
 * indices. All heavy aggregation happens in OpenSearch; these handlers just
 * shape query bodies and project the response for the UI.
 */

const {
  RUNS_INDEX,
  BUGS_INDEX,
  osSearch,
  osStatus,
  runFilters,
  bugFilters
} = require('./opensearch');

/** Wrap an async handler so OpenSearch connectivity errors become clean HTTP responses. */
function safe(handler) {
  return async function (req, res) {
    try {
      await handler(req, res);
    } catch (err) {
      if (err.code === 'OS_UNREACHABLE') {
        return res.status(503).json({ error: err.message, code: 'OS_UNREACHABLE' });
      }
      return res.status(502).json({ error: err.message || 'OpenSearch query failed' });
    }
  };
}

const bucketList = (agg) => (agg && agg.buckets ? agg.buckets : []);

module.exports = function registerRoutes(router, context) {
  const { requireAuth } = context;

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
    const status = await osStatus();
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
        workflows: { terms: { field: 'workflow_label', size: 100, order: { _key: 'asc' } } }
      }
    };
    const r = await osSearch(RUNS_INDEX, body);
    const a = r.aggregations || {};
    res.json({
      versions: bucketList(a.versions).map((b) => ({ value: b.key, count: b.doc_count })),
      providers: bucketList(a.providers).map((b) => ({ value: b.key, count: b.doc_count })),
      models: bucketList(a.models).map((b) => ({ value: b.key, count: b.doc_count })),
      workflows: bucketList(a.workflows).map((b) => ({ value: b.key, count: b.doc_count }))
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
   *       - { in: query, name: verdict, schema: { type: string, enum: [PASS, FAIL] } }
   *       - { in: query, name: provider, schema: { type: string } }
   *       - { in: query, name: q, schema: { type: string } }
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
        runs: { value_count: { field: 'run_key' } },
        pass_rate: { avg: { field: 'passed_int' } },
        passed: { filter: { term: { passed: true } } },
        failed: { filter: { term: { passed: false } } },
        tasks_total: { sum: { field: 'tasks_total' } },
        tasks_passed: { sum: { field: 'tasks_passed' } },
        tasks_failed: { sum: { field: 'tasks_failed' } },
        ai_cost: { sum: { field: 'cost_usd' } },
        infra_cost: { sum: { field: 'infra_cost_usd' } },
        avg_duration: { avg: { field: 'duration_s' } },
        turns: { sum: { field: 'num_turns' } },
        workflows: { cardinality: { field: 'workflow_label' } },
        versions: { cardinality: { field: 'rhoai_version' } }
      }
    };
    const bugsBody = {
      size: 0,
      query: bugFilters(req.query),
      aggs: {
        total: { value_count: { field: 'bug_id' } },
        opened: { filter: { term: { opened: true } } },
        distinct_jira: { cardinality: { field: 'bug_key' } }
      }
    };
    const [runsR, bugsR] = await Promise.all([
      osSearch(RUNS_INDEX, runsBody),
      osSearch(BUGS_INDEX, bugsBody)
    ]);
    const ra = runsR.aggregations || {};
    const ba = bugsR.aggregations || {};
    res.json({
      runs: {
        total: ra.runs?.value || 0,
        passRate: ra.pass_rate?.value ?? null,
        passed: ra.passed?.doc_count || 0,
        failed: ra.failed?.doc_count || 0,
        tasksTotal: ra.tasks_total?.value || 0,
        tasksPassed: ra.tasks_passed?.value || 0,
        tasksFailed: ra.tasks_failed?.value || 0,
        aiCost: ra.ai_cost?.value || 0,
        infraCost: ra.infra_cost?.value || 0,
        avgDuration: ra.avg_duration?.value || 0,
        turns: ra.turns?.value || 0,
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
   *     responses:
   *       200: { description: Chart series }
   */
  router.get('/charts', requireAuth, safe(async function (req, res) {
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
            runs: { value_count: { field: 'run_key' } }
          }
        },
        by_workflow: {
          terms: { field: 'workflow_label', size: 100, order: { runs: 'desc' } },
          aggs: {
            runs: { value_count: { field: 'run_key' } },
            pass_rate: { avg: { field: 'passed_int' } },
            ai_cost: { sum: { field: 'cost_usd' } },
            avg_dur: { avg: { field: 'duration_s' } },
            bugs: { sum: { field: 'bug_count' } }
          }
        },
        by_provider: { terms: { field: 'inference_provider', size: 20 } }
      }
    };
    const bugsBody = {
      size: 0,
      query: bugFilters(req.query),
      aggs: {
        by_category: { terms: { field: 'category', size: 20 } },
        by_action: { terms: { field: 'action', size: 20 } },
        by_component: { terms: { field: 'rhoaieng_component', size: 20 } }
      }
    };
    const [runsR, bugsR] = await Promise.all([
      osSearch(RUNS_INDEX, runsBody),
      osSearch(BUGS_INDEX, bugsBody)
    ]);
    const a = runsR.aggregations || {};
    const b = bugsR.aggregations || {};
    res.json({
      overTime: bucketList(a.over_time).map((bkt) => ({
        date: bkt.key_as_string || bkt.key,
        total: bkt.doc_count,
        pass: (bucketList(bkt.verdict).find((v) => v.key === 'PASS') || {}).doc_count || 0,
        fail: (bucketList(bkt.verdict).find((v) => v.key === 'FAIL') || {}).doc_count || 0
      })),
      byVersion: bucketList(a.by_version).map((bkt) => ({
        version: bkt.key,
        runs: bkt.runs?.value || 0,
        passRate: bkt.pass_rate?.value ?? null
      })),
      byWorkflow: bucketList(a.by_workflow).map((bkt) => ({
        workflow: bkt.key,
        runs: bkt.runs?.value || 0,
        passRate: bkt.pass_rate?.value ?? null,
        aiCost: bkt.ai_cost?.value || 0,
        avgDuration: bkt.avg_dur?.value || 0,
        bugs: bkt.bugs?.value || 0
      })),
      byProvider: bucketList(a.by_provider).map((bkt) => ({ provider: bkt.key, runs: bkt.doc_count })),
      bugsByCategory: bucketList(b.by_category).map((bkt) => ({ category: bkt.key, count: bkt.doc_count })),
      bugsByAction: bucketList(b.by_action).map((bkt) => ({ action: bkt.key, count: bkt.doc_count })),
      bugsByComponent: bucketList(b.by_component).map((bkt) => ({ component: bkt.key, count: bkt.doc_count }))
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
   *       - { in: query, name: q, schema: { type: string } }
   *       - { in: query, name: page, schema: { type: integer, default: 0 } }
   *       - { in: query, name: size, schema: { type: integer, default: 25 } }
   *     responses:
   *       200: { description: Runs page }
   */
  router.get('/runs', requireAuth, safe(async function (req, res) {
    const size = Math.min(parseInt(req.query.size, 10) || 25, 200);
    const page = Math.max(parseInt(req.query.page, 10) || 0, 0);
    const body = {
      size,
      from: page * size,
      query: runFilters(req.query),
      sort: [{ timestamp: 'desc' }],
      _source: [
        'run_key', 'run_id', 'workflow_label', 'test_name', 'rhoai_version',
        'verdict', 'tasks_total', 'tasks_passed', 'tasks_failed',
        'cost_usd', 'infra_cost_usd', 'duration_s', 'num_turns', 'model',
        'inference_provider', 'bug_count', 'timestamp'
      ]
    };
    const r = await osSearch(RUNS_INDEX, body);
    res.json({
      total: r.hits?.total?.value || 0,
      page,
      size,
      runs: (r.hits?.hits || []).map((h) => ({ id: h._id, ...h._source }))
    });
  }));

  /**
   * @openapi
   * /api/modules/workflow-validation/runs/{runKey}:
   *   get:
   *     summary: Single run with its task list and linked bugs
   *     tags: [Workflow Validation]
   *     parameters:
   *       - { in: path, name: runKey, required: true, schema: { type: string } }
   *     responses:
   *       200: { description: Run detail }
   *       404: { description: Run not found }
   */
  router.get('/runs/:runKey', requireAuth, safe(async function (req, res) {
    const runKey = req.params.runKey;
    const runR = await osSearch(RUNS_INDEX, {
      size: 1,
      query: { term: { run_key: runKey } }
    });
    const hit = (runR.hits?.hits || [])[0];
    if (!hit) return res.status(404).json({ error: `Run not found: ${runKey}` });
    const run = { id: hit._id, ...hit._source };

    let bugs = [];
    if (run.run_id) {
      const bugR = await osSearch(BUGS_INDEX, {
        size: 100,
        query: { term: { run_id: run.run_id } },
        sort: [{ timestamp: 'desc' }]
      });
      bugs = (bugR.hits?.hits || []).map((h) => ({ id: h._id, ...h._source }));
    }
    res.json({ run, bugs });
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
   *       - { in: query, name: q, schema: { type: string } }
   *       - { in: query, name: page, schema: { type: integer, default: 0 } }
   *       - { in: query, name: size, schema: { type: integer, default: 50 } }
   *     responses:
   *       200: { description: Bugs page with KPIs }
   */
  router.get('/bugs', requireAuth, safe(async function (req, res) {
    const size = Math.min(parseInt(req.query.size, 10) || 50, 200);
    const page = Math.max(parseInt(req.query.page, 10) || 0, 0);
    const query = bugFilters(req.query);
    const body = {
      size,
      from: page * size,
      query,
      sort: [{ timestamp: 'desc' }],
      aggs: {
        total: { value_count: { field: 'bug_id' } },
        opened: { filter: { term: { opened: true } } },
        distinct_jira: { cardinality: { field: 'bug_key' } },
        by_category: { terms: { field: 'category', size: 20 } },
        by_action: { terms: { field: 'action', size: 20 } }
      }
    };
    const r = await osSearch(BUGS_INDEX, body);
    const a = r.aggregations || {};
    res.json({
      total: r.hits?.total?.value || 0,
      page,
      size,
      kpis: {
        total: a.total?.value || 0,
        opened: a.opened?.doc_count || 0,
        distinctJira: a.distinct_jira?.value || 0
      },
      byCategory: bucketList(a.by_category).map((b) => ({ category: b.key, count: b.doc_count })),
      byAction: bucketList(a.by_action).map((b) => ({ action: b.key, count: b.doc_count })),
      bugs: (r.hits?.hits || []).map((h) => ({ id: h._id, ...h._source }))
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
   *       - { in: query, name: q, schema: { type: string } }
   *     responses:
   *       200: { description: Workflow rollup list }
   */
  router.get('/workflows', requireAuth, safe(async function (req, res) {
    const body = {
      size: 0,
      query: runFilters(req.query),
      aggs: {
        by_workflow: {
          terms: { field: 'workflow_label', size: 300, order: { runs: 'desc' } },
          aggs: {
            runs: { value_count: { field: 'run_key' } },
            pass_rate: { avg: { field: 'passed_int' } },
            avg_dur: { avg: { field: 'duration_s' } },
            ai_cost: { sum: { field: 'cost_usd' } },
            bugs: { sum: { field: 'bug_count' } },
            test: { terms: { field: 'test_name', size: 1 } },
            latest: {
              top_hits: {
                size: 1,
                sort: [{ timestamp: 'desc' }],
                _source: ['verdict', 'timestamp', 'rhoai_version', 'run_key', 'tasks_passed', 'tasks_total']
              }
            }
          }
        },
        tags: { terms: { field: 'test_name', size: 100, order: { _key: 'asc' } } }
      }
    };
    const r = await osSearch(RUNS_INDEX, body);
    const a = r.aggregations || {};
    res.json({
      tags: bucketList(a.tags).map((b) => ({ tag: b.key, count: b.doc_count })),
      workflows: bucketList(a.by_workflow).map((bkt) => {
        const latest = bkt.latest?.hits?.hits?.[0]?._source || {};
        return {
          workflow: bkt.key,
          tag: bkt.test?.buckets?.[0]?.key || null,
          runs: bkt.runs?.value || 0,
          passRate: bkt.pass_rate?.value ?? null,
          avgDuration: bkt.avg_dur?.value || 0,
          aiCost: bkt.ai_cost?.value || 0,
          bugs: bkt.bugs?.value || 0,
          latestVerdict: latest.verdict || null,
          latestVersion: latest.rhoai_version || null,
          latestTimestamp: latest.timestamp || null,
          latestRunKey: latest.run_key || null
        };
      })
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
   *     responses:
   *       200: { description: Workflow history }
   *       400: { description: Missing workflow param }
   */
  router.get('/workflow-history', requireAuth, safe(async function (req, res) {
    const workflow = req.query.workflow;
    if (!workflow) return res.status(400).json({ error: 'workflow query param is required' });

    const runR = await osSearch(RUNS_INDEX, {
      size: 500,
      query: { term: { workflow_label: workflow } },
      sort: [{ timestamp: 'asc' }],
      _source: [
        'run_key', 'run_id', 'rhoai_version', 'verdict', 'timestamp',
        'duration_s', 'tasks_total', 'tasks_passed', 'tasks_failed',
        'cost_usd', 'model', 'cluster_name', 'classification', 'confidence', 'workflow'
      ]
    });
    const runs = (runR.hits?.hits || []).map((h) => ({ id: h._id, ...h._source }));

    // Bug docs key on the SHORT workflow name (e.g. "fraud-detection-tutorial"),
    // not the workflow_label — collect the short names from the runs to join.
    const shortNames = [...new Set(runs.map((r) => r.workflow).filter(Boolean))];
    let bugs = [];
    if (shortNames.length) {
      const bugR = await osSearch(BUGS_INDEX, {
        size: 200,
        query: {
          bool: {
            should: [
              { terms: { workflow: shortNames } },
              { terms: { impacted_workflows: shortNames } }
            ],
            minimum_should_match: 1
          }
        },
        sort: [{ timestamp: 'desc' }]
      });
      bugs = (bugR.hits?.hits || []).map((h) => ({ id: h._id, ...h._source }));
    }

    const passed = runs.filter((r) => r.verdict === 'PASS').length;
    const failed = runs.filter((r) => r.verdict === 'FAIL').length;
    res.json({
      workflow,
      summary: {
        runs: runs.length,
        passed,
        failed,
        passRate: runs.length ? passed / (passed + failed || 1) : null,
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
    const body = {
      size: 0,
      aggs: {
        runs: {
          terms: { field: 'run_id', size: 100, order: { latest: 'desc' } },
          aggs: {
            latest: { max: { field: 'timestamp' } },
            pass_rate: { avg: { field: 'passed_int' } },
            ver: { terms: { field: 'rhoai_version', size: 1 } }
          }
        }
      }
    };
    const r = await osSearch(RUNS_INDEX, body);
    res.json({
      ciRuns: bucketList(r.aggregations?.runs).map((b) => ({
        runId: b.key,
        version: b.ver?.buckets?.[0]?.key || null,
        workflows: b.doc_count,
        passRate: b.pass_rate?.value ?? null,
        timestamp: b.latest?.value_as_string || null,
        timestampMs: b.latest?.value || null
      }))
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
      const r = await osSearch(RUNS_INDEX, {
        size: 300,
        query: { term: { run_id: runId } },
        _source: ['workflow_label', 'verdict', 'rhoai_version', 'timestamp', 'run_key', 'duration_s', 'cost_usd', 'tasks_passed', 'tasks_total']
      });
      return (r.hits?.hits || []).map((h) => ({ id: h._id, ...h._source }));
    };
    const [runsA, runsB] = await Promise.all([fetchRun(a), fetchRun(b)]);

    const meta = (runId, rows) => ({
      runId,
      version: rows[0]?.rhoai_version || null,
      timestamp: rows[0]?.timestamp || null,
      workflows: rows.length
    });
    const mapA = new Map(runsA.map((r) => [r.workflow_label, r]));
    const mapB = new Map(runsB.map((r) => [r.workflow_label, r]));
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
