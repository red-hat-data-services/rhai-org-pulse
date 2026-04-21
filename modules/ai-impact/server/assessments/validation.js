const CRITERIA = ['what', 'why', 'how', 'task', 'size'];

/**
 * Validate an assessment request body.
 * @param {object} body - The request body to validate
 * @returns {{ valid: true, data: object } | { valid: false, errors: string[] }}
 */
function validateAssessment(body) {
  const errors = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body must be an object'] };
  }

  // scores: object with what/why/how/task/size each 0-2 integer
  if (!body.scores || typeof body.scores !== 'object') {
    errors.push('scores must be an object with keys: ' + CRITERIA.join(', '));
  } else {
    for (const criterion of CRITERIA) {
      const val = body.scores[criterion];
      if (!Number.isInteger(val) || val < 0 || val > 2) {
        errors.push(`scores.${criterion} must be an integer between 0 and 2`);
      }
    }
  }

  // total: 0-10 integer, must equal sum of scores
  if (!Number.isInteger(body.total) || body.total < 0 || body.total > 10) {
    errors.push('total must be an integer between 0 and 10');
  } else if (body.scores && typeof body.scores === 'object') {
    const sum = CRITERIA.reduce((acc, c) => {
      const v = body.scores[c];
      return acc + (Number.isInteger(v) ? v : 0);
    }, 0);
    if (body.total !== sum) {
      errors.push(`total (${body.total}) must equal sum of scores (${sum})`);
    }
  }

  // passFail: enum "PASS" or "FAIL"
  if (body.passFail !== 'PASS' && body.passFail !== 'FAIL') {
    errors.push('passFail must be "PASS" or "FAIL"');
  }

  // assessedAt: valid ISO 8601 date string
  if (typeof body.assessedAt !== 'string' || isNaN(Date.parse(body.assessedAt))) {
    errors.push('assessedAt must be a valid ISO 8601 date string');
  }

  // antiPatterns: array of strings (optional, default [])
  if (body.antiPatterns !== undefined) {
    if (!Array.isArray(body.antiPatterns) || !body.antiPatterns.every(s => typeof s === 'string')) {
      errors.push('antiPatterns must be an array of strings');
    }
  }

  // criterionNotes: object with what/why/how/task/size string values (optional)
  if (body.criterionNotes !== undefined) {
    if (!body.criterionNotes || typeof body.criterionNotes !== 'object') {
      errors.push('criterionNotes must be an object');
    } else {
      for (const criterion of CRITERIA) {
        if (body.criterionNotes[criterion] !== undefined && typeof body.criterionNotes[criterion] !== 'string') {
          errors.push(`criterionNotes.${criterion} must be a string`);
        }
      }
    }
  }

  // verdict: string (optional)
  if (body.verdict !== undefined && typeof body.verdict !== 'string') {
    errors.push('verdict must be a string');
  }

  // feedback: string (optional)
  if (body.feedback !== undefined && typeof body.feedback !== 'string') {
    errors.push('feedback must be a string');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Return normalized data
  return {
    valid: true,
    data: {
      scores: {
        what: body.scores.what,
        why: body.scores.why,
        how: body.scores.how,
        task: body.scores.task,
        size: body.scores.size
      },
      total: body.total,
      passFail: body.passFail,
      antiPatterns: body.antiPatterns || [],
      criterionNotes: body.criterionNotes || {},
      verdict: body.verdict || '',
      feedback: body.feedback || '',
      assessedAt: body.assessedAt
    }
  };
}

module.exports = { validateAssessment, CRITERIA };
