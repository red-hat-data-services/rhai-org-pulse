const STORAGE_KEY = 'ai-impact/decomposer.json';

/**
 * Empty decomposer snapshot returned when nothing has been pushed yet.
 */
function emptySnapshot() {
  return {
    lastSyncedAt: null,
    schemaVersion: null,
    generatedAt: null,
    source: null,
    signalNames: [],
    investigationSignalNames: [],
    counts: { runs: 0, strategies: 0 },
    aggregates: null,
    runs: [],
    strategies: []
  };
}

/**
 * Read the stored decomposer snapshot with a null/malformed guard.
 * @param {Function} readFromStorage - The storage read function
 * @returns {object} Decomposer snapshot (never null)
 */
async function readDecomposer(readFromStorage) {
  const data = await readFromStorage(STORAGE_KEY);
  if (!data || typeof data !== 'object' || !Array.isArray(data.runs)) {
    return emptySnapshot();
  }
  return data;
}

/**
 * Atomic write via the shared storage abstraction.
 * @param {Function} writeToStorage - The storage write function
 * @param {object} snapshot - The projected snapshot to persist
 */
async function writeDecomposer(writeToStorage, snapshot) {
  await writeToStorage(STORAGE_KEY, snapshot);
}

/**
 * Slim a single run down to the fields the dashboard tab renders.
 * Drops the per-strategy `results[]` — charts key off run-level totals.
 * @param {object} run - A run entry from the canonical data.json
 */
function slimRun(run) {
  return {
    run_id: run.run_id,
    started: run.started,
    completed: run.completed,
    duration_minutes: run.duration_minutes,
    total: run.total,
    passed: run.passed,
    failed: run.failed,
    errors: run.errors,
    avg_score: run.avg_score,
    score_max: run.score_max,
    submitted_epics: run.submitted_epics
  };
}

/**
 * Slim a single epic to the fields shown in the expanded strategy view.
 * Drops per-epic signal maps and body markdown (dashboard-only).
 * @param {object} epic - An epic entry from a strategy
 */
function slimEpic(epic) {
  return {
    epic_id: epic.epic_id,
    title: epic.title,
    type: epic.type,
    implementation_type: epic.implementation_type,
    priority: epic.priority,
    component: epic.component,
    ai_implementability: epic.ai_implementability,
    jira_key: epic.jira_key,
    dependencies: Array.isArray(epic.dependencies) ? epic.dependencies : []
  };
}

/**
 * Slim a single strategy for the list + expandable detail view. Keeps the
 * `mermaid_dag` and a slim `epics[]` so a row can expand to show the DAG and
 * its epics; drops the heavy dashboard-only `epic_bodies` (kept out of the
 * subset entirely) and per-epic signal maps.
 * @param {object} strat - A strategy entry from the canonical data.json
 */
function slimStrategy(strat) {
  const review = strat.review || {};
  return {
    strat_id: strat.strat_id,
    title: strat.title,
    priority: strat.priority,
    epic_count: strat.epic_count,
    critical_path_length: strat.critical_path_length,
    revised: strat.revised,
    mermaid_dag: strat.mermaid_dag || '',
    review: {
      score: review.score,
      pass: review.pass,
      recommendation: review.recommendation
    },
    epics: Array.isArray(strat.epics) ? strat.epics.map(slimEpic) : [],
    run_history: Array.isArray(strat.run_history) ? strat.run_history : []
  };
}

/**
 * Project the full canonical data.json (dashboard superset) down to the
 * subset Org Pulse persists and renders. The pipeline pushes the whole
 * document; we skim off what the Feature Decomposer tab needs.
 * @param {object} doc - The validated canonical data.json
 * @returns {object} The subset snapshot to store
 */
function projectSnapshot(doc) {
  const strategies = doc.strategies && typeof doc.strategies === 'object'
    ? Object.values(doc.strategies).map(slimStrategy)
    : [];
  return {
    lastSyncedAt: null, // stamped by the route on write
    schemaVersion: doc.schema_version || null,
    generatedAt: doc.generated_at || null,
    source: doc.source || null,
    signalNames: Array.isArray(doc.signal_names) ? doc.signal_names : [],
    investigationSignalNames: Array.isArray(doc.investigation_signal_names) ? doc.investigation_signal_names : [],
    counts: doc.counts || { runs: (doc.runs || []).length, strategies: strategies.length },
    aggregates: doc.aggregates || null,
    runs: Array.isArray(doc.runs) ? doc.runs.map(slimRun) : [],
    strategies
  };
}

module.exports = {
  STORAGE_KEY,
  emptySnapshot,
  readDecomposer,
  writeDecomposer,
  slimRun,
  slimEpic,
  slimStrategy,
  projectSnapshot
};
