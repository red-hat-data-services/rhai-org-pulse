/** Compare what a suite run was announced to run with the workflows that ran. */
const { RUNS_INDEX, SUITE_RUNS_INDEX, readAll } = require('./opensearch');
const runKey = (suite, invocation) => JSON.stringify([suite, invocation]);
const isText = value => typeof value === 'string' && value.length > 0;
const NO_COVERAGE = { suiteName: null, workflowsExpected: null, workflowsRan: null, workflowsMissing: null };
const runPairs = runs => ({ bool: { should: runs.map(run => ({ bool: { filter: [
  { term: { telemetry_suite: run.suite } }, { term: { invocation_id: run.invocationId } }
] } })), minimum_should_match: 1 } });

/** Read the identity of every announced run. An absent index means none exist; null means unknown. */
async function readAnnouncedRuns(search, isClosed) {
  let docs;
  try {
    docs = await readAll(search, SUITE_RUNS_INDEX, {
      sort: [{ announced_at: 'asc' }, { suite_run_id: 'asc' }], _source: ['telemetry_suite', 'invocation_id']
    }, isClosed);
  } catch (err) { return err?.status === 404 ? new Set() : null; }
  return new Set(docs.filter(doc => isText(doc.telemetry_suite) && isText(doc.invocation_id))
    .map(doc => runKey(doc.telemetry_suite, doc.invocation_id)));
}

/** Mark each run group as a suite run or an ad hoc run. Rows stay unchanged when announcements cannot be read. */
async function markSuiteRuns(rows, search, isClosed = () => false) {
  const announced = await readAnnouncedRuns(search, isClosed);
  return announced ? rows.map(row => ({ ...row, suiteRun: announced.has(runKey(row.suite, row.invocationId)) })) : rows;
}

/** Read the suite name and the distinct expected workflows of the given runs. Unreadable runs are omitted. */
async function readExpectedWorkflows(runs, search, isClosed) {
  const expected = new Map();
  let docs;
  try {
    docs = await readAll(search, SUITE_RUNS_INDEX, {
      query: runPairs(runs), sort: [{ announced_at: 'asc' }, { suite_run_id: 'asc' }],
      _source: ['suite', 'telemetry_suite', 'invocation_id', 'expected_workflows']
    }, isClosed);
  } catch { return expected; }
  for (const doc of docs) {
    if (!isText(doc.telemetry_suite) || !isText(doc.invocation_id) || !Array.isArray(doc.expected_workflows)) continue;
    const workflows = new Map();
    for (const workflow of doc.expected_workflows) {
      if (isText(workflow?.workflow_id) && !workflows.has(workflow.workflow_id)) {
        workflows.set(workflow.workflow_id, { workflowId: workflow.workflow_id, title: isText(workflow.title) ? workflow.title : workflow.workflow_id });
      }
    }
    expected.set(runKey(doc.telemetry_suite, doc.invocation_id), { suiteName: isText(doc.suite) ? doc.suite : doc.telemetry_suite,
      workflows: [...workflows.values()] });
  }
  return expected;
}

/** Distinct workflow ids per run. A run is omitted unless the result is complete and every execution recorded its id. */
async function readRanWorkflows(runs, search, isClosed) {
  const ran = new Map();
  try {
    const response = await search(RUNS_INDEX, {
      size: 0,
      query: runPairs(runs),
      aggs: { suite_runs: {
        composite: { size: runs.length, sources: [
          { suite: { terms: { field: 'telemetry_suite' } } }, { invocation: { terms: { field: 'invocation_id' } } }
        ] },
        aggs: { identified: { value_count: { field: 'workflow_id' } }, workflow_ids: { terms: { field: 'workflow_id', size: 1000 } } }
      } }
    });
    if (isClosed() || response.timed_out || response._shards?.failed) return ran;
    for (const bucket of response.aggregations?.suite_runs?.buckets || []) {
      const ids = bucket.workflow_ids;
      if (bucket.identified?.value === bucket.doc_count && Array.isArray(ids?.buckets) && !ids.sum_other_doc_count) {
        ran.set(runKey(bucket.key.suite, bucket.key.invocation), new Set(ids.buckets.map(item => item.key)));
      }
    }
  } catch { /* A failed lookup leaves these runs without a ran count. */ }
  return ran;
}

/** Add expected versus ran to the suite runs of one page (at most 200 rows). Other rows are returned as they are. */
async function addCoverage(rows, search, isClosed = () => false) {
  const suiteRuns = rows.filter(row => row.suiteRun === true);
  if (!suiteRuns.length) return rows;
  const expected = await readExpectedWorkflows(suiteRuns, search, isClosed);
  const known = suiteRuns.filter(row => expected.has(runKey(row.suite, row.invocationId)));
  const ran = known.length && !isClosed() ? await readRanWorkflows(known, search, isClosed) : new Map();
  return rows.map(row => {
    if (row.suiteRun !== true) return row;
    const key = runKey(row.suite, row.invocationId), announcement = expected.get(key), ids = ran.get(key);
    if (!announcement) return { ...row, ...NO_COVERAGE };
    const { workflows } = announcement;
    return { ...row, suiteName: announcement.suiteName, workflowsExpected: workflows.length,
      workflowsRan: ids ? workflows.filter(workflow => ids.has(workflow.workflowId)).length : null,
      workflowsMissing: ids ? workflows.filter(workflow => !ids.has(workflow.workflowId)) : null };
  });
}

/** Describe one run. Returns no fields when the announcement cannot be read. */
async function suiteRunDetail(suite, invocationId, search) {
  let response;
  try {
    response = await search(SUITE_RUNS_INDEX, { size: 0, track_total_hits: true, query: runPairs([{ suite, invocationId }]) });
  } catch (err) { return err?.status === 404 ? { suiteRun: false } : {}; }
  const total = response.hits?.total?.value;
  if (response.timed_out || response._shards?.failed || !Number.isInteger(total)) return {};
  if (!total) return { suiteRun: false };
  const [row] = await addCoverage([{ suite, invocationId, suiteRun: true }], search);
  const { suite: _suite, invocationId: _invocationId, ...fields } = row;
  return fields;
}

module.exports = { markSuiteRuns, addCoverage, suiteRunDetail };
