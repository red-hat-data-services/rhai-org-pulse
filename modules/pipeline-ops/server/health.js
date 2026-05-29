const NON_TERMINAL = ['waiting_for_resource', 'running', 'pending'];

/**
 * Compute pipeline health status from run history.
 *
 * @param {object} pipeline - Pipeline definition from config.json
 * @param {object[]} runs - Array of run records, newest first
 * @param {object} [queue] - Queue snapshot from collector
 * @returns {object} Health summary
 */
function computeHealth(pipeline, runs, queue) {
  const terminalRuns = (runs || []).filter(r => !NON_TERMINAL.includes(r.status));

  const queueMetrics = queue?.waiting > 0 ? {
    waiting: queue.waiting,
    runnerTags: queue.runnerTags || [],
    oldestWaitingSince: queue.oldestWaitingSince || null,
  } : null;

  if (terminalRuns.length === 0) {
    return {
      healthStatus: 'grey',
      scheduleAdherence: null,
      successRate: null,
      avgDurationSeconds: null,
      failureStreak: 0,
      durationTrend: null,
      lastRunAt: null,
      lastSuccessAt: null,
      queue: queueMetrics,
    };
  }

  const now = Date.now();
  const expectedIntervalMs = (pipeline.schedule?.expectedIntervalMinutes || 1440) * 60 * 1000;

  const sorted = [...terminalRuns].sort((a, b) =>
    new Date(b.startedAt || b.createdAt) - new Date(a.startedAt || a.createdAt)
  );

  const lastRun = sorted[0];
  const lastRunAt = lastRun.startedAt || lastRun.createdAt;
  const successfulRuns = sorted.filter(r => r.status === 'success');
  const lastSuccessAt = successfulRuns.length > 0
    ? (successfulRuns[0].startedAt || successfulRuns[0].createdAt)
    : null;

  const recentWindow = sorted.slice(0, 10);
  const recentSuccesses = recentWindow.filter(r => r.status === 'success').length;
  const successRate = recentWindow.length > 0 ? recentSuccesses / recentWindow.length : 0;

  let failureStreak = 0;
  for (const run of sorted) {
    if (run.status !== 'success') failureStreak++;
    else break;
  }

  const durations = sorted
    .filter(r => r.durationSeconds != null)
    .map(r => r.durationSeconds);
  const avgDurationSeconds = durations.length > 0
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : null;

  let durationTrend = null;
  if (durations.length >= 6) {
    const recentHalf = durations.slice(0, Math.floor(durations.length / 2));
    const olderHalf = durations.slice(Math.floor(durations.length / 2));
    const recentAvg = recentHalf.reduce((a, b) => a + b, 0) / recentHalf.length;
    const olderAvg = olderHalf.reduce((a, b) => a + b, 0) / olderHalf.length;
    const change = (recentAvg - olderAvg) / olderAvg;
    if (change > 0.15) durationTrend = 'increasing';
    else if (change < -0.15) durationTrend = 'decreasing';
    else durationTrend = 'stable';
  }

  const queuedDurations = sorted
    .filter(r => r.queuedSeconds != null && r.queuedSeconds > 0)
    .map(r => r.queuedSeconds);
  const avgQueuedSeconds = queuedDurations.length > 0
    ? Math.round(queuedDurations.reduce((a, b) => a + b, 0) / queuedDurations.length)
    : null;
  const maxQueuedSeconds = queuedDurations.length > 0
    ? Math.max(...queuedDurations)
    : null;

  const timeSinceLastSuccess = lastSuccessAt
    ? now - new Date(lastSuccessAt).getTime()
    : Infinity;
  const scheduleAdherence = lastSuccessAt
    ? timeSinceLastSuccess / expectedIntervalMs
    : null;

  let healthStatus;
  if (
    timeSinceLastSuccess <= expectedIntervalMs &&
    lastRun.status === 'success' &&
    successRate >= 0.8
  ) {
    healthStatus = 'green';
  } else if (
    timeSinceLastSuccess > 2 * expectedIntervalMs ||
    failureStreak >= 3 ||
    successRate < 0.5
  ) {
    healthStatus = 'red';
  } else {
    healthStatus = 'yellow';
  }

  return {
    healthStatus,
    scheduleAdherence,
    successRate: Math.round(successRate * 100),
    avgDurationSeconds,
    failureStreak,
    durationTrend,
    lastRunAt,
    lastSuccessAt,
    avgQueuedSeconds,
    maxQueuedSeconds,
    queue: queueMetrics,
  };
}

module.exports = { computeHealth };
