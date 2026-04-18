/**
 * Unified sync job manager.
 *
 * Replaces the three separate ad-hoc schedulers (team-tracker startup,
 * org-roster 5-min-delay scheduler, team-data auto-sync) with a single
 * coordinated job runner that prevents overlapping runs and exposes
 * unified status.
 */

const jobs = {};

/**
 * Register a named sync job.
 *
 * @param {string} name - Unique job name (e.g. 'roster-sync', 'org-roster-sheets', 'ipa-sync')
 * @param {Function} fn - Async function to execute. Receives (storage) as argument.
 * @param {Object} [options]
 * @param {number} [options.intervalMs] - Repeat interval in ms (default: 24 hours)
 * @param {number} [options.delayMs] - Initial delay before first run (default: 0)
 * @param {boolean} [options.autoStart] - Whether to start scheduling immediately (default: false)
 * @param {Object} [options.storage] - Storage object passed to fn on scheduled runs
 */
function registerJob(name, fn, options) {
  var opts = options || {};
  jobs[name] = {
    name: name,
    fn: fn,
    storage: opts.storage || null,
    intervalMs: opts.intervalMs || 24 * 60 * 60 * 1000,
    delayMs: opts.delayMs || 0,
    running: false,
    startedAt: null,
    lastResult: null,
    lastRunAt: null,
    timer: null,
    delayTimer: null
  };

  if (opts.autoStart) {
    scheduleJob(name);
  }

  return jobs[name];
}

/**
 * Start the recurring schedule for a job.
 * If delayMs > 0, waits before the first run.
 */
function scheduleJob(name) {
  var job = jobs[name];
  if (!job) return;

  cancelJob(name);

  if (job.delayMs > 0) {
    job.delayTimer = setTimeout(function() {
      job.delayTimer = null;
      startRecurring(job);
    }, job.delayMs);
    if (job.delayTimer.unref) job.delayTimer.unref();
  } else {
    startRecurring(job);
  }
}

function startRecurring(job) {
  job.timer = setInterval(function() {
    runJobInternal(job, job.storage).catch(function(err) {
      console.error('[sync-manager] Scheduled run of "' + job.name + '" failed:', err.message);
    });
  }, job.intervalMs);
  if (job.timer.unref) job.timer.unref();
}

/**
 * Cancel a scheduled job.
 */
function cancelJob(name) {
  var job = jobs[name];
  if (!job) return;

  if (job.timer) {
    clearInterval(job.timer);
    job.timer = null;
  }
  if (job.delayTimer) {
    clearTimeout(job.delayTimer);
    job.delayTimer = null;
  }
}

/**
 * Manually trigger a job. Returns the job result.
 * Prevents overlapping runs of the same job.
 */
async function triggerJob(name, storage) {
  var job = jobs[name];
  if (!job) {
    return { status: 'error', message: 'Unknown job: ' + name };
  }

  return runJobInternal(job, storage);
}

async function runJobInternal(job, storage) {
  if (job.running) {
    return { status: 'skipped', message: job.name + ' is already running' };
  }

  job.running = true;
  job.startedAt = new Date().toISOString();
  var startTime = Date.now();

  try {
    var result = await job.fn(storage);
    job.lastResult = result;
    job.lastRunAt = new Date().toISOString();
    return result;
  } catch (err) {
    var errorResult = {
      status: 'error',
      message: err.message,
      completedAt: new Date().toISOString(),
      duration: Date.now() - startTime
    };
    job.lastResult = errorResult;
    job.lastRunAt = new Date().toISOString();
    throw err;
  } finally {
    job.running = false;
    job.startedAt = null;
  }
}

/**
 * Check if a specific job is currently running.
 */
function isJobRunning(name) {
  var job = jobs[name];
  return job ? job.running : false;
}

/**
 * Check if any registered job is currently running.
 */
function isAnyJobRunning() {
  for (var name in jobs) {
    if (jobs[name].running) return true;
  }
  return false;
}

/**
 * Get status for a single job.
 */
function getJobStatus(name) {
  var job = jobs[name];
  if (!job) return null;

  return {
    name: job.name,
    running: job.running,
    startedAt: job.startedAt,
    lastRunAt: job.lastRunAt,
    lastResult: job.lastResult,
    scheduled: !!(job.timer || job.delayTimer)
  };
}

/**
 * Get status for all registered jobs.
 */
function getAllJobStatuses() {
  var statuses = {};
  for (var name in jobs) {
    statuses[name] = getJobStatus(name);
  }
  return statuses;
}

/**
 * Cancel all jobs. Useful for cleanup/shutdown.
 */
function cancelAllJobs() {
  for (var name in jobs) {
    cancelJob(name);
  }
}

module.exports = {
  registerJob,
  scheduleJob,
  cancelJob,
  triggerJob,
  isJobRunning,
  isAnyJobRunning,
  getJobStatus,
  getAllJobStatuses,
  cancelAllJobs
};
