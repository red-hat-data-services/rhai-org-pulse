// ─── Shared helpers (private) ───

function escapeCell(val) {
  return String(val).replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

function escapeCsv(val) {
  var s = String(val)
  if (/^[=+\-@\t\r]/.test(s)) {
    s = "'" + s
  }
  if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1 || s.indexOf('\r') !== -1) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

function normalizeComponents(components) {
  if (!components) return ''
  if (Array.isArray(components)) return components.join(', ')
  return String(components)
}

function riskLabel(feature) {
  // 1. If a risk override exists, use its riskOverride value
  if (feature.risk && feature.risk.override && feature.risk.override.riskOverride) {
    return feature.risk.override.riskOverride
  }
  // 2. Otherwise use the computed risk level
  if (feature.risk && feature.risk.level) {
    return feature.risk.level
  }
  // 3. Default to green
  return 'green'
}

function riskFlagCount(feature) {
  return feature.risk && feature.risk.flags ? feature.risk.flags.length : 0
}

function buildFilename(version, phase, ext) {
  var today = new Date().toISOString().split('T')[0]
  return 'release-health-' + version + '-' + phase.toLowerCase() + '-' + today + '.' + ext
}

function triggerDownload(blob, filename) {
  var url = URL.createObjectURL(blob)
  var a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function computePhaseSummary(features) {
  var totalFeatures = features.length
  var byRisk = { green: 0, yellow: 0, red: 0 }
  var dorSum = 0
  var riceSum = 0
  var riceCount = 0
  var blockedCount = 0
  var unestimatedCount = 0

  for (var i = 0; i < features.length; i++) {
    var f = features[i]
    var risk = riskLabel(f)
    if (byRisk[risk] !== undefined) byRisk[risk]++
    else byRisk[risk]++   // unexpected value -- still count

    dorSum += (f.dor && f.dor.completionPct) ? f.dor.completionPct : 0
    if (f.rice && f.rice.score != null) {
      riceSum += f.rice.score
      riceCount++
    }
    if (f.blockerCount > 0) blockedCount++

    // Feature is unestimated if it has the UNESTIMATED risk flag
    var flags = (f.risk && f.risk.flags) ? f.risk.flags : []
    for (var j = 0; j < flags.length; j++) {
      if (flags[j].category === 'UNESTIMATED') { unestimatedCount++; break }
    }
  }

  return {
    totalFeatures: totalFeatures,
    byRisk: byRisk,
    dorCompletionRate: totalFeatures > 0 ? Math.round(dorSum / totalFeatures) : 0,
    averageRiceScore: riceCount > 0 ? Math.round(riceSum / riceCount) : 0,
    blockedCount: blockedCount,
    unestimatedCount: unestimatedCount
  }
}

// ─── Exported functions ───

// eslint-disable-next-line no-unused-vars
export function exportHealthMarkdown({ version, phase, features, milestones, planningFreezes, cachedAt }) {
  var phaseSummary = computePhaseSummary(features)
  var generated = new Date().toISOString()
  var lines = []

  // Header
  lines.push('# Release Health Report: ' + version + ' -- ' + phase)
  lines.push('')
  lines.push('**Generated:** ' + generated)
  lines.push('**Data as of:** ' + (cachedAt || 'N/A'))
  lines.push('**Phase status:** Committed')
  lines.push('')
  lines.push('---')
  lines.push('')

  // Summary
  lines.push('## Summary')
  lines.push('')
  lines.push('| Metric | Value |')
  lines.push('|--------|-------|')
  lines.push('| Total Features | ' + phaseSummary.totalFeatures + ' |')
  lines.push('| Red Risk | ' + phaseSummary.byRisk.red + ' |')
  lines.push('| Yellow Risk | ' + phaseSummary.byRisk.yellow + ' |')
  lines.push('| Green Risk | ' + phaseSummary.byRisk.green + ' |')
  lines.push('| Avg DoR Completion | ' + phaseSummary.dorCompletionRate + '% |')
  lines.push('| Avg RICE Score | ' + phaseSummary.averageRiceScore + ' |')
  lines.push('| Blocked Features | ' + phaseSummary.blockedCount + ' |')
  lines.push('| Unestimated Features | ' + phaseSummary.unestimatedCount + ' |')
  lines.push('')

  // Milestones (conditional)
  if (milestones) {
    lines.push('## Milestones')
    lines.push('')
    lines.push('| Milestone | Date |')
    lines.push('|-----------|------|')
    lines.push('| EA1 Code Freeze | ' + (milestones.ea1Freeze || 'N/A') + ' |')
    lines.push('| EA1 Target | ' + (milestones.ea1Target || 'N/A') + ' |')
    lines.push('| EA2 Code Freeze | ' + (milestones.ea2Freeze || 'N/A') + ' |')
    lines.push('| EA2 Target | ' + (milestones.ea2Target || 'N/A') + ' |')
    lines.push('| GA Code Freeze | ' + (milestones.gaFreeze || 'N/A') + ' |')
    lines.push('| GA Target | ' + (milestones.gaTarget || 'N/A') + ' |')
    lines.push('')
  }

  lines.push('---')
  lines.push('')

  // Features table
  lines.push('## Features')
  lines.push('')
  lines.push('| Feature | Summary | Status | Risk | DoR % | Priority | RICE | Component | PM | Owner | Fix Version |')
  lines.push('|---------|---------|--------|------|-------|----------|------|-----------|-----|-------|-------------|')
  for (var i = 0; i < features.length; i++) {
    var f = features[i]
    lines.push('| ' + [
      escapeCell(f.key),
      escapeCell(f.summary || '-'),
      escapeCell(f.status || '-'),
      escapeCell(riskLabel(f).charAt(0).toUpperCase() + riskLabel(f).slice(1)),
      (f.dor ? f.dor.completionPct : 0) + '%',
      f.priorityScore != null ? f.priorityScore : '-',
      f.rice != null ? f.rice.score : '-',
      escapeCell(normalizeComponents(f.components) || '-'),
      escapeCell(f.pm || '-'),
      escapeCell(f.deliveryOwner || '-'),
      escapeCell(f.fixVersions || '-')
    ].join(' | ') + ' |')
  }
  lines.push('')
  lines.push('---')
  lines.push('')

  // Risk Flag Details
  lines.push('### Risk Flag Details')
  lines.push('')
  var hasAnyFlags = false
  for (var k = 0; k < features.length; k++) {
    var feat = features[k]
    if (feat.risk && feat.risk.flags && feat.risk.flags.length > 0) {
      hasAnyFlags = true
      var label = riskLabel(feat)
      lines.push('#### ' + feat.key + ' (' + label.charAt(0).toUpperCase() + label.slice(1) + ')')
      for (var m = 0; m < feat.risk.flags.length; m++) {
        var flag = feat.risk.flags[m]
        lines.push('- **' + flag.category + '**: ' + flag.message)
      }
      lines.push('')
    }
  }
  if (!hasAnyFlags) {
    lines.push('No risk flags.')
    lines.push('')
  }

  lines.push('---')
  lines.push('')
  lines.push('*Report generated by RHOAI Org Pulse*')
  lines.push('')

  var blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
  triggerDownload(blob, buildFilename(version, phase, 'md'))
}

// eslint-disable-next-line no-unused-vars
export function exportHealthCsv({ version, phase, features, cachedAt }) {
  var phaseSummary = computePhaseSummary(features)
  var rows = []

  // Header row
  rows.push([
    'Feature', 'Summary', 'Status', 'Risk', 'DoR %', 'Priority Score',
    'RICE Score', 'Big Rock', 'Component', 'PM', 'Delivery Owner',
    'Fix Version', 'Target Release', 'Completion %', 'Blockers', 'Risk Flags'
  ])

  // Summary row
  rows.push([
    'SUMMARY: ' + version + ' ' + phase,
    'Total: ' + phaseSummary.totalFeatures + ' features',
    'Red: ' + phaseSummary.byRisk.red + ' / Yellow: ' + phaseSummary.byRisk.yellow + ' / Green: ' + phaseSummary.byRisk.green,
    'Avg DoR: ' + phaseSummary.dorCompletionRate + '%',
    '',
    'Avg RICE: ' + phaseSummary.averageRiceScore,
    '',
    'Blocked: ' + phaseSummary.blockedCount,
    'Unestimated: ' + phaseSummary.unestimatedCount,
    '',
    '',
    '',
    '',
    '',
    '',
    ''
  ])

  // Data rows
  for (var i = 0; i < features.length; i++) {
    var f = features[i]
    rows.push([
      f.key,
      f.summary || '',
      f.status || '',
      riskLabel(f),
      f.dor ? f.dor.completionPct : 0,
      f.priorityScore != null ? f.priorityScore : '',
      f.rice != null ? f.rice.score : '',
      f.bigRock || '',
      normalizeComponents(f.components),
      f.pm || '',
      f.deliveryOwner || '',
      f.fixVersions || '',
      f.targetRelease || '',
      f.completionPct != null ? f.completionPct : '',
      f.blockerCount != null ? f.blockerCount : 0,
      riskFlagCount(f)
    ])
  }

  var csv = rows.map(function(row) { return row.map(escapeCsv).join(',') }).join('\n')
  var blob = new Blob([csv + '\n'], { type: 'text/csv' })
  triggerDownload(blob, buildFilename(version, phase, 'csv'))
}

// Export helpers for testing
export { computePhaseSummary, normalizeComponents, riskLabel }
