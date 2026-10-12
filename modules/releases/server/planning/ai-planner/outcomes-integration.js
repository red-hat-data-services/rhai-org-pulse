/**
 * Build outcomes from live Jira feature data (already synced every 12h).
 * Features contain parent links; we extract and organize them by outcome.
 *
 * Outcomes are parent work items (RHAISTRAT-* issues) with child features.
 * The 22 priority order matches Jira plan view 7384 (Racer Strat).
 */

const OUTCOME_KEY_PATTERN = /^RHAISTRAT-\d+$/;

/**
 * The 22 prioritized outcomes from Jira plan view 7384 (Racer Strat).
 * Order matches Jira plan priority. Features' parent fields reference these.
 */
const PRIORITY_OUTCOMES = [
  'RHAISTRAT-2046', // 1: AIPCC Security Policy Compliance Directive
  'RHAISTRAT-2129', // 2: Outcome: RHAIE Platform Stabilization
  'RHAISTRAT-1513', // 3: MaaS — 3.5 Deliverables
  'RHAISTRAT-2125', // 4: OCP 5 release and impact on RH AI
  'RHAISTRAT-1979', // 5: Outcome: Production Resilience
  'RHAISTRAT-1981', // 6: Outcome: Platform Experience for llm-d
  'RHAISTRAT-1680', // 7: Parent Outcome: Unified Red Hat AI Inference
  'RHAISTRAT-1312', // 8: Gen AI Studio
  'RHAISTRAT-155',  // 9: Secure Agent Onboarding: Security-First Agent Engineering
  'RHAISTRAT-1357', // 10: Tool Calling
  'RHAISTRAT-1971', // 11: Tool Calling related
  'RHAISTRAT-1354', // 12: From Tools to Swarms (MCP)
  'RHAISTRAT-1355', // 13: MCP related
  'RHAISTRAT-932',  // 14: MCP Connectivity
  'RHAISTRAT-1498', // 15: Eval Hub
  'RHAISTRAT-1339', // 16: AI Hub incl MCP
  'RHAISTRAT-1066', // 17: Multitenancy
  'RHAISTRAT-155',  // 18: BYOA — Bring Your Own Agent
  'RHAISTRAT-2875', // 19: AI Grid MVP
  'RHAISTRAT-1088', // 20: vLLM Omni
  'RHAISTRAT-2604', // 21: (exact key)
  'RHAISTRAT-188'   // 22: AutoRAG
];

/**
 * Extract outcomes from live feature data (already from Jira 12h sync).
 * Build map of outcome key → { key, title, children }.
 *
 * @param {Array} allFeatures - Features from buildFeatureReadiness (includes parent links from Jira)
 * @returns {Object} Map of outcomeKey -> { key, title, children: [...feature keys...], outcomeNumber: 1-22 }
 */
function extractOutcomesFromFeatures(allFeatures) {
  const outcomes = {};

  // Initialize all outcomes (1-22)
  PRIORITY_OUTCOMES.forEach((outcomeKey, index) => {
    outcomes[outcomeKey] = {
      key: outcomeKey,
      title: '', // Will be populated from features below
      outcomeNumber: index + 1,
      children: []
    };
  });

  // Scan features for their parent outcome links
  // Features store parent outcome in: f.parentKey (e.g., "RHAISTRAT-2046")
  allFeatures.forEach(feature => {
    const featureKey = feature.key;

    // Check for direct parent link (Jira parent field)
    if (feature.parentKey && OUTCOME_KEY_PATTERN.test(feature.parentKey)) {
      const parentKey = feature.parentKey;
      if (outcomes[parentKey]) {
        outcomes[parentKey].children.push(featureKey);
      }
    }
  });

  return outcomes;
}

/**
 * Calculate in-plan metrics for outcomes.
 *
 * @param {Array} outcomes - Array of outcome objects from extractOutcomesFromFeatures
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
      outcomeNumber: outcome.outcomeNumber,
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
  extractOutcomesFromFeatures,
  calculateOutcomeMetrics
};
