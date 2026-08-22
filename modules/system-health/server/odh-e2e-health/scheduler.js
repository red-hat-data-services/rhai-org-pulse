const prowFetch = require('./prow-ci-fetch');
const { saveE2EHealthData, calculateComponentStats, calculateSuiteHealth } = require('./storage');
const { analyzeComponentImpact } = require('./component-mapper');

/**
 * Scheduler configuration for opendatahub-operator E2E health data refresh
 */
const SCHEDULER_CONFIG = {
  cadence: '1h', // 1 hour refresh interval
  name: 'odh-e2e-health',
  enabled: true,
  timeout: 10 * 60 * 1000, // 10 minute timeout (increased for prowjobs.js download)
  retries: 3
};

/**
 * Main refresh handler for opendatahub-operator E2E health data with incremental data accumulation
 * This function is called by the Org Pulse scheduler system
 *
 * @param {Object} context - Scheduler context with config and logger
 * @returns {Promise<Object>} Refresh result with status and metrics
 */
async function refreshE2EHealthData(context = {}) {
  const { logger = console, storage } = context;

  if (!storage) {
    throw new Error('Storage context is required for opendatahub-operator E2E health refresh');
  }

  const { readFromStorage, writeToStorage } = storage;

  logger.info('Starting opendatahub-operator E2E health data refresh with incremental accumulation...');

  const startTime = Date.now();
  let status = 'success';
  let error = null;
  let metrics = {
    runsProcessed: 0,
    componentsAnalyzed: 0,
    dataPoints: 0,
    accumulatedRuns: 0,
    mergedRuns: 0,
    evictedRuns: 0
  };

  try {
    // Step 1: Load existing accumulated data
    logger.info('Loading existing accumulated data...');
    let existingData = null;
    try {
      const { getE2EHealthData } = require('./storage');
      existingData = await getE2EHealthData(readFromStorage);
    } catch {
      logger.info('No existing data found, will start fresh accumulation');
    }

    const existingAccumulatedRuns = existingData?.accumulatedRuns || [];
    logger.info(`Found ${existingAccumulatedRuns.length} existing accumulated runs`);

    // Step 3: Fetch recent E2E data using prowjobs.js API (last 2 days)
    const isDemoMode = process.env.DEMO_MODE === 'true';
    const lastSyncTime = existingData?.lastSyncedAt;

    if (lastSyncTime) {
      const hoursSinceLastSync = (Date.now() - new Date(lastSyncTime).getTime()) / (1000 * 60 * 60);
      logger.info(`Last sync was ${hoursSinceLastSync.toFixed(1)} hours ago`);
    }

    logger.info('Fetching recent E2E data from prowjobs.js API...');
    const recentData = await prowFetch.fetchRecentE2ERuns(isDemoMode, 2, lastSyncTime); // Only fetch 2 days

    // Check for connection/fetch errors first
    if (recentData.error) {
      throw new Error(`Prow CI data fetch failed: ${recentData.error}`);
    }

    // Handle data format - object with odhJobs/rhoaiJobs
    const newRuns = [...(recentData.odhJobs || []), ...(recentData.rhoaiJobs || [])];
    metrics.runsProcessed = newRuns.length;

    if (recentData.isStubData) {
      logger.warn('Using stub data for development/testing');
    } else {
      logger.info(`Fetched ${recentData.odhJobs?.length || 0} ODH + ${recentData.rhoaiJobs?.length || 0} recent jobs`);

      // Log prowjobs.js API metrics if available
      if (recentData.fetchMetrics) {
        const m = recentData.fetchMetrics;
        logger.info(`API Performance: ${m.dataTransferMB}MB downloaded, ${m.filteredJobs}/${m.totalProwJobs} jobs (${m.filteringRatio}), ${(m.executionTimeMs/1000).toFixed(1)}s`);
      }
    }

    // Step 4: Merge new runs with existing accumulated data
    logger.info('Merging new runs with existing accumulated data...');
    const mergeResult = mergeRuns(existingAccumulatedRuns, newRuns, logger);
    metrics.mergedRuns = mergeResult.merged;

    // Step 5: Evict runs older than 30 days
    logger.info('Evicting runs older than 30 days...');
    const evictResult = evictOldRuns(mergeResult.runs, 30, logger);
    const accumulatedRuns = evictResult.runs;
    metrics.evictedRuns = evictResult.evicted;
    metrics.accumulatedRuns = accumulatedRuns.length;

    logger.info(`Accumulated dataset: ${metrics.accumulatedRuns} total runs (${metrics.mergedRuns} merged, ${metrics.evictedRuns} evicted)`);

    if (accumulatedRuns.length === 0) {
      logger.warn('No accumulated E2E runs available');
      status = 'warning';
    }

    // Step 6: Calculate component statistics from full 30-day accumulated dataset
    logger.info('Calculating component failure statistics from accumulated data...');
    const componentStats = calculateComponentStats(accumulatedRuns, 30); // Use full 30-day window
    metrics.componentsAnalyzed = Object.keys(componentStats).length;

    // Step 7: Calculate suite health summary from recent data for current status
    logger.info('Calculating current suite health summary...');
    const suiteHealth = calculateSuiteHealth(recentData);

    // Step 8: Perform component impact analysis on accumulated data
    logger.info('Analyzing component impact and trends from accumulated data...');
    const componentAnalysis = analyzeComponentImpact(accumulatedRuns, { timeWindowDays: 30 });

    // Step 9: Build comprehensive health data structure with accumulated data
    const healthData = buildHealthDataStructure(
      accumulatedRuns, // Use full accumulated dataset for analysis
      newRuns, // Keep recent runs for API compatibility
      componentStats,
      suiteHealth,
      componentAnalysis,
      recentData.fetchMetrics
    );
    metrics.dataPoints = healthData.recentRuns?.length || newRuns.length;

    // Step 10: Save to storage
    logger.info('Saving E2E health data to storage...');
    const saveSuccess = await saveE2EHealthData(writeToStorage, readFromStorage, healthData, isDemoMode);

    if (!saveSuccess) {
      throw new Error('Failed to save E2E health data to storage');
    }

    const duration = Date.now() - startTime;
    logger.info(`E2E health refresh completed successfully in ${duration}ms`, {
      runsProcessed: metrics.runsProcessed,
      accumulatedRuns: metrics.accumulatedRuns,
      mergedRuns: metrics.mergedRuns,
      evictedRuns: metrics.evictedRuns,
      componentsAnalyzed: metrics.componentsAnalyzed,
      dataPoints: metrics.dataPoints
    });

  } catch (err) {
    error = err;
    status = 'error';
    logger.error('opendatahub-operator E2E health refresh failed:', err);

    // For development, use demo storage if the real fetch fails and we have demo data
    if (process.env.NODE_ENV !== 'production') {
      logger.info('Real fetch failed in development, checking for demo data...');
      try {
        // Try to load existing demo data instead of generating new test scenarios
        const { getE2EHealthData } = require('./storage');
        const existingData = await getE2EHealthData(readFromStorage);
        if (existingData && existingData.recentRuns && existingData.recentRuns.length > 0) {
          logger.info('Using existing demo/fixture data');
          status = 'success_demo';
          return { status, metrics, timestamp: new Date().toISOString() };
        }
      } catch (demoError) {
        logger.warn('No demo data available:', demoError.message);
      }
    }
  }

  return {
    status,
    duration: Date.now() - startTime,
    error: error ? error.message : null,
    metrics,
    timestamp: new Date().toISOString()
  };
}

/**
 * Merge new runs with existing accumulated runs
 * @param {Array} existingRuns - Existing accumulated runs
 * @param {Array} newRuns - New runs from API fetch
 * @param {Object} logger - Logger instance
 * @returns {Object} Merge result with { runs: Array, merged: number }
 */
function mergeRuns(existingRuns, newRuns, logger) {
  const merged = [...existingRuns];
  let mergeCount = 0;

  for (const newRun of newRuns) {
    const existingIndex = merged.findIndex(run =>
      run.buildId === newRun.buildId ||
      (run.prNumber && run.prNumber === newRun.prNumber && run.suite === newRun.suite)
    );

    if (existingIndex >= 0) {
      // Overwrite existing run with newer data
      merged[existingIndex] = newRun;
      logger.debug(`Overwriting existing run: ${newRun.buildId} (${newRun.suite})`);
    } else {
      // Add new run
      merged.push(newRun);
      logger.debug(`Adding new run: ${newRun.buildId} (${newRun.suite})`);
    }
    mergeCount++;
  }

  // Sort by timestamp (newest first)
  merged.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return { runs: merged, merged: mergeCount };
}

/**
 * Evict runs older than the specified number of days
 * @param {Array} runs - All accumulated runs
 * @param {number} retentionDays - Number of days to retain
 * @param {Object} logger - Logger instance
 * @returns {Object} Eviction result with { runs: Array, evicted: number }
 */
function evictOldRuns(runs, retentionDays, logger) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const retained = [];
  let evictedCount = 0;

  for (const run of runs) {
    const runDate = new Date(run.timestamp);
    if (runDate >= cutoffDate) {
      retained.push(run);
    } else {
      evictedCount++;
      logger.debug(`Evicting old run: ${run.buildId} (${run.suite}) from ${run.timestamp}`);
    }
  }

  logger.info(`Retained ${retained.length} runs, evicted ${evictedCount} runs older than ${retentionDays} days`);
  return { runs: retained, evicted: evictedCount };
}


/**
 * Builds the comprehensive health data structure for storage with incremental accumulation
 * @param {Array} accumulatedRuns - Full 30-day accumulated runs dataset
 * @param {Array} recentRuns - Recent runs from current API fetch
 * @param {Object} componentStats - Component failure statistics
 * @param {Object} suiteHealth - Suite health summary
 * @param {Object} componentAnalysis - Component impact analysis
 * @param {Object} fetchMetrics - Metrics from prowjobs.js fetch
 * @returns {Object} Complete health data structure
 */
function buildHealthDataStructure(accumulatedRuns, recentRuns, componentStats, suiteHealth, componentAnalysis, fetchMetrics = null) {
  const now = new Date();

  // Calculate overall metrics from full accumulated dataset (30 days)
  const totalRuns = accumulatedRuns.length;
  const passedRuns = accumulatedRuns.filter(run => run.status === 'passed').length;
  const overallPassRate = totalRuns > 0 ? passedRuns / totalRuns : 0;

  // Find currently blocking components (failed in recent runs from last fetch)
  const currentlyBlocking = new Set();
  const recentFailedRuns = recentRuns.filter(run => run.status === 'failed').slice(0, 5);
  recentFailedRuns.forEach(run => {
    if (run.failedComponents) {
      run.failedComponents.forEach(component => currentlyBlocking.add(component));
    }
  });

  // Calculate trend direction from accumulated runs (comparing recent vs older halves)
  const midpoint = Math.floor(accumulatedRuns.length / 2);
  const recentHalfPassRate = accumulatedRuns.length > 0 ?
    accumulatedRuns.slice(0, midpoint).filter(run => run.status === 'passed').length / midpoint : 0;
  const olderHalfPassRate = accumulatedRuns.length > midpoint ?
    accumulatedRuns.slice(midpoint).filter(run => run.status === 'passed').length / (accumulatedRuns.length - midpoint) : 0;

  let trendDirection = 'stable';
  const trendDiff = recentHalfPassRate - olderHalfPassRate;
  if (trendDiff > 0.1) trendDirection = 'improving';
  else if (trendDiff < -0.1) trendDirection = 'worsening';

  // Calculate average resolution time from accumulated runs
  const avgResolutionTime = calculateAverageResolutionTime(accumulatedRuns);

  const healthData = {
    lastSyncedAt: now.toISOString(),
    repository: "opendatahub-io/opendatahub-operator",

    // Suite-specific health (from recent data for current status)
    suites: suiteHealth,

    // Overall summary (from full accumulated dataset)
    summary: {
      totalRuns,
      passRate: overallPassRate,
      avgResolutionTime,
      trendDirection
    },

    // Recent runs (from current API fetch for backward compatibility)
    recentRuns: recentRuns.map(run => ({
      buildId: run.buildId,
      jobName: run.jobName,
      suite: run.suite,
      status: run.status,
      timestamp: run.timestamp,
      prNumber: run.prNumber,
      prowUrl: run.prowUrl,
      failedComponents: run.failedComponents || [],
      runDuration: run.runDuration
    })),

    // NEW: Full accumulated dataset for analysis (30 days)
    accumulatedRuns: accumulatedRuns.map(run => ({
      buildId: run.buildId,
      jobName: run.jobName,
      suite: run.suite,
      status: run.status,
      timestamp: run.timestamp,
      prNumber: run.prNumber,
      prowUrl: run.prowUrl,
      failedComponents: run.failedComponents || [],
      runDuration: run.runDuration
    })),

    // Component statistics with enhanced analysis (from accumulated data)
    componentStats: enhanceComponentStats(componentStats, componentAnalysis),

    // Currently blocking components (from recent failures)
    currentlyBlocking: Array.from(currentlyBlocking),

    assessedAt: now.toISOString(),
    dataSource: 'prowjobs-api-incremental',

    // Metadata about accumulated dataset
    datasetMetadata: {
      accumulatedRunsCount: accumulatedRuns.length,
      recentRunsCount: recentRuns.length,
      dataRetentionDays: 30,
      oldestRunDate: accumulatedRuns.length > 0 ?
        accumulatedRuns[accumulatedRuns.length - 1].timestamp : null,
      newestRunDate: accumulatedRuns.length > 0 ?
        accumulatedRuns[0].timestamp : null
    }
  };

  // Include prowjobs.js fetch metrics if available
  if (fetchMetrics) {
    healthData.prowJobsMetrics = fetchMetrics;
  }

  return healthData;
}

/**
 * Enhances component stats with impact analysis data
 * @param {Object} componentStats - Basic component statistics
 * @param {Object} componentAnalysis - Component impact analysis
 * @returns {Object} Enhanced component statistics
 */
function enhanceComponentStats(componentStats, componentAnalysis) {
  const enhanced = {};

  Object.keys(componentStats).forEach(component => {
    const stats = componentStats[component];
    const analysis = componentAnalysis[component] || {};

    enhanced[component] = {
      ...stats,
      classification: analysis.classification || 'unknown',
      impact: analysis.impact || { score: 0, level: 'low' },
      trends: analysis.trends || { direction: 'stable' },
      displayName: analysis.displayName || component,
      testSuites: analysis.testSuites || []
    };
  });

  return enhanced;
}

/**
 * Calculates average resolution time for failed E2E runs
 * @param {Array} runs - E2E runs sorted by timestamp (newest first)
 * @returns {string} Formatted average resolution time
 */
function calculateAverageResolutionTime(runs) {
  const resolutionTimes = [];

  // Find failure -> success transitions
  let currentFailureStart = null;

  // Process runs in chronological order (oldest first)
  const chronologicalRuns = [...runs].reverse();

  chronologicalRuns.forEach(run => {
    if (run.status === 'failed' && !currentFailureStart) {
      currentFailureStart = new Date(run.timestamp);
    } else if (run.status === 'passed' && currentFailureStart) {
      const resolutionTime = new Date(run.timestamp) - currentFailureStart;
      resolutionTimes.push(resolutionTime);
      currentFailureStart = null;
    }
  });

  if (resolutionTimes.length === 0) {
    return 'N/A';
  }

  const averageMs = resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length;
  const hours = Math.floor(averageMs / (1000 * 60 * 60));
  const minutes = Math.floor((averageMs % (1000 * 60 * 60)) / (1000 * 60));

  return `${hours}h ${minutes}m`;
}

/**
 * Manual refresh trigger for opendatahub-operator E2E health data
 * @param {Object} options - Refresh options
 * @returns {Promise<Object>} Refresh result
 */
async function manualRefresh(options = {}) {
  const { logger = console, force = false, storage } = options;

  logger.info('Manual opendatahub-operator E2E health refresh triggered', { force });

  // Call the main refresh function with proper storage context
  const result = await refreshE2EHealthData({
    logger,
    storage
  });

  return {
    ...result,
    trigger: 'manual',
    forced: force
  };
}

/**
 * Health check for the opendatahub-operator E2E scheduler
 * @param {Object} context - Scheduler context with storage
 * @returns {Promise<Object>} Health status
 */
async function healthCheck(context = {}) {
  try {
    const { storage } = context;

    if (!storage) {
      throw new Error('Storage context is required for opendatahub-operator E2E health check');
    }

    const { readFromStorage } = storage;

    // Check if we have recent data
    const { getE2EHealthData } = require('./storage');
    const healthData = await getE2EHealthData(readFromStorage);

    const hasRecentData = healthData && healthData.lastSyncedAt &&
      (new Date() - new Date(healthData.lastSyncedAt)) < (2 * 60 * 60 * 1000); // 2 hours

    return {
      status: hasRecentData ? 'healthy' : 'degraded',
      hasRecentData,
      lastSync: healthData?.lastSyncedAt || null,
      dataSource: healthData?.dataSource || 'unknown',
      checks: {
        'recent-data': hasRecentData ? 'pass' : 'fail'
      }
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message,
      checks: {
        'recent-data': 'error'
      }
    };
  }
}


module.exports = {
  refreshE2EHealthData,
  manualRefresh,
  healthCheck,
  SCHEDULER_CONFIG
};