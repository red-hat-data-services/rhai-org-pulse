/**
 * Build outcomes from live Jira feature data (already synced every 12h).
 * Features contain parent links; we extract and organize them by outcome.
 *
 * Outcomes are parent work items (RHAISTRAT-* issues) with child features.
 * Outcomes are fetched live from Jira via:
 * 1. Feature parent links (feature→outcome mapping for feature aggregation)
 * 2. Direct Jira query for priority order (outcome-fetch.js)
 *
 * Priority order is cached in data/releases/planning/priority-outcomes.json
 * and synced via cadence refresh (12h like features).
 */

const OUTCOME_KEY_PATTERN = /^RHAISTRAT-\d+$/;

/**
 * Fallback outcomes (used when Jira fetch fails or cache is empty).
 * These are loaded from data/releases/planning/priority-outcomes.json at runtime,
 * which is synced from Jira every 12h via cadence refresh handler.
 *
 * Format: {orderNumber, key, title}
 */
const FALLBACK_OUTCOMES = [
  { orderNumber: 1, key: 'RHAISTRAT-3004', title: 'Deliver a Production-Ready, Praxis-Native AI Gateway' },
  { orderNumber: 2, key: 'RHAISTRAT-1981', title: 'Outcome: Platform User Experience for Model Serving' },
  { orderNumber: 3, key: 'RHAISTRAT-2997', title: 'MaaS Governance and Platform Maturity' },
  { orderNumber: 4, key: 'RHAISTRAT-2875', title: 'AI Grid TP - Multicluster inference use case' },
  { orderNumber: 5, key: 'RHAISTRAT-155', title: 'Agents run governed in OpenShell on Red Hat AI in production' },
  { orderNumber: 6, key: 'RHAISTRAT-2955', title: 'OpenClaw Enterprise runs on Red Hat AI as a Tech Preview with OpenShell governance and Red Hat AI models' },
  { orderNumber: 7, key: 'RHAISTRAT-2686', title: '[Big Rock] SOTA Model Deployment Recipe Catalog' },
  { orderNumber: 8, key: 'RHAISTRAT-1339', title: 'AI Hub AI Asset Delivery for Agentic Solutions' },
  { orderNumber: 9, key: 'RHAISTRAT-2996', title: '[Outcome] AI Safety Studio: A Security-Team-Owned Workspace for Guardrail Visibility and Control' },
  { orderNumber: 10, key: 'RHAISTRAT-2446', title: 'Platform Multimodal Experience' },
  { orderNumber: 11, key: 'RHAISTRAT-2016', title: 'AI-Native Observability Operations for RHOAI' },
  { orderNumber: 12, key: 'RHAISTRAT-1446', title: 'Delivering GPUaaS and Kueue Experience in OpenShift AI' },
  { orderNumber: 13, key: 'RHAISTRAT-2921', title: '[🎯^^^RANKED OUTCOMES ABOVE THIS LINE^^^...]' },
  { orderNumber: 14, key: 'RHAISTRAT-2046', title: 'AIPCC Security Policy Compliance Directive' },
  { orderNumber: 15, key: 'RHAISTRAT-2129', title: 'Outcome: RHAIE Platform Stabilization, Quality, and Cohesion' },
  { orderNumber: 16, key: 'RHAISTRAT-1513', title: 'MaaS — 3.5 Deliverables' },
  { orderNumber: 17, key: 'RHAISTRAT-2125', title: 'OCP 5 release and impact on RH AI' },
  { orderNumber: 18, key: 'RHAISTRAT-1979', title: 'Outcome: Production Resilience' },
  { orderNumber: 19, key: 'RHAISTRAT-1680', title: 'Parent Outcome: Unified Red Hat AI Inference (RHAII) on Any Linux and Any Kubernetes' },
  { orderNumber: 20, key: 'RHAISTRAT-1357', title: 'Make Red Hat Inference Server the Best for Agents' },
  { orderNumber: 21, key: 'RHAISTRAT-1855', title: 'End-to-End Observability for RH AI — All Components Emitting Metrics, Traces, and Logs' },
  { orderNumber: 22, key: 'RHAISTRAT-1517', title: 'Observability for OpenShift AI — 3.5 Deliverables' },
  { orderNumber: 23, key: 'RHAISTRAT-1669', title: 'Red Hat AI Factory with NVIDIA: Vera Rubin Dashboard' },
  { orderNumber: 24, key: 'RHAISTRAT-2995', title: '[Outcome] Graph AutoRAG - Relationship-Aware Agentic RAG' },
  { orderNumber: 25, key: 'RHAISTRAT-1312', title: 'Gen AI Studio — Playground, Observability, AI Experimentation' },
  { orderNumber: 26, key: 'RHAISTRAT-1498', title: '[Outcome] EvalHub Dashboard UI Experience' },
  { orderNumber: 27, key: 'RHAISTRAT-898', title: 'Deliver Role Based Access Control for RHOAI' },
  { orderNumber: 28, key: 'RHAISTRAT-1471', title: 'Multi-Tenancy in RHOAI' },
  { orderNumber: 29, key: 'RHAISTRAT-188', title: '[Outcome] Enable AutoRAG for Automated RAG' },
  { orderNumber: 30, key: 'RHAISTRAT-1066', title: '[Outcome] Enable AutoML' },
  { orderNumber: 31, key: 'RHAISTRAT-1480', title: 'Automated Migration: RHOAI 2.25 to 3.5 (EUS)' },
  { orderNumber: 32, key: 'RHAISTRAT-1210', title: '[Outcome] Integration Safety/Guardrails for MC Conversations' },
  { orderNumber: 33, key: 'RHAISTRAT-1261', title: '[Outcome] Agent Red Teaming Platform' },
  { orderNumber: 34, key: 'RHAISTRAT-1264', title: '[Outcome] Build a TrustyAI Agent Safety Solution' },
  { orderNumber: 35, key: 'RHAISTRAT-1269', title: '[Outcome] Platform-Level Safety Enforcement' },
  { orderNumber: 36, key: 'RHAISTRAT-1303', title: 'Summit \'26 Model Validation Delivery' },
  { orderNumber: 37, key: 'RHAISTRAT-1317', title: '[Outcome] Physics-Based Observability for LLMs' }
];

/**
 * Extract outcomes from live feature data (already from Jira 12h sync).
 * Build map of outcome key → { key, title, children }.
 *
 * @param {Array} allFeatures - Features from buildFeatureReadiness (includes parent links from Jira)
 * @param {Array} priorityOutcomes - Outcomes in priority order (from cache or fallback)
 * @returns {Object} Map of outcomeKey -> { key, title, children: [...feature keys...], outcomeNumber: 1-12 }
 */
function isJiraMarker(outcome) {
  return outcome.title && outcome.title.includes('^^^');
}

function extractOutcomesFromFeatures(allFeatures, priorityOutcomes) {
  const outcomes = {};
  const source = priorityOutcomes && priorityOutcomes.length > 0 ? priorityOutcomes : FALLBACK_OUTCOMES;
  const outcomesToUse = source.filter(o => !isJiraMarker(o));
  const titleMap = {};

  // Build title→key map from priorityOutcomes
  outcomesToUse.forEach(outcome => {
    titleMap[outcome.title] = outcome.key;
  });

  // Initialize all outcomes
  outcomesToUse.forEach((outcome, index) => {
    outcomes[outcome.key] = {
      key: outcome.key,
      title: outcome.title,
      outcomeNumber: outcome.orderNumber || (index + 1),
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
 * @param {Array} allFeatures - All features (for confidence aggregation and version extraction)
 * @returns {Array} Array of outcome objects with metrics and version info
 */
function calculateOutcomeMetrics(outcomes, inPlanFeatures, allFeatures) {
  const inPlanSet = new Set(inPlanFeatures.map(f => typeof f === 'string' ? f : f.key));
  const confidenceMap = new Map();
  const versionMap = new Map();
  allFeatures.forEach(f => {
    const key = typeof f === 'string' ? f : f.key;
    confidenceMap.set(key, f.confidence || f._conf || 0);
    const versions = f.targetVersions || [];
    if (versions.length > 0) {
      versionMap.set(key, versions);
    }
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

    // Collect unique versions from child features
    const versionSet = new Set();
    outcome.children.forEach(child => {
      const versions = versionMap.get(child);
      if (versions && Array.isArray(versions)) {
        versions.forEach(v => versionSet.add(v));
      }
    });
    const linkedVersions = Array.from(versionSet).sort();

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
      children: outcome.children,
      linkedVersions: linkedVersions
    };
  });
}

module.exports = {
  FALLBACK_OUTCOMES,
  extractOutcomesFromFeatures,
  calculateOutcomeMetrics
};
