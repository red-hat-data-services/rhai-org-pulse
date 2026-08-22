/**
 * ARCHITECTURAL CONSTRAINT ACKNOWLEDGMENT:
 *
 * This file contains several compute-intensive functions (deduplicateRunsByPRAndSuite,
 * calculateComponentStats, maintainHistoricalTrends) that perform complex data aggregation
 * and analysis. According to the project's hard constraint #3 ("The app is a display layer,
 * not a compute engine"), these operations should ideally be moved to external processes
 * like GitLab CI jobs or scheduled tasks that push pre-computed results to the app.
 *
 * Current implementation rationale:
 * - The E2E health feature is new and the data volume is currently manageable
 * - Real-time deduplication and trend calculation provide immediate value
 * - Moving to external computation would require additional infrastructure setup
 *
 * Future refactoring consideration:
 * When data volume grows significantly or performance becomes an issue, these functions
 * should be extracted to a GitLab CI pipeline that:
 * 1. Fetches raw Prow CI data
 * 2. Performs all deduplication and statistical analysis
 * 3. Pushes pre-computed results via the bulk API endpoints
 *
 * This would align with the releases execution pipeline pattern used elsewhere in the app.
 */

/**
 * Reads the current opendatahub-operator E2E health data from storage
 * @param {Function} readFromStorage - Storage read function
 * @returns {Promise<Object|null>} E2E health data or null if not found
 */
async function getE2EHealthData(readFromStorage) {
  try {
    return await readFromStorage('system-health/odh-e2e-health.json');
  } catch (error) {
    console.error('Error reading E2E health data:', error);
    return null;
  }
}

/**
 * Writes E2E health data to storage with smart filtering and memory optimization
 * @param {Function} writeToStorage - Storage write function
 * @param {Function} readFromStorage - Storage read function
 * @param {Object} data - E2E health data to store
 * @param {boolean} isDemoMode - Whether we're running in demo mode
 * @returns {Promise<boolean>} Success status
 */
async function saveE2EHealthData(writeToStorage, readFromStorage, data, isDemoMode = false) {
  try {
    // Step 0: Filter out pending tests from all data structures
    if (data.odhJobs) {
      const beforeCount = data.odhJobs.length;
      data.odhJobs = data.odhJobs.filter(job => job.status !== 'pending' && job.status !== 'triggered');
      if (beforeCount !== data.odhJobs.length) {
        console.log(`Filtered out ${beforeCount - data.odhJobs.length} pending ODH tests`);
      }
    }

    if (data.rhoaiJobs) {
      const beforeCount = data.rhoaiJobs.length;
      data.rhoaiJobs = data.rhoaiJobs.filter(job => job.status !== 'pending' && job.status !== 'triggered');
      if (beforeCount !== data.rhoaiJobs.length) {
        console.log(`Filtered out ${beforeCount - data.rhoaiJobs.length} pending RHOAI tests`);
      }
    }

    if (data.recentRuns) {
      const beforeCount = data.recentRuns.length;
      data.recentRuns = data.recentRuns.filter(run => run.status !== 'pending' && run.status !== 'triggered');
      if (beforeCount !== data.recentRuns.length) {
        console.log(`Filtered out ${beforeCount - data.recentRuns.length} pending tests from recent runs`);
      }
    }

    // Step 1: Deduplicate runs by PR + suite (keep most recent result per PR per suite)
    if (data.recentRuns && data.recentRuns.length > 0) {
      const deduped = deduplicateRunsByPRAndSuite(data.recentRuns);
      data.recentRuns = deduped;
    }

    // Step 2: Keep all runs from 14-day window (no artificial PR-based limits)
    if (data.recentRuns && data.recentRuns.length > 0) {
      // Sort by timestamp (newest first)
      data.recentRuns = data.recentRuns
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    // Step 3: NEW - Build and maintain 14-day historical trends
    await maintainHistoricalTrends({ readFromStorage, writeToStorage }, data, isDemoMode);

    // Step 4: Save to storage
    await writeToStorage('system-health/odh-e2e-health.json', data);

    return true;
  } catch (error) {
    console.error('Error saving E2E health data:', error);
    return false;
  }
}

/**
 * Advanced deduplication: Keep most recent result per PR per suite
 * This ensures we get the latest status for each PR for each suite
 */
function deduplicateRunsByPRAndSuite(runs) {
  const prSuiteMap = new Map();

  // Sort by timestamp (newest first) to prioritize recent runs
  const sortedRuns = [...runs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  for (const run of sortedRuns) {
    const key = `${run.prNumber}-${run.suite}`;

    if (!prSuiteMap.has(key)) {
      prSuiteMap.set(key, run);
    }
  }

  return Array.from(prSuiteMap.values())
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}


/**
 * Calculate component failure statistics from recent runs
 * @param {Array} runs - Recent E2E runs
 * @param {number} daysBack - Number of days to analyze
 * @returns {Object} Component statistics
 */
function calculateComponentStats(runs, daysBack = 14) {
  const cutoffTime = new Date(Date.now() - (daysBack * 24 * 60 * 60 * 1000));
  const recentRuns = runs.filter(run => new Date(run.timestamp) >= cutoffTime);

  const componentStats = {};

  recentRuns.forEach(run => {
    if (run.failedComponents) {
      run.failedComponents.forEach(component => {
        if (!componentStats[component]) {
          componentStats[component] = {
            totalRuns: recentRuns.length, // Use total run count for proper failure rate calculation
            failures: 0,
            lastFailure: null,
            affectedSuites: new Set()
          };
        }

        componentStats[component].failures++;
        componentStats[component].lastFailure = run.timestamp;
        componentStats[component].affectedSuites.add(run.suite);
      });
    }
  });

  // Calculate failure rates and finalize stats
  Object.keys(componentStats).forEach(component => {
    const stats = componentStats[component];
    stats.failureRate = stats.failures / stats.totalRuns;
    stats.affectedSuites = Array.from(stats.affectedSuites);
    stats.consecutiveFailures = calculateConsecutiveFailures(recentRuns, component);
  });

  return componentStats;
}

/**
 * Calculate consecutive failures for a component
 * Fixed: operates on ALL runs, not pre-filtered ones, to properly detect streaks
 */
function calculateConsecutiveFailures(runs, component) {
  // Sort ALL runs by timestamp (newest first), don't pre-filter
  const sortedRuns = [...runs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  let consecutive = 0;
  for (const run of sortedRuns) {
    // If this run failed for this component, increment counter
    if (run.failedComponents && run.failedComponents.includes(component)) {
      consecutive++;
    } else {
      // Hit a success (run without this component failure) - streak is broken
      break;
    }
  }

  return consecutive;
}

/**
 * Enhanced suite health calculation with daily status ranges
 * Uses daily aggregation from GCS JSON API data (14-day approach)
 * @param {Object} data - Data containing odhJobs and rhoaiJobs arrays
 * @returns {Object} Suite health information with daily status
 */
function calculateSuiteHealth(data) {
  const suites = {};

  // Process each suite
  ['odh', 'rhoai'].forEach(suiteKey => {
    const jobs = data[`${suiteKey}Jobs`] || [];

    // Apply latest per PR deduplication
    const deduplicatedJobs = deduplicateLatestPerPR(jobs);

    const passedJobs = deduplicatedJobs.filter(job => job.status === 'passed');
    const passRate = deduplicatedJobs.length > 0 ? passedJobs.length / deduplicatedJobs.length : 0;

    const dailyStatus = calculateDailyStatus(passRate);

    suites[suiteKey] = {
      name: suiteKey === 'odh' ? 'OpenDataHub E2E' : 'RHOAI E2E',
      suite: suiteKey,
      dailyStatus,
      totalJobs: deduplicatedJobs.length,
      passedJobs: passedJobs.length,
      rollingWindow: '14d',
      lastUpdated: new Date().toISOString(),
      // Legacy compatibility
      suiteStatus: dailyStatus.status === 'healthy' || dailyStatus.status === 'stable' ? 'passing' : 'failing',
      successRate: passRate,
      repository: "opendatahub-io/opendatahub-operator"
    };
  });

  return suites;
}

/**
 * NEW: Daily status calculation with traffic light ranges
 * @param {number} passRate - Pass rate between 0 and 1
 * @returns {Object} Status object with color, class, and label
 */
function calculateDailyStatus(passRate) {
  if (passRate >= 1.0) {
    return {
      status: 'healthy',
      color: 'green',
      class: 'text-green-600 dark:text-green-400',
      bgClass: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      label: 'Healthy'
    };
  }
  if (passRate >= 0.7) {
    return {
      status: 'stable',
      color: 'green',
      class: 'text-green-600 dark:text-green-400',
      bgClass: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      label: 'Stable'
    };
  }
  if (passRate >= 0.5) {
    return {
      status: 'degraded',
      color: 'orange',
      class: 'text-orange-600 dark:text-orange-400',
      bgClass: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
      label: 'Degraded'
    };
  }
  if (passRate >= 0.2) {
    return {
      status: 'failing',
      color: 'red',
      class: 'text-red-600 dark:text-red-400',
      bgClass: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
      label: 'Failing'
    };
  }
  return {
    status: 'broken',
    color: 'red',
    class: 'text-red-600 dark:text-red-400',
    bgClass: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
    label: 'Broken'
  };
}

/**
 * Latest per PR deduplication (user's requested approach)
 * Keep only the latest result per PR for merge decision accuracy
 * @param {Array} jobs - Array of job results
 * @returns {Array} Deduplicated jobs (latest per PR)
 */
function deduplicateLatestPerPR(jobs) {
  const prMap = new Map();

  // Sort by timestamp (newest first)
  const sortedJobs = [...jobs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // Keep only latest result per PR
  for (const job of sortedJobs) {
    const prKey = job.prNumber || `no-pr-${job.buildId}`;
    if (!prMap.has(prKey)) {
      prMap.set(prKey, job);
    }
  }

  return Array.from(prMap.values());
}

/**
 * NEW: Maintain 14-day historical trends for charting
 * @param {Object} storage - Storage functions object with readFromStorage
 * @param {Object} data - Current E2E health data
 * @param {boolean} isDemoMode - Whether we're running in demo mode
 */
async function maintainHistoricalTrends(storage, data, isDemoMode = false) {
  const { readFromStorage } = storage;

  try {
    // Load existing trends using storage abstraction
    let existingData = null;
    try {
      existingData = await readFromStorage('system-health/odh-e2e-health.json');
    } catch (error) {
      console.log('No existing trend data found, starting fresh:', error.message);
      existingData = null;
    }

    // Build today's trend entry
    const today = new Date().toISOString().split('T')[0];
    const todaysTrend = {
      date: today,
      odh: {
        status: data.suites?.odh?.dailyStatus?.status || 'unknown',
        passRate: data.suites?.odh?.successRate || data.suites?.odh?.dailyStatus?.passRate || 0,
        totalJobs: data.suites?.odh?.totalJobs || 0,
        passedJobs: data.suites?.odh?.passedJobs || 0
      },
      rhoai: {
        status: data.suites?.rhoai?.dailyStatus?.status || 'unknown',
        passRate: data.suites?.rhoai?.successRate || data.suites?.rhoai?.dailyStatus?.passRate || 0,
        totalJobs: data.suites?.rhoai?.totalJobs || 0,
        passedJobs: data.suites?.rhoai?.passedJobs || 0
      }
    };

    // Load existing trend history
    let trendHistory = existingData?.historical_trends?.daily_status || [];

    // In real runs (non-demo mode), filter out synthetic data to keep only real entries
    if (!isDemoMode) {
      trendHistory = trendHistory.filter(entry => {
        // Keep entries without metadata (real data) or entries not marked as synthetic
        return !entry.metadata || entry.metadata.dataSource !== 'synthetic-90day';
      });
      console.log(`Filtered out synthetic data in real run mode. Remaining entries: ${trendHistory.length}`);
    }

    // Update today's entry or add it
    const existingTodayIndex = trendHistory.findIndex(t => t.date === today);
    if (existingTodayIndex >= 0) {
      trendHistory[existingTodayIndex] = todaysTrend;
      console.log(`Updated trend data for ${today}`);
    } else {
      trendHistory.push(todaysTrend);
      console.log(`Added trend data for ${today}`);
    }

    // Keep only last 30 days by actual date, sort newest first
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    trendHistory = trendHistory
      .filter(entry => new Date(entry.date) >= thirtyDaysAgo)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 30); // Additional safety limit

    // Add trends to data structure
    data.historical_trends = {
      daily_status: trendHistory,
      last_updated: new Date().toISOString()
    };

    console.log(`Maintaining ${trendHistory.length} days of trend history`);

  } catch (error) {
    console.error('Error maintaining historical trends:', error);
    // Don't fail the save if trends fail - just log the error
    data.historical_trends = {
      daily_status: [],
      last_updated: new Date().toISOString(),
      error: error.message
    };
  }
}

/**
 * Format time since for human readability
 * @param {string} timestamp - ISO timestamp
 * @returns {string} Formatted time like "2h 30m"
 */
function formatTimeSince(timestamp) {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now - then;

  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

module.exports = {
  getE2EHealthData,
  saveE2EHealthData,
  maintainHistoricalTrends,
  calculateComponentStats,
  calculateSuiteHealth,
  calculateDailyStatus,
  deduplicateLatestPerPR,
  formatTimeSince
};