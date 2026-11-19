/** Project OpenSearch counters without treating missing telemetry as zero. */
const TASK_FIELDS = { tasks: 'tasks_total', passed: 'tasks_passed', failed: 'tasks_failed', skipped: 'tasks_skipped' };
const isCount = value => Number.isSafeInteger(value) && value >= 0;
const taskAggregations = Object.fromEntries(Object.entries(TASK_FIELDS).flatMap(([key, field]) => [
  [key, { sum: { field } }], [`${key}_count`, { value_count: { field } }]
]));

function groupCounts(bucket) {
  return { workflows: bucket.doc_count, ...Object.fromEntries(Object.keys(TASK_FIELDS).map(key => [key,
    bucket[`${key}_count`]?.value === bucket.doc_count && isCount(bucket[key]?.value) ? bucket[key].value : null
  ])) };
}

/** Sum every selected suite run; count a Jira key once across the selection. */
function summarizeRuns(rows) {
  const sum = key => rows.every(row => isCount(row[key])) ? rows.reduce((total, row) => total + row[key], 0) : null;
  return { suiteRuns: rows.length, workflows: sum('workflows'),
    ...Object.fromEntries(Object.keys(TASK_FIELDS).map(key => [key, sum(key)])),
    bugs: rows.every(row => Array.isArray(row._bugKeys)) ? new Set(rows.flatMap(row => row._bugKeys)).size : null };
}

module.exports = { taskAggregations, groupCounts, summarizeRuns };
