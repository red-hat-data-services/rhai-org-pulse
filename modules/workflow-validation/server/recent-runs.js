/** Lightweight filtering and pagination of complete suite/invocation run groups. */
const { createHash } = require('node:crypto');

/** Reject invalid query values before querying OpenSearch. */
function invalid(message) {
  const error = new Error(message);
  error.code = 'BAD_REQUEST';
  throw error;
}

/** Normalize a bounded optional filter string. */
function text(value, name) {
  if (value === undefined) return '';
  if (typeof value !== 'string' || value.length > 256) invalid(`Invalid ${name}`);
  return value.trim();
}

/** Accept only real UTC calendar dates in YYYY-MM-DD format. */
function date(value, name) {
  const input = text(value, name);
  if (!input) return '';
  const time = Date.parse(`${input}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input) || !Number.isFinite(time)
    || new Date(time).toISOString().slice(0, 10) !== input) invalid(`Invalid ${name}`);
  return input;
}

/** Validate paged queries and query-bound cursors; return null for legacy callers. */
function parseRecentRuns(query) {
  if (query.pageSize === undefined) {
    if (query.cursor !== undefined || query.sortDir !== undefined || query.runQuery !== undefined || query.refresh !== undefined) {
      invalid('pageSize is required for recent-run pagination');
    }
    return null;
  }
  if (typeof query.pageSize !== 'string' || !/^[1-9]\d*$/.test(query.pageSize) || Number(query.pageSize) > 200) {
    invalid('pageSize must be an integer between 1 and 200');
  }
  if (query.limit !== undefined || query.latest !== undefined || query.includeBugs === 'true') {
    invalid('Paged run metadata cannot be combined with limit, latest, or bug enrichment');
  }
  const filters = {
    version: text(query.version, 'version'), suite: text(query.suite, 'suite'),
    runQuery: text(query.runQuery, 'runQuery').toLowerCase(),
    dateFrom: date(query.dateFrom, 'dateFrom'), dateTo: date(query.dateTo, 'dateTo')
  };
  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) invalid('dateFrom must not be after dateTo');
  const direction = query.sortDir === undefined ? 'desc' : text(query.sortDir, 'sortDir');
  if (!['asc', 'desc'].includes(direction)) invalid('sortDir must be asc or desc');
  if (query.refresh !== undefined && !['true', 'false'].includes(query.refresh)) invalid('refresh must be true or false');
  const pageSize = Number(query.pageSize);
  const scope = createHash('sha256').update(JSON.stringify([filters, direction, pageSize])).digest('hex');
  let cursor = null;
  if (query.cursor) {
    if (typeof query.cursor !== 'string' || query.cursor.length > 8192 || !/^[\w-]+$/.test(query.cursor)) invalid('Invalid recent-run cursor');
    try { cursor = JSON.parse(Buffer.from(query.cursor, 'base64url').toString()); } catch { invalid('Invalid recent-run cursor'); }
    if (![1, 2].includes(cursor?.v) || cursor.scope !== scope || !['after', 'before'].includes(cursor.direction)
      || !Array.isArray(cursor.anchor) || cursor.anchor.length !== 3
      || !(cursor.anchor[0] === null || Number.isSafeInteger(cursor.anchor[0]))
      || !cursor.anchor.slice(1).every(value => typeof value === 'string' && value.length > 0
        && (cursor.v === 1 || /^[a-f0-9]{64}$/.test(value)))) {
      invalid('Cursor does not match the current filters and sorting');
    }
  } else if (query.cursor !== undefined && typeof query.cursor !== 'string') invalid('Invalid recent-run cursor');
  return { filters, direction, pageSize, scope, cursor, refresh: query.refresh === 'true' };
}

/** Parse recorded execution time; missing or invalid dates sort last. */
function time(value) {
  const parsed = typeof value === 'string' && value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

/** Bound cursor length without truncating suite or invocation IDs. */
function identityHash(value) { return createHash('sha256').update(value).digest('hex'); }

/** Keep full identities for stable ordering without changing stored IDs. */
function anchor(row) { return [time(row.timestamp), row.suite, row.invocationId]; }

/** Order recorded times first, with exact suite/invocation ties and missing times last. */
function compare(left, right, direction) {
  if (left[0] !== right[0]) {
    if (left[0] === null) return 1;
    if (right[0] === null) return -1;
    return (left[0] - right[0]) * (direction === 'asc' ? 1 : -1);
  }
  const a = JSON.stringify(left.slice(1)), b = JSON.stringify(right.slice(1));
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Filter a complete metadata snapshot and return one page around an opaque anchor. */
function pageRecentRuns(allRows, request) {
  const { filters, direction, pageSize, scope, cursor } = request;
  const available = allRows.filter(row => typeof row.suite === 'string' && row.suite
    && typeof row.invocationId === 'string' && row.invocationId);
  const options = {
    versions: [...new Set(available.map(row => row.rhoaiVersion).filter(value => typeof value === 'string' && value))].sort((a, b) => b.localeCompare(a, undefined, { numeric: true })),
    suites: [...new Set(available.map(row => row.suite))].sort()
  };
  const from = filters.dateFrom ? Date.parse(`${filters.dateFrom}T00:00:00Z`) : null;
  const until = filters.dateTo ? Date.parse(`${filters.dateTo}T00:00:00Z`) + 86400000 : null;
  const rows = available.filter(row => {
    const recorded = time(row.timestamp);
    return (!filters.version || row.rhoaiVersion === filters.version)
      && (!filters.suite || row.suite === filters.suite)
      && (!filters.runQuery || row.invocationId.toLowerCase().includes(filters.runQuery))
      && (from === null || (recorded !== null && recorded >= from))
      && (until === null || (recorded !== null && recorded < until));
  }).sort((a, b) => compare(anchor(a), anchor(b), direction));
  let cursorAnchor = cursor?.anchor;
  if (cursor?.v === 2) {
    const origin = available.find(row => identityHash(row.suite) === cursor.anchor[1]
      && identityHash(row.invocationId) === cursor.anchor[2]);
    cursorAnchor = origin ? [cursor.anchor[0], origin.suite, origin.invocationId] : null;
  }
  let candidates = rows;
  if (cursor) candidates = cursorAnchor ? rows.filter(row => cursor.direction === 'after'
    ? compare(anchor(row), cursorAnchor, direction) > 0
    : compare(anchor(row), cursorAnchor, direction) < 0) : [];
  const page = cursor?.direction === 'before' ? candidates.slice(-pageSize) : candidates.slice(0, pageSize);
  const start = page.length ? rows.indexOf(page[0]) : -1;
  const end = start + page.length;
  const encode = (row, way) => Buffer.from(JSON.stringify({ v: 2, scope, direction: way,
    anchor: [time(row.timestamp), identityHash(row.suite), identityHash(row.invocationId)] })).toString('base64url');
  return {
    rows: page.map(({ suite, invocationId, timestamp, rhoaiVersion }) => ({ suite, invocationId, timestamp, rhoaiVersion })),
    total: rows.length, pageSize, start: start < 0 ? 0 : start + 1, end: start < 0 ? 0 : end,
    nextCursor: page.length && end < rows.length ? encode(page.at(-1), 'after') : null,
    previousCursor: page.length && start > 0 ? encode(page[0], 'before')
      : !page.length && rows.length && cursor ? '' : null,
    options, sortField: 'timestamp', sortDir: direction
  };
}

module.exports = { parseRecentRuns, pageRecentRuns };
