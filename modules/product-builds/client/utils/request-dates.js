// Business-day date helpers for the AIPCC-E request forms. Mirror the
// server checks in server/request-common.js (Mon-Fri, UTC, no holidays).

export function isoBusinessDaysFromNow(days, now = new Date()) {
  const d = new Date(now)
  d.setUTCHours(0, 0, 0, 0)
  let added = 0
  while (added < days) {
    d.setUTCDate(d.getUTCDate() + 1)
    const day = d.getUTCDay()
    if (day !== 0 && day !== 6) added++
  }
  return d.toISOString().slice(0, 10)
}

export function formatDateLabel(isoDate) {
  return new Date(isoDate + 'T00:00:00Z').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'
  })
}
