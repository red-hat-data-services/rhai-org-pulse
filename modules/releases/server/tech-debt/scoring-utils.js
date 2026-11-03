const DAY_MS = 24 * 60 * 60 * 1000

const PRIORITY_BANDS = [
  { minimum: 85, level: 'P0', label: 'Immediate', expectedAction: 'Begin within 1–2 business days' },
  { minimum: 70, level: 'P1', label: 'Urgent', expectedAction: 'Begin within 2–4 business days' },
  { minimum: 50, level: 'P2', label: 'Planned', expectedAction: 'Commit to the current or next sprint' },
  { minimum: 30, level: 'P3', label: 'Monitor', expectedAction: 'Review within 30 days' },
  { minimum: 0, level: 'P4', label: 'Backlog', expectedAction: 'Review monthly' }
]

function utcDateOnly(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
  if (typeof value !== 'string') return null
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/)
  if (!match) return null
  const parsed = new Date(match[1] + 'T00:00:00Z')
  return Number.isNaN(parsed.getTime()) ? null : match[1]
}

function dayDifference(dateValue, asOfDate) {
  const date = utcDateOnly(dateValue)
  if (!date) return null
  return Math.round((Date.parse(date + 'T00:00:00Z') - Date.parse(asOfDate + 'T00:00:00Z')) / DAY_MS)
}

function scoreDeadline(value, asOfDate) {
  const date = utcDateOnly(value)
  const daysUntil = dayDifference(date, asOfDate)
  if (daysUntil === null) return { points: 0, state: 'Missing or invalid', date: null, daysUntil: null }
  if (daysUntil < 0) return { points: 15, state: 'Past due', date, daysUntil }
  if (daysUntil <= 7) return { points: 13, state: 'Due within 7 days', date, daysUntil }
  if (daysUntil <= 30) return { points: 9, state: 'Due in 8–30 days', date, daysUntil }
  if (daysUntil <= 90) return { points: 5, state: 'Due in 31–90 days', date, daysUntil }
  return { points: 2, state: 'Due after 90 days', date, daysUntil }
}

function scoreAge(createdAt, asOfDate) {
  const created = utcDateOnly(createdAt)
  if (!created) return { points: 0, state: 'Unknown', weeks: null, createdAt: null }
  const elapsedDays = Math.max(0, -dayDifference(created, asOfDate))
  const weeks = Math.floor(elapsedDays / 7)
  if (weeks >= 13) return { points: 5, state: '13+ weeks', weeks, createdAt: created }
  if (weeks >= 8) return { points: 4, state: '8–12 weeks', weeks, createdAt: created }
  if (weeks >= 4) return { points: 3, state: '4–7 weeks', weeks, createdAt: created }
  if (weeks >= 2) return { points: 2, state: '2–3 weeks', weeks, createdAt: created }
  return { points: 0, state: '0–1 week', weeks, createdAt: created }
}

function priorityBand(score) {
  return PRIORITY_BANDS.find(function (band) { return score >= band.minimum })
}

module.exports = { priorityBand, scoreAge, scoreDeadline, utcDateOnly }
