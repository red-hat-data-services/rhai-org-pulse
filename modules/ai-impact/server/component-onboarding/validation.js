const VALID_COMPLETION_STATUSES = ['completed', 'in-progress', 'in_queue'];
const VALID_PRODUCT_CONTEXTS = ['RHOAI', 'ODH'];
const VALID_ONBOARDING_METHODS = ['automated', 'manual'];
const VALID_KEY_PREFIXES = ['RHOAIENG-'];

// Pipeline step keys in execution order (per onboarding skill doc)
const ONBOARDING_STEP_KEYS = [
  'yamlValidated',           // Step 1  — Both
  'quayRepoCreated',         // Step 2  — Both
  'deliveryRepoProvisioned', // Step 3  — RHOAI only
  'konfluxOnboarded',        // Step 4  — Both (KRD)
  'pushPipelineConfigured',  // Step 5  — Both (rkc/tekton push)
  'pullPipelineConfigured',  // Step 5b — RHOAI only
  'odhKonfluxOnboarded',     // Step 6  — ODH + cross-product RHOAI components
  'operatorIntegrated',      // Step 7  — If operator
  'bundleConfigured',        // Step 8  — Both
  'productListingUpdated',   // Step 9  — RHOAI only
  'autoMergeSetup',          // Step 10 — RHOAI only
  'renovateSetup'            // Step 11 — RHOAI only
];

/**
 * Derive dashboard completion status from the current Jira status (+ completion signals).
 * Always follow the latest status — do not keep a stale in_queue/completed from storage
 * after the ticket has moved on.
 *
 * Mapping:
 *   New            → in_queue
 *   Resolved/Closed/Done/Cancelled, or Done resolution/category, or completed label → completed
 *   anything else  → in-progress
 *
 * Legacy stored "new" is only used as a fallback when status is missing.
 */
function deriveCompletionStatus(status, completionStatus, context) {
  const normalized = typeof status === 'string' ? status.trim().toLowerCase() : '';

  if (normalized === 'new') {
    return 'in_queue';
  }

  const labels = context?.labels || [];
  const resolution = context?.resolution || null;
  const statusCategory = context?.statusCategory || null;

  if (labels.includes('component-onboarding-completed')) {
    return 'completed';
  }
  if (resolution === 'Done' || statusCategory === 'Done') {
    return 'completed';
  }
  if (normalized === 'resolved' || normalized === 'closed' || normalized === 'done' || normalized === 'cancelled') {
    return 'completed';
  }

  // Status is present and not New / not completed → in progress (ignore stale stored bucket)
  if (normalized) {
    return 'in-progress';
  }

  // No usable status: fall back to stored value (normalize legacy "new")
  if (completionStatus === 'new') return 'in_queue';
  if (VALID_COMPLETION_STATUSES.includes(completionStatus)) return completionStatus;
  return 'in-progress';
}

/**
 * Validate a component onboarding request body.
 * @param {object} body
 * @returns {{ valid: true, data: object } | { valid: false, errors: string[] }}
 */
function validateComponentOnboarding(body) {
  const errors = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body must be an object'] };
  }

  // key: required, must start with known prefix
  if (typeof body.key !== 'string' || !body.key.trim()) {
    errors.push('key must be a non-empty string');
  } else if (!VALID_KEY_PREFIXES.some(p => body.key.startsWith(p))) {
    errors.push(`key must start with one of: ${VALID_KEY_PREFIXES.join(', ')}`);
  }

  // summary: required string
  if (typeof body.summary !== 'string' || !body.summary.trim()) {
    errors.push('summary must be a non-empty string');
  }

  // status: required string (raw Jira status, no enum — it can evolve)
  if (typeof body.status !== 'string' || !body.status.trim()) {
    errors.push('status must be a non-empty string');
  }

  // completionStatus: required enum (legacy "new" is normalized to in_queue)
  const normalizedCompletionStatus = body.completionStatus === 'new' ? 'in_queue' : body.completionStatus;
  if (!VALID_COMPLETION_STATUSES.includes(normalizedCompletionStatus)) {
    errors.push(`completionStatus must be one of: ${VALID_COMPLETION_STATUSES.join(', ')}`);
  }

  // productContext: required enum
  if (!VALID_PRODUCT_CONTEXTS.includes(body.productContext)) {
    errors.push(`productContext must be one of: ${VALID_PRODUCT_CONTEXTS.join(', ')}`);
  }

  // syncedAt: required ISO 8601
  if (typeof body.syncedAt !== 'string' || isNaN(Date.parse(body.syncedAt))) {
    errors.push('syncedAt must be a valid ISO 8601 date string');
  }

  // componentName: optional string
  if (body.componentName !== undefined && typeof body.componentName !== 'string') {
    errors.push('componentName must be a string');
  }

  // repoUrl: optional string
  if (body.repoUrl !== undefined && typeof body.repoUrl !== 'string') {
    errors.push('repoUrl must be a string');
  }

  // branch: optional string
  if (body.branch !== undefined && typeof body.branch !== 'string') {
    errors.push('branch must be a string');
  }

  // dockerfilePath: optional string
  if (body.dockerfilePath !== undefined && typeof body.dockerfilePath !== 'string') {
    errors.push('dockerfilePath must be a string');
  }

  // isOperator: optional boolean
  if (body.isOperator !== undefined && typeof body.isOperator !== 'boolean') {
    errors.push('isOperator must be a boolean');
  }

  // linkedFeatures: optional array of strings
  if (body.linkedFeatures !== undefined) {
    if (!Array.isArray(body.linkedFeatures) || !body.linkedFeatures.every(s => typeof s === 'string')) {
      errors.push('linkedFeatures must be an array of strings');
    }
  }

  // featureTitles: optional { key: string } — titles for linked feature Jira issues
  if (body.featureTitles !== undefined) {
    if (!body.featureTitles || typeof body.featureTitles !== 'object' || Array.isArray(body.featureTitles)) {
      errors.push('featureTitles must be an object');
    } else if (!Object.values(body.featureTitles).every(v => typeof v === 'string')) {
      errors.push('featureTitles values must be strings');
    }
  }

  // labels: optional array of strings, max 100
  if (body.labels !== undefined) {
    if (!Array.isArray(body.labels) || !body.labels.every(s => typeof s === 'string')) {
      errors.push('labels must be an array of strings');
    } else if (body.labels.length > 100) {
      errors.push('labels must not exceed 100 items');
    }
  }

  // onboardingSteps: optional object of booleans
  if (body.onboardingSteps !== undefined) {
    if (!body.onboardingSteps || typeof body.onboardingSteps !== 'object' || Array.isArray(body.onboardingSteps)) {
      errors.push('onboardingSteps must be an object');
    } else {
      for (const [k, v] of Object.entries(body.onboardingSteps)) {
        if (typeof v !== 'boolean') {
          errors.push(`onboardingSteps.${k} must be a boolean`);
        }
      }
    }
  }

  // created: optional ISO 8601
  if (body.created !== undefined && (typeof body.created !== 'string' || isNaN(Date.parse(body.created)))) {
    errors.push('created must be a valid ISO 8601 date string');
  }

  // resolution: optional string or null (e.g. "Done", "Won't Do", "Duplicate")
  if (body.resolution !== undefined && body.resolution !== null && typeof body.resolution !== 'string') {
    errors.push('resolution must be a string or null');
  }

  // resolved: optional ISO 8601 or null
  if (body.resolved !== undefined && body.resolved !== null) {
    if (typeof body.resolved !== 'string' || isNaN(Date.parse(body.resolved))) {
      errors.push('resolved must be a valid ISO 8601 date string or null');
    }
  }

  // validationDate: optional ISO 8601 or null — when validation-successful label was first added
  if (body.validationDate !== undefined && body.validationDate !== null) {
    if (typeof body.validationDate !== 'string' || isNaN(Date.parse(body.validationDate))) {
      errors.push('validationDate must be a valid ISO 8601 date string or null');
    }
  }

  // onboardingMethod: optional enum (automated/manual), defaults to "automated"
  if (body.onboardingMethod !== undefined && !VALID_ONBOARDING_METHODS.includes(body.onboardingMethod)) {
    errors.push(`onboardingMethod must be one of: ${VALID_ONBOARDING_METHODS.join(', ')}`);
  }

  // firstCommentDate: optional ISO 8601 or null
  if (body.firstCommentDate !== undefined && body.firstCommentDate !== null) {
    if (typeof body.firstCommentDate !== 'string' || isNaN(Date.parse(body.firstCommentDate))) {
      errors.push('firstCommentDate must be a valid ISO 8601 date string or null');
    }
  }

  // contextPath: optional string
  if (body.contextPath !== undefined && typeof body.contextPath !== 'string') {
    errors.push('contextPath must be a string');
  }

  // statusCategory: optional string or null (e.g. "Done")
  if (body.statusCategory !== undefined && body.statusCategory !== null && typeof body.statusCategory !== 'string') {
    errors.push('statusCategory must be a string or null');
  }

  // targetVersion: optional string (Jira customfield_10855, e.g. "rhoai-3.6")
  if (body.targetVersion !== undefined && body.targetVersion !== null && typeof body.targetVersion !== 'string') {
    errors.push('targetVersion must be a string or null');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      key: body.key.trim(),
      summary: body.summary.trim(),
      status: body.status.trim(),
      completionStatus: deriveCompletionStatus(body.status, normalizedCompletionStatus, {
        labels: body.labels || [],
        resolution: body.resolution || null,
        statusCategory: body.statusCategory || null
      }),
      productContext: body.productContext,
      targetVersion: body.targetVersion?.trim() || null,
      statusCategory: body.statusCategory || null,
      syncedAt: body.syncedAt,
      componentName: body.componentName || '',
      repoUrl: body.repoUrl || '',
      branch: body.branch || '',
      dockerfilePath: body.dockerfilePath || '',
      isOperator: body.isOperator || false,
      linkedFeatures: body.linkedFeatures || [],
      featureTitles: body.featureTitles || {},
      labels: body.labels || [],
      onboardingSteps: body.onboardingSteps || {},
      created: body.created || null,
      resolution: body.resolution || null,
      resolved: body.resolved || null,
      validationDate: body.validationDate || null,
      onboardingMethod: body.onboardingMethod || 'automated',
      firstCommentDate: body.firstCommentDate || null,
      contextPath: body.contextPath || ''
    }
  };
}

module.exports = {
  validateComponentOnboarding,
  deriveCompletionStatus,
  VALID_COMPLETION_STATUSES,
  VALID_PRODUCT_CONTEXTS,
  VALID_ONBOARDING_METHODS,
  ONBOARDING_STEP_KEYS
};
