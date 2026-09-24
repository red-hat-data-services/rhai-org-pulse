function validateSnapshot(body) {
  const errors = [];

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, errors: ['Request body must be a planner snapshot object'] };
  }

  if (!Array.isArray(body.features)) {
    errors.push('features must be an array');
  }

  if (body.bugQueue && !Array.isArray(body.bugQueue)) {
    errors.push('bugQueue must be an array');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  for (let i = 0; i < body.features.length; i++) {
    const f = body.features[i];
    if (!f || typeof f.Key !== 'string' || !f.Key.trim()) {
      errors.push('features[' + i + '] must have a non-empty string Key');
    }
    if (!f || typeof f.Summary !== 'string' || !f.Summary.trim()) {
      errors.push('features[' + i + '] must have a non-empty string Summary');
    }
    if (errors.length >= 5) break;
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, data: body };
}

module.exports = { validateSnapshot };
