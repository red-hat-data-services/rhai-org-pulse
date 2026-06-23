const STORAGE_KEY = 'system-health/disconnected/reports.json';
const MAX_HISTORY = 90;

function readReports(readFromStorage) {
  const data = readFromStorage(STORAGE_KEY);
  if (!data || typeof data !== 'object' || !data.repos) {
    return { lastSyncedAt: null, repoCount: 0, repos: {} };
  }
  return data;
}

function writeReportsAtomic(writeToStorageAtomic, data) {
  writeToStorageAtomic(STORAGE_KEY, data);
}

function trimForHistory(report) {
  return {
    score: report.score,
    blockerCount: report.blockerCount,
    infoCount: report.infoCount,
    ruleCount: report.ruleCount,
    rulesPassedCount: report.rulesPassedCount,
    date: report.date
  };
}

function buildLatest(report) {
  const totalBlockers = report.rules.reduce((sum, r) => sum + (r.blockers || 0), 0);
  const totalInfos = report.rules.reduce((sum, r) => sum + (r.infos || 0), 0);
  const rulesPassed = report.rules.filter(r => r.passed).length;

  return {
    repo: report.repo,
    date: report.date,
    score: report.score,
    blockerCount: totalBlockers,
    infoCount: totalInfos,
    ruleCount: report.rules.length,
    rulesPassedCount: rulesPassed,
    rules: report.rules,
    false_positive_help: report.false_positive_help || null
  };
}

function toDay(dateStr) {
  return dateStr ? dateStr.slice(0, 10) : '';
}

function upsertReport(data, report) {
  const key = report.repo;
  const latest = buildLatest(report);
  const existing = data.repos[key];

  if (!existing) {
    data.repos[key] = { latest, history: [] };
    return 'created';
  }

  const incomingDay = toDay(report.date);
  const latestDay = toDay(existing.latest.date);

  if (incomingDay === latestDay) {
    existing.latest = latest;
    return 'updated';
  }

  const incomingDate = new Date(report.date);
  const latestDate = new Date(existing.latest.date);

  if (incomingDate > latestDate) {
    const existingDay = toDay(existing.latest.date);
    const alreadyInHistory = existing.history.some(h => toDay(h.date) === existingDay);
    if (!alreadyInHistory) {
      const history = [trimForHistory(existing.latest), ...existing.history];
      existing.history = history.slice(0, MAX_HISTORY);
    }
    existing.latest = latest;
    return 'updated';
  }

  const dayExistsInHistory = existing.history.some(h => toDay(h.date) === incomingDay);
  if (dayExistsInHistory) {
    return 'unchanged';
  }

  if (existing.history.length >= MAX_HISTORY) {
    const oldestDate = new Date(existing.history[existing.history.length - 1].date);
    if (incomingDate <= oldestDate) {
      return 'unchanged';
    }
  }

  const trimmed = trimForHistory(latest);
  const insertIdx = existing.history.findIndex(h => new Date(h.date) < incomingDate);
  if (insertIdx === -1) {
    existing.history.push(trimmed);
  } else {
    existing.history.splice(insertIdx, 0, trimmed);
  }
  existing.history = existing.history.slice(0, MAX_HISTORY);
  return 'updated';
}


function computeTrend(latest, history) {
  if (!history || history.length === 0) return { direction: 'new', blockerDelta: 0 };

  const prev = history[0];
  const blockerDelta = latest.blockerCount - prev.blockerCount;

  let direction = 'stable';
  if (latest.score === 'READY' && prev.score !== 'READY') direction = 'up';
  else if (latest.score !== 'READY' && prev.score === 'READY') direction = 'down';
  else if (blockerDelta < 0) direction = 'up';
  else if (blockerDelta > 0) direction = 'down';

  return { direction, blockerDelta };
}

function getSummaryProjection(data) {
  const repos = [];
  let readyCount = 0;
  let notReadyCount = 0;

  for (const key of Object.keys(data.repos)) {
    const entry = data.repos[key];
    const { latest } = entry;
    if (latest.score === 'READY') readyCount++;
    else if (latest.score === 'NOT READY') notReadyCount++;

    const trend = computeTrend(latest, entry.history);

    repos.push({
      repo: latest.repo,
      storageKey: latest.repo.replace('/', '--'),
      score: latest.score,
      blockerCount: latest.blockerCount,
      infoCount: latest.infoCount,
      ruleCount: latest.ruleCount,
      rulesPassedCount: latest.rulesPassedCount,
      lastScanDate: latest.date,
      historyLength: entry.history.length,
      trend
    });
  }

  const scoredCount = readyCount + notReadyCount;
  return {
    lastSyncedAt: data.lastSyncedAt,
    repoCount: repos.length,
    readyCount,
    notReadyCount,
    readinessPercent: scoredCount > 0 ? Math.round((readyCount / scoredCount) * 100) : 0,
    repos
  };
}

module.exports = {
  STORAGE_KEY,
  MAX_HISTORY,
  readReports,
  writeReportsAtomic,
  trimForHistory,
  buildLatest,
  toDay,
  upsertReport,
  computeTrend,
  getSummaryProjection
};
