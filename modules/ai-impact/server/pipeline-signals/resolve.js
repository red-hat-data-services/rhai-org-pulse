const { readFeatures } = require('../features/storage');
const { readTestPlans } = require('../test-plans/storage');
const { readDecomposer } = require('../decomposer/storage');
const { readComponentOnboarding, projectComponent } = require('../component-onboarding/storage');

/**
 * Resolve pipeline signals for a given feature key by joining across all
 * AI Impact data stores.
 *
 * @param {string} featureKey - RHAISTRAT-xxx or RHOAIENG-xxx
 * @param {Function} readFromStorage - storage read function
 * @param {object} [options]
 * @param {string} [options.jiraHost] - Jira base URL
 * @returns {Promise<object|null>} Resolved signals or null if feature not found
 */
async function resolvePipelineSignals(featureKey, readFromStorage, options = {}) {
  const [rfeData, featuresData, testPlansData, decomposerData, docData, coData] = await Promise.all([
    readFromStorage('ai-impact/rfe-data.json'),
    readFeatures(readFromStorage),
    readTestPlans(readFromStorage),
    readDecomposer(readFromStorage),
    readFromStorage('ai-impact/doc-data.json'),
    readComponentOnboarding(readFromStorage)
  ]);

  const phases = {};

  // --- RFE Review ---
  const rfeSignal = resolveRfeSignal(rfeData, featureKey);
  phases['rfe-review'] = rfeSignal;

  // --- Feature Review ---
  phases['feature-review'] = resolveFeatureSignal(featuresData, featureKey);

  // --- Feature Decomposer ---
  phases['decomposer'] = resolveDecomposerSignal(decomposerData, featureKey);

  // --- Test Plan Review ---
  phases['test-plan-review'] = resolveTestPlanSignal(testPlansData, featureKey);

  // --- Documentation ---
  phases['documentation'] = resolveDocSignal(docData, featureKey);

  // --- Build & Release ---
  phases['build-release'] = resolveBuildReleaseSignal(coData, featureKey);

  return {
    featureKey,
    rfeKey: rfeSignal.linkedKey || null,
    jiraHost: options.jiraHost || null,
    phases
  };
}

function resolveRfeSignal(rfeData, featureKey) {
  if (!rfeData || !Array.isArray(rfeData.issues)) {
    return { completed: false, current: false, aiUsed: null, detail: 'No data' };
  }

  const rfe = rfeData.issues.find(function(issue) {
    return issue.linkedFeature && issue.linkedFeature.key === featureKey;
  });

  if (!rfe) {
    return { completed: false, current: false, aiUsed: null, detail: 'No linked RFE' };
  }

  const aiUsed = rfe.aiInvolvement !== 'none';
  let detail = 'No AI involvement';
  if (rfe.aiInvolvement === 'both') detail = 'AI created & revised';
  else if (rfe.aiInvolvement === 'created') detail = 'AI created';
  else if (rfe.aiInvolvement === 'revised') detail = 'AI revised';

  return {
    completed: true,
    current: false,
    aiUsed,
    detail,
    linkedKey: rfe.key
  };
}

function resolveFeatureSignal(featuresData, featureKey) {
  if (!featuresData || !featuresData.features) {
    return { completed: false, current: false, aiUsed: null, detail: 'No data' };
  }

  const entry = featuresData.features[featureKey];
  if (!entry) {
    return { completed: false, current: false, aiUsed: null, detail: 'No feature data' };
  }

  const latest = entry.latest;
  const labels = latest.labels || [];
  const aiUsed = labels.some(function(l) {
    return l === 'strat-creator-auto-created' || l === 'strat-creator-auto-refined';
  });

  const approved = latest.humanReviewStatus === 'approved';
  const total = latest.scores && latest.scores.total != null ? latest.scores.total : 0;

  return {
    completed: approved,
    current: !approved,
    aiUsed,
    detail: (latest.recommendation || 'pending') + ' — ' + total + '/8',
    linkedKey: featureKey,
    scores: latest.scores || null,
    recommendation: latest.recommendation || null,
    humanReviewStatus: latest.humanReviewStatus || null
  };
}

function resolveDecomposerSignal(decomposerData, featureKey) {
  if (!decomposerData || !Array.isArray(decomposerData.strategies)) {
    return { completed: false, current: false, aiUsed: null, detail: 'No data' };
  }

  const strategy = decomposerData.strategies.find(function(s) {
    return s.strat_id === featureKey;
  });

  if (!strategy) {
    return { completed: false, current: false, aiUsed: null, detail: 'Not decomposed' };
  }

  const review = strategy.review || {};
  const score = review.score != null ? review.score : null;
  const pass = review.pass || false;

  return {
    completed: pass,
    current: !pass && score != null,
    aiUsed: true,
    detail: strategy.epic_count + ' epics · ' + (pass ? 'pass' : 'fail') + (score != null ? ' (' + score + ')' : ''),
    linkedKey: featureKey,
    epicCount: strategy.epic_count,
    score,
    pass
  };
}

function resolveTestPlanSignal(testPlansData, featureKey) {
  if (!testPlansData || !testPlansData.testPlans) {
    return { completed: false, current: false, aiUsed: null, detail: 'No data' };
  }

  // Test plans use sourceKey to link back to the feature
  let testPlan = null;
  for (const entry of Object.values(testPlansData.testPlans)) {
    if (entry.latest && entry.latest.sourceKey === featureKey) {
      testPlan = entry.latest;
      break;
    }
  }

  if (!testPlan) {
    return { completed: false, current: false, aiUsed: null, detail: 'No test plan' };
  }

  const aiUsed = (testPlan.labels || []).some(function(l) {
    return l === 'test-plan-auto-created';
  });
  const approved = testPlan.humanReviewStatus === 'approved';

  return {
    completed: approved,
    current: !approved && testPlan.verdict !== undefined,
    aiUsed,
    detail: (testPlan.verdict || 'pending') + ' — ' + (testPlan.score || 0) + '/10',
    linkedKey: testPlan.sourceKey || testPlan.key
  };
}

function resolveDocSignal(docData, featureKey) {
  if (!docData || !Array.isArray(docData.issues)) {
    return { completed: false, current: false, aiUsed: null, detail: 'No data' };
  }

  const issue = docData.issues.find(function(i) {
    return i.key === featureKey;
  });

  if (!issue) {
    return { completed: false, current: false, aiUsed: null, detail: 'No doc issue' };
  }

  if (issue.hasDocContributed) {
    return {
      completed: true,
      current: false,
      aiUsed: true,
      detail: 'Docs contributed',
      linkedKey: featureKey,
      hasDocContributed: true,
      docContributedDate: issue.docContributedDate || null
    };
  }

  if (issue.hasDocSkipped) {
    return {
      completed: true,
      current: false,
      aiUsed: false,
      detail: 'Docs skipped',
      linkedKey: featureKey,
      hasDocSkipped: true
    };
  }

  if (issue.hasDocInvoked) {
    return {
      completed: false,
      current: true,
      aiUsed: true,
      detail: 'Doc tool invoked',
      linkedKey: featureKey,
      hasDocInvoked: true
    };
  }

  return {
    completed: false,
    current: false,
    aiUsed: null,
    detail: 'Docs not started',
    linkedKey: featureKey
  };
}

function resolveBuildReleaseSignal(coData, featureKey) {
  if (!coData || !coData.components) {
    return { completed: false, current: false, aiUsed: null, detail: 'No data' };
  }

  // Scan components for any whose linkedFeatures contains the feature key
  let match = null;
  for (const entry of Object.values(coData.components)) {
    const latest = entry.latest;
    if (latest && Array.isArray(latest.linkedFeatures) && latest.linkedFeatures.includes(featureKey)) {
      match = projectComponent(entry);
      break;
    }
  }

  if (!match) {
    return { completed: false, current: false, aiUsed: null, detail: 'No onboarding data' };
  }

  const steps = match.onboardingSteps || {};
  const stepKeys = Object.keys(steps);
  const completedSteps = stepKeys.filter(function(k) { return steps[k]; }).length;
  const totalSteps = stepKeys.length;

  const completed = match.completionStatus === 'completed';
  const current = match.completionStatus === 'in-progress';

  let detail = completedSteps + '/' + totalSteps + ' steps';
  if (match.targetVersion) detail += ' · ' + match.targetVersion;

  return {
    completed,
    current,
    aiUsed: null,
    detail,
    linkedKey: match.key,
    completionStatus: match.completionStatus,
    targetVersion: match.targetVersion
  };
}

module.exports = {
  resolvePipelineSignals,
  resolveRfeSignal,
  resolveFeatureSignal,
  resolveDecomposerSignal,
  resolveTestPlanSignal,
  resolveDocSignal,
  resolveBuildReleaseSignal
};
