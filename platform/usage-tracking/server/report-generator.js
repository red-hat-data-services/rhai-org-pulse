function parseEvents(rawContent) {
  if (!rawContent) return []
  return rawContent
    .split('\n')
    .filter(Boolean)
    .map(function (line) {
      try { return JSON.parse(line) } catch { return null }
    })
    .filter(Boolean)
}

const KNOWN_MODULES = [
  'ai-impact', 'releases', 'system-health', 'team-tracker',
  'upstream-pulse', 'okr-hub', 'customer-insights', 'product-builds',
  'workflow-validation', 'ai-catalyst'
]

function generateReport(allEvents, periodStart, periodEnd, knownModules) {
  const byModule = Object.create(null)
  const byPersona = Object.create(null)
  const users = new Set()
  const userVisits = Object.create(null)
  const aiImpactViews = Object.create(null)
  const aiImpactInteractions = Object.create(null)
  const aiImpactByPersona = Object.create(null)
  const navigationFlows = Object.create(null)
  const allModules = new Set()

  for (const event of allEvents) {
    const { module, view, action, persona, userId } = event
    if (!module || !action) continue
    allModules.add(module)

    if (!byModule[module]) byModule[module] = { visits: 0, interactions: 0, users: new Set() }
    if (!byPersona[persona || 'unknown']) byPersona[persona || 'unknown'] = { visits: 0, interactions: 0, users: new Set() }

    users.add(userId)
    byModule[module].users.add(userId)
    byPersona[persona || 'unknown'].users.add(userId)

    if (action === 'view') {
      byModule[module].visits++
      byPersona[persona || 'unknown'].visits++
      if (!userVisits[userId]) userVisits[userId] = 0
      userVisits[userId]++
    } else {
      byModule[module].interactions++
      byPersona[persona || 'unknown'].interactions++
    }

    if (module === 'ai-impact') {
      if (action === 'view') {
        if (!aiImpactViews[view]) aiImpactViews[view] = { visits: 0, interactions: 0, users: new Set() }
        aiImpactViews[view].visits++
        aiImpactViews[view].users.add(userId)
      } else {
        if (!aiImpactInteractions[view]) aiImpactInteractions[view] = { visits: 0, interactions: 0, users: new Set() }
        aiImpactInteractions[view].interactions++
        aiImpactInteractions[view].users.add(userId)
      }

      const pKey = persona || 'unknown'
      if (!aiImpactByPersona[pKey]) aiImpactByPersona[pKey] = Object.create(null)
      if (!aiImpactByPersona[pKey][view]) aiImpactByPersona[pKey][view] = 0
      if (action === 'view') aiImpactByPersona[pKey][view]++

      if (action === 'navigate' && event.target) {
        const flowKey = `${view} → ${event.target}`
        navigationFlows[flowKey] = (navigationFlows[flowKey] || 0) + 1
      }
    }
  }

  const totalVisits = Object.values(byModule).reduce(function (s, m) { return s + m.visits }, 0)
  const totalInteractions = Object.values(byModule).reduce(function (s, m) { return s + m.interactions }, 0)
  const repeatUsers = Object.values(userVisits).filter(function (v) { return v >= 2 }).length

  const lines = []
  lines.push('═══════════════════════════════════════════════════')
  lines.push(`  Org Pulse Usage Report — ${periodStart} to ${periodEnd}`)
  lines.push('═══════════════════════════════════════════════════')
  lines.push('')
  lines.push('SUMMARY')
  lines.push(`  Total visits:        ${totalVisits}`)
  lines.push(`  Total interactions:  ${totalInteractions}`)
  lines.push(`  Distinct users:      ${users.size}`)
  lines.push(`  Repeat users (2+):   ${repeatUsers}`)

  lines.push('')
  lines.push('BY MODULE')
  const sortedModules = Object.entries(byModule).sort(function (a, b) { return b[1].visits - a[1].visits })
  for (const [mod, stats] of sortedModules) {
    lines.push(`  ${mod.padEnd(22)} ${String(stats.visits).padStart(4)} visits   ${String(stats.interactions).padStart(5)} interactions   ${String(stats.users.size).padStart(3)} users`)
  }

  const aiViews = Object.assign(Object.create(null), aiImpactViews)
  for (const [view, stats] of Object.entries(aiImpactInteractions)) {
    if (!aiViews[view]) aiViews[view] = { visits: 0, interactions: 0, users: new Set() }
    aiViews[view].interactions += stats.interactions
    for (const u of stats.users) aiViews[view].users.add(u)
  }

  if (Object.keys(aiViews).length > 0) {
    lines.push('')
    lines.push('AI IMPACT BREAKDOWN')
    lines.push('  View                 Visits  Interactions  Users')
    lines.push('  ──────────────────   ──────  ────────────  ─────')
    const sortedViews = Object.entries(aiViews).sort(function (a, b) { return b[1].visits - a[1].visits })
    for (const [view, stats] of sortedViews) {
      lines.push(`  ${view.padEnd(22)} ${String(stats.visits).padStart(5)}  ${String(stats.interactions).padStart(12)}  ${String(stats.users.size).padStart(5)}`)
    }
  }

  lines.push('')
  lines.push('BY PERSONA')
  lines.push('  Persona               Visits  Interactions  Users')
  lines.push('  ────────────────────   ──────  ────────────  ─────')
  const sortedPersonas = Object.entries(byPersona).sort(function (a, b) { return b[1].visits - a[1].visits })
  for (const [persona, stats] of sortedPersonas) {
    lines.push(`  ${persona.padEnd(22)} ${String(stats.visits).padStart(5)}  ${String(stats.interactions).padStart(12)}  ${String(stats.users.size).padStart(5)}`)
  }

  if (Object.keys(navigationFlows).length > 0) {
    lines.push('')
    lines.push('AI IMPACT NAVIGATION FLOWS')
    const sortedFlows = Object.entries(navigationFlows).sort(function (a, b) { return b[1] - a[1] })
    for (const [flow, count] of sortedFlows.slice(0, 10)) {
      lines.push(`  ${flow.padEnd(35)} ${count} transitions`)
    }
  }

  const trackedModules = new Set(Object.keys(byModule))
  const untrackedModules = (knownModules || KNOWN_MODULES).filter(function (m) { return !trackedModules.has(m) })
  if (untrackedModules.length > 0) {
    lines.push('')
    lines.push('MEASUREMENT GAPS')
    for (const m of untrackedModules) {
      lines.push(`  - ${m}: no tracking data`)
    }
  }

  lines.push('')
  lines.push('═══════════════════════════════════════════════════')
  lines.push(`  Generated: ${new Date().toISOString()}`)
  lines.push(`  Period: ${periodStart} to ${periodEnd}`)
  lines.push('═══════════════════════════════════════════════════')

  return lines.join('\n')
}

async function runReportGeneration(context) {
  const { storage } = context
  const now = new Date()
  const allEvents = []

  for (let i = 0; i < 7; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dateKey = d.toISOString().slice(0, 10)
    const raw = await storage.readRawFromStorage(`usage/events-${dateKey}.jsonl`)
    if (raw) {
      for (const event of parseEvents(raw)) allEvents.push(event)
    }
  }

  const periodEnd = now.toISOString().slice(0, 10)
  const periodStartDate = new Date(now)
  periodStartDate.setDate(periodStartDate.getDate() - 6)
  const periodStart = periodStartDate.toISOString().slice(0, 10)

  const report = generateReport(allEvents, periodStart, periodEnd)

  await storage.writeRawToStorage('usage/report-latest.txt', report)
  await storage.writeRawToStorage(`usage/report-${periodEnd}.txt`, report)

  return { eventCount: allEvents.length, periodStart, periodEnd }
}

module.exports = { generateReport, parseEvents, runReportGeneration }
