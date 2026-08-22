const STORAGE_KEY = 'system-health/quality/reports.json';
const HTML_PREFIX = 'system-health/quality/html/';
const MAX_HISTORY = 52;

async function readReports(readFromStorage) {
  const data = await readFromStorage(STORAGE_KEY);
  if (!data || typeof data !== 'object' || !data.reports) {
    return { lastSyncedAt: null, totalReports: 0, reports: {} };
  }
  return data;
}

async function writeReportsAtomic(writeToStorage, data) {
  await writeToStorage(STORAGE_KEY, data);
}

function trimForHistory(report) {
  return {
    overallScore: report.overallScore,
    gapCount: Array.isArray(report.criticalGaps) ? report.criticalGaps.length : 0,
    assessedAt: report.assessedAt
  };
}

function repoKeyFromSlug(repository) {
  return repository.replace('/', '--');
}

const POISONED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function upsertReport(data, repoKey, report) {
  if (POISONED_KEYS.has(repoKey)) {
    return 'unchanged';
  }
  const existing = data.reports[repoKey];

  if (!existing) {
    data.reports[repoKey] = { latest: report, history: [] };
    return 'created';
  }

  if (existing.latest.assessedAt === report.assessedAt) {
    return 'unchanged';
  }

  const incomingDate = new Date(report.assessedAt);
  const latestDate = new Date(existing.latest.assessedAt);

  if (incomingDate > latestDate) {
    const history = [trimForHistory(existing.latest), ...existing.history];
    existing.history = history.slice(0, MAX_HISTORY);
    existing.latest = report;
    return 'updated';
  }

  const existsInHistory = existing.history.some(function(h) {
    return h.assessedAt === report.assessedAt;
  });
  if (existsInHistory) {
    return 'unchanged';
  }

  if (existing.history.length >= MAX_HISTORY) {
    const oldestInHistory = existing.history[existing.history.length - 1];
    const oldestDate = new Date(oldestInHistory.assessedAt);
    if (incomingDate <= oldestDate) {
      return 'unchanged';
    }
  }

  const trimmed = trimForHistory(report);
  const insertIdx = existing.history.findIndex(function(h) {
    return new Date(h.assessedAt) < incomingDate;
  });
  if (insertIdx === -1) {
    existing.history.push(trimmed);
  } else {
    existing.history.splice(insertIdx, 0, trimmed);
  }
  existing.history = existing.history.slice(0, MAX_HISTORY);
  return 'updated';
}

function getListProjection(data) {
  const projected = {};
  for (const [key, entry] of Object.entries(data.reports)) {
    const r = entry.latest;
    projected[key] = {
      repository: r.repository,
      overallScore: r.overallScore,
      tier: r.tier || null,
      component: r.component || null,
      team: r.team || null,
      githubUrl: r.githubUrl || null,
      hasHtmlReport: r.hasHtmlReport || false,
      gapCount: Array.isArray(r.criticalGaps) ? r.criticalGaps.length : 0,
      assessedAt: r.assessedAt,
      historyLength: entry.history.length
    };
  }
  return {
    lastSyncedAt: data.lastSyncedAt,
    totalReports: data.totalReports,
    reports: projected
  };
}

function countHistoryEntries(data) {
  let count = 0;
  for (const entry of Object.values(data.reports)) {
    count += (entry.history ? entry.history.length : 0);
  }
  return count;
}

async function readHtmlReport(readFromStorage, repoKey) {
  if (POISONED_KEYS.has(repoKey)) return null;
  return readFromStorage(HTML_PREFIX + repoKey + '.html');
}

async function writeHtmlReport(writeToStorage, repoKey, html) {
  if (POISONED_KEYS.has(repoKey)) return;
  await writeToStorage(HTML_PREFIX + repoKey + '.html', html);
}

module.exports = {
  STORAGE_KEY,
  HTML_PREFIX,
  MAX_HISTORY,
  readReports,
  writeReportsAtomic,
  trimForHistory,
  repoKeyFromSlug,
  upsertReport,
  getListProjection,
  countHistoryEntries,
  readHtmlReport,
  writeHtmlReport
};
