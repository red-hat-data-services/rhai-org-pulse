const SCORECARD_DIMENSIONS = [
  'Unit Tests',
  'Integration/E2E',
  'Build Integration',
  'Image Testing',
  'Coverage Tracking',
  'CI/CD Automation',
  'Static Analysis',
  'Agent Rules'
];

const VALID_SEVERITIES = ['HIGH', 'MEDIUM', 'LOW'];
const VALID_TIERS = ['upstream', 'midstream', 'downstream'];

function validateQualityReport(body) {
  const errors = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body must be an object'] };
  }

  if (typeof body.repository !== 'string' || !body.repository.includes('/')) {
    errors.push('repository must be a string in owner/repo format');
  }

  if (typeof body.overallScore !== 'number' || body.overallScore < 0 || body.overallScore > 10) {
    errors.push('overallScore must be a number between 0 and 10');
  }

  if (!Array.isArray(body.scorecard)) {
    errors.push('scorecard must be an array of dimension objects');
  } else {
    for (const item of body.scorecard) {
      if (!item || typeof item !== 'object') {
        errors.push('Each scorecard entry must be an object');
        continue;
      }
      if (typeof item.dimension !== 'string') {
        errors.push('scorecard entry missing dimension name');
      }
      if (typeof item.score !== 'number' || item.score < 0 || item.score > 10) {
        errors.push('scorecard entry "' + (item.dimension || '?') + '" score must be 0-10');
      }
      if (typeof item.status !== 'string') {
        errors.push('scorecard entry "' + (item.dimension || '?') + '" must have a status string');
      }
    }
  }

  if (typeof body.assessedAt !== 'string' || isNaN(Date.parse(body.assessedAt))) {
    errors.push('assessedAt must be a valid ISO 8601 date string');
  }

  if (body.criticalGaps !== undefined) {
    if (!Array.isArray(body.criticalGaps)) {
      errors.push('criticalGaps must be an array');
    } else {
      for (const gap of body.criticalGaps) {
        if (!gap || typeof gap !== 'object' || typeof gap.title !== 'string') {
          errors.push('Each criticalGap must have a title string');
        }
      }
    }
  }

  if (body.quickWins !== undefined) {
    if (!Array.isArray(body.quickWins)) {
      errors.push('quickWins must be an array');
    } else {
      for (const win of body.quickWins) {
        if (!win || typeof win !== 'object' || typeof win.title !== 'string') {
          errors.push('Each quickWin must have a title string');
        }
      }
    }
  }

  if (body.tier !== undefined && typeof body.tier === 'string' && !VALID_TIERS.includes(body.tier)) {
    errors.push('tier must be one of: ' + VALID_TIERS.join(', '));
  }

  if (body.githubUrl !== undefined && typeof body.githubUrl !== 'string') {
    errors.push('githubUrl must be a string');
  }

  if (body.reportHtml !== undefined && typeof body.reportHtml !== 'string') {
    errors.push('reportHtml must be a string');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const data = {
    repository: body.repository,
    overallScore: Math.round(body.overallScore * 10) / 10,
    scorecard: body.scorecard.map(function(item) {
      return {
        dimension: item.dimension,
        score: Math.round(item.score * 10) / 10,
        status: item.status
      };
    }),
    criticalGaps: (body.criticalGaps || []).map(function(gap) {
      return {
        title: gap.title,
        impact: gap.impact || '',
        severity: VALID_SEVERITIES.includes(gap.severity) ? gap.severity : 'MEDIUM',
        effort: gap.effort || ''
      };
    }),
    quickWins: (body.quickWins || []).map(function(win) {
      return {
        title: win.title,
        effort: win.effort || '',
        impact: win.impact || ''
      };
    }),
    tier: body.tier || null,
    component: body.component || null,
    team: body.team || null,
    githubUrl: body.githubUrl || null,
    assessedAt: body.assessedAt
  };

  return { valid: true, data };
}

module.exports = { validateQualityReport, SCORECARD_DIMENSIONS, VALID_TIERS };
