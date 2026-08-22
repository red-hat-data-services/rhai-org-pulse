/**
 * Component failure detection and mapping logic for opendatahub-operator E2E tests
 * Dynamic detection following ODH triage script patterns - no hardcoded mappings needed!
 */

const COMPONENT_TEST_PATTERN = /^TestOdhOperator\/components\/group_\d+\/([^/]+)\//;
const E2E_SUITE_PATTERN = /E2E-(\w+)/;

/**
 * Extract component name from test path using opendatahub-operator patterns
 * @param {string} testPath - JUnit test path
 * @returns {string|null} Component identifier or null if not found
 */
function extractComponentFromTestPath(testPath) {
  if (!testPath) return null;

  // Primary pattern: TestOdhOperator/components/group_X/COMPONENT/
  const componentMatch = COMPONENT_TEST_PATTERN.exec(testPath);
  if (componentMatch) {
    return componentMatch[1].toLowerCase();
  }

  return null;
}

/**
 * Extract component from E2E suite name - fully dynamic
 * @param {string} suiteName - E2E suite name
 * @returns {string|null} Component identifier or null if not found
 */
function extractComponentFromSuiteName(suiteName) {
  if (!suiteName) return null;

  // Pattern: E2E-ComponentName → componentname
  const suiteMatch = E2E_SUITE_PATTERN.exec(suiteName);
  if (suiteMatch) {
    return suiteMatch[1].toLowerCase(); // Pure extraction - no hardcoded mappings!
  }

  return null;
}

/**
 * Maps test suite name to component identifier using dynamic detection
 * @param {string} suiteName - JUnit test suite name or test path
 * @returns {string|null} Component identifier or null if not found
 */
function mapSuiteToComponent(suiteName) {
  if (!suiteName) return null;

  // Strategy 1: Extract from test path (most reliable - follows ODH triage script)
  const pathComponent = extractComponentFromTestPath(suiteName);
  if (pathComponent) {
    return pathComponent;
  }

  // Strategy 2: Extract from E2E suite name
  const suiteComponent = extractComponentFromSuiteName(suiteName);
  if (suiteComponent) {
    return suiteComponent;
  }

  // Strategy 3: Fuzzy matching for edge cases
  const normalized = suiteName.toLowerCase();
  if (normalized.includes('dashboard') || normalized.includes('ui')) return 'dashboard';
  if (normalized.includes('kserve') || normalized.includes('model-serving')) return 'kserve';
  if (normalized.includes('registry') && normalized.includes('model')) return 'modelregistry';
  if (normalized.includes('ray') || normalized.includes('distributed')) return 'ray';
  if (normalized.includes('trusty') || normalized.includes('bias')) return 'trustyai';
  if (normalized.includes('workbench') || normalized.includes('notebook')) return 'workbenches';
  if (normalized.includes('pipeline') || normalized.includes('workflow')) return 'dsp';
  if (normalized.includes('codeflare')) return 'codeflare';
  if (normalized.includes('training') || normalized.includes('job')) return 'training';
  if (normalized.includes('infra') || normalized.includes('operator')) return 'infrastructure';

  return null;
}

/**
 * Classifies test failures as deterministic vs flaky based on patterns
 * @param {Array} runs - Recent test runs for analysis
 * @param {string} component - Component to analyze
 * @param {Object} options - Analysis options
 * @returns {Object} Classification result
 */
function classifyFailurePattern(runs, component, options = {}) {
  const {
    lookbackRuns = 10,
    flakyThreshold = 0.3 // 30% failure rate considered flaky vs deterministic
  } = options;

  // Get recent runs that tested this component
  const relevantRuns = runs
    .filter(run => {
      const testedComponents = getTestedComponents(run);
      return testedComponents.includes(component);
    })
    .slice(0, lookbackRuns);

  if (relevantRuns.length === 0) {
    return {
      classification: 'unknown',
      confidence: 0,
      failureRate: 0,
      pattern: 'insufficient_data'
    };
  }

  const failedRuns = relevantRuns.filter(run =>
    run.failedComponents && run.failedComponents.includes(component)
  );

  const failureRate = failedRuns.length / relevantRuns.length;
  const consecutiveFailures = calculateConsecutiveFailures(relevantRuns, component);

  let classification, pattern, confidence;

  if (failureRate === 0) {
    classification = 'stable';
    pattern = 'no_failures';
    confidence = 0.95;
  } else if (failureRate >= 0.8) {
    classification = 'deterministic';
    pattern = 'consistent_failure';
    confidence = 0.9;
  } else if (consecutiveFailures >= 3) {
    classification = 'deterministic';
    pattern = 'consecutive_failures';
    confidence = 0.85;
  } else if (failureRate <= flakyThreshold) {
    classification = 'flaky';
    pattern = 'intermittent_failures';
    confidence = 0.7;
  } else {
    classification = 'degrading';
    pattern = 'increasing_failures';
    confidence = 0.6;
  }

  return {
    classification,
    pattern,
    confidence,
    failureRate,
    consecutiveFailures,
    recentRuns: relevantRuns.length,
    analysis: {
      failedRuns: failedRuns.length,
      passedRuns: relevantRuns.length - failedRuns.length,
      lastFailure: failedRuns.length > 0 ? failedRuns[0].timestamp : null,
      lastSuccess: findLastSuccess(relevantRuns, component)
    }
  };
}

/**
 * Determines which components were tested in a given run - dynamically from test data
 * @param {Object} run - Test run data
 * @returns {Array} Array of component identifiers that were tested
 */
function getTestedComponents(run) {
  const components = new Set();

  // Add components that failed (we know these were tested)
  if (run.failedComponents) {
    run.failedComponents.forEach(component => components.add(component));
  }

  // Extract components from test paths (if available in test details)
  if (run.testDetails) {
    Object.keys(run.testDetails).forEach(testPath => {
      const component = extractComponentFromTestPath(testPath);
      if (component) components.add(component);
    });
  }

  // If no test details, infer from job name patterns
  if (run.jobName) {
    const suiteMatches = run.jobName.match(/E2E-(\w+)/g);
    if (suiteMatches) {
      suiteMatches.forEach(suite => {
        const component = extractComponentFromSuiteName(suite);
        if (component) components.add(component);
      });
    }
  }

  return Array.from(components);
}

/**
 * Gets components tested in a suite - dynamically determined from test runs
 * For zero maintenance, we discover components from actual test data
 * @param {string} suite - Test suite name (odh/rhoai)
 * @param {Array} runs - Optional test runs to discover components from
 * @returns {Array} Array of component identifiers
 */
function getSuiteComponents(suite, runs = []) {
  // If no runs provided, return empty array - true zero maintenance
  if (runs.length === 0) {
    return [];
  }

  // Discover components dynamically from actual test runs for this suite
  const discoveredComponents = new Set();

  runs
    .filter(run => run.suite === suite)
    .forEach(run => {
      // Add components that failed
      if (run.failedComponents) {
        run.failedComponents.forEach(component => discoveredComponents.add(component));
      }

      // Extract components from test paths if available
      if (run.testDetails) {
        Object.keys(run.testDetails).forEach(testPath => {
          const component = extractComponentFromTestPath(testPath);
          if (component) discoveredComponents.add(component);
        });
      }
    });

  return Array.from(discoveredComponents);
}

/**
 * Calculates consecutive failures for a component
 * @param {Array} runs - Test runs (should be sorted newest first)
 * @param {string} component - Component identifier
 * @returns {number} Number of consecutive failures
 */
function calculateConsecutiveFailures(runs, component) {
  let consecutiveFailures = 0;

  for (const run of runs) {
    if (run.failedComponents && run.failedComponents.includes(component)) {
      consecutiveFailures++;
    } else {
      // Stop at first success
      break;
    }
  }

  return consecutiveFailures;
}

/**
 * Finds the last successful run for a component
 * @param {Array} runs - Test runs (should be sorted newest first)
 * @param {string} component - Component identifier
 * @returns {string|null} Timestamp of last success or null
 */
function findLastSuccess(runs, component) {
  for (const run of runs) {
    const testedComponents = getTestedComponents(run);
    if (testedComponents.includes(component) &&
      (!run.failedComponents || !run.failedComponents.includes(component))) {
      return run.timestamp;
    }
  }
  return null;
}

/**
 * Generates component impact analysis
 * @param {Array} runs - Recent test runs
 * @param {Object} options - Analysis options
 * @returns {Object} Component impact analysis
 */
function analyzeComponentImpact(runs, options = {}) {
  const { timeWindowDays = 30 } = options;

  const cutoffDate = new Date(Date.now() - (timeWindowDays * 24 * 60 * 60 * 1000));
  const recentRuns = runs.filter(run => new Date(run.timestamp) >= cutoffDate);

  const analysis = {};

  // Get all components that appear in the data
  const allComponents = new Set();
  recentRuns.forEach(run => {
    getTestedComponents(run).forEach(component => allComponents.add(component));
  });

  allComponents.forEach(component => {
    const classification = classifyFailurePattern(recentRuns, component);
    const info = getComponentInfo(component);

    analysis[component] = {
      ...info,
      ...classification,
      impact: calculateComponentImpact(recentRuns, component),
      trends: calculateTrends(recentRuns, component)
    };
  });

  return analysis;
}

/**
 * Calculates the impact score of a component's failures
 * @param {Array} runs - Recent test runs
 * @param {string} component - Component identifier
 * @returns {Object} Impact analysis
 */
function calculateComponentImpact(runs, component) {
  const affectedRuns = runs.filter(run =>
    run.failedComponents && run.failedComponents.includes(component)
  );

  const affectedSuites = new Set();
  affectedRuns.forEach(run => {
    if (run.suite) affectedSuites.add(run.suite);
  });

  // Calculate impact score (0-100)
  const failureRate = affectedRuns.length / runs.length;
  const suiteImpact = Array.from(affectedSuites).length / 2; // Normalize by max 2 suites
  const recencyWeight = calculateRecencyWeight(affectedRuns);

  const impactScore = Math.round((failureRate * 0.5 + suiteImpact * 0.3 + recencyWeight * 0.2) * 100);

  return {
    score: impactScore,
    level: impactScore > 70 ? 'high' : impactScore > 40 ? 'medium' : 'low',
    affectedSuites: Array.from(affectedSuites),
    affectedRuns: affectedRuns.length,
    totalRuns: runs.length
  };
}

/**
 * Calculates trends for component health over time
 * @param {Array} runs - Recent test runs
 * @param {string} component - Component identifier
 * @returns {Object} Trend analysis
 */
function calculateTrends(runs, component) {
  // Split runs into two halves to compare trends
  const midpoint = Math.floor(runs.length / 2);
  const recentHalf = runs.slice(0, midpoint);
  const olderHalf = runs.slice(midpoint);

  const recentFailureRate = calculateFailureRate(recentHalf, component);
  const olderFailureRate = calculateFailureRate(olderHalf, component);

  const trend = recentFailureRate - olderFailureRate;

  return {
    direction: trend > 0.1 ? 'worsening' : trend < -0.1 ? 'improving' : 'stable',
    magnitude: Math.abs(trend),
    recentFailureRate,
    olderFailureRate,
    confidence: Math.min(recentHalf.length, olderHalf.length) > 5 ? 'high' : 'low'
  };
}

/**
 * Helper function to calculate failure rate for a component in given runs
 * @param {Array} runs - Test runs
 * @param {string} component - Component identifier
 * @returns {number} Failure rate (0-1)
 */
function calculateFailureRate(runs, component) {
  const relevantRuns = runs.filter(run => getTestedComponents(run).includes(component));
  if (relevantRuns.length === 0) return 0;

  const failedRuns = relevantRuns.filter(run =>
    run.failedComponents && run.failedComponents.includes(component)
  );

  return failedRuns.length / relevantRuns.length;
}

/**
 * Calculates recency weight for impact scoring
 * @param {Array} runs - Failed runs
 * @returns {number} Recency weight (0-1)
 */
function calculateRecencyWeight(runs) {
  if (runs.length === 0) return 0;

  const now = new Date();
  const weights = runs.map(run => {
    const ageHours = (now - new Date(run.timestamp)) / (1000 * 60 * 60);
    return Math.max(0, 1 - (ageHours / (24 * 7))); // Weight decreases over a week
  });

  return weights.reduce((sum, weight) => sum + weight, 0) / weights.length;
}

/**
 * Gets component information by identifier - fully dynamic generation
 * @param {string} componentId - Component identifier
 * @returns {Object} Component information
 */
function getComponentInfo(componentId) {
  // Generate display name by capitalizing and spacing
  const displayName = componentId
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return {
    displayName,
    description: `OpenDataHub component: ${displayName}`,
    testSuites: getTestSuitesForComponent(componentId),
    dynamicallyGenerated: true
  };
}

/**
 * Determine which test suites a component belongs to
 * @param {string} componentId - Component identifier
 * @returns {Array} Array of test suite names
 */
function getTestSuitesForComponent(componentId) {
  // Component-specific suite mapping based on ODH documentation
  const componentSuiteMap = {
    modelregistry: ['rhoai'], // RHOAI-specific
    trustyai: ['rhoai'],      // RHOAI-specific
    ray: ['odh'],             // ODH-specific
    codeflare: ['odh'],       // ODH-specific
    training: ['odh']         // ODH-specific
  };

  return componentSuiteMap[componentId] || ['odh', 'rhoai']; // Default to both
}

/**
 * Lists all components discovered from runs - fully dynamic
 * @param {Array} runs - Optional runs to discover components from
 * @returns {Array} Array of component identifiers
 */
function getAllComponents(runs = []) {
  if (runs.length === 0) {
    // Zero maintenance: no runs = no components discovered
    return [];
  }

  const discoveredComponents = new Set();

  runs.forEach(run => {
    // Extract from failed components
    if (run.failedComponents) {
      run.failedComponents.forEach(component => discoveredComponents.add(component));
    }

    // Extract from test paths
    if (run.testDetails) {
      Object.keys(run.testDetails).forEach(testPath => {
        const component = extractComponentFromTestPath(testPath);
        if (component) discoveredComponents.add(component);
      });
    }

    // Extract from job names
    if (run.jobName) {
      const suiteMatches = run.jobName.match(/E2E-(\w+)/g);
      if (suiteMatches) {
        suiteMatches.forEach(suite => {
          const component = extractComponentFromSuiteName(suite);
          if (component) discoveredComponents.add(component);
        });
      }
    }
  });

  return Array.from(discoveredComponents);
}

/**
 * Discover components from test run data and JUnit XML analysis
 * @param {Array} runs - Recent test runs
 * @returns {Object} Discovery results with components found
 */
function discoverNewComponents(runs) {
  const discoveredComponents = new Set();
  const discoveredSuites = new Set();
  const discoveredFromPaths = new Set();
  const discoveredFromFailures = new Set();

  runs.forEach(run => {
    // Extract components from existing failed components
    if (run.failedComponents) {
      run.failedComponents.forEach(component => {
        discoveredFromFailures.add(component);
        discoveredComponents.add(component);
      });
    }

    // Extract components from test paths (if available in test details)
    if (run.testDetails) {
      Object.keys(run.testDetails).forEach(testPath => {
        const pathComponent = extractComponentFromTestPath(testPath);
        if (pathComponent) {
          discoveredFromPaths.add(pathComponent);
          discoveredComponents.add(pathComponent);
        }
      });
    }

    // Look for E2E suite patterns in job names
    if (run.jobName) {
      const suiteMatches = run.jobName.match(/E2E-(\w+)/g);
      if (suiteMatches) {
        suiteMatches.forEach(suite => {
          const component = extractComponentFromSuiteName(suite);
          if (component) {
            discoveredSuites.add(suite);
            discoveredComponents.add(component);
          }
        });
      }
    }
  });

  return {
    allDiscovered: Array.from(discoveredComponents),
    discoveredSuites: Array.from(discoveredSuites),
    discoveredFromPaths: Array.from(discoveredFromPaths),
    discoveredFromFailures: Array.from(discoveredFromFailures),
    suggestions: generateMappingSuggestions(Array.from(discoveredComponents), Array.from(discoveredSuites))
  };
}

/**
 * Generate mapping suggestions for discovered components and test suites
 * @param {Array} components - Discovered component names
 * @param {Array} suites - Discovered test suite names
 * @returns {Array} Array of mapping suggestions
 */
function generateMappingSuggestions(components = [], suites = []) {
  const suggestions = [];

  // Generate suggestions for discovered components
  components.forEach(componentName => {
    // Normalize component name
    const normalizedName = componentName.toLowerCase();

    // Generate display name by capitalizing
    const displayName = componentName.split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    // Try to infer which test suites this component belongs to
    const testSuites = [];
    if (normalizedName.includes('model') && normalizedName.includes('registry')) {
      testSuites.push('rhoai'); // Model Registry is RHOAI-specific
    } else if (normalizedName.includes('trusty')) {
      testSuites.push('rhoai'); // TrustyAI is RHOAI-specific
    } else if (normalizedName.includes('ray')) {
      testSuites.push('odh'); // Ray is ODH-specific
    } else if (normalizedName.includes('codeflare')) {
      testSuites.push('odh'); // CodeFlare is ODH-specific
    } else {
      testSuites.push('odh', 'rhoai'); // Default to both
    }

    // Try to infer repository
    let repo = 'unknown';
    const repoMappings = {
      dashboard: 'opendatahub-io/odh-dashboard',
      kserve: 'kserve/kserve',
      modelregistry: 'kubeflow/model-registry',
      ray: 'ray-project/kuberay',
      trustyai: 'trustyai-explainability/trustyai-service-operator',
      workbenches: 'opendatahub-io/notebooks',
      dsp: 'opendatahub-io/data-science-pipelines',
      codeflare: 'project-codeflare/codeflare-operator',
      training: 'kubeflow/training-operator'
    };

    if (repoMappings[normalizedName]) {
      repo = repoMappings[normalizedName];
    }

    suggestions.push({
      type: 'component',
      source: 'test-path-analysis',
      componentName: normalizedName,
      suggestedComponentId: normalizedName,
      suggestedDisplayName: displayName,
      suggestedMapping: {
        [`E2E-${componentName.charAt(0).toUpperCase() + componentName.slice(1)}`]: normalizedName
      },
      suggestedInfo: {
        [normalizedName]: {
          displayName,
          description: `Auto-discovered component from test path analysis`,
          testSuites,
          repo,
          autoDiscovered: true,
          discoveredAt: new Date().toISOString(),
          detectionMethod: 'test-path-pattern'
        }
      },
      confidence: 'high' // Test path extraction is very reliable
    });
  });

  // Generate suggestions for discovered test suites
  suites.forEach(suite => {
    const componentName = extractComponentFromSuiteName(suite) || suite.replace('E2E-', '').toLowerCase();
    const displayName = suite.replace('E2E-', '').replace(/([A-Z])/g, ' $1').trim();

    suggestions.push({
      type: 'suite',
      source: 'job-name-analysis',
      suite,
      suggestedComponentId: componentName,
      suggestedDisplayName: displayName,
      suggestedMapping: {
        [suite]: componentName
      },
      suggestedInfo: {
        [componentName]: {
          displayName,
          description: `Auto-discovered component from ${suite} test suite`,
          testSuites: ['odh', 'rhoai'], // Default to both for suite-discovered
          repo: 'unknown',
          autoDiscovered: true,
          discoveredAt: new Date().toISOString(),
          detectionMethod: 'suite-name-pattern'
        }
      },
      confidence: 'medium' // Suite name extraction is less reliable
    });
  });

  // Remove duplicates and prioritize high-confidence suggestions
  const uniqueSuggestions = suggestions.reduce((acc, suggestion) => {
    const key = suggestion.suggestedComponentId;
    if (!acc[key] || suggestion.confidence === 'high') {
      acc[key] = suggestion;
    }
    return acc;
  }, {});

  return Object.values(uniqueSuggestions);
}

/**
 * Update component configuration with new mappings
 * @param {Object} newMappings - New component mappings to add
 * @param {Object} newComponentInfo - New component info to add
 * @returns {boolean} Success status
 */
/**
 * Get component detection status and statistics
 * @param {Array} recentRuns - Optional recent runs to check for discoveries
 * @returns {Object} Detection status
 */
function getDetectionStatus(recentRuns = []) {
  const discovery = recentRuns.length > 0 ? discoverNewComponents(recentRuns) : {
    allDiscovered: [],
    discoveredSuites: [],
    discoveredFromPaths: [],
    discoveredFromFailures: [],
    suggestions: []
  };

  const allDiscoveredComponents = getAllComponents(recentRuns);

  return {
    detectionMethod: 'dynamic-pattern-based-zero-maintenance',
    totalDiscoveredComponents: allDiscoveredComponents.length,
    suites: ['odh', 'rhoai'],
    componentsPerSuite: {
      odh: getSuiteComponents('odh', recentRuns).length,
      rhoai: getSuiteComponents('rhoai', recentRuns).length
    },
    detectionPatterns: {
      testPath: COMPONENT_TEST_PATTERN.source,
      suitePattern: E2E_SUITE_PATTERN.source
    },
    recentDiscoveries: discovery,
    metadataSource: 'fully-dynamic-zero-maintenance'
  };
}

module.exports = {
  // Detection patterns
  COMPONENT_TEST_PATTERN,
  E2E_SUITE_PATTERN,

  // Core mapping functions (dynamic detection)
  mapSuiteToComponent,
  extractComponentFromTestPath,
  extractComponentFromSuiteName,

  // Analysis functions
  classifyFailurePattern,
  getTestedComponents,
  getSuiteComponents,
  calculateConsecutiveFailures,
  findLastSuccess,
  analyzeComponentImpact,
  calculateTrends,

  // Component discovery and dynamic management
  discoverNewComponents,
  generateMappingSuggestions,
  getDetectionStatus,

  // Utility functions
  getComponentInfo,
  getTestSuitesForComponent,
  getAllComponents
};
