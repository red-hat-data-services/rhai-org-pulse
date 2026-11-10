/** Parse supported release labels into numeric parts, or return null for unknown labels. */
function parseVersion(value) {
  const input = typeof value === 'string' ? value.trim() : '';
  if (!input || input.length > 256) return null;
  const match = input.match(/^(\d+)\.(\d+)(?:\.(\d+))?(?:[- ._]*(ea|rc|alpha|beta)[ ._-]*(\d+))?$/i);
  if (!match) return null;
  return { major: BigInt(match[1]), minor: BigInt(match[2]), patch: match[3] === undefined ? null : BigInt(match[3]),
    stage: match[4]?.toLowerCase() || '', stageNumber: match[5] ? BigInt(match[5]) : 0n };
}
/** Combine confirmed spelling aliases and the legacy 3.6 label without changing unknown labels. */
function normalizeVersion(value) {
  const input = typeof value === 'string' ? value.trim() : '';
  const parsed = parseVersion(input);
  if (!parsed) return input;
  const base = `${parsed.major}.${parsed.minor}${parsed.patch === null ? '' : `.${parsed.patch}`}`;
  const normalized = base + (parsed.stage ? `-${parsed.stage}.${parsed.stageNumber}` : '');
  // Recent Runs groups the legacy 3.6 label with 3.6.0.
  return normalized === '3.6' ? '3.6.0' : normalized;
}
/** Return the canonical version label shown in Recent Runs. */
function versionLabel(value) {
  return normalizeVersion(value);
}
/** Compare releases numerically and break unknown-label ties by exact spelling. */
function compareVersions(left, right) {
  const a = parseVersion(normalizeVersion(left)), b = parseVersion(normalizeVersion(right));
  if (a && b) {
    for (const key of ['major', 'minor']) if (a[key] !== b[key]) return a[key] > b[key] ? 1 : -1;
    // An unspecified release is separate from any confirmed patch/stage.
    if (a.patch === null || b.patch === null) {
      if (a.patch !== b.patch) return a.patch === null ? -1 : 1;
    } else if (a.patch !== b.patch) return a.patch > b.patch ? 1 : -1;
    const rank = { alpha: 0, beta: 1, ea: 2, rc: 3, '': 4 };
    if (rank[a.stage] !== rank[b.stage]) return rank[a.stage] - rank[b.stage];
    if (a.stageNumber !== b.stageNumber) return a.stageNumber > b.stageNumber ? 1 : -1;
    return 0;
  }
  if (a || b) return a ? 1 : -1;
  const leftText = String(left || ''), rightText = String(right || '');
  return leftText.localeCompare(rightText, 'en', { numeric: true, sensitivity: 'base' })
    || (leftText < rightText ? -1 : leftText > rightText ? 1 : 0);
}
/** Deduplicate canonical labels and return a stable highest-first selection. */
function normalizeVersions(values = []) {
  return [...new Set(values.map(normalizeVersion).filter(Boolean))].sort((a, b) => compareVersions(b, a));
}
/** Format a suite identifier as the display label used for alphabetic sorting. */
function suiteLabel(value) {
  return String(value || '').replaceAll(/[_-]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}
export { parseVersion, normalizeVersion, normalizeVersions, versionLabel, compareVersions, suiteLabel };
