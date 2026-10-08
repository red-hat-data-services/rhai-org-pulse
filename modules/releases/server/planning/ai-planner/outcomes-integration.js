/**
 * Fetch 22 prioritized outcomes from Jira plan view 7384 and calculate in-plan metrics.
 *
 * Outcomes are parent work items (RHAISTRAT-* issues) with child features.
 * For each outcome, count how many children are in the current draft-plan.
 */

const OUTCOME_KEY_PATTERN = /^RHAISTRAT-\d+$/;

/**
 * The 22 prioritized outcomes from Jira plan view 7384 (Racer Strat).
 * Order matches Jira plan priority.
 */
const PRIORITY_OUTCOMES = [
  'RHAISTRAT-2046', // AIPCC Security Policy Compliance Directive
  'RHAISTRAT-2129', // Outcome: RHAIE Platform Stabilization
  'RHAISTRAT-1513', // MaaS — 3.5 Deliverables
  'RHAISTRAT-2125', // OCP 5 release and impact on RH AI
  'RHAISTRAT-1979', // Outcome: Production Resilience
  'RHAISTRAT-1981', // Outcome: Platform Experience for llm-d
  'RHAISTRAT-1680', // Parent Outcome: Unified Red Hat AI Inference (formerly MaaS/llm-d on xKS)
  'RHAISTRAT-1312', // Gen AI Studio
  'RHAISTRAT-155',  // Secure Agent Onboarding: Security-First Agent Engineering
  'RHAISTRAT-1357', // Tool Calling
  'RHAISTRAT-1971', // (Tool Calling related)
  'RHAISTRAT-1354', // From Tools to Swarms (MCP)
  'RHAISTRAT-1355', // (MCP related)
  'RHAISTRAT-932',  // MCP Connectivity
  'RHAISTRAT-1498', // Eval Hub
  'RHAISTRAT-1339', // AI Hub incl MCP
  'RHAISTRAT-1066', // Multitenancy
  // RHAISTRAT-155 already listed above (Secure Agent Onboarding)
  'RHAISTRAT-2875', // AI Grid MVP
  'RHAISTRAT-1088', // vLLM Omni
  'RHAISTRAT-2604', // (check for exact key)
  'RHAISTRAT-188'   // AutoRAG
];

/**
 * Fetch outcome summaries and child features from Jira.
 *
 * @param {object|null} jiraClient - { fetchAllJqlResults, request }
 * @param {string[]} outcomeKeys - List of outcome RHAISTRAT keys
 * @returns {Promise<Object>} Map of outcomeKey -> { key, title, children: [...child keys...] }
 */
async function fetchOutcomesFromJira(jiraClient, outcomeKeys) {
  if (!jiraClient) return {};

  const outcomes = {};

  // Fetch summaries for all outcomes
  const jql = 'key in (' + outcomeKeys.filter(k => OUTCOME_KEY_PATTERN.test(k)).join(', ') + ')';
  const fields = 'summary';
  const params = new URLSearchParams({ jql, fields, maxResults: '100' });

  try {
    const result = await jiraClient.request('/rest/api/3/search/jql?' + params);
    if (result && result.issues) {
      result.issues.forEach(issue => {
        outcomes[issue.key] = {
          key: issue.key,
          title: issue.fields?.summary || '',
          children: []
        };
      });
    }
  } catch (err) {
    console.error('[ai-planner] Failed to fetch outcome summaries from Jira:', err.message);
    return {};
  }

  // Fetch child features for each outcome
  for (const outcomeKey of Object.keys(outcomes)) {
    try {
      const childJql = `(parent = ${outcomeKey} OR "Epic Link" = ${outcomeKey}) AND issuetype in (Feature, Initiative)`;
      const childFields = 'key,summary';
      const childParams = new URLSearchParams({ jql: childJql, fields: childFields, maxResults: '100' });

      const childResult = await jiraClient.request('/rest/api/3/search/jql?' + childParams);
      if (childResult && childResult.issues) {
        outcomes[outcomeKey].children = childResult.issues.map(issue => issue.key);
      }
    } catch (err) {
      console.error(`[ai-planner] Failed to fetch children for ${outcomeKey}:`, err.message);
    }
  }

  return outcomes;
}

/**
 * Calculate in-plan metrics for outcomes.
 *
 * @param {Object} outcomes - Map from fetchOutcomesFromJira
 * @param {Array} inPlanFeatures - Array of feature keys currently in draft-plan
 * @param {Array} allFeatures - All features (for confidence aggregation)
 * @returns {Array} Array of outcome objects with metrics
 */
function calculateOutcomeMetrics(outcomes, inPlanFeatures, allFeatures) {
  const inPlanSet = new Set(inPlanFeatures.map(f => typeof f === 'string' ? f : f.key));
  const confidenceMap = new Map();
  allFeatures.forEach(f => {
    confidenceMap.set(typeof f === 'string' ? f : f.key, f.confidence || f._conf || 0);
  });

  return Object.values(outcomes).map(outcome => {
    const total = outcome.children.length;
    const inPlan = outcome.children.filter(child => inPlanSet.has(child)).length;
    const percentComplete = total > 0 ? Math.round((inPlan / total) * 100) : 0;

    // Calculate average confidence of in-plan children
    const inPlanConfidences = outcome.children
      .filter(child => inPlanSet.has(child))
      .map(child => confidenceMap.get(child) || 0)
      .filter(conf => typeof conf === 'number');
    const avgConfidence = inPlanConfidences.length > 0
      ? Math.round(inPlanConfidences.reduce((a, b) => a + b, 0) / inPlanConfidences.length)
      : 0;

    // Status logic: confident if all children ready, otherwise pending
    let status = 'Confident';
    if (inPlan === 0 && total > 0) {
      status = 'No features in plan';
    } else if (inPlan < total) {
      status = avgConfidence >= 70 ? 'Confident' : 'Lagging';
    }

    return {
      key: outcome.key,
      title: outcome.title,
      inPlan,
      total,
      percentComplete,
      confidence: avgConfidence,
      status,
      children: outcome.children
    };
  });
}

module.exports = {
  PRIORITY_OUTCOMES,
  fetchOutcomesFromJira,
  calculateOutcomeMetrics
};
