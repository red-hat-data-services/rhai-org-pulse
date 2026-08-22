/**
 * Validate the canonical epic-decomposer data.json snapshot.
 *
 * This is a full-document push (one snapshot per pipeline run), NOT a
 * per-item bulk array. We validate the envelope shape leniently — extra
 * dashboard-only fields (epic_bodies, mermaid_dag, per-epic detail) are
 * tolerated and simply dropped during projection. Org Pulse renders a
 * subset, so we only require the pieces the tab needs.
 *
 * @param {object} body - The request body (canonical data.json)
 * @returns {{ valid: true, data: object } | { valid: false, errors: string[] }}
 */
function validateSnapshot(body) {
  const errors = [];

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, errors: ['Request body must be a data.json object'] };
  }

  if (!Array.isArray(body.runs)) {
    errors.push('runs must be an array');
  }

  if (!body.strategies || typeof body.strategies !== 'object' || Array.isArray(body.strategies)) {
    errors.push('strategies must be an object keyed by strategy id');
  }

  if (!body.aggregates || typeof body.aggregates !== 'object' || Array.isArray(body.aggregates)) {
    errors.push('aggregates must be an object');
  }

  // generated_at is optional but, if present, must be a valid date
  if (body.generated_at !== undefined && body.generated_at !== null) {
    if (typeof body.generated_at !== 'string' || isNaN(Date.parse(body.generated_at))) {
      errors.push('generated_at must be a valid ISO 8601 date string');
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, data: body };
}

module.exports = { validateSnapshot };
