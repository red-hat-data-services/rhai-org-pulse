export function parseDate(val) {
  if (!val) return null
  var str = (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) ? val + 'T00:00:00' : val
  var d = new Date(str)
  return isNaN(d.getTime()) ? null : d
}

export function todayMidnight() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export function daysFromNow(dateStr) {
  const d = parseDate(dateStr)
  if (!d) return null
  const today = todayMidnight()
  d.setHours(0, 0, 0, 0)
  return Math.ceil((d.getTime() - today.getTime()) / 86400000)
}

export function formatShort(dateStr, opts) {
  const d = parseDate(dateStr)
  if (!d) return '—'
  const format = { month: 'short', day: 'numeric' }
  if (opts && opts.year) format.year = 'numeric'
  return d.toLocaleDateString('en-US', format)
}

export function getProduct(release) {
  var shortname = release.productPagesShortname
  if (shortname && /^[a-z]+$/i.test(shortname)) return shortname
  var sources = [release.id, release.displayName]
  for (var i = 0; i < sources.length; i++) {
    if (!sources[i]) continue
    var match = sources[i].match(/([a-z]{4,})/i)
    if (match) return match[1].toLowerCase()
  }
  return release.id
}

export function releasePhase(release) {
  const ms = release.milestones || {}
  const phases = [
    { label: 'Planning', until: ms.planningFreeze },
    { label: 'Feature Dev', until: ms.featureFreeze },
    { label: 'Code Complete', until: ms.codeFreeze },
    { label: 'Release Prep', until: ms.ga },
    { label: 'Released', until: null }
  ]
  const today = todayMidnight()
  let phaseIndex = 0
  for (let i = 0; i < 4; i++) {
    const d = parseDate(phases[i].until)
    if (d && d.getTime() <= today.getTime()) {
      phaseIndex = i + 1
    }
  }
  return { phaseIndex, phases }
}

export function getStream(release) {
  var sources = [release.productPagesVersion, release.displayName, release.id]
  for (var i = 0; i < sources.length; i++) {
    if (!sources[i]) continue
    var match = sources[i].match(/(\d+\.\d+)/)
    if (match) return match[1]
  }
  return null
}

export function milestoneProgress(currentDate, prevDate) {
  const curr = parseDate(currentDate)
  if (!curr) return null
  const prev = prevDate ? parseDate(prevDate) : null
  const today = todayMidnight()
  if (today.getTime() >= curr.getTime()) return 100
  if (!prev) return null
  const total = curr.getTime() - prev.getTime()
  if (total <= 0) return 100
  const elapsed = today.getTime() - prev.getTime()
  if (elapsed <= 0) return 0
  return Math.min(100, Math.round((elapsed / total) * 100))
}
