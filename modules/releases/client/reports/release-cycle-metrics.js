const MILESTONE_FIELDS = [
  'build_ready_date',
  'test_started_date',
  'test_finished_date',
  'tfas_passed_date',
  'tfas_triaged_date',
  'blockers_resolved_date'
]

export function visibleReleaseCyclePhases(phases = []) {
  return phases.filter(phase => MILESTONE_FIELDS.some(field => Boolean(phase?.[field])))
}

export function missingMilestoneLabel(kind, phase = {}, context = {}) {
  if (kind === 'build_received') return 'Not recorded'
  if (kind === 'test_started') return 'Not started'
  if (kind === 'test_finished') return phase.test_started_date ? 'In progress' : 'Not started'
  if (kind === 'tfas_passed') return 'Pending'
  if (kind === 'tfas_triaged' && context.tfaTotal > 0) {
    return `${context.tfaDone || 0} / ${context.tfaTotal} done`
  }
  if (kind === 'blockers_resolved' && context.blockersOpen > 0) {
    return `${context.blockersOpen} open`
  }
  if (kind === 'blockers_resolved') return 'No open blockers'
  return 'Pending'
}
