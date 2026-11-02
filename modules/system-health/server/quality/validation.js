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

/** @type {readonly string[]} */
const NIGHTLY_COMPONENT_STATES = Object.freeze([
  'ready',
  'failed',
  'blocked',
  'unknown',
  'not_run',
  'not_applicable'
]);

/**
 * @param {unknown} gates
 * @param {string} runLabel
 * @returns {string|null}
 */
function validateNightlyRunGates(gates, runLabel) {
  if (gates === undefined) {
    return null;
  }
  if (!Array.isArray(gates)) {
    return `${runLabel}.gates must be an array when present`;
  }
  for (let gateIndex = 0; gateIndex < gates.length; gateIndex += 1) {
    const gate = gates[gateIndex];
    const gateLabel = `${runLabel}.gates[${gateIndex}]`;
    if (!gate || typeof gate !== 'object' || Array.isArray(gate)) {
      return `${gateLabel} must be an object`;
    }
    if (typeof gate.id !== 'string' || gate.id.length === 0) {
      return `${gateLabel} must have a non-empty id string`;
    }
    if (gate.state !== undefined) {
      if (typeof gate.state !== 'string' || !NIGHTLY_COMPONENT_STATES.includes(gate.state)) {
        return `${gateLabel}.state must be one of: ${NIGHTLY_COMPONENT_STATES.join(', ')}`;
      }
    }
  }
  return null;
}

/**
 * @param {unknown} payload
 * @returns {string|null} error message or null when valid
 */
function validateNightlyHealthPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return 'nightly_health must be an object';
  }
  if (
    typeof payload.schema_version !== 'number' ||
    !Number.isInteger(payload.schema_version) ||
    payload.schema_version !== 1
  ) {
    return 'nightly_health.schema_version must be 1';
  }
  if (!Array.isArray(payload.days)) {
    return 'nightly_health.days must be an array';
  }
  const seenDates = new Set();
  for (let dayIndex = 0; dayIndex < payload.days.length; dayIndex += 1) {
    const day = payload.days[dayIndex];
    const dayLabel = `nightly_health.days[${dayIndex}]`;
    if (!day || typeof day !== 'object' || Array.isArray(day)) {
      return `${dayLabel} must be an object`;
    }
    if (typeof day.date !== 'string' || day.date.length === 0) {
      return `${dayLabel} must have a non-empty date string`;
    }
    if (seenDates.has(day.date)) {
      return `${dayLabel} has duplicate date ${day.date}`;
    }
    seenDates.add(day.date);
    if (!Array.isArray(day.runs)) {
      return `${dayLabel} must have a runs array`;
    }

    const runIds = new Set();
    for (let runIndex = 0; runIndex < day.runs.length; runIndex += 1) {
      const run = day.runs[runIndex];
      const runLabel = `${dayLabel}.runs[${runIndex}]`;
      if (!run || typeof run !== 'object' || Array.isArray(run)) {
        return `${runLabel} must be an object`;
      }
      if (typeof run.run_id !== 'string' || run.run_id.length === 0) {
        return `${runLabel} must have a non-empty run_id string`;
      }
      if (runIds.has(run.run_id)) {
        return `${dayLabel} has duplicate run_id ${run.run_id}`;
      }
      runIds.add(run.run_id);

      const gatesError = validateNightlyRunGates(run.gates, runLabel);
      if (gatesError) {
        return gatesError;
      }

      if (!Array.isArray(run.components)) {
        return `${runLabel}.components must be an array`;
      }
      for (let compIndex = 0; compIndex < run.components.length; compIndex += 1) {
        const component = run.components[compIndex];
        const compLabel = `${runLabel}.components[${compIndex}]`;
        if (!component || typeof component !== 'object' || Array.isArray(component)) {
          return `${compLabel} must be an object`;
        }
        const componentId = component.id;
        if (typeof componentId !== 'string' || componentId.length === 0) {
          return `${compLabel} must have a non-empty id string`;
        }
        if (typeof component.state !== 'string' || !NIGHTLY_COMPONENT_STATES.includes(component.state)) {
          return `${compLabel}.state must be one of: ${NIGHTLY_COMPONENT_STATES.join(', ')}`;
        }
      }
    }

    if (day.runs.length > 0) {
      if (typeof day.latest_run_id !== 'string' || day.latest_run_id.length === 0) {
        return `${dayLabel} must include latest_run_id when runs is non-empty`;
      }
      if (!runIds.has(day.latest_run_id)) {
        return `${dayLabel}.latest_run_id must reference a run in runs`;
      }
    }
  }
  return null;
}

module.exports = {
  validateQualityReport,
  validateNightlyHealthPayload,
  NIGHTLY_COMPONENT_STATES,
  SCORECARD_DIMENSIONS,
  VALID_TIERS
};
