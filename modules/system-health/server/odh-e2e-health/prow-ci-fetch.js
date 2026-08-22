/**
 * Simple Prow CI data fetcher using prowjobs.js API
 * Replaces complex enhanced filtering with single API call approach
 */

const PROW_CONFIG = {
  prowJobsApiUrl: 'https://prow.ci.openshift.org/prowjobs.js?var=allBuilds&omit=annotations,labels,decoration_config,pod_spec',
  jobNames: {
    odh: 'pull-ci-opendatahub-io-opendatahub-operator-main-opendatahub-operator-e2e',
    rhoai: 'pull-ci-opendatahub-io-opendatahub-operator-main-opendatahub-operator-rhoai-e2e'
  },
  orgName: 'opendatahub-io',
  repoName: 'opendatahub-operator'
};

/**
 * Modern fetch API helper with timeout
 * @param {string} url - URL to fetch
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<string>} Response text
 */
async function fetchWithTimeout(url, timeout = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'org-pulse-e2e-health-monitor/1.0',
        'Accept-Encoding': 'gzip, deflate'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.text();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`, { cause: error });
    }
    throw error;
  }
}

/**
 * Main function: Fetch recent E2E runs using prowjobs.js API
 * @param {boolean} isDemoMode - Use demo data instead of real API
 * @param {number} daysBack - Days to look back (for filtering)
 * @param {string} lastSyncTime - Optional last sync time for incremental updates
 * @returns {Promise<Object>} E2E data with odhJobs and rhoaiJobs arrays
 */
async function fetchRecentE2ERuns(isDemoMode = false, daysBack = 14, lastSyncTime = null) {
  if (isDemoMode || process.env.DEMO_MODE === 'true') {
    console.log('Using fixture data (demo mode)');
    // Return empty data - fixture data is served directly by demo-storage.js
    // The main health endpoint will read from fixtures/system-health/odh-e2e-health.json
    return {
      odhJobs: [],
      rhoaiJobs: [],
      isStubData: true,
      error: null,
      isIncremental: false,
      fetchMetrics: {
        totalProwJobs: 0,
        filteredJobs: 0,
        executionTimeMs: 1,
        dataTransferMB: 0,
        filteringRatio: '0%',
        demoMode: true
      }
    };
  }

  const startTime = Date.now();
  console.log('Fetching E2E data from prowjobs.js API...');

  try {
    // Step 1: Download prowjobs data
    console.log('Downloading prowjobs data from Prow CI...');
    const rawData = await fetchWithTimeout(PROW_CONFIG.prowJobsApiUrl, 60000); // 60 second timeout

    // Step 2: Parse JavaScript response
    console.log('Parsing prowjobs data...');
    const jsonData = rawData.replace(/^var allBuilds = /, '').replace(/;$/, '');
    const prowData = JSON.parse(jsonData);

    console.log(`Parsed ${prowData.items.length} total ProwJobs`);

    // Step 3: Filter to our specific E2E jobs
    console.log('Filtering to OpenDataHub E2E jobs...');
    const odhJobsToProcess = [];
    const rhoaiJobsToProcess = [];

    const cutoffTime = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    for (const job of prowData.items) {
      const jobName = job.spec?.job;
      const jobStartTime = job.status?.startTime;

      // Skip jobs without proper data
      if (!jobName || !jobStartTime) continue;

      // Check if it's one of our target jobs
      if (jobName === PROW_CONFIG.jobNames.odh) {
        // Filter by time if specified
        if (new Date(jobStartTime) < cutoffTime) continue;
        odhJobsToProcess.push(job);
      } else if (jobName === PROW_CONFIG.jobNames.rhoai) {
        // Filter by time if specified
        if (new Date(jobStartTime) < cutoffTime) continue;
        rhoaiJobsToProcess.push(job);
      }
    }

    console.log(`Processing ${odhJobsToProcess.length} ODH + ${rhoaiJobsToProcess.length} RHOAI jobs for component extraction...`);

    // Process jobs in parallel with async component extraction
    const [odhJobsRaw, rhoaiJobsRaw] = await Promise.all([
      Promise.all(odhJobsToProcess.map(job => transformProwJobToE2EData(job, 'odh'))),
      Promise.all(rhoaiJobsToProcess.map(job => transformProwJobToE2EData(job, 'rhoai')))
    ]);

    // Filter out null results (pending/running tests)
    const odhJobs = odhJobsRaw.filter(job => job !== null);
    const rhoaiJobs = rhoaiJobsRaw.filter(job => job !== null);

    // Step 4: Sort by timestamp (newest first)
    odhJobs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    rhoaiJobs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const totalJobs = odhJobs.length + rhoaiJobs.length;
    const executionTime = Date.now() - startTime;

    console.log(`Found ${odhJobs.length} ODH + ${rhoaiJobs.length} RHOAI E2E jobs in ${(executionTime/1000).toFixed(1)}s`);

    return {
      odhJobs,
      rhoaiJobs,
      isStubData: false,
      error: null,
      isIncremental: !!lastSyncTime,
      fetchMetrics: {
        totalProwJobs: prowData.items.length,
        filteredJobs: totalJobs,
        executionTimeMs: executionTime,
        dataTransferMB: Math.round(rawData.length / (1024 * 1024) * 10) / 10,
        filteringRatio: ((totalJobs / prowData.items.length) * 100).toFixed(3) + '%'
      }
    };

  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`Failed to fetch E2E data: ${error.message}`);

    return {
      odhJobs: [],
      rhoaiJobs: [],
      isStubData: false,
      error: error.message,
      isIncremental: !!lastSyncTime,
      fetchMetrics: {
        totalProwJobs: 0,
        filteredJobs: 0,
        executionTimeMs: executionTime,
        errorOccurred: true
      }
    };
  }
}

/**
 * Transform a Prow CI job object to our E2E data format
 * Note: This function needs to be async now that it extracts real failed components
 */
async function transformProwJobToE2EData(prowJob, suite) {
  const job = prowJob.spec || {};
  const status = prowJob.status || {};
  const refs = job.refs || {};
  const pulls = refs.pulls || [];
  const firstPull = pulls[0] || {};

  // Extract component failures from job artifacts (async operation)
  const failedComponents = await extractFailedComponents(prowJob);

  const mappedStatus = mapProwJobStatus(status.state);

  // Skip pending/running tests - only process completed tests
  if (mappedStatus === null) {
    return null;
  }

  return {
    buildId: status.build_id || prowJob.metadata?.name || 'unknown',
    jobName: job.job,
    suite: suite,
    status: mappedStatus,
    timestamp: status.startTime || prowJob.metadata?.creationTimestamp || new Date().toISOString(),
    prNumber: firstPull.number || null,
    prTitle: firstPull.title || null,
    prAuthor: firstPull.author || null,
    prowUrl: status.url || `https://prow.ci.openshift.org/view/gs/test-platform-results/pr-logs/pull/${refs.org}_${refs.repo}/${firstPull.number}/${job.job}/${status.build_id}`,
    artifactsUrl: status.url ? status.url.replace('https://prow.ci.openshift.org/view/gs/', 'https://storage.googleapis.com/') + '/' : null,
    runDuration: calculateRunDuration(status.startTime, status.completionTime),
    failedComponents: failedComponents,
    repository: `${refs.org}/${refs.repo}`
  };
}

/**
 * Map Prow job states to our E2E status format
 * Only returns completed states - filters out pending/running tests
 */
function mapProwJobStatus(prowState) {
  switch (prowState) {
    case 'success': return 'passed';
    case 'failure': return 'failed';
    case 'error': return 'failed';
    case 'aborted': return 'failed';
    // Skip pending/running tests - they don't contribute to health metrics
    case 'pending': return null;
    case 'triggered': return null;
    default: return null;
  }
}

/**
 * Calculate run duration in seconds
 */
function calculateRunDuration(startTime, completionTime) {
  if (!startTime || !completionTime) return null;

  const start = new Date(startTime);
  const end = new Date(completionTime);
  return Math.round((end - start) / 1000); // seconds
}

/**
 * Extract failed components from job data
 * Note: This is simplified - detailed component analysis would require JUnit parsing
 */
/**
 * Extract failed components by fetching and parsing JUnit XML from Prow CI artifacts
 * @param {Object} prowJob - The Prow job object
 * @returns {Promise<Array<string>>} Array of failed component names
 */
async function extractFailedComponents(prowJob) {
  const status = prowJob.status || {};

  // Only try to extract failed components for failed jobs
  if (status.state !== 'failure' && status.state !== 'error') {
    return [];
  }

  try {
    // Get possible JUnit XML URLs to try
    const junitUrls = buildJunitXmlUrls(prowJob);
    if (junitUrls.length === 0) {
      console.log(`No JUnit URLs could be built for job ${status.build_id}`);
      return [];
    }

    // Try each URL until we find JUnit XML data
    let junitXml = null;
    let successUrl = null;

    for (const url of junitUrls) {
      console.log(`Trying JUnit XML from: ${url}`);
      try {
        const xml = await fetchJunitXml(url);
        if (xml && xml.trim().length > 0) {
          junitXml = xml;
          successUrl = url;
          console.log(`Found JUnit XML at: ${url}`);
          break;
        }
      } catch (error) {
        console.log(`Failed to fetch from ${url}: ${error.message}`);
        continue;
      }
    }

    if (!junitXml) {
      console.log(`No JUnit XML found for job ${status.build_id} after trying ${junitUrls.length} locations`);
      return [];
    }

    // Parse XML and extract failed components
    const failedComponents = parseJunitXmlForComponents(junitXml);
    console.log(`Extracted ${failedComponents.length} failed components for job ${status.build_id} from ${successUrl}:`, failedComponents);

    return failedComponents;

  } catch (error) {
    console.error(`Failed to extract components for job ${status.build_id}:`, error.message);
    return [];
  }
}

/**
 * Efficient connectivity test using HEAD request
 * No longer downloads the full payload like the previous version
 */
async function validateProwConnection() {
  try {
    // Use HEAD request to check connectivity without downloading the full payload
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(PROW_CONFIG.prowJobsApiUrl, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'org-pulse-e2e-health-monitor/1.0'
        }
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        console.log('Prow CI prowjobs.js API is accessible (HEAD check)');
        return true;
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  } catch (error) {
    console.error(`Cannot connect to Prow CI API: ${error.message}`);
    return false;
  }
}

/**
 * Build the GCS URLs for JUnit XML artifacts
 * @param {Object} prowJob - The Prow job object
 * @returns {Array<string>} Array of GCS URLs for JUnit XML files to try
 */
function buildJunitXmlUrls(prowJob) {
  const job = prowJob.spec || {};
  const status = prowJob.status || {};
  const refs = job.refs || {};
  const pulls = refs.pulls || [];
  const firstPull = pulls[0] || {};

  const buildId = status.build_id;
  const jobName = job.job;
  const org = refs.org;
  const repo = refs.repo;
  const prNumber = firstPull.number;

  if (!buildId || !jobName || !org || !repo || !prNumber) {
    return [];
  }

  const baseUrl = `https://storage.googleapis.com/test-platform-results/pr-logs/pull/${org}_${repo}/${prNumber}/${jobName}/${buildId}`;

  return [
    // Try detailed JUnit XML first (contains component-level test failures)
    `${baseUrl}/artifacts/junit_operator.xml`,
    // Fallback to prowjob JUnit XML (job-level status only)
    `${baseUrl}/prowjob_junit.xml`
  ];
}

/**
 * Fetch JUnit XML from GCS
 * @param {string} url - The GCS URL for JUnit XML
 * @returns {Promise<string|null>} The JUnit XML content or null if not found
 */
async function fetchJunitXml(url) {
  return new Promise((resolve, reject) => {
    let req;
    const timeout = setTimeout(() => {
      if (req) req.abort();
      reject(new Error('JUnit XML fetch timeout'));
    }, 10000); // 10 second timeout

    req = require('https').get(url, { timeout: 10000 }, (res) => {
      clearTimeout(timeout);

      if (res.statusCode === 404) {
        console.log('JUnit XML not found (404) - test may not have generated artifacts');
        resolve(null);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (data.trim().length === 0) {
          resolve(null);
        } else {
          resolve(data);
        }
      });
    });

    req.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    req.on('timeout', () => {
      req.abort();
      reject(new Error('JUnit XML fetch timeout'));
    });
  });
}

/**
 * Parse JUnit XML and extract failed component names using proper XML parser
 * @param {string} xmlContent - The JUnit XML content
 * @returns {Array<string>} Array of failed component names
 */
function parseJunitXmlForComponents(xmlContent) {
  const xml2js = require('xml2js');
  const failedComponents = new Set();

  try {
    // Infrastructure/diagnostic test patterns (will be mapped to 'infrastructure' component)
    const infrastructurePatterns = [
      /gather.*audit.*logs?/i,
      /gather.*extra/i,
      /gather.*must.*gather/i,
      /must.*gather/i,
      /cluster.*preflight.*health.*check/i,
      /preflight.*health.*check/i,
      /health.*check/i,
      /rbac.*install/i,
      /pre\s+phase/i,
      /post\s+phase/i,
      /step.*graph/i,
      /build.*image/i,
      /clone.*source/i,
      /find.*input.*image/i,
      // Additional patterns for the actual test names we see
      /run.*multi.*stage.*test.*gather/i,
      /run.*multi.*stage.*test.*pre.*phase/i,
      /run.*multi.*stage.*test.*post.*phase/i,
      /opendatahub-operator-e2e.*gather/i,
      /opendatahub-operator-e2e.*preflight/i,
      /opendatahub-operator-rhoai-e2e.*gather/i,
      /opendatahub-operator-rhoai-e2e.*preflight/i,
      // Specific mustgather and audit log tests (both ODH and RHOAI)
      /gather.*audit.*logs.*container.*test/i,
      /gather.*extra.*container.*test/i,
      /gather.*must.*gather.*container.*test/i,
      /cluster.*preflight.*health.*check.*container.*test/i
    ];

    // Component mapping patterns (inspired by ODH triage script patterns)
    const componentMapping = {
      // Infrastructure/diagnostic category (separate from components)
      'infrastructure': /^step.*graph$|build.*image|clone.*source|find.*input.*image|rbac.*install|pre\s+phase|post\s+phase/i,

      // Real E2E component tests (pattern: TestOdhOperator/components/... from triage.py)
      'dashboard': /TestOdhOperator.*components.*dashboard|dashboard.*e2e|ui.*test|frontend.*test|web.*test|console.*test/i,
      'authentication': /TestOdhOperator.*components.*auth|auth.*e2e|login.*test|oauth.*test|sso.*test|identity.*test/i,
      'notebook': /TestOdhOperator.*components.*notebook|TestOdhOperator.*components.*workbench|notebook.*e2e|jupyter.*test|workbench.*test/i,

      // ML/AI components
      'kserve': /TestOdhOperator.*components.*kserve|kserve.*e2e|serving.*test|inference.*test|model.*serv.*test/i,
      'modelregistry': /TestOdhOperator.*components.*modelregistry|model.*registry.*e2e|registry.*model.*test/i,
      'trustyai': /TestOdhOperator.*components.*trustyai|trusty.*e2e|explainability.*test|fairness.*test|bias.*test/i,
      'modelmesh': /TestOdhOperator.*components.*modelmesh|model.*mesh.*e2e|mesh.*model.*test/i,

      // Data science components
      'datasciencepipelines': /TestOdhOperator.*components.*datasciencepipelines|TestOdhOperator.*components.*dsp|pipeline.*e2e|kubeflow.*test|argo.*test|workflow.*test/i,
      'ray': /TestOdhOperator.*components.*ray|ray.*e2e|ray.*test|distributed.*test/i,
      'codeflare': /TestOdhOperator.*components.*codeflare|codeflare.*e2e|mcad.*test|appwrapper.*test/i,
      'kueue': /TestOdhOperator.*components.*kueue|kueue.*e2e|queue.*test|workload.*test/i
    };

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
    const testSuites = parsed.testsuites?.testsuite || parsed.testsuite || [parsed];
    const suiteArray = Array.isArray(testSuites) ? testSuites : [testSuites];

    console.log(`Processing ${suiteArray.length} test suite(s) from JUnit XML`);

    for (const suite of suiteArray) {
      if (!suite) continue;

      // Check for suite-level failures
      const suiteName = suite.name || 'unknown';
      const suiteFailures = parseInt(suite.failures) || 0;

      if (suiteFailures > 0) {
        console.log(`Test suite "${suiteName}" has ${suiteFailures} failures`);

        // Check if this is an infrastructure test suite (inspired by triage.py)
        const isInfrastructure = infrastructurePatterns.some(pattern => pattern.test(suiteName));
        if (isInfrastructure) {
          failedComponents.add('infrastructure');
          console.log(`Mapped infrastructure suite "${suiteName}" to infrastructure category`);
          continue;
        }

        // Map suite name to component
        for (const [component, pattern] of Object.entries(componentMapping)) {
          if (pattern.test(suiteName)) {
            failedComponents.add(component);
            console.log(`Mapped suite "${suiteName}" to component: ${component}`);
            break;
          }
        }
      }

      // Process individual test cases
      const testCases = suite.testcase || [];
      const caseArray = Array.isArray(testCases) ? testCases : [testCases];

      for (const testCase of caseArray) {
        if (!testCase) continue;

        // Check if test case has failures or errors
        const hasFailure = testCase.failure !== undefined;
        const hasError = testCase.error !== undefined;

        if (hasFailure || hasError) {
          const testName = testCase.name || testCase.classname || 'unknown';
          const errorMessage = testCase.failure?.message || testCase.error?.message || 'No message';

          console.log(`Failed test: "${testName}" - ${errorMessage.substring(0, 100)}...`);

          // Check if this is an infrastructure/diagnostic test case
          const isInfrastructure = infrastructurePatterns.some(pattern => pattern.test(testName));
          if (isInfrastructure) {
            failedComponents.add('infrastructure');
            console.log(`Mapped infrastructure test "${testName}" to infrastructure category`);
            continue;
          }

          // Map test name to component (only for actual E2E component tests)
          let mapped = false;
          for (const [component, pattern] of Object.entries(componentMapping)) {
            if (pattern.test(testName)) {
              failedComponents.add(component);
              console.log(`Mapped test "${testName}" to component: ${component}`);
              mapped = true;
              break;
            }
          }

          // For unmapped tests, only consider them if they look like actual E2E tests
          if (!mapped && /TestOdhOperator.*components|e2e.*test/i.test(testName)) {
            console.log(`Unmapped E2E test failure: "${testName}" (potential new component)`);
            // Consider adding to a general "unknown-component" category if needed
          }
        }
      }
    }

    const components = Array.from(failedComponents);
    console.log(`Total failed components extracted from JUnit XML: ${components.join(', ') || 'none'}`);

    return components;

  } catch (error) {
    console.error('Error parsing JUnit XML with xml2js:', error.message);
    console.log('Falling back to minimal regex parsing...');

    // Fallback to basic regex if XML parsing fails
    return parseJunitXmlWithRegexFallback(xmlContent);
  }
}

/**
 * Fallback regex-based XML parsing for when xml2js fails
 * @param {string} xmlContent - The JUnit XML content
 * @returns {Array<string>} Array of failed component names
 */
function parseJunitXmlWithRegexFallback(xmlContent) {
  const failedComponents = new Set();

  try {
    // Simple regex for test failures
    const failureRegex = /<testcase[^>]*name="([^"]*)"[^>]*>[\s\S]*?<(?:failure|error)/g;
    let match;

    while ((match = failureRegex.exec(xmlContent)) !== null) {
      const testName = match[1];

      // Check if this is an infrastructure/diagnostic test
      const isInfrastructure = /gather.*audit.*logs?|gather.*extra|gather.*must.*gather|must.*gather|cluster.*preflight|health.*check|rbac.*install|pre\s+phase|post\s+phase|step.*graph|build.*image|clone.*source|find.*input.*image|run.*multi.*stage.*test.*gather|run.*multi.*stage.*test.*pre.*phase|run.*multi.*stage.*test.*post.*phase|opendatahub-operator-e2e.*gather|opendatahub-operator-e2e.*preflight|opendatahub-operator-rhoai-e2e.*gather|opendatahub-operator-rhoai-e2e.*preflight|gather.*audit.*logs.*container.*test|gather.*extra.*container.*test|gather.*must.*gather.*container.*test|cluster.*preflight.*health.*check.*container.*test/i.test(testName);

      if (isInfrastructure) {
        failedComponents.add('infrastructure');
        console.log(`Mapped infrastructure test in fallback: "${testName}"`);
        continue;
      }

      // Only map actual E2E component tests (with TestOdhOperator patterns when available)
      if (/TestOdhOperator.*components.*dashboard|dashboard.*e2e|ui.*test/i.test(testName)) failedComponents.add('dashboard');
      else if (/TestOdhOperator.*components.*auth|auth.*e2e|login.*test/i.test(testName)) failedComponents.add('authentication');
      else if (/TestOdhOperator.*components.*kserve|kserve.*e2e|serving.*test/i.test(testName)) failedComponents.add('kserve');
      else if (/TestOdhOperator.*components.*notebook|TestOdhOperator.*components.*workbench|notebook.*e2e|jupyter.*test/i.test(testName)) failedComponents.add('notebook');
      else if (/TestOdhOperator.*components.*ray|ray.*e2e|ray.*test/i.test(testName)) failedComponents.add('ray');
      else if (/TestOdhOperator.*components.*datasciencepipelines|TestOdhOperator.*components.*dsp|pipeline.*e2e|workflow.*test/i.test(testName)) failedComponents.add('datasciencepipelines');
      else {
        console.log(`Unmapped test failure in fallback: "${testName}"`);
      }
    }

    const components = Array.from(failedComponents);
    console.log(`Fallback regex extracted components: ${components.join(', ') || 'none'}`);
    return components;

  } catch (error) {
    console.error('Fallback regex parsing also failed:', error.message);
    return [];
  }
}

module.exports = {
  fetchRecentE2ERuns,
  validateProwConnection
};