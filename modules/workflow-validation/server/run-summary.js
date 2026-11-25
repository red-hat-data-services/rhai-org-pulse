/** Project OpenSearch counters without treating missing telemetry as zero. */
const { RUNS_INDEX, TASKS_INDEX, readAll } = require('./opensearch');
const { bugSearchUrl } = require('./bug-tickets');
const TASK_FIELDS = { tasks: 'tasks_total', passed: 'tasks_passed', failed: 'tasks_failed', skipped: 'tasks_skipped' };
const isCount = value => Number.isSafeInteger(value) && value >= 0;
const runKey = (suite, invocation) => JSON.stringify([suite, invocation]);
const skippedStatuses = ['SKIP', 'SKIPPED'];
const taskStatuses = ['PASS', 'FAIL', 'FAILED', ...skippedStatuses];
const taskAggregations = Object.fromEntries(Object.entries(TASK_FIELDS).flatMap(([key, field]) => [
  [key, { sum: { field } }], [`${key}_count`, { value_count: { field } }]
]));

/** Use task-index outcomes when an execution lacks a complete embedded list. */
async function readIndexedSkipped(executions, search, isClosed) {
  const counts = new Map();
  const ids = [...new Set(executions.map(execution => execution.execution_id))];
  for (let offset = 0; offset < ids.length && !isClosed(); offset += 500) {
    const batch = ids.slice(offset, offset + 500);
    try {
      const response = await search(TASKS_INDEX, {
        size: 0,
        query: { terms: { execution_id: batch } },
        aggs: { executions: { terms: { field: 'execution_id', size: batch.length }, aggs: {
          known: { filter: { terms: { status: taskStatuses } } },
          skipped: { filter: { terms: { status: skippedStatuses } } }
        } } }
      });
      if (response.timed_out || response._shards?.failed) continue;
      for (const bucket of response.aggregations?.executions?.buckets || []) {
        if (bucket.known?.doc_count === bucket.doc_count && isCount(bucket.skipped?.doc_count)) counts.set(bucket.key, bucket);
      }
    } catch { /* A failed lookup leaves only this batch unavailable. */ }
  }
  return counts;
}

/** Recover missing counts within a bounded batch of matching suite runs. */
async function recoverSkipped(rows, search, isClosed) {
  const legacyRows = rows.filter(row => row._skippedCoverage);
  if (!legacyRows.length) return rows;
  const counts = new Map();
  let executions;
  try {
    executions = await readAll(search, RUNS_INDEX, {
      query: { bool: { should: legacyRows.map(row => ({ bool: { filter: [
        { term: { telemetry_suite: row.suite } }, { term: { invocation_id: row.invocationId } }
      ] } })), minimum_should_match: 1, must_not: [{ exists: { field: 'tasks_skipped' } }] } },
      sort: [{ timestamp: 'asc' }, { execution_id: 'asc' }],
      _source: ['execution_id', 'telemetry_suite', 'invocation_id', 'tasks_total', 'tasks.status']
    }, isClosed);
  } catch { return rows; }

  function addCount(execution, skipped) {
    const key = runKey(execution.telemetry_suite, execution.invocation_id);
    const count = counts.get(key) || { executions: 0, skipped: 0 };
    count.executions += 1;
    count.skipped += skipped;
    counts.set(key, count);
  }
  const pending = [];
  for (const execution of executions) {
    const tasks = execution.tasks ?? [];
    if (Array.isArray(tasks) && tasks.length === execution.tasks_total && tasks.every(task => taskStatuses.includes(task?.status))) {
      addCount(execution, tasks.filter(task => skippedStatuses.includes(task.status)).length);
    } else if (typeof execution.execution_id === 'string' && execution.execution_id && isCount(execution.tasks_total)) {
      pending.push(execution);
    }
  }
  const indexed = await readIndexedSkipped(pending, search, isClosed);
  for (const execution of pending) {
    const bucket = indexed.get(execution.execution_id);
    if (bucket?.doc_count === execution.tasks_total) addCount(execution, bucket.skipped.doc_count);
  }
  return rows.map(row => {
    const coverage = row._skippedCoverage;
    const legacy = counts.get(runKey(row.suite, row.invocationId));
    return coverage && legacy?.executions === coverage.missing ? { ...row, skipped: coverage.recorded + legacy.skipped } : row;
  });
}

function groupCounts(bucket) {
  const counts = { workflows: bucket.doc_count, ...Object.fromEntries(Object.keys(TASK_FIELDS).map(key => [key,
    bucket[`${key}_count`]?.value === bucket.doc_count && isCount(bucket[key]?.value) ? bucket[key].value : null
  ])) };
  const recorded = bucket.skipped_count?.value;
  if (isCount(recorded) && recorded < bucket.doc_count && isCount(bucket.skipped?.value)) {
    counts._skippedCoverage = { missing: bucket.doc_count - recorded, recorded: bucket.skipped.value };
  }
  return counts;
}

/** Sum every selected suite run; count a Jira key once across the selection. */
function summarizeRuns(rows, jiraHost, bugsIncomplete) {
  const sum = key => rows.every(row => isCount(row[key])) ? rows.reduce((total, row) => total + row[key], 0) : null;
  const keys = [...new Set(rows.flatMap(row => row._bugKeys || []))].sort();
  let bugUrl = bugSearchUrl(jiraHost, keys);
  let bugJql;
  // Keep the full query available when it cannot fit through a common 8 KiB gateway limit.
  if (bugUrl?.length > 8000) {
    const url = new URL(bugUrl);
    bugJql = url.searchParams.get('jql');
    url.search = '';
    bugUrl = url.href;
  }
  return { suiteRuns: rows.length, workflows: sum('workflows'),
    ...Object.fromEntries(Object.keys(TASK_FIELDS).map(key => [key, sum(key)])),
    bugs: bugsIncomplete && !keys.length ? null : keys.length,
    ...(bugsIncomplete ? { bugsIncomplete: true } : {}), ...(bugUrl ? { bugUrl } : {}), ...(bugJql ? { bugJql } : {}) };
}

module.exports = { taskAggregations, recoverSkipped, groupCounts, summarizeRuns };
