const DIMENSIONS = ['feasibility', 'testability', 'scope', 'architecture'];
const PRIORITIES = ['Blocker', 'Critical', 'Major', 'Minor', 'Normal', 'Undefined'];
const RECOMMENDATIONS = ['approve', 'revise', 'reject'];

/**
 * Derive humanReviewStatus from labels array.
 * @param {string[]} labels
 * @returns {'reviewed' | 'pending' | 'not-required'}
 */
function deriveHumanReviewStatus(labels) {
  if (labels.includes('tech-reviewed')) return 'reviewed';
  if (labels.includes('needs-tech-review')) return 'pending';
  return 'not-required';
}

/**
 * Validate and normalize a feature request body.
 * Accepts both snake_case (from summary.json) and camelCase fields.
 * @param {object} body - The request body to validate
 * @returns {{ valid: true, data: object } | { valid: false, errors: string[] }}
 */
function validateFeature(body) {
  const errors = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body must be an object'] };
  }

  // ─── Normalize snake_case → camelCase ───
  if (body.strat_id && !body.key) body.key = body.strat_id;
  if (body.source_rfe && !body.sourceRfe) body.sourceRfe = body.source_rfe;
  if (body.needs_attention !== undefined && body.needsAttention === undefined) body.needsAttention = body.needs_attention;
  if (body.run_id && body.runId === undefined) body.runId = body.run_id;
  if (body.run_timestamp && body.runTimestamp === undefined) body.runTimestamp = body.run_timestamp;
  // Synthesize reviewedAt from runTimestamp if absent
  if (body.reviewedAt === undefined && typeof body.runTimestamp === 'string' && !isNaN(Date.parse(body.runTimestamp))) {
    body.reviewedAt = body.runTimestamp;
  }

  // ─── Field validation ───

  // key: required non-empty string
  if (typeof body.key !== 'string' || body.key.length === 0) {
    errors.push('key must be a non-empty string');
  }

  // title: required non-empty string
  if (typeof body.title !== 'string' || body.title.length === 0) {
    errors.push('title must be a non-empty string');
  }

  // sourceRfe: required, must start with RHAIRFE-
  if (typeof body.sourceRfe !== 'string' || !body.sourceRfe.startsWith('RHAIRFE-')) {
    errors.push('sourceRfe must be a string starting with "RHAIRFE-"');
  }

  // priority: required enum
  if (!PRIORITIES.includes(body.priority)) {
    errors.push('priority must be one of: ' + PRIORITIES.join(', '));
  }

  // status: required non-empty string
  if (typeof body.status !== 'string' || body.status.length === 0) {
    errors.push('status must be a non-empty string');
  }

  // size: optional enum or null
  if (body.size !== undefined && body.size !== null) {
    if (!['S', 'M', 'L', 'XL'].includes(body.size)) {
      errors.push('size must be one of: S, M, L, XL, or null');
    }
  }

  // recommendation: required enum
  if (!RECOMMENDATIONS.includes(body.recommendation)) {
    errors.push('recommendation must be one of: ' + RECOMMENDATIONS.join(', '));
  }

  // needsAttention: required boolean
  if (typeof body.needsAttention !== 'boolean') {
    errors.push('needsAttention must be a boolean');
  }

  // scores: required object with dimension scores + total
  if (!body.scores || typeof body.scores !== 'object') {
    errors.push('scores must be an object with keys: ' + DIMENSIONS.join(', ') + ', total');
  } else {
    for (const dim of DIMENSIONS) {
      const val = body.scores[dim];
      if (!Number.isInteger(val) || val < 0 || val > 2) {
        errors.push(`scores.${dim} must be an integer between 0 and 2`);
      }
    }
    if (!Number.isInteger(body.scores.total) || body.scores.total < 0 || body.scores.total > 8) {
      errors.push('scores.total must be an integer between 0 and 8');
    } else {
      const sum = DIMENSIONS.reduce((acc, d) => {
        const v = body.scores[d];
        return acc + (Number.isInteger(v) ? v : 0);
      }, 0);
      if (body.scores.total !== sum) {
        errors.push(`scores.total (${body.scores.total}) must equal sum of dimension scores (${sum})`);
      }
    }
  }

  // reviewers: required object with dimension verdicts
  if (!body.reviewers || typeof body.reviewers !== 'object') {
    errors.push('reviewers must be an object with keys: ' + DIMENSIONS.join(', '));
  } else {
    for (const dim of DIMENSIONS) {
      if (!RECOMMENDATIONS.includes(body.reviewers[dim])) {
        errors.push(`reviewers.${dim} must be one of: ${RECOMMENDATIONS.join(', ')}`);
      }
    }
  }

  // labels: required array of strings, max 50
  if (!Array.isArray(body.labels) || !body.labels.every(s => typeof s === 'string')) {
    errors.push('labels must be an array of strings');
  } else if (body.labels.length > 50) {
    errors.push('labels must have at most 50 items');
  }

  // runId: optional string
  if (body.runId !== undefined && typeof body.runId !== 'string') {
    errors.push('runId must be a string');
  }

  // runTimestamp: optional valid ISO 8601
  if (body.runTimestamp !== undefined) {
    if (typeof body.runTimestamp !== 'string' || isNaN(Date.parse(body.runTimestamp))) {
      errors.push('runTimestamp must be a valid ISO 8601 date string');
    }
  }

  // reviewedAt: required valid ISO 8601
  if (typeof body.reviewedAt !== 'string' || isNaN(Date.parse(body.reviewedAt))) {
    errors.push('reviewedAt must be a valid ISO 8601 date string');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Derive humanReviewStatus from labels
  const humanReviewStatus = deriveHumanReviewStatus(body.labels);

  return {
    valid: true,
    data: {
      key: body.key,
      title: body.title,
      sourceRfe: body.sourceRfe,
      priority: body.priority,
      status: body.status,
      size: body.size !== undefined ? body.size : null,
      recommendation: body.recommendation,
      needsAttention: body.needsAttention,
      humanReviewStatus,
      scores: {
        feasibility: body.scores.feasibility,
        testability: body.scores.testability,
        scope: body.scores.scope,
        architecture: body.scores.architecture,
        total: body.scores.total
      },
      reviewers: {
        feasibility: body.reviewers.feasibility,
        testability: body.reviewers.testability,
        scope: body.reviewers.scope,
        architecture: body.reviewers.architecture
      },
      labels: body.labels,
      runId: body.runId || undefined,
      runTimestamp: body.runTimestamp || undefined,
      reviewedAt: body.reviewedAt
    }
  };
}

module.exports = { validateFeature, DIMENSIONS, PRIORITIES, RECOMMENDATIONS };
