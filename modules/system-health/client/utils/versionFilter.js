/**
 * Version helpers for the Test Execution dashboard.
 *
 * Semantics (match test-reports-dashboard static UI):
 *   - Exact filter: 3.5 ≠ 3.5.2
 *   - Patch .0 collapses to y-stream: 3.5.0 ≡ 3.5
 *   - Trend charts still group by y-stream family via yStreamVer()
 */

/** Strip -ea suffix; collapse x.y.0 → x.y; keep real patches like x.y.1. */
export function cleanVer(v) {
  const b = String(v || '').split('-')[0]
  const p = b.split('.').filter(Boolean)
  if (p.length >= 3) {
    if (p[2] === '0' || p[2] === '00') return `${p[0]}.${p[1]}`
    return `${p[0]}.${p[1]}.${p[2]}`
  }
  if (p.length >= 2) return `${p[0]}.${p[1]}`
  return b
}

/** Y-stream family (3.5.2 → 3.5). Used for trend charts and Jira xy keys. */
export function yStreamVer(v) {
  const c = cleanVer(v)
  const p = c.split('.')
  return p.length >= 2 ? `${p[0]}.${p[1]}` : c
}

/** @deprecated Prefer cleanVer for filters; kept as alias for call sites that meant y-stream. */
export function normalizeVersion(v) {
  return yStreamVer(v)
}

export function compareVers(a, b) {
  const pa = String(a).split('.').map(Number)
  const pb = String(b).split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0)
    if (d) return d
  }
  return 0
}

/**
 * True for real RHOAI versions. Ingest writes `unknown` when a Jenkins build
 * has no RHOAI_VERSION / path / image / branch — never offer that in pickers.
 */
export function isKnownVersion(v) {
  const c = cleanVer(v)
  return Boolean(c) && c.toLowerCase() !== 'unknown'
}

/** True for real release milestones (EA1/EA2/GA). Drops ingest sentinel `unknown`. */
export function isKnownRelease(r) {
  const s = String(r || '').trim()
  return Boolean(s) && s.toLowerCase() !== 'unknown'
}

/** Exact version match: 3.5 ≡ 3.5.0; 3.5 ≠ 3.5.2. */
export function versionMatches(raw, filter) {
  if (!filter || filter === 'All') return true
  return cleanVer(raw) === cleanVer(filter)
}

export function isZStream(v) {
  return cleanVer(v).split('.').filter(Boolean).length >= 3
}

export function vrKeyMatches(vrKey, version, release) {
  const [v, r] = String(vrKey || '').split('|')
  if (!versionMatches(v, version)) return false
  if (release && release !== 'All' && r !== release) return false
  return true
}

/**
 * Match a Jenkins job URL folder segment to the selected RHOAI version.
 * Exact: /3.5/ or /3.5.0/ match y-stream 3.5; /3.5.2/ does not.
 * Matches test-reports-dashboard `urlMatchesVersion`.
 */
export function urlMatchesVersion(url, ver) {
  if (!ver || ver === 'All') return true
  const cleaned = cleanVer(ver).toLowerCase()
  if (!cleaned) return true
  const esc = cleaned.replace(/\./g, '\\.')
  const u = String(url || '').toLowerCase()
  if (cleaned.split('.').length === 2) {
    return new RegExp(`/${esc}(?:\\.0)?(?:/|-|$)`).test(u)
  }
  return new RegExp(`/${esc}(?:/|-|$)`).test(u)
}

/**
 * Match release milestone encoded in the Jenkins path (-ea.1 / -ea.2 / GA).
 * GA = path has no `-ea.` segment. Matches test-reports-dashboard gate filter.
 */
export function urlMatchesRelease(url, release) {
  if (!release || release === 'All') return true
  const u = String(url || '').toLowerCase()
  const relLower = String(release).toLowerCase()
  if (relLower === 'ga') return !u.includes('-ea.')
  if (relLower.startsWith('ea')) {
    const eaNum = relLower.replace('ea', '')
    return u.includes(`-ea.${eaNum}`)
  }
  return true
}

/**
 * Keep quality-gate executions whose jenkins_url matches version/release.
 * Recalculates passed/failed/skipped/total from the filtered set.
 * Returns null when nothing matches (caller should drop the day cell).
 */
export function filterGateDayByVersionRelease(dayData, version, release) {
  if (!dayData) return null
  const executions = Array.isArray(dayData.executions) ? dayData.executions : []
  if (executions.length === 0) {
    if ((!version || version === 'All') && (!release || release === 'All')) return dayData
    return null
  }
  if ((!version || version === 'All') && (!release || release === 'All')) return dayData

  const filtered = executions.filter((ex) => {
    if (!ex?.jenkins_url) return true
    return urlMatchesVersion(ex.jenkins_url, version) && urlMatchesRelease(ex.jenkins_url, release)
  })
  if (filtered.length === 0) return null

  let passed = 0
  let failed = 0
  let skipped = 0
  let total = 0
  filtered.forEach((ex) => {
    passed += ex.passed || 0
    failed += ex.failed || 0
    skipped += ex.skipped || 0
    total += ex.total || ((ex.passed || 0) + (ex.failed || 0) + (ex.skipped || 0))
  })
  return { passed, failed, skipped, total, executions: filtered }
}

/**
 * Collect cleaned versions from heatmap component day.by_vr keys.
 * Only includes entries with total > 0 (matches dashboard filter population).
 * Never includes ingest sentinel `unknown`.
 */
export function collectVersionsFromComponents(components) {
  const set = new Set()
  ;(components || []).forEach((comp) => {
    Object.values(comp.days || {}).forEach((day) => {
      Object.entries(day.by_vr || {}).forEach(([k, vr]) => {
        if ((vr?.total || 0) <= 0) return
        const cleaned = cleanVer(k.split('|')[0])
        if (isKnownVersion(cleaned)) set.add(cleaned)
      })
    })
  })
  return Array.from(set).sort(compareVers)
}

/**
 * Collect release milestones from by_vr keys (EA1/EA2/GA).
 * Never includes ingest sentinel `unknown`.
 */
export function collectReleasesFromComponents(components) {
  const set = new Set()
  ;(components || []).forEach((comp) => {
    Object.values(comp.days || {}).forEach((day) => {
      Object.entries(day.by_vr || {}).forEach(([k, vr]) => {
        if ((vr?.total || 0) <= 0) return
        const r = k.split('|')[1]
        if (isKnownRelease(r)) set.add(r)
      })
    })
  })
  return Array.from(set).sort()
}

export function yStreamList(versions) {
  const ys = new Set()
  ;(versions || []).forEach((v) => ys.add(yStreamVer(v)))
  return Array.from(ys).sort(compareVers)
}

export function zStreamList(versions, y) {
  const zs = []
  ;(versions || []).forEach((v) => {
    if (yStreamVer(v) === y) zs.push(v)
  })
  if (!zs.includes(y)) zs.push(y)
  return zs.sort(compareVers).reverse()
}
