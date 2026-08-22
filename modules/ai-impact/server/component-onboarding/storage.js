const { deriveCompletionStatus } = require('./validation');

const STORAGE_KEY = 'ai-impact/component-onboarding-data.json';
const MAX_HISTORY = 20;

async function readComponentOnboarding(readFromStorage) {
  const data = await readFromStorage(STORAGE_KEY);
  if (!data || typeof data !== 'object' || !data.components) {
    return { fetchedAt: null, totalComponents: 0, components: {} };
  }
  return data;
}

async function writeComponentOnboardingAtomic(writeToStorage, data) {
  await writeToStorage(STORAGE_KEY, data);
}

function trimForHistory(component) {
  return {
    completionStatus: component.completionStatus,
    onboardingSteps: component.onboardingSteps,
    onboardingMethod: component.onboardingMethod,
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

function projectComponent(entry) {
  const latest = entry.latest;
  // Re-derive from the latest stored Jira status so the bucket always matches
  // current status (New→in_queue, Resolved→completed, else in-progress).
  return {
    key: latest.key,
    summary: latest.summary,
    status: latest.status,
    completionStatus: deriveCompletionStatus(latest.status, latest.completionStatus, {
      labels: latest.labels || [],
      resolution: latest.resolution || null,
      statusCategory: latest.statusCategory || null
    }),
    productContext: latest.productContext,
    targetVersion: latest.targetVersion || null,
    componentName: latest.componentName,
    repoUrl: latest.repoUrl || '',
    branch: latest.branch || '',
    dockerfilePath: latest.dockerfilePath || '',
    isOperator: latest.isOperator || false,
    linkedFeatures: latest.linkedFeatures,
    featureTitles: latest.featureTitles || {},
    labels: latest.labels || [],
    onboardingSteps: latest.onboardingSteps,
    created: latest.created,
    resolution: latest.resolution || null,
    resolved: latest.resolved,
    validationDate: latest.validationDate || null,
    onboardingMethod: latest.onboardingMethod || 'automated',
    firstCommentDate: latest.firstCommentDate || null,
    contextPath: latest.contextPath || '',
    statusCategory: latest.statusCategory || null,
    syncedAt: latest.syncedAt
  };
}

function getLatestProjection(data, options) {
  const versionFilter = options?.version || null;
  const projected = {};
  for (const [key, entry] of Object.entries(data.components)) {
    const item = projectComponent(entry);
    if (versionFilter && item.targetVersion !== versionFilter) continue;
    projected[key] = item;
  }
  return {
    fetchedAt: data.fetchedAt,
    totalComponents: versionFilter ? Object.keys(projected).length : data.totalComponents,
    components: projected,
    availableVersions: getAvailableVersions(data)
  };
}

function getAvailableVersions(data) {
  const versions = new Set();
  for (const entry of Object.values(data.components)) {
    if (entry.latest?.targetVersion) versions.add(entry.latest.targetVersion);
  }
  return Array.from(versions).sort();
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
  projectComponent,
  getLatestProjection,
  getAvailableVersions,
  countHistoryEntries
};
