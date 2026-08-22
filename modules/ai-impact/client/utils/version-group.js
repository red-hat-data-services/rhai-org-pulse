/**
 * Group Jira target-version strings by logical release identity:
 *   major.minor[.phase]
 *
 * Same release, different naming → one filter option:
 *   "rhoai-3.5.EA1"  +  "3.5 EA1 RHOAI RELEASE"  →  "3.5.EA1"
 *   "rhoai-3.5"      +  "3.5 GA RHOAI RELEASE"   →  "3.5"
 *
 * Different phases stay separate:
 *   "3.5" / "3.5.EA1" / "3.5.EA2"  → three options
 */

// ODH build type values that are valid version group keys (not numeric releases).
// Maps lowercase → canonical display form.
const ODH_BUILD_TYPES = { ci: 'CI', release: 'Release' }

/**
 * @param {string|null|undefined} name
 * @returns {string|null} Canonical group key, e.g. "3.5", "3.5.EA1", "CI", "Release"
 */
export function extractVersionGroup(name) {
  if (name == null) return null
  let s = String(name).toLowerCase().trim()
  if (!s) return null

  // ODH build_type values map to their canonical form.
  if (s in ODH_BUILD_TYPES) {
    return ODH_BUILD_TYPES[s]
  }

  s = s.replace(/\brhel\s+ai\b/g, 'rhelai')
  s = s.replace(/\.z(?=$|[.\s])/gi, '')
  s = s.replace(/\bea-(\d)/g, 'ea$1')
  s = s.replace(/[-._]+/g, ' ')
  s = s.replace(/\s+/g, ' ').trim()
  s = s.replace(/\s+release$/i, '').trim()

  // Drop leading product tokens so we key on version + phase only.
  s = s.replace(/^(?:rhoai|rhaiis|rhaii|rhelai|rhai)\s+/, '')

  // Version-first: "3 5 ea1 rhoai" / "3 5 ga rhoai"
  let m = s.match(/^(\d+(?:\s+\d+)*)\s+(ga|ea\d+)\s+(?:rhoai|rhaiis|rhaii|rhelai|rhai)$/)
  if (m) {
    const ver = m[1].replace(/\s+/g, '.')
    return m[2] === 'ga' ? ver : `${ver}.${m[2].toUpperCase()}`
  }

  // Version-first without phase: "3 5 rhoai"
  m = s.match(/^(\d+(?:\s+\d+)*)\s+(?:rhoai|rhaiis|rhaii|rhelai|rhai)$/)
  if (m) return m[1].replace(/\s+/g, '.')

  // Product already stripped — "3 5 ea1" / "3 5 ga" / "3 5"
  m = s.match(/^(\d+(?:\s+\d+)*)(?:\s+(ga|ea\d+))?$/)
  if (m) {
    const ver = m[1].replace(/\s+/g, '.')
    if (!m[2] || m[2] === 'ga') return ver
    return `${ver}.${m[2].toUpperCase()}`
  }

  // Fallback: require at least major.minor (two number parts) so junk like "ea1" is ignored
  m = s.match(/(\d+(?:\s+\d+)+)(?:\s+(ea\d+))?/)
  if (m) {
    const ver = m[1].replace(/\s+/g, '.')
    return m[2] ? `${ver}.${m[2].toUpperCase()}` : ver
  }

  return null
}

/**
 * @param {Iterable<string>} versions
 * @returns {string[]}
 */
export function collectVersionGroups(versions) {
  const groups = new Set()
  for (const v of versions) {
    const g = extractVersionGroup(v)
    if (g) groups.add(g)
  }
  return [...groups].sort(compareVersionGroups)
}

/**
 * Sort 3.4 < 3.4.EA1 < 3.4.EA2 < 3.5 < 3.5.EA1 … < CI < Release
 * Non-numeric labels (ODH build types) sort after all numeric versions.
 */
function compareVersionGroups(a, b) {
  const pa = parseGroupKey(a)
  const pb = parseGroupKey(b)
  if (pa.isLabel !== pb.isLabel) return pa.isLabel ? 1 : -1
  if (pa.isLabel && pb.isLabel) return a.localeCompare(b)
  if (pa.major !== pb.major) return pa.major - pb.major
  if (pa.minor !== pb.minor) return pa.minor - pb.minor
  if (pa.patch !== pb.patch) return pa.patch - pb.patch
  if (pa.phaseRank !== pb.phaseRank) return pa.phaseRank - pb.phaseRank
  return (pa.phase || '').localeCompare(pb.phase || '')
}

function parseGroupKey(key) {
  const m = String(key).match(/^(\d+)\.(\d+)(?:\.(\d+))?(?:\.(EA\d+))?$/i)
  if (!m) return { major: 0, minor: 0, patch: 0, phase: null, phaseRank: 0, isLabel: true }
  const phase = m[4] ? m[4].toUpperCase() : null
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: m[3] ? Number(m[3]) : 0,
    phase,
    phaseRank: phase ? Number(phase.replace(/\D/g, '')) || 99 : 0,
    isLabel: false
  }
}

/**
 * Human label for a group key: "3.5.EA1" → "3.5 EA1"
 * @param {string} groupKey
 */
export function formatVersionGroupLabel(groupKey) {
  if (!groupKey) return groupKey
  return String(groupKey).replace(/\.EA(\d+)/i, ' EA$1')
}

/**
 * @param {string|null|undefined} targetVersion
 * @param {string[]} selectedGroups
 */
export function matchesVersionGroups(targetVersion, selectedGroups) {
  if (!selectedGroups?.length) return true
  const g = extractVersionGroup(targetVersion)
  return g != null && selectedGroups.includes(g)
}
