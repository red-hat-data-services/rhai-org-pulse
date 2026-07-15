const GROUPS = [
  {
    id: 'rfe-revision',
    label: 'RFEs needing revision',
    stages: ['rfe-needs-revision', 'rfe-feasibility']
  },
  {
    id: 'rfe-scope',
    label: 'RFEs ready — add scope or wait for STRAT',
    stages: ['rfe-ready-no-scope', 'rfe-waiting-strat']
  },
  {
    id: 'metadata',
    label: 'Fix metadata before planning',
    stages: ['planning-ready-blocked']
  },
  {
    id: 'signoff',
    label: 'Awaiting strategy sign-off (escalate)',
    stages: ['strat-awaiting-signoff']
  },
  {
    id: 'strat-fix',
    label: 'Strategy needs engineering fixes',
    stages: ['strat-needs-attention']
  },
  {
    id: 'release-gate',
    label: 'Planning gate failed or pending',
    stages: ['release-gate-failed', 'release-gate-pending']
  },
  {
    id: 'epics',
    label: 'Waiting on epic decomposition',
    stages: ['epics-pending', 'epics-decomp-failed']
  }
]

export function groupActionItems(items) {
  const groups = GROUPS.map(g => ({ ...g, items: [] }))
  const byStage = new Map(groups.map(g => [g.id, g]))

  for (const item of items) {
    const match = GROUPS.find(g => g.stages.includes(item.stage.id))
    if (match) {
      byStage.get(match.id).items.push(item)
    } else if (item.pmActionable) {
      let misc = byStage.get('misc')
      if (!misc) {
        misc = { id: 'misc', label: 'Other action needed', items: [], stages: [] }
        groups.push(misc)
        byStage.set('misc', misc)
      }
      misc.items.push(item)
    }
  }

  return groups.filter(g => g.items.length > 0)
}

export function pickHeroItem(actionItems) {
  if (!actionItems.length) return null
  return [...actionItems].sort((a, b) => {
    const wait = b.waitDays - a.waitDays
    if (wait !== 0) return wait
    const priority = { Blocker: 0, Critical: 1, High: 2, Major: 3, Normal: 5 }
    return (priority[a.priority] ?? 9) - (priority[b.priority] ?? 9)
  })[0]
}

export function stageAccentClass(item) {
  if (item.pmActionable) return 'border-l-red-500'
  if (item.stage.phase === 4) return 'border-l-green-500'
  return 'border-l-amber-500'
}
