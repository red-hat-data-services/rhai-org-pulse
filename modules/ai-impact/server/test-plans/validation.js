const CRITERIA = ['specificity', 'grounding', 'scope_fidelity', 'actionability', 'consistency'];
const VERDICTS = ['Ready', 'Revise', 'Rework'];
const HUMAN_REVIEW_STATUSES = ['approved', 'needs-review', 'awaiting-review'];

/**
 * Derive humanReviewStatus from test-plan pipeline labels.
 * @param {string[]} labels
 * @returns {'approved' | 'needs-review' | 'awaiting-review'}
 */
function deriveHumanReviewStatus(labels) {
  if (labels.includes('test-plan-human-sign-off')) return 'approved';
  if (labels.includes('test-plan-rubric-fail')) return 'needs-review';
  return 'awaiting-review';
}

function validateTestPlan(body) {
  const errors = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body must be an object'] };
  }

  // Normalize snake_case to camelCase
  const b = {
    ...body,
    sourceKey: body.sourceKey || body.source_key,
    autoRevised: body.autoRevised ?? body.auto_revised,
    beforeScore: body.beforeScore ?? body.before_score,
    beforeScores: body.beforeScores || body.before_scores,
    criterionNotes: body.criterionNotes || body.criterion_notes,
    testCaseCount: body.testCaseCount ?? body.test_case_count,
    reviewedAt: body.reviewedAt || body.reviewed_at
  };

  // feature: required string
  if (typeof b.feature !== 'string' || !b.feature.trim()) {
    errors.push('feature must be a non-empty string');
  }

  // sourceKey: required, pattern match
  if (typeof b.sourceKey !== 'string' || !/^(RHAISTRAT|RHOAIENG|RHAIRFE)-\d+$/.test(b.sourceKey)) {
    errors.push('sourceKey must match pattern RHAISTRAT-NNN, RHOAIENG-NNN, or RHAIRFE-NNN');
  }

  // scores: object with 5 criteria, each 0-2 integer
  if (!b.scores || typeof b.scores !== 'object') {
    errors.push('scores must be an object with keys: ' + CRITERIA.join(', '));
  } else {
    for (const criterion of CRITERIA) {
      const val = b.scores[criterion];
      if (!Number.isInteger(val) || val < 0 || val > 2) {
        errors.push(`scores.${criterion} must be an integer between 0 and 2`);
      }
    }
  }

  // score: 0-10 integer, must equal sum of scores
  if (!Number.isInteger(b.score) || b.score < 0 || b.score > 10) {
    errors.push('score must be an integer between 0 and 10');
  } else if (b.scores && typeof b.scores === 'object') {
    const sum = CRITERIA.reduce((acc, c) => {
      const v = b.scores[c];
      return acc + (Number.isInteger(v) ? v : 0);
    }, 0);
    if (b.score !== sum) {
      errors.push(`score (${b.score}) must equal sum of scores (${sum})`);
    }
  }

  // verdict: enum
  if (!VERDICTS.includes(b.verdict)) {
    errors.push('verdict must be one of: ' + VERDICTS.join(', '));
  }

  // reviewedAt: valid ISO 8601 date string
  if (typeof b.reviewedAt !== 'string' || isNaN(Date.parse(b.reviewedAt))) {
    errors.push('reviewedAt must be a valid ISO 8601 date string');
  }

  // autoRevised: bool (optional, default false)
  if (b.autoRevised !== undefined && b.autoRevised !== null && typeof b.autoRevised !== 'boolean') {
    errors.push('autoRevised must be a boolean');
  }

  // beforeScore / beforeScores pairing
  const hasBeforeScore = b.beforeScore !== undefined && b.beforeScore !== null;
  const hasBeforeScores = b.beforeScores !== undefined && b.beforeScores !== null;
  if (hasBeforeScore !== hasBeforeScores) {
    errors.push('beforeScore and beforeScores must both be set or both be null');
  }
  if (hasBeforeScore) {
    if (!Number.isInteger(b.beforeScore) || b.beforeScore < 0 || b.beforeScore > 10) {
      errors.push('beforeScore must be an integer between 0 and 10');
    }
  }
  if (hasBeforeScores) {
    if (typeof b.beforeScores !== 'object') {
      errors.push('beforeScores must be an object');
    } else {
      for (const criterion of CRITERIA) {
        const val = b.beforeScores[criterion];
        if (!Number.isInteger(val) || val < 0 || val > 2) {
          errors.push(`beforeScores.${criterion} must be an integer between 0 and 2`);
        }
      }
      if (hasBeforeScore && Number.isInteger(b.beforeScore)) {
        const sum = CRITERIA.reduce((acc, c) => {
          const v = b.beforeScores[c];
          return acc + (Number.isInteger(v) ? v : 0);
        }, 0);
        if (b.beforeScore !== sum) {
          errors.push(`beforeScore (${b.beforeScore}) must equal sum of beforeScores (${sum})`);
        }
      }
    }
  }

  // criterionNotes: optional object with string values
  if (b.criterionNotes !== undefined && b.criterionNotes !== null) {
    if (typeof b.criterionNotes !== 'object') {
      errors.push('criterionNotes must be an object');
    } else {
      for (const criterion of CRITERIA) {
        if (b.criterionNotes[criterion] !== undefined && typeof b.criterionNotes[criterion] !== 'string') {
          errors.push(`criterionNotes.${criterion} must be a string`);
        }
      }
    }
  }

  // feedback: optional string
  if (b.feedback !== undefined && b.feedback !== null && typeof b.feedback !== 'string') {
    errors.push('feedback must be a string');
  }

  // gapAnalysis: optional string
  if (b.gapAnalysis !== undefined && b.gapAnalysis !== null && typeof b.gapAnalysis !== 'string') {
    errors.push('gapAnalysis must be a string');
  }

  // error: optional string
  if (b.error !== undefined && b.error !== null && typeof b.error !== 'string') {
    errors.push('error must be a string');
  }

  // components: optional array of strings
  if (b.components !== undefined && b.components !== null) {
    if (!Array.isArray(b.components) || !b.components.every(s => typeof s === 'string')) {
      errors.push('components must be an array of strings');
    }
  }

  // testCaseCount: optional non-negative integer
  if (b.testCaseCount !== undefined && b.testCaseCount !== null) {
    if (!Number.isInteger(b.testCaseCount) || b.testCaseCount < 0) {
      errors.push('testCaseCount must be a non-negative integer');
    }
  }

  // ─── Optional Jira-enriched fields ───

  // jiraTitle: optional string
  if (b.jiraTitle !== undefined && b.jiraTitle !== null && typeof b.jiraTitle !== 'string') {
    errors.push('jiraTitle must be a string');
  }

  // jiraStatus: optional string
  if (b.jiraStatus !== undefined && b.jiraStatus !== null && typeof b.jiraStatus !== 'string') {
    errors.push('jiraStatus must be a string');
  }

  // jiraPriority: optional string
  if (b.jiraPriority !== undefined && b.jiraPriority !== null && typeof b.jiraPriority !== 'string') {
    errors.push('jiraPriority must be a string');
  }

  // labels: optional array of strings
  if (b.labels !== undefined && b.labels !== null) {
    if (!Array.isArray(b.labels) || !b.labels.every(s => typeof s === 'string')) {
      errors.push('labels must be an array of strings');
    } else if (b.labels.length > 50) {
      errors.push('labels must have at most 50 items');
    }
  }

  // humanReviewStatus: optional enum
  if (b.humanReviewStatus !== undefined && b.humanReviewStatus !== null) {
    if (!HUMAN_REVIEW_STATUSES.includes(b.humanReviewStatus)) {
      errors.push('humanReviewStatus must be one of: ' + HUMAN_REVIEW_STATUSES.join(', '));
    }
  }

  // approvedBy: optional string
  if (b.approvedBy !== undefined && b.approvedBy !== null && typeof b.approvedBy !== 'string') {
    errors.push('approvedBy must be a string');
  }

  // approvedAt: optional valid ISO 8601 date string
  if (b.approvedAt !== undefined && b.approvedAt !== null) {
    if (typeof b.approvedAt !== 'string' || isNaN(Date.parse(b.approvedAt))) {
      errors.push('approvedAt must be a valid ISO 8601 date string');
    }
  }

  // gitlabPath: optional string (path to test plan in GitLab repo)
  if (b.gitlabPath !== undefined && b.gitlabPath !== null && typeof b.gitlabPath !== 'string') {
    errors.push('gitlabPath must be a string');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Derive humanReviewStatus from labels if labels are present and no explicit status given
  const resolvedHumanReviewStatus = b.humanReviewStatus
    || (Array.isArray(b.labels) ? deriveHumanReviewStatus(b.labels) : undefined);

  return {
    valid: true,
    data: {
      key: b.key || b.sourceKey,
      feature: b.feature,
      sourceKey: b.sourceKey,
      score: b.score,
      verdict: b.verdict,
      scores: {
        specificity: b.scores.specificity,
        grounding: b.scores.grounding,
        scope_fidelity: b.scores.scope_fidelity,
        actionability: b.scores.actionability,
        consistency: b.scores.consistency
      },
      autoRevised: b.autoRevised ?? false,
      beforeScore: b.beforeScore ?? null,
      beforeScores: b.beforeScores ?? null,
      criterionNotes: b.criterionNotes || {},
      feedback: b.feedback || '',
      gapAnalysis: b.gapAnalysis || '',
      error: b.error || null,
      components: b.components || [],
      testCaseCount: b.testCaseCount ?? null,
      jiraTitle: b.jiraTitle || undefined,
      jiraStatus: b.jiraStatus || undefined,
      jiraPriority: b.jiraPriority || undefined,
      labels: b.labels || undefined,
      humanReviewStatus: resolvedHumanReviewStatus || undefined,
      approvedBy: b.approvedBy || undefined,
      approvedAt: b.approvedAt || undefined,
      reviewedAt: b.reviewedAt,
      gitlabPath: b.gitlabPath || undefined
    }
  };
}

module.exports = { validateTestPlan, deriveHumanReviewStatus, CRITERIA, VERDICTS, HUMAN_REVIEW_STATUSES };
