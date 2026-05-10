const fs = require('fs');
const path = require('path');

const STORAGE_KEY = 'ai-impact/component-onboarding-data.json';
const MAX_HISTORY = 20;

const DATA_DIR = path.join(__dirname, '..', '..', '..', '..', 'data');

function readComponentOnboarding(readFromStorage) {
  const data = readFromStorage(STORAGE_KEY);
  if (!data || typeof data !== 'object' || !data.components) {
    return { fetchedAt: null, totalComponents: 0, components: {} };
  }
  return data;
}

function writeComponentOnboardingAtomic(data) {
  const filePath = path.resolve(DATA_DIR, STORAGE_KEY);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmpPath = filePath + '.tmp.' + process.pid;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

function trimForHistory(component) {
  return {
    completionStatus: component.completionStatus,
    onboardingSteps: component.onboardingSteps,
    syncedAt: component.syncedAt
  };
}

/**
 * Upsert a single component into the data object (mutates in place).
 * Idempotency key: syncedAt.
 * @returns {'created' | 'updated' | 'unchanged'}
 */
function upsertComponent(data, key, component) {
  const existing = data.components[key];

  if (!existing) {
    data.components[key] = { latest: component, history: [] };
    return 'created';
  }

  if (existing.latest.syncedAt === component.syncedAt) {
    return 'unchanged';
  }

  const incomingDate = new Date(component.syncedAt);
  const latestDate = new Date(existing.latest.syncedAt);

  if (incomingDate > latestDate) {
    const history = [trimForHistory(existing.latest), ...existing.history];
    existing.history = history.slice(0, MAX_HISTORY);
    existing.latest = component;
    return 'updated';
  }

  const existsInHistory = existing.history.some(h => h.syncedAt === component.syncedAt);
  if (existsInHistory) return 'unchanged';

  if (existing.history.length >= MAX_HISTORY) {
    const oldest = existing.history[existing.history.length - 1];
    if (incomingDate <= new Date(oldest.syncedAt)) return 'unchanged';
  }

  const trimmed = trimForHistory(component);
  const insertIdx = existing.history.findIndex(h => new Date(h.syncedAt) < incomingDate);
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
  for (const [key, entry] of Object.entries(data.components)) {
    projected[key] = {
      key: entry.latest.key,
      summary: entry.latest.summary,
      status: entry.latest.status,
      completionStatus: entry.latest.completionStatus,
      productContext: entry.latest.productContext,
      componentName: entry.latest.componentName,
      linkedFeatures: entry.latest.linkedFeatures,
      onboardingSteps: entry.latest.onboardingSteps,
      created: entry.latest.created,
      resolved: entry.latest.resolved,
      syncedAt: entry.latest.syncedAt
    };
  }
  return {
    fetchedAt: data.fetchedAt,
    totalComponents: data.totalComponents,
    components: projected
  };
}

function countHistoryEntries(data) {
  let count = 0;
  for (const entry of Object.values(data.components)) {
    count += entry.history ? entry.history.length : 0;
  }
  return count;
}

module.exports = {
  STORAGE_KEY,
  MAX_HISTORY,
  readComponentOnboarding,
  writeComponentOnboardingAtomic,
  trimForHistory,
  upsertComponent,
  getLatestProjection,
  countHistoryEntries
};
