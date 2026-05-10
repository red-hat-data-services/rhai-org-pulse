const VALID_COMPLETION_STATUSES = ['completed', 'in-progress'];
const VALID_PRODUCT_CONTEXTS = ['RHOAI', 'ODH'];
const VALID_KEY_PREFIXES = ['RHOAIENG-', 'RHODS-'];

const ONBOARDING_STEP_KEYS = [
  'yamlValidated',
  'quayRepoCreated',
  'konfluxOnboarded',
  'pushPipelineConfigured',
  'operatorIntegrated',
  'bundleConfigured',
  'deliveryRepoProvisioned',
  'productListingUpdated',
  'renovateSetup'
];

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

  // completionStatus: required enum
  if (!VALID_COMPLETION_STATUSES.includes(body.completionStatus)) {
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

  // resolved: optional ISO 8601
  if (body.resolved !== undefined && body.resolved !== null) {
    if (typeof body.resolved !== 'string' || isNaN(Date.parse(body.resolved))) {
      errors.push('resolved must be a valid ISO 8601 date string or null');
    }
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
      completionStatus: body.completionStatus,
      productContext: body.productContext,
      syncedAt: body.syncedAt,
      componentName: body.componentName || '',
      repoUrl: body.repoUrl || '',
      branch: body.branch || '',
      dockerfilePath: body.dockerfilePath || '',
      isOperator: body.isOperator || false,
      linkedFeatures: body.linkedFeatures || [],
      labels: body.labels || [],
      onboardingSteps: body.onboardingSteps || {},
      created: body.created || null,
      resolved: body.resolved || null
    }
  };
}

module.exports = { validateComponentOnboarding, VALID_COMPLETION_STATUSES, VALID_PRODUCT_CONTEXTS, ONBOARDING_STEP_KEYS };
