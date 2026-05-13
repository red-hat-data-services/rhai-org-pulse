const fs = require('fs');
const path = require('path');

const STORAGE_KEY = 'ai-impact/test-plans.json';
const MAX_HISTORY = 20;

const DATA_DIR = path.join(__dirname, '..', '..', '..', '..', 'data');

function readTestPlans(readFromStorage) {
  const data = readFromStorage(STORAGE_KEY);
  if (!data || typeof data !== 'object' || !data.testPlans) {
    return { lastSyncedAt: null, lastJiraSyncAt: null, totalTestPlans: 0, testPlans: {} };
  }
  return data;
}

function writeTestPlansAtomic(data) {
  const filePath = path.resolve(DATA_DIR, STORAGE_KEY);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmpPath = filePath + '.tmp.' + process.pid;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

function trimForHistory(testPlan) {
  return {
    scores: testPlan.scores,
    score: testPlan.score,
    verdict: testPlan.verdict,
    autoRevised: testPlan.autoRevised,
    reviewedAt: testPlan.reviewedAt
  };
}

function upsertTestPlan(data, key, testPlan) {
  const existing = data.testPlans[key];

  if (!existing) {
    data.testPlans[key] = { latest: testPlan, history: [] };
    return 'created';
  }

  if (existing.latest.reviewedAt === testPlan.reviewedAt) {
    return 'unchanged';
  }

  const incomingDate = new Date(testPlan.reviewedAt);
  const latestDate = new Date(existing.latest.reviewedAt);

  if (incomingDate > latestDate) {
    const history = [trimForHistory(existing.latest), ...existing.history];
    existing.history = history.slice(0, MAX_HISTORY);
    existing.latest = testPlan;
    return 'updated';
  }

  const existsInHistory = existing.history.some(h => h.reviewedAt === testPlan.reviewedAt);
  if (existsInHistory) {
    return 'unchanged';
  }

  if (existing.history.length >= MAX_HISTORY) {
    const oldestInHistory = existing.history[existing.history.length - 1];
    const oldestDate = new Date(oldestInHistory.reviewedAt);
    if (incomingDate <= oldestDate) {
      return 'unchanged';
    }
  }

  const trimmed = trimForHistory(testPlan);
  const insertIdx = existing.history.findIndex(h => new Date(h.reviewedAt) < incomingDate);
  if (insertIdx === -1) {
    existing.history.push(trimmed);
  } else {
    existing.history.splice(insertIdx, 0, trimmed);
  }
  existing.history = existing.history.slice(0, MAX_HISTORY);
  return 'updated';
}

function getLatestProjection(data) {
  const projected = {};
  for (const [key, entry] of Object.entries(data.testPlans)) {
    const l = entry.latest;
    projected[key] = {
      key: l.key,
      feature: l.feature,
      sourceKey: l.sourceKey,
      score: l.score,
      verdict: l.verdict,
      scores: l.scores,
      autoRevised: l.autoRevised,
      components: l.components,
      testCaseCount: l.testCaseCount,
      jiraStatus: l.jiraStatus || null,
      jiraPriority: l.jiraPriority || null,
      labels: l.labels || null,
      humanReviewStatus: l.humanReviewStatus || null,
      reviewedAt: l.reviewedAt
    };
  }
  return {
    lastSyncedAt: data.lastSyncedAt,
    lastJiraSyncAt: data.lastJiraSyncAt || null,
    totalTestPlans: data.totalTestPlans,
    testPlans: projected
  };
}

function countHistoryEntries(data) {
  let count = 0;
  for (const entry of Object.values(data.testPlans)) {
    count += (entry.history ? entry.history.length : 0);
  }
  return count;
}

module.exports = {
  STORAGE_KEY,
  MAX_HISTORY,
  readTestPlans,
  writeTestPlansAtomic,
  trimForHistory,
  upsertTestPlan,
  getLatestProjection,
  countHistoryEntries
};
