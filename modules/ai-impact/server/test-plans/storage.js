const STORAGE_KEY = 'ai-impact/test-plans.json';
const MAX_HISTORY = 20;

async function readTestPlans(readFromStorage) {
  const data = await readFromStorage(STORAGE_KEY);
  if (!data || typeof data !== 'object' || !data.testPlans) {
    return { lastSyncedAt: null, lastJiraSyncAt: null, totalTestPlans: 0, testPlans: {} };
  }
  return data;
}

async function writeTestPlansAtomic(writeToStorage, data) {
  await writeToStorage(STORAGE_KEY, data);
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
    const history = [];

    // If test plan has beforeScore/beforeScores, create initial history entry
    // This represents the state before auto-revision
    if (testPlan.beforeScore !== null && testPlan.beforeScore !== undefined &&
        testPlan.beforeScores) {
      history.push({
        scores: testPlan.beforeScores,
        score: testPlan.beforeScore,
        verdict: testPlan.beforeScore >= 8 ? 'Ready' : (testPlan.beforeScore >= 6 ? 'Revise' : 'Rework'),
        autoRevised: false,
        reviewedAt: testPlan.reviewedAt
      });
    }

    data.testPlans[key] = { latest: testPlan, history };
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
