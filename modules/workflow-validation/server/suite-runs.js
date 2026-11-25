/** Compare what a suite run was announced to run with the workflows that ran. */
const { RUNS_INDEX, SUITE_RUNS_INDEX, readAll } = require('./opensearch');
const runKey = (suite, invocation) => JSON.stringify([suite, invocation]);
const isText = value => typeof value === 'string' && value.length > 0;

/** Keep the identity and the distinct expected workflows of a valid announcement. */
function parseAnnouncement(doc) {
  if (!isText(doc?.telemetry_suite) || !isText(doc.invocation_id) || !Array.isArray(doc.expected_workflows)) return null;
  const expected = new Map();
  for (const workflow of doc.expected_workflows) {
    if (isText(workflow?.workflow_id) && !expected.has(workflow.workflow_id)) {
      expected.set(workflow.workflow_id, { workflowId: workflow.workflow_id, title: isText(workflow.title) ? workflow.title : workflow.workflow_id });
    }
  }
  return { suite: doc.telemetry_suite, invocationId: doc.invocation_id, suiteName: isText(doc.suite) ? doc.suite : doc.telemetry_suite,
    expected: [...expected.values()] };
}

/** Read every announcement. An absent index means none exist; null means unknown. */
async function readAnnouncements(search, isClosed) {
  let docs;
  try {
    docs = await readAll(search, SUITE_RUNS_INDEX, {
      sort: [{ announced_at: 'asc' }, { suite_run_id: 'asc' }],
      _source: ['suite', 'telemetry_suite', 'invocation_id', 'expected_workflows']
    }, isClosed);
  } catch (err) { return err?.status === 404 ? new Map() : null; }
  const announcements = new Map();
  for (const doc of docs) {
    const announcement = parseAnnouncement(doc);
    if (announcement) announcements.set(runKey(announcement.suite, announcement.invocationId), announcement);
  }
  return announcements;
}

/** Read one run's announcement: the announcement, false when none exists, null when unknown. */
async function readAnnouncement(search, suite, invocationId) {
  try {
    const response = await search(SUITE_RUNS_INDEX, { size: 1, query: { bool: { filter: [
      { term: { telemetry_suite: suite } }, { term: { invocation_id: invocationId } }
    ] } }, _source: ['suite', 'telemetry_suite', 'invocation_id', 'expected_workflows'] });
    if (response.timed_out || response._shards?.failed || !Array.isArray(response.hits?.hits)) return null;
    return parseAnnouncement(response.hits.hits[0]?._source) || false;
  } catch (err) { return err?.status === 404 ? false : null; }
}

/** Distinct workflow ids per run. A run is omitted unless every execution recorded its id. */
async function readRanWorkflows(runs, search, isClosed) {
  const ran = new Map();
  // Bound the run correlation query below OpenSearch's Boolean-clause limit.
  for (let offset = 0; offset < runs.length && !isClosed(); offset += 200) {
    const batch = runs.slice(offset, offset + 200);
    try {
      const response = await search(RUNS_INDEX, {
        size: 0,
        query: { bool: { should: batch.map(run => ({ bool: { filter: [
          { term: { telemetry_suite: run.suite } }, { term: { invocation_id: run.invocationId } }
        ] } })), minimum_should_match: 1 } },
        aggs: { suite_runs: {
          composite: { size: batch.length, sources: [
            { suite: { terms: { field: 'telemetry_suite' } } }, { invocation: { terms: { field: 'invocation_id' } } }
          ] },
          aggs: { identified: { value_count: { field: 'workflow_id' } }, workflow_ids: { terms: { field: 'workflow_id', size: 1000 } } }
        } }
      });
      if (response.timed_out || response._shards?.failed) continue;
      for (const bucket of response.aggregations?.suite_runs?.buckets || []) {
        const ids = bucket.workflow_ids;
        if (bucket.identified?.value === bucket.doc_count && Array.isArray(ids?.buckets) && !ids.sum_other_doc_count) {
          ran.set(runKey(bucket.key.suite, bucket.key.invocation), new Set(ids.buckets.map(item => item.key)));
        }
      }
    } catch { /* A failed lookup leaves only this batch without a ran count. */ }
  }
  return ran;
}

/** Describe a run against its announcement; ran is null when workflow ids are not recorded. */
function suiteRunFields(announcement, ran) {
  if (!announcement) return { suiteRun: false };
  const { expected } = announcement;
  return { suiteRun: true, suiteName: announcement.suiteName, workflowsExpected: expected.length,
    workflowsRan: ran ? expected.filter(workflow => ran.has(workflow.workflowId)).length : null,
    workflowsMissing: ran ? expected.filter(workflow => !ran.has(workflow.workflowId)) : null };
}

/** Mark each run group as a suite run or an ad hoc run. Rows stay unchanged when announcements cannot be read. */
async function addSuiteRuns(rows, search, isClosed = () => false) {
  const announcements = await readAnnouncements(search, isClosed);
  if (!announcements) return rows;
  const announced = rows.filter(row => announcements.has(runKey(row.suite, row.invocationId)));
  const ran = announced.length ? await readRanWorkflows(announced, search, isClosed) : new Map();
  return rows.map(row => {
    const key = runKey(row.suite, row.invocationId);
    return { ...row, ...suiteRunFields(announcements.get(key), ran.get(key)) };
  });
}

/** Describe one run from its executions. Returns no fields when the announcement cannot be read. */
async function suiteRunDetail(suite, invocationId, executions, search) {
  const announcement = await readAnnouncement(search, suite, invocationId);
  if (announcement === null) return {};
  const identified = executions.length > 0 && executions.every(execution => isText(execution.workflow_id));
  return suiteRunFields(announcement, identified ? new Set(executions.map(execution => execution.workflow_id)) : null);
}

module.exports = { addSuiteRuns, suiteRunDetail, suiteRunFields, readAnnouncements, readRanWorkflows };
