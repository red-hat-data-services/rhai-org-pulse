function normalizeRelease(raw) {
  return raw
    .replace(/^RHAI\s+/i, '')
    .replace(/\.+\s/g, ' ')
    .replace(/[-\s]*(EA|GA)[-\s]*/gi, ' $1')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = { normalizeRelease };
