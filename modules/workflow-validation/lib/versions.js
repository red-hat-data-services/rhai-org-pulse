/** Release ordering shared by the Recent Runs API and client. */
function parseVersion(value) {
  const input = typeof value === 'string' ? value.trim() : '';
  if (!input || input.length > 256) return null;
  const match = input.match(/^(\d+)\.(\d+)(?:\.(\d+))?(?:[- ._]*(ea|rc|alpha|beta)[ ._-]*(\d+))?$/i);
  if (!match) return null;
  return { major: BigInt(match[1]), minor: BigInt(match[2]), patch: match[3] === undefined ? null : BigInt(match[3]),
    stage: match[4]?.toLowerCase() || '', stageNumber: match[5] ? BigInt(match[5]) : 0n };
}
function normalizeVersion(value) {
  const input = typeof value === 'string' ? value.trim() : '';
  const parsed = parseVersion(input);
  if (!parsed) return input;
  const base = `${parsed.major}.${parsed.minor}${parsed.patch === null ? '' : `.${parsed.patch}`}`;
  const normalized = base + (parsed.stage ? `-${parsed.stage}.${parsed.stageNumber}` : '');
  // Recent Runs groups the legacy 3.6 label with 3.6.0.
  return normalized === '3.6' ? '3.6.0' : normalized;
}
function versionLabel(value) {
  const normalized = normalizeVersion(value);
  const parsed = parseVersion(normalized);
  return parsed?.patch === null && !parsed.stage ? `${normalized} (release unspecified)` : normalized;
}
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
  return String(left || '').localeCompare(String(right || ''), 'en', { numeric: true, sensitivity: 'base' });
}
function normalizeVersions(values = []) {
  return [...new Set(values.map(normalizeVersion).filter(Boolean))].sort((a, b) => compareVersions(b, a));
}
function suiteLabel(value) {
  return String(value || '').replaceAll(/[_-]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}
export { parseVersion, normalizeVersion, normalizeVersions, versionLabel, compareVersions, suiteLabel };
