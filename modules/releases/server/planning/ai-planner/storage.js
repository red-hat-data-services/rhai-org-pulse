const STORAGE_KEY = 'releases/planning/ai-planner.json';

function emptySnapshot() {
  return {
    lastSyncedAt: null,
    dataDate: null,
    featureCount: 0,
    features: [],
    bugQueue: [],
    metadata: {
      source: 'csv-export',
      version: '1.0'
    }
  };
}

async function readAIPlanner(readFromStorage) {
  const data = await readFromStorage(STORAGE_KEY);
  if (!data || typeof data !== 'object' || !Array.isArray(data.features)) {
    return emptySnapshot();
  }
  return data;
}

async function writeAIPlanner(writeToStorage, snapshot) {
  await writeToStorage(STORAGE_KEY, snapshot);
}

function projectSnapshot(doc) {
  const features = Array.isArray(doc.features) ? doc.features : [];
  const bugQueue = Array.isArray(doc.bugQueue) ? doc.bugQueue : [];

  return {
    lastSyncedAt: new Date().toISOString(),
    dataDate: doc.dataDate || null,
    featureCount: features.length,
    features: features.map(f => ({
      Key: f.Key,
      Summary: f.Summary,
      Components: Array.isArray(f.Components) ? f.Components : [],
      RICE: f.RICE || 0,
      PlannedFor: f.PlannedFor || '',
      Status: f.Status || '',
      PM: f.PM || '',
      DeliveryOwner: f.DeliveryOwner || '',
      Priority: f.Priority || '',
      FPDoR: f.FPDoR || '0/17',
      Confidence: f.Confidence || 'not-ready',
      XTeam: f.XTeam || ''
    })),
    bugQueue: bugQueue.map(b => ({
      component: b.component,
      blocker: b.blocker || 0,
      critical: b.critical || 0,
      total: (b.blocker || 0) + (b.critical || 0)
    })),
    metadata: {
      source: doc.source || 'csv-export',
      version: '1.0'
    }
  };
}

module.exports = {
  STORAGE_KEY,
  emptySnapshot,
  readAIPlanner,
  writeAIPlanner,
  projectSnapshot
};
