const DEMO_MODE = process.env.DEMO_MODE === 'true';

const {
  extractComponentFromTestPath,
  mapSuiteToComponent
} = require('./component-mapper');

const {
  STORAGE_KEY: BLOCKER_JIRAS_STORAGE_KEY,
  JQL: BLOCKER_JIRAS_JQL,
  buildJqlDeepLink: buildBlockerJqlDeepLink,
  TEMPLATE_ISSUE_KEY: BLOCKER_TEMPLATE_ISSUE_KEY
} = require('./blocker-jiras');

/**
 * Generate contextual failing components based on current system state
 * @param {Object} suites - Suite health data
 * @param {Object} componentStats - Component statistics
 * @returns {Object} Contextual component information
 */
function generateContextualFailingComponents(suites, componentStats = {}) {
  // Determine overall system state
  const suitesArray = Object.values(suites || {});
  const hasFailingSuites = suitesArray.some(suite => suite.status === 'failing');
  const allPassing = suitesArray.every(suite => suite.status === 'passing');

  // Get actionable components (>10% failure rate, excluding infrastructure)
  const actionableComponents = Object.entries(componentStats)
    .filter(([component, stats]) => {
      // Skip infrastructure components entirely - they are not real user-facing component failures
      return component !== 'infrastructure' && stats.failureRate > 0.10;
    })
    .map(([component, stats]) => ({
      component,
      failureRate: stats.failureRate,
      affectedSuites: stats.affectedSuites || [],
      consecutiveFailures: stats.consecutiveFailures,
      isActionable: true // Already filtered for actionable
    }))
    .sort((a, b) => b.failureRate - a.failureRate);

  // Return contextual response
  if (allPassing && actionableComponents.length === 0) {
    return {
      context: "stable",
      message: "All components stable ",
      components: [],
      actionRequired: false
    };
  }

  // If we filtered out infrastructure components and have no other actionable components
  if (actionableComponents.length === 0) {
    return {
      context: "stable",
      message: "No significant component issues",
      components: [],
      actionRequired: false
    };
  }

  if (hasFailingSuites && actionableComponents.length > 0) {
    return {
      context: "failing",
      message: `${actionableComponents.length} component${actionableComponents.length > 1 ? 's' : ''} need attention`,
      components: actionableComponents.slice(0, 3), // Top 3 blockers
      actionRequired: true
    };
  }

  if (actionableComponents.length > 0) {
    return {
      context: "degraded",
      message: "Some components showing elevated failure rates",
      components: actionableComponents.slice(0, 2), // Top 2 concerning
      actionRequired: false
    };
  }

  return {
    context: "stable",
    message: "No significant component issues",
    components: [],
    actionRequired: false
  };
}

/**
 * Register opendatahub-operator E2E health routes on the module router.
 *
 * @param {import('express').Router} router
 * @param {object} context
 */
module.exports = function registerOpendatahubOperatorE2ERoutes(router, context) {
  const { storage } = context;
  const { readFromStorage } = storage;

  /**
   * @openapi
   * /api/modules/system-health/odh-e2e-health:
   *   get:
   *     tags: [System Health]
   *     summary: Get opendatahub-operator E2E test health status
   *     description: Returns current E2E test health status for ODH and RHOAI suites
   *     responses:
   *       200:
   *         description: E2E health status
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 lastSyncedAt:
   *                   type: string
   *                   format: date-time
   *                 summary:
   *                   type: object
   *                 totalRuns:
   *                   type: integer
   *                 overallPassRate:
   *                   type: number
   *                 topFailingComponents:
   *                   type: array
   */
  router.get('/', async (_req, res) => {
    try {
      const healthData = await readFromStorage('system-health/odh-e2e-health.json');

      if (!healthData) {
        return res.json({
          status: 'no_data',
          message: 'E2E health data not yet available',
          lastSyncedAt: null
        });
      }

      // Helper function for calculating combined pass rate
      function calculateCombinedPassRate(suites) {
        if (!suites) return 0;

        const odhJobs = suites.odh?.totalJobs || 0;
        const odhPassed = suites.odh?.passedJobs || 0;
        const rhoaiJobs = suites.rhoai?.totalJobs || 0;
        const rhoaiPassed = suites.rhoai?.passedJobs || 0;

        const totalJobs = odhJobs + rhoaiJobs;
        const totalPassed = odhPassed + rhoaiPassed;

        return totalJobs > 0 ? totalPassed / totalJobs : 0;
      }

      // NEW: Daily suites format response
      const response = {
        lastSyncedAt: healthData.lastSyncedAt,

        // NEW: Daily suites format with traffic light status
        suites: healthData.suites,

        // Legacy summary for backward compatibility
        summary: healthData.summary || (healthData.suites ? {
          totalRuns: (healthData.suites.odh?.totalJobs || 0) + (healthData.suites.rhoai?.totalJobs || 0),
          passRate: calculateCombinedPassRate(healthData.suites),
          odh: {
            suiteStatus: healthData.suites.odh?.dailyStatus?.status === 'healthy' || healthData.suites.odh?.dailyStatus?.status === 'stable' ? 'passing' : 'failing',
            timeSinceGreen: 'See daily status',
            successRate: healthData.suites.odh?.dailyStatus?.passRate || 0
          },
          rhoai: {
            suiteStatus: healthData.suites.rhoai?.dailyStatus?.status === 'healthy' || healthData.suites.rhoai?.dailyStatus?.status === 'stable' ? 'passing' : 'failing',
            timeSinceGreen: 'See daily status',
            successRate: healthData.suites.rhoai?.dailyStatus?.passRate || 0
          }
        } : {
          odh: { suiteStatus: 'unknown', timeSinceGreen: 'N/A' },
          rhoai: { suiteStatus: 'unknown', timeSinceGreen: 'N/A' }
        }),

        totalRuns: healthData.suites ?
          (healthData.suites.odh?.totalJobs || 0) + (healthData.suites.rhoai?.totalJobs || 0) :
          (healthData.summary?.totalRuns || 0),

        overallPassRate: healthData.suites ?
          calculateCombinedPassRate(healthData.suites) :
          (healthData.summary?.passRate || 0),

        topFailingComponents: generateContextualFailingComponents(
          healthData.suites || healthData.summary,
          healthData.componentStats
        ),

        // Include recent runs for the UI table and chart
        recentRuns: healthData.recentRuns || [],

        // Include historical trends for chart visualization
        historical_trends: healthData.historical_trends || null
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching opendatahub-operator E2E health:', error);
      res.status(500).json({
        error: 'Failed to fetch E2E health data',
        message: error.message
      });
    }
  });

  /**
   * @openapi
   * /api/modules/system-health/odh-e2e-health/blocker-jiras:
   *   get:
   *     tags: [System Health]
   *     summary: List auto-filed opendatahub-operator E2E blocker JIRAs
   *     description: >
   *       Returns the currently-open Jira blocker bugs auto-filed by the
   *       opendatahub-operator e2e-failure-triage automation (identified by the
   *       label odh-operator-auto-e2e-blocker). Served from a snapshot refreshed
   *       on a schedule.
   *     responses:
   *       200:
   *         description: Open blocker JIRAs snapshot
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 lastSyncedAt:
   *                   type: string
   *                   format: date-time
   *                   nullable: true
   *                 available:
   *                   type: boolean
   *                   description: False when Jira credentials are missing or a fetch failed
   *                 reason:
   *                   type: string
   *                   nullable: true
   *                 count:
   *                   type: integer
   *                 jql:
   *                   type: string
   *                 jqlUrl:
   *                   type: string
   *                   description: Deep link to view these issues in Jira
   *                 templateIssue:
   *                   type: string
   *                 issues:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       key:
   *                         type: string
   *                       summary:
   *                         type: string
   *                       status:
   *                         type: string
   *                       priority:
   *                         type: string
   *                         nullable: true
   *                       component:
   *                         type: string
   *                         nullable: true
   *                       affectsVersions:
   *                         type: array
   *                         items:
   *                           type: string
   *                       assignee:
   *                         type: string
   *                         nullable: true
   *                       created:
   *                         type: string
   *                         format: date-time
   *                         nullable: true
   *                       updated:
   *                         type: string
   *                         format: date-time
   *                         nullable: true
   *                       url:
   *                         type: string
   *                         nullable: true
   */
  router.get('/blocker-jiras', async (_req, res) => {
    try {
      const data = await readFromStorage(BLOCKER_JIRAS_STORAGE_KEY);

      if (!data) {
        // No snapshot yet (refresh hasn't run). Return an explicit empty payload
        // rather than 404 so the UI can render its empty/pending state.
        return res.json({
          lastSyncedAt: null,
          available: false,
          reason: 'no_data',
          count: 0,
          jql: BLOCKER_JIRAS_JQL,
          jqlUrl: buildBlockerJqlDeepLink(process.env.JIRA_HOST || 'https://redhat.atlassian.net'),
          templateIssue: BLOCKER_TEMPLATE_ISSUE_KEY,
          issues: []
        });
      }

      res.json(data);
    } catch (error) {
      console.error('Error fetching E2E blocker JIRAs:', error);
      res.status(500).json({
        error: 'Failed to fetch E2E blocker JIRAs',
        message: error.message
      });
    }
  });

  /**
   * @openapi
   * /api/modules/system-health/odh-e2e-health/runs/{buildId}/details:
   *   get:
   *     tags: [System Health]
   *     summary: Get detailed test results for a specific E2E run
   *     description: Returns parsed JUnit XML data with component failures and stack traces
   *     parameters:
   *       - name: buildId
   *         in: path
   *         required: true
   *         description: Prow build ID for the test run
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Detailed test run analysis
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 runDetails:
   *                   type: object
   *                 testSuites:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       name:
   *                         type: string
   *                         description: Test suite name
   *                       component:
   *                         type: string
   *                         description: Component being tested
   *                       status:
   *                         type: string
   *                         enum: [passed, failed]
   *                         description: Overall suite status
   *                       total:
   *                         type: number
   *                         description: Total number of test cases
   *                       passed:
   *                         type: number
   *                         description: Number of passed test cases
   *                       failed:
   *                         type: number
   *                         description: Number of failed test cases
   *                       duration:
   *                         type: number
   *                         description: Suite execution duration in seconds
   *                       failedTestCases:
   *                         type: array
   *                         description: Details of failed test cases
   *                         items:
   *                           type: object
   *                           properties:
   *                             name:
   *                               type: string
   *                               description: Test case name
   *                             classname:
   *                               type: string
   *                               description: Test class name
   *                             status:
   *                               type: string
   *                               enum: [passed, failed, skipped]
   *                               description: Test case status
   *                             duration:
   *                               type: number
   *                               description: Test case duration in seconds
   *                             failure:
   *                               type: object
   *                               description: Failure details (only present for failed tests)
   *                               properties:
   *                                 message:
   *                                   type: string
   *                                   description: Error message summary
   *                                 stackTrace:
   *                                   type: string
   *                                   description: Detailed stack trace (truncated to 1000 chars)
   *                             timestamp:
   *                               type: string
   *                               format: date-time
   *                               description: Test case timestamp
   *       404:
   *         description: Test run not found
   */
  router.get('/runs/:buildId/details', async (req, res) => {
    try {
      const { buildId } = req.params;

      if (!buildId) {
        return res.status(400).json({
          error: 'Build ID is required'
        });
      }

      // Get basic run details
      const healthData = await readFromStorage('system-health/odh-e2e-health.json');

      if (!healthData || !healthData.recentRuns) {
        return res.status(404).json({
          error: 'No E2E health data available'
        });
      }

      // Find the specific run
      const runDetails = healthData.recentRuns.find(run => run.buildId === buildId);

      if (!runDetails) {
        return res.status(404).json({
          error: `Test run with build ID ${buildId} not found`
        });
      }

      // Parse JUnit XML for detailed test results
      const testSuites = await parseTestSuiteDetails(runDetails, readFromStorage);

      res.json({
        runDetails,
        testSuites
      });

    } catch (error) {
      console.error('Error fetching test run details:', error);
      res.status(500).json({
        error: 'Failed to fetch test run details',
        message: error.message
      });
    }
  });

  /**
   * @openapi
   * /api/modules/system-health/odh-e2e-health/runs:
   *   get:
   *     tags: [System Health]
   *     summary: Get paginated E2E test run history
   *     description: Returns paginated history of recent E2E test runs
   *     parameters:
   *       - name: page
   *         in: query
   *         description: Page number (1-based)
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *       - name: limit
   *         in: query
   *         description: Number of runs per page
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 50
   *           default: 20
   *       - name: suite
   *         in: query
   *         description: Filter by test suite
   *         schema:
   *           type: string
   *           enum: [odh, rhoai]
   *       - name: status
   *         in: query
   *         description: Filter by run status
   *         schema:
   *           type: string
   *           enum: [passed, failed]
   *     responses:
   *       200:
   *         description: Paginated test run history
   */
  router.get('/runs', async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = Math.min(parseInt(req.query.limit) || 20, 50);
      const suiteFilter = req.query.suite;
      const statusFilter = req.query.status;

      const healthData = await readFromStorage('system-health/odh-e2e-health.json');

      if (!healthData || !healthData.recentRuns) {
        return res.json({
          runs: [],
          pagination: { page, limit, total: 0, hasNextPage: false }
        });
      }

      let filteredRuns = healthData.recentRuns;

      // Apply filters
      if (suiteFilter) {
        filteredRuns = filteredRuns.filter(run => run.suite === suiteFilter);
      }
      if (statusFilter) {
        filteredRuns = filteredRuns.filter(run => run.status === statusFilter);
      }

      // Pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedRuns = filteredRuns.slice(startIndex, endIndex);

      res.json({
        runs: paginatedRuns,
        pagination: {
          page,
          limit,
          total: filteredRuns.length,
          hasNextPage: endIndex < filteredRuns.length
        }
      });
    } catch (error) {
      console.error('Error fetching E2E run history:', error);
      res.status(500).json({
        error: 'Failed to fetch E2E run history',
        message: error.message
      });
    }
  });



};

/**
 * Parse detailed test suite information from real JUnit XML artifacts
 * @param {Object} runDetails - Basic run information
 * @param {Function} readFromStorage - Storage read function
 * @returns {Promise<Array>} Array of detailed test suite data
 */
async function parseTestSuiteDetails(runDetails, readFromStorage) {
  try {
    // For failed tests, try to fetch real JUnit XML from Prow artifacts
    if (runDetails.status === 'failed' && runDetails.artifactsUrl) {
      console.log(`Fetching real JUnit XML for build ${runDetails.buildId}`);

      try {
        const junitXml = await fetchJunitXmlFromArtifacts(runDetails.artifactsUrl);
        if (junitXml) {
          console.log(`Successfully fetched JUnit XML for build ${runDetails.buildId}`);
          return parseRealJunitXml(junitXml, runDetails);
        }
      } catch (error) {
        console.error(`Failed to fetch real JUnit XML for build ${runDetails.buildId}:`, error.message);
      }
    }

    // Try to load detailed stub data as fallback
    try {
      const junitExamples = await readFromStorage('system-health/junit-detailed-examples.json');
      if (junitExamples && junitExamples[runDetails.buildId]) {
        console.log(`Using detailed stub data for build ${runDetails.buildId}`);
        return junitExamples[runDetails.buildId].testSuites;
      }
    } catch {
      console.log('No detailed stub data found');
    }

    // Final fallback: mock data only in demo mode
    const isDemoMode = DEMO_MODE;
    if (!isDemoMode) {
      console.log(`No JUnit XML available for build ${runDetails.buildId}, returning empty test suites (real run)`);
      return [];
    }

    console.log(`Generating mock test suites for build ${runDetails.buildId} (demo mode)`);
    const testSuites = [];

    if (runDetails.status === 'failed' && runDetails.failedComponents && runDetails.failedComponents.length > 0) {
      for (const component of runDetails.failedComponents) {
        const suite = generateMockTestSuite(component, runDetails.suite, false, true);
        testSuites.push(suite);
      }
    } else if (runDetails.status === 'failed') {
      const suite = generateMockTestSuite('unknown', runDetails.suite, false);
      testSuites.push(suite);
    } else if (runDetails.status === 'passed') {
      const commonComponents = ['dashboard', 'kserve', 'modelregistry'];
      for (const component of commonComponents) {
        const suite = generateMockTestSuite(component, runDetails.suite, true);
        testSuites.push(suite);
      }
    }

    return testSuites;

  } catch (error) {
    console.error('Error parsing test suite details:', error);
    return [];
  }
}

/**
 * Generate deterministic hash value for mock test generation
 * @param {string} input - Input string to hash
 * @param {number} seed - Additional seed value
 * @returns {number} Deterministic hash value
 */
function deterministicHash(input, seed = 0) {
  let hash = 0;
  const str = input + seed.toString();
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Generate mock test suite data for development
 * @param {string} component - Component name
 * @param {string} suite - Test suite (odh/rhoai)
 * @param {boolean} shouldPass - Whether tests should pass
 * @param {boolean} forceFailures - Force some test failures regardless of shouldPass
 * @returns {Object} Mock test suite data
 */
function generateMockTestSuite(component, _suite, shouldPass = false, forceFailures = false) {
  const testCases = [];
  const numTests = 3 + (deterministicHash(component, 1) % 5); // 3-7 tests per component

  for (let i = 0; i < numTests; i++) {
    const testName = `Test${component.charAt(0).toUpperCase()}${component.slice(1)}${String(i + 1).padStart(2, '0')}`;
    const duration = 10 + (deterministicHash(component, i + 2) % 180); // 10-190 seconds

    let shouldFail = !shouldPass && (deterministicHash(component, i + 3) % 100) < 30; // 30% chance of individual test failure

    // If forceFailures is true, ensure at least the first 1-2 tests fail for failed components
    if (forceFailures && !shouldPass && i < 2) {
      shouldFail = true;
    }

    const testCase = {
      name: testName,
      duration,
      status: shouldFail ? 'failed' : 'passed'
    };

    if (shouldFail) {
      testCase.failure = {
        message: generateRealisticErrorMessage(component, testName),
        stackTrace: generateMockStackTrace(component, testName)
      };
    }

    testCases.push(testCase);
  }

  const failedTests = testCases.filter(t => t.status === 'failed');
  const totalDuration = testCases.reduce((sum, t) => sum + t.duration, 0);

  return {
    name: `E2E-${component.charAt(0).toUpperCase()}${component.slice(1)}`,
    component,
    total: testCases.length,
    passed: testCases.length - failedTests.length,
    failed: failedTests.length,
    status: failedTests.length > 0 ? 'failed' : 'passed',
    duration: totalDuration,
    testCases,
    failedTestCases: failedTests
  };
}

/**
 * Generate realistic error messages based on component
 */
function generateRealisticErrorMessage(component, _testName) {
  const errorMessages = {
    dashboard: [
      'Dashboard pod failed to start within timeout',
      'Login page did not load within 60 seconds',
      'Navigation menu items not found',
      'User session authentication failed'
    ],
    kserve: [
      'KServe inference service deployment timeout',
      'Model serving endpoint not responding',
      'Predictor pod failed readiness check',
      'Inference request returned 503 Service Unavailable'
    ],
    modelregistry: [
      'Model registration API returned 500 Internal Server Error',
      'Database connection pool exhausted',
      'Model artifact upload failed with timeout',
      'Registry schema validation failed'
    ],
    trustyai: [
      'TrustyAI service discovery failed',
      'Explainability analysis timeout',
      'Bias detection algorithm crashed',
      'AI fairness metrics calculation failed'
    ]
  };

  const messages = errorMessages[component] || ['Generic test failure'];
  return messages[deterministicHash(component + _testName, 99) % messages.length];
}

/**
 * Generate mock stack trace for failed tests
 */
function generateMockStackTrace(component, _testName) {
  return `java.lang.AssertionError: ${generateRealisticErrorMessage(component, _testName)}
    at org.junit.Assert.fail(Assert.java:88)
    at org.junit.Assert.assertTrue(Assert.java:41)
    at io.opendatahub.test.e2e.${component}.${_testName}(${_testName}.java:45)
    at sun.reflect.NativeMethodAccessorImpl.invoke0(Native Method)
    at sun.reflect.NativeMethodAccessorImpl.invoke(NativeMethodAccessorImpl.java:62)
    at sun.reflect.DelegatingMethodAccessorImpl.invoke(DelegatingMethodAccessorImpl.java:43)
    at java.lang.reflect.Method.invoke(Method.java:498)
    at org.junit.runners.model.FrameworkMethod$1.runReflectiveCall(FrameworkMethod.java:50)
    at org.junit.internal.runners.model.ReflectiveCallable.run(ReflectiveCallable.java:12)
    at org.junit.runners.model.FrameworkMethod.invokeExplosively(FrameworkMethod.java:47)
    at org.junit.internal.runners.statements.InvokeMethod.evaluate(InvokeMethod.java:17)
    at org.junit.runners.ParentRunner.runLeaf(ParentRunner.java:325)
    at org.junit.runners.BlockJUnit4ClassRunner.runChild(BlockJUnit4ClassRunner.java:78)
    at org.junit.runners.ParentRunner$3.run(ParentRunner.java:290)
    at java.util.concurrent.FutureTask.run(FutureTask.java:266)
    at java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1149)`;
}

/**
 * Fetch JUnit XML from Prow artifacts URL
 * @param {string} artifactsUrl - The artifacts URL from runDetails
 * @returns {Promise<string|null>} JUnit XML content or null if not found
 */
async function fetchJunitXmlFromArtifacts(artifactsUrl) {
  // Normalize: old runs may have stored the Prow GCS proxy URL (/gcs/) instead of
  // the direct GCS download URL — convert to storage.googleapis.com which actually serves files
  const normalized = artifactsUrl.replace('https://prow.ci.openshift.org/gcs/', 'https://storage.googleapis.com/');
  const base = normalized.endsWith('/') ? normalized : normalized + '/';
  // Must match the paths that actually exist in GCS (verified: junit_operator.xml and prowjob_junit.xml)
  const candidatePaths = ['artifacts/junit_operator.xml', 'prowjob_junit.xml'];

  for (const candidate of candidatePaths) {
    const junitUrl = base + candidate;
    console.log(`Trying JUnit XML from: ${junitUrl}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(junitUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (response.status === 404) {
        continue;
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const xml = await response.text();
      if (xml.trim().length > 0) {
        console.log(`Found JUnit XML at: ${junitUrl} (${xml.length} bytes)`);
        return xml;
      }
    } catch (error) {
      clearTimeout(timeout);
      if (error.name === 'AbortError') {
        console.log(`Timeout fetching JUnit XML from: ${junitUrl}`);
      } else {
        console.log(`Failed to fetch ${junitUrl}: ${error.message}`);
      }
    }
  }

  console.log(`No JUnit XML found for artifacts URL: ${base}`);
  return null;
}

/**
 * Parse real JUnit XML into detailed test suite information using xml2js
 * @param {string} xmlContent - The JUnit XML content
 * @param {Object} runDetails - Basic run information
 * @returns {Array} Array of detailed test suite data
 */
function parseRealJunitXml(xmlContent, runDetails) {
  const xml2js = require('xml2js');
  const testSuites = [];

  try {
    console.log(`Parsing JUnit XML (${xmlContent.length} bytes) for build ${runDetails.buildId} with xml2js`);

    // Parse XML to JavaScript object
    const parser = new xml2js.Parser({
      explicitArray: false,
      ignoreAttrs: false,
      mergeAttrs: true
    });

    // Synchronous parsing for better error handling
    let parsed;
    parser.parseString(xmlContent, (err, result) => {
      if (err) {
        throw err;
      }
      parsed = result;
    });

    if (!parsed) {
      console.log('No valid XML structure found');
      return [];
    }

    // Handle different JUnit XML root structures
    const testSuitesData = parsed.testsuites?.testsuite || parsed.testsuite || [parsed];
    const suiteArray = Array.isArray(testSuitesData) ? testSuitesData : [testSuitesData];

    console.log(`Processing ${suiteArray.length} test suite(s) from JUnit XML`);

    for (const suite of suiteArray) {
      if (!suite || !suite.name) continue;

      const suiteName = suite.name;
      const totalTests = parseInt(suite.tests) || 0;
      const failures = parseInt(suite.failures) || 0;
      const errors = parseInt(suite.errors) || 0;
      const duration = parseFloat(suite.time) || 0;

      const failed = failures + errors;
      const passed = totalTests - failed;

      // Extract component name from suite name
      const component = extractComponentFromSuiteName(suiteName);

      // Process test cases with full details
      const testCases = extractTestCasesWithDetails(suite);

      testSuites.push({
        name: suiteName,
        component: component,
        total: totalTests,
        passed: passed,
        failed: failed,
        status: failed > 0 ? 'failed' : 'passed',
        duration: Math.round(duration),
        testCases: testCases,
        failedTestCases: testCases.filter(tc => tc.status === 'failed')
      });

      console.log(`Suite "${suiteName}": ${totalTests} tests, ${passed} passed, ${failed} failed (${component})`);
    }

    console.log(`Parsed ${testSuites.length} test suites from JUnit XML using xml2js`);
    return testSuites;

  } catch (error) {
    console.error('Error parsing real JUnit XML with xml2js:', error.message);
    console.log('Falling back to regex parsing...');

    // Fallback to regex parsing if xml2js fails
    return parseRealJunitXmlWithRegex(xmlContent, runDetails);
  }
}

/**
 * Extract detailed test case information from a test suite using xml2js parsed data
 * @param {Object} suite - Parsed test suite object
 * @returns {Array} Array of test case details
 */
function extractTestCasesWithDetails(suite) {
  const testCases = [];

  try {
    const testCaseData = suite.testcase || [];
    const caseArray = Array.isArray(testCaseData) ? testCaseData : [testCaseData];

    for (const testCase of caseArray) {
      if (!testCase || !testCase.name) continue;

      const hasFailure = testCase.failure !== undefined;
      const hasError = testCase.error !== undefined;
      const isSkipped = testCase.skipped !== undefined;

      let status = 'passed';
      let errorMessage = '';
      let errorDetails = '';

      if (hasFailure) {
        status = 'failed';
        errorMessage = testCase.failure.message || 'Test failure';
        errorDetails = typeof testCase.failure === 'object' ? testCase.failure._ || '' : testCase.failure || '';
      } else if (hasError) {
        status = 'failed';
        errorMessage = testCase.error.message || 'Test error';
        errorDetails = typeof testCase.error === 'object' ? testCase.error._ || '' : testCase.error || '';
      } else if (isSkipped) {
        status = 'skipped';
      }

      testCases.push({
        name: testCase.name,
        classname: testCase.classname || '',
        status: status,
        duration: parseFloat(testCase.time) || 0,
        failure: status === 'failed' ? {
          message: errorMessage,
          stackTrace: errorDetails.substring(0, 1000)
        } : undefined,
        timestamp: testCase.timestamp || null
      });
    }

    return testCases;

  } catch (error) {
    console.error('Error extracting test case details:', error.message);
    return [];
  }
}

/**
 * Fallback regex-based XML parsing for when xml2js fails
 * @param {string} xmlContent - The JUnit XML content
 * @param {Object} runDetails - Basic run information
 * @returns {Array} Array of test suite data
 */
function parseRealJunitXmlWithRegex(xmlContent, runDetails) {
  const testSuites = [];

  try {
    console.log(`Fallback: parsing JUnit XML with regex for build ${runDetails.buildId}`);

    // Parse test suites from XML using regex
    const testSuiteRegex = /<testsuite[^>]*name="([^"]+)"[^>]*tests="(\d+)"[^>]*failures="(\d+)"[^>]*errors="(\d+)"[^>]*time="([^"]*)"[^>]*>/g;

    let suiteMatch;
    while ((suiteMatch = testSuiteRegex.exec(xmlContent)) !== null) {
      const suiteName = suiteMatch[1];
      const totalTests = parseInt(suiteMatch[2]);
      const failures = parseInt(suiteMatch[3]);
      const errors = parseInt(suiteMatch[4]);
      const timeStr = suiteMatch[5];

      const failed = failures + errors;
      const passed = totalTests - failed;
      const duration = parseFloat(timeStr) || 0;

      // Extract component name from suite name
      const component = extractComponentFromSuiteName(suiteName);

      // Find all test cases in this suite (basic regex extraction)
      const testCases = extractTestCasesFromSuite(xmlContent, suiteName);

      testSuites.push({
        name: suiteName,
        component: component,
        total: totalTests,
        passed: passed,
        failed: failed,
        status: failed > 0 ? 'failed' : 'passed',
        duration: Math.round(duration),
        testCases: testCases,
        failedTestCases: testCases.filter(tc => tc.status === 'failed')
      });
    }

    console.log(`Fallback regex parsed ${testSuites.length} test suites`);
    return testSuites;

  } catch (error) {
    console.error('Fallback regex parsing also failed:', error.message);
    return [];
  }
}

/**
 * Extract component name from test suite name - zero maintenance version
 * @param {string} suiteName - The test suite name
 * @returns {string} Component name
 */
function extractComponentFromSuiteName(suiteName) {
  // Use our zero-maintenance component detection
  const component = mapSuiteToComponent(suiteName);

  if (component) {
    return component;
  }

  // If dynamic detection fails, try path extraction or fallback to unknown
  const pathComponent = extractComponentFromTestPath(suiteName);
  if (pathComponent) {
    return pathComponent;
  }

  return 'unknown';
}

/**
 * Extract test cases from a specific test suite in the XML
 * @param {string} xmlContent - The full JUnit XML content
 * @param {string} suiteName - The test suite name
 * @returns {Array} Array of test case objects
 */
function extractTestCasesFromSuite(xmlContent, suiteName) {
  const testCases = [];

  try {
    // Find the test suite section in the XML
    const suiteStartRegex = new RegExp(`<testsuite[^>]*name="${suiteName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`, 'i');
    const suiteMatch = xmlContent.match(suiteStartRegex);

    if (!suiteMatch) {
      return testCases;
    }

    const suiteStartIndex = suiteMatch.index + suiteMatch[0].length;
    const suiteEndIndex = xmlContent.indexOf('</testsuite>', suiteStartIndex);

    if (suiteEndIndex === -1) {
      return testCases;
    }

    const suiteContent = xmlContent.substring(suiteStartIndex, suiteEndIndex);

    // Extract test cases
    const testCaseRegex = /<testcase[^>]*name="([^"]+)"[^>]*time="([^"]*)"[^>]*>([\s\S]*?)<\/testcase>/g;

    let testMatch;
    while ((testMatch = testCaseRegex.exec(suiteContent)) !== null) {
      const testName = testMatch[1];
      const timeStr = testMatch[2];
      const testContent = testMatch[3];

      const duration = Math.round(parseFloat(timeStr) || 0);

      // Check if test failed
      const hasFailure = testContent.includes('<failure') || testContent.includes('<error');

      const testCase = {
        name: testName,
        duration: duration,
        status: hasFailure ? 'failed' : 'passed'
      };

      if (hasFailure) {
        // Extract failure information
        const failureMatch = testContent.match(/<(failure|error)[^>]*message="([^"]*)"[^>]*>([\s\S]*?)<\/\1>/);
        if (failureMatch) {
          testCase.failure = {
            message: failureMatch[2] || 'Test failed',
            stackTrace: failureMatch[3] || ''
          };
        }
      }

      testCases.push(testCase);
    }

  } catch (error) {
    console.error('Error extracting test cases:', error.message);
  }

  return testCases;
};
