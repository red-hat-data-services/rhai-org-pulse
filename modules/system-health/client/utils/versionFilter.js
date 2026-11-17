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
 * Collect cleaned versions from heatmap component day.by_vr keys.
 * Only includes entries with total > 0 (matches dashboard filter population).
 */
export function collectVersionsFromComponents(components) {
  const set = new Set()
  ;(components || []).forEach((comp) => {
    Object.values(comp.days || {}).forEach((day) => {
      Object.entries(day.by_vr || {}).forEach(([k, vr]) => {
        if ((vr?.total || 0) <= 0) return
        const cleaned = cleanVer(k.split('|')[0])
        if (cleaned && cleaned !== 'unknown') set.add(cleaned)
      })
    })
  })
  return Array.from(set).sort(compareVers)
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
