/** Read-only join for the versioned CI execution metadata contract. */
const { createHash } = require('node:crypto');
const BUILD_INDEX = 'workflow-suite-builds';
const suiteBuildId = (suite, invocation) => createHash('sha256')
  .update(JSON.stringify([suite, invocation])).digest('hex');

function buildTimestamp(document, row) {
  if (!document || document.schema_version !== '1.0'
      || document.suite_build_id !== suiteBuildId(row.suite, row.invocationId)
      || document.telemetry_suite !== row.suite || document.invocation_id !== row.invocationId
      || !['gitlab', 'jenkins'].includes(document.ci_platform)
      || !['runtime', 'artifact', 'historical-ci-match'].includes(document.metadata_source)
      || !/^[1-9]\d*$/.test(document.ci_job_id)
      || typeof document.ci_job_name !== 'string' || !document.ci_job_name.trim()) return null;
  const value = document.ci_job_started_at;
  const time = Date.parse(value);
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
      || !Number.isFinite(time) || new Date(time).toISOString() !== value) return null;
  // Five minutes allows small CI/test host clock differences. Never substitute test time.
  const firstTest = Date.parse(row.firstTestTimestamp || row.timestamp);
  if (Number.isFinite(firstTest) && time > firstTest + 300_000) return null;
  try {
    const url = new URL(document.ci_job_url);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
    if (document.ci_platform === 'gitlab') {
      if (!url.pathname.endsWith(`/-/jobs/${document.ci_job_id}`) || document.ci_build_number) return null;
    } else {
      const name = url.pathname.split('/').slice(2, -1).filter((_, i) => i % 2 === 0)
        .map(decodeURIComponent).join('/');
      if (!/^(?:\/job\/[^/]+)+\/\d+$/.test(url.pathname)
          || !url.pathname.endsWith('/' + document.ci_job_id)
          || document.ci_build_number !== document.ci_job_id || document.ci_job_name !== name) return null;
    }
  } catch { return null; }
  return value;
}

async function attachBuildTimestamps(client, rows) {
  const documents = new Map();
  for (let offset = 0; offset < rows.length; offset += 250) {
    const ids = rows.slice(offset, offset + 250).map(row => suiteBuildId(row.suite, row.invocationId));
    const result = await client.mget(BUILD_INDEX, ids);
    if (!Array.isArray(result.docs) || result.docs.length !== ids.length) throw new Error('Incomplete CI metadata response');
    const pending = new Set(ids);
    for (const item of result.docs) {
      if (!pending.delete(item._id) || item.error) throw new Error('Invalid CI metadata response');
      if (item.found) documents.set(item._id, item._source);
    }
  }
  return rows.map(row => ({ ...row,
    buildTimestamp: buildTimestamp(documents.get(suiteBuildId(row.suite, row.invocationId)), row) }));
}

function compareRuns(field) {
  return (a, b) => {
    const time = row => Number.isFinite(Date.parse(row[field])) ? Date.parse(row[field]) : -Infinity;
    const left = time(a), right = time(b);
    if (left !== right) return right > left ? 1 : -1;
    const key = row => JSON.stringify([row.suite, row.invocationId]);
    return key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0;
  };
}

module.exports = { BUILD_INDEX, suiteBuildId, buildTimestamp, attachBuildTimestamps, compareRuns };
