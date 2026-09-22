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

  return { valid: true, data: body };
}

module.exports = { validateSnapshot };
