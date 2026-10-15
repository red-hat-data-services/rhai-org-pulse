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
  { key: 'RHAISTRAT-2046', title: 'AIPCC Security Policy Compliance Directive' },
  { key: 'RHAISTRAT-2129', title: 'Outcome: RHAIE Platform Stabilization, Quality, and Cohesion' },
  { key: 'RHAISTRAT-1513', title: 'MaaS — 3.5 Deliverables' },
  { key: 'RHAISTRAT-2125', title: 'OCP 5 release and impact on RH AI' },
  { key: 'RHAISTRAT-1979', title: 'Outcome: Production Resilience' },
  { key: 'RHAISTRAT-1981', title: 'Outcome: Platform Experience for llm-d' },
  { key: 'RHAISTRAT-1680', title: 'Parent Outcome: Unified Red Hat AI Inference (RHAII) on Any Linux and Any Kubernetes' },
  { key: 'RHAISTRAT-2875', title: 'AI Grid MVP' },
  { key: 'RHAISTRAT-155', title: 'Agents run governed in OpenShell on Red Hat AI in production' },
  { key: 'RHAISTRAT-1357', title: 'Make Red Hat Inference Server the Best for Agents' },
  { key: 'RHAISTRAT-1855', title: 'End-to-End Observability for RH AI — All Components Emitting Metrics, Traces, and Logs' },
  { key: 'RHAISTRAT-2016', title: '[TP] AI-Native Observability Operations for RHOAI' },
  { key: 'RHAISTRAT-1517', title: 'Observability for OpenShift AI — 3.5 Deliverables' },
  { key: 'RHAISTRAT-1669', title: 'Red Hat AI Factory with NVIDIA: Vera Rubin Day 0 Support' },
  { key: 'RHAISTRAT-1446', title: 'Delivering GPUaaS and Kueue Experience in OpenShift AI' },
  { key: 'RHAISTRAT-1312', title: 'Gen AI Studio — Playground, Observability, AI Assets, and Model Specialization' },
  { key: 'RHAISTRAT-1339', title: 'AI Hub AI Asset Delivery for Agentic Solutions' },
  { key: 'RHAISTRAT-1498', title: '[Outcome] EvalHub Dashboard UI Experience for 3.5 & 3.6 (EA1, EA2, GA)' },
  { key: 'RHAISTRAT-898', title: 'Deliver Role Based Access Control for RHOAI components' },
  { key: 'RHAISTRAT-1471', title: 'Multi-Tenancy in RHOAI' },
  { key: 'RHAISTRAT-188', title: '[Outcome] Enable AutoRAG for Automated RAG Pattern Discovery and Optimization' },
  { key: 'RHAISTRAT-1066', title: '[Outcome] Enable AutoML' }
];

/**
 * Build title → key mapping for quick outcome lookup
 */
function buildOutcomeTitleMap() {
  const titleMap = {};
  PRIORITY_OUTCOMES.forEach(outcome => {
    titleMap[outcome.title] = outcome.key;
  });
  return titleMap;
}

/**
 * Extract outcomes from live feature data (already from Jira 12h sync).
 * Build map of outcome key → { key, title, children }.
 *
 * @param {Array} allFeatures - Features from buildFeatureReadiness (includes parent links from Jira)
 * @returns {Object} Map of outcomeKey -> { key, title, children: [...feature keys...], outcomeNumber: 1-22 }
 */
function extractOutcomesFromFeatures(allFeatures) {
  const outcomes = {};
  const titleMap = buildOutcomeTitleMap();

  // Initialize all outcomes (1-22)
  PRIORITY_OUTCOMES.forEach((outcome, index) => {
    outcomes[outcome.key] = {
      key: outcome.key,
      title: outcome.title,
      outcomeNumber: index + 1,
      children: []
    };
  });

  // Scan features for their parent outcome links
  // Features can have parent in two forms:
  // 1. f.parentKey = "RHAISTRAT-2046" (direct key)
  // 2. f.parent = "Outcome title" (title from Jira parent field)
  allFeatures.forEach(feature => {
    const featureKey = feature.key;
    let parentKey = null;

    // Try direct parentKey first
    if (feature.parentKey && OUTCOME_KEY_PATTERN.test(feature.parentKey)) {
      parentKey = feature.parentKey;
    }
    // Fall back to title-based lookup (f.parent contains outcome title)
    else if (feature.parent && titleMap[feature.parent]) {
      parentKey = titleMap[feature.parent];
    }

    if (parentKey && outcomes[parentKey]) {
      outcomes[parentKey].children.push(featureKey);
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
    if (total === 0 || (inPlan === 0 && total > 0)) {
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
