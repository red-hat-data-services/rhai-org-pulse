/** Lightweight filtering and pagination of complete suite/invocation run groups. */
const { createHash } = require('node:crypto');
/** Create paging helpers with the same release rules used by the client. */
module.exports = function createRecentRuns({ parseVersion, normalizeVersion, normalizeVersions, compareVersions, suiteLabel }) {
  const SORT_FIELDS = ['timestamp', 'version', 'suite', 'buildDate'];
  /** Reject an invalid paged request with a client-facing BAD_REQUEST error. */
  function invalid(message) { const error = new Error(message); error.code = 'BAD_REQUEST'; throw error; }
  /** Read a bounded optional query string and reject non-string values. */
  function text(value, name) {
    if (value === undefined) return '';
    if (typeof value !== 'string' || value.length > 256) invalid(`Invalid ${name}`);
    return value.trim();
  }
  /** Validate an inclusive UTC calendar date without accepting calendar overflow. */
  function date(value, name) {
    const input = text(value, name);
    if (!input) return '';
    const parsed = Date.parse(`${input}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input) || !Number.isFinite(parsed)
      || new Date(parsed).toISOString().slice(0, 10) !== input) invalid(`Invalid ${name}`);
    return input;
  }
  const hash = value => createHash('sha256').update(value).digest('hex');
  /** Validate paged filters and bind a cursor to the selected criteria. */
  function parseRecentRuns(query) {
    if (query.pageSize === undefined) {
      if (['cursor', 'sortDir', 'sortField', 'versions', 'runQuery', 'refresh', 'includeBugTickets'].some(key => query[key] !== undefined)) invalid('pageSize is required for recent-run pagination');
      return null;
    }
    if (typeof query.pageSize !== 'string' || !/^[1-9]\d*$/.test(query.pageSize) || Number(query.pageSize) > 200) invalid('pageSize must be an integer between 1 and 200');
    if (query.limit !== undefined || query.latest !== undefined || query.includeBugs === 'true') invalid('Paged run metadata cannot be combined with limit, latest, or bug enrichment');
    const version = text(query.version, 'version');
    if (query.versions !== undefined && query.version !== undefined) invalid('Use versions or version, not both');
    const rawVersions = query.versions === undefined ? (version ? [version] : []) : Array.isArray(query.versions) ? query.versions : [query.versions];
    if (rawVersions.length > 50) invalid('Select at most 50 versions');
    const selected = rawVersions.map(value => text(value, 'versions'));
    if (selected.some(value => !value)) invalid('Invalid versions');
    const filters = { versions: normalizeVersions(selected), suite: text(query.suite, 'suite'),
      runQuery: text(query.runQuery, 'runQuery').toLowerCase(), dateFrom: date(query.dateFrom, 'dateFrom'), dateTo: date(query.dateTo, 'dateTo') };
    if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) invalid('dateFrom must not be after dateTo');
    const direction = query.sortDir === undefined ? 'desc' : text(query.sortDir, 'sortDir');
    const sortField = query.sortField === undefined ? 'timestamp' : text(query.sortField, 'sortField');
    if (!['asc', 'desc'].includes(direction)) invalid('sortDir must be asc or desc');
    if (!SORT_FIELDS.includes(sortField)) invalid('Invalid sortField');
    if (query.refresh !== undefined && !['true', 'false'].includes(query.refresh)) invalid('refresh must be true or false');
    if (query.includeBugTickets !== undefined && !['true', 'false'].includes(query.includeBugTickets)) invalid('includeBugTickets must be true or false');
    const pageSize = Number(query.pageSize);
    const scope = hash(JSON.stringify([filters, sortField, direction, pageSize]));
    // Earlier date-sorted bookmarks used a single exact version and v1/v2 cursors.
    const legacyFilters = { version: selected[0] || '', suite: filters.suite, runQuery: filters.runQuery, dateFrom: filters.dateFrom, dateTo: filters.dateTo };
    const legacyScope = hash(JSON.stringify([legacyFilters, direction, pageSize]));
    let cursor = null;
    if (query.cursor) {
      if (typeof query.cursor !== 'string' || query.cursor.length > 8192 || !/^[\w-]+$/.test(query.cursor)) invalid('Invalid recent-run cursor');
      try { cursor = JSON.parse(Buffer.from(query.cursor, 'base64url').toString()); } catch { invalid('Invalid recent-run cursor'); }
      const legacy = [1, 2].includes(cursor?.v) && sortField === 'timestamp' && selected.length <= 1;
      const validScope = cursor?.scope === scope || (legacy && cursor.scope === legacyScope);
      const value = cursor?.anchor?.[0];
      const validValue = ['timestamp', 'buildDate'].includes(sortField) ? value === null || (Number.isSafeInteger(value) && Number.isFinite(new Date(value).getTime()))
        : sortField === 'suite' ? value === null : value === null || (typeof value === 'string' && value.length <= 256);
      if ((!legacy && cursor?.v !== 3) || !validScope || !['after', 'before'].includes(cursor.direction)
        || !Array.isArray(cursor.anchor) || cursor.anchor.length !== 3 || !validValue
        || !cursor.anchor.slice(1).every(value => typeof value === 'string' && value.length > 0
          && (cursor.v === 1 || /^[a-f0-9]{64}$/.test(value)))) invalid('Cursor does not match the current filters and sorting');
    } else if (query.cursor !== undefined && typeof query.cursor !== 'string') invalid('Invalid recent-run cursor');
    return { filters, direction, sortField, pageSize, scope, cursor, refresh: query.refresh === 'true' };
  }
  /** Convert a recorded timestamp to milliseconds; invalid or missing timestamps sort last. */
  function time(value) { const parsed = typeof value === 'string' && value ? Date.parse(value) : NaN; return Number.isFinite(parsed) ? parsed : null; }
  /** Return a comparable release label; missing and unparseable versions sort last. */
  function versionValue(row) { const value = normalizeVersion(row.rhoaiVersion); return parseVersion(value) ? value : null; }
  /** Select the normalized value used to order the requested column. */
  function sortValue(row, field) {
    if (field === 'buildDate') return time(row.buildDate);
    return field === 'timestamp' ? time(row.timestamp) : field === 'version' ? versionValue(row) : suiteLabel(row.suite);
  }
  /** Compare valid values in the selected direction while keeping null values last. */
  function compareValues(a, b, field, direction) {
    if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
    const value = ['timestamp', 'buildDate'].includes(field) ? a - b : field === 'version' ? compareVersions(a, b)
      : a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });
    return value * (direction === 'asc' ? 1 : -1);
  }
  /** Order rows globally, then break ties by their exact suite and invocation identity. */
  function compareRows(a, b, field, direction) {
    const order = compareValues(sortValue(a, field), sortValue(b, field), field, direction);
    if (order) return order;
    const left = JSON.stringify([a.suite, a.invocationId]), right = JSON.stringify([b.suite, b.invocationId]);
    return left < right ? -1 : left > right ? 1 : 0;
  }
  /** Check the complete run identity independently of mutable sort metadata. */
  function sameRun(a, b) { return a.suite === b.suite && a.invocationId === b.invocationId; }
  /** Filter complete groups, sort globally, and return a stable anchored page. */
  function pageRecentRuns(allRows, request) {
    const { filters, direction, sortField, pageSize, scope, cursor } = request;
    const available = allRows.filter(row => typeof row.suite === 'string' && row.suite && typeof row.invocationId === 'string' && row.invocationId);
    const options = { versions: normalizeVersions(available.map(row => row.rhoaiVersion)), suites: [...new Set(available.map(row => row.suite))].sort() };
    const from = filters.dateFrom ? Date.parse(`${filters.dateFrom}T00:00:00Z`) : null;
    const until = filters.dateTo ? Date.parse(`${filters.dateTo}T00:00:00Z`) + 86400000 : null;
    const rows = available.filter(row => {
      const recorded = time(row.timestamp);
      return (!filters.versions.length || filters.versions.includes(normalizeVersion(row.rhoaiVersion)))
        && (!filters.suite || row.suite === filters.suite)
        && (!filters.runQuery || row.invocationId.toLowerCase().includes(filters.runQuery))
        && (from === null || (recorded !== null && recorded >= from)) && (until === null || (recorded !== null && recorded < until));
    }).sort((a, b) => compareRows(a, b, sortField, direction));
    let origin;
    if (cursor) origin = available.find(row => cursor.v === 1
      ? row.suite === cursor.anchor[1] && row.invocationId === cursor.anchor[2]
      : hash(row.suite) === cursor.anchor[1] && hash(row.invocationId) === cursor.anchor[2]);
    let candidates = rows;
    if (cursor) {
      if (!origin) candidates = [];
      else {
        const anchored = { ...origin };
        if (sortField === 'timestamp') anchored.timestamp = cursor.anchor[0] === null ? null : new Date(cursor.anchor[0]).toISOString();
        if (sortField === 'version') anchored.rhoaiVersion = cursor.anchor[0];
        if (sortField === 'buildDate') anchored.buildDate = cursor.anchor[0] === null ? null : new Date(cursor.anchor[0]).toISOString();
        candidates = rows.filter(row => !sameRun(row, origin) && (cursor.direction === 'after'
          ? compareRows(row, anchored, sortField, direction) > 0 : compareRows(row, anchored, sortField, direction) < 0));
      }
    }
    const page = cursor?.direction === 'before' ? candidates.slice(-pageSize) : candidates.slice(0, pageSize);
    const start = page.length ? rows.indexOf(page[0]) : -1, end = start + page.length;
    const encode = (row, way) => Buffer.from(JSON.stringify({ v: 3, scope, direction: way,
      anchor: [sortField === 'suite' ? null : sortValue(row, sortField), hash(row.suite), hash(row.invocationId)] })).toString('base64url');
    return { rows: page.map(({ suite, invocationId, timestamp, rhoaiVersion, buildDate = null, buildDateStatus = null }) => ({
      suite, invocationId, timestamp, rhoaiVersion, buildDate, buildDateStatus })),
      total: rows.length, pageSize, start: start < 0 ? 0 : start + 1, end: start < 0 ? 0 : end,
      nextCursor: page.length && end < rows.length ? encode(page.at(-1), 'after') : null,
      previousCursor: page.length && start > 0 ? encode(page[0], 'before') : !page.length && rows.length && cursor ? '' : null,
      options, sortField, sortDir: direction };
  }
  return { parseRecentRuns, pageRecentRuns };
};
