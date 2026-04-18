const STRATEGIC_LABELS = {
  evaluating_participation: 'Evaluating Participation',
  sustaining_participation: 'Sustaining Participation',
  increasing_participation: 'Increasing Participation',
  evaluating_leadership: 'Evaluating Leadership',
  sustaining_leadership: 'Sustaining Leadership',
  increasing_leadership: 'Increasing Leadership',
}

const STRATEGIC_BADGE_CLASSES = {
  evaluating_participation: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  sustaining_participation: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  increasing_participation: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  evaluating_leadership: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  sustaining_leadership: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  increasing_leadership: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
}

const STRATEGIC_DESCRIPTIONS = {
  evaluating_participation: 'Red Hat is evaluating whether to increase participation in this project',
  sustaining_participation: 'Red Hat is sustaining current participation levels in this project',
  increasing_participation: 'Red Hat is actively increasing participation in this project',
  evaluating_leadership: 'Red Hat is evaluating whether to pursue leadership positions in this project',
  sustaining_leadership: 'Red Hat is sustaining current leadership presence in this project',
  increasing_leadership: 'Red Hat is actively pursuing more leadership positions in this project',
}

export function getStrategicLabel(strategic) {
  return STRATEGIC_LABELS[strategic] || strategic || ''
}

export function getStrategicBadgeClass(strategic) {
  return STRATEGIC_BADGE_CLASSES[strategic] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
}

export function getStrategicDescription(strategic) {
  return STRATEGIC_DESCRIPTIONS[strategic] || ''
}

export function getEngagementStatus(leadershipCount, maintainerCount, total) {
  const hasGovernance = leadershipCount > 0 || maintainerCount > 0
  const highGovernance = leadershipCount >= 3 || maintainerCount >= 5

  if (total === 0 && !hasGovernance) {
    return {
      label: 'New Entrant',
      classes: 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600',
      description: 'No contributions or governance positions yet',
    }
  }
  if (highGovernance) {
    return {
      label: 'Established Leader',
      classes: 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700',
      description: 'Significant influence with 3+ leadership positions or 5+ maintainers',
    }
  }
  if (hasGovernance) {
    return {
      label: 'Core Contributor',
      classes: 'text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-700',
      description: 'Active participation with leadership or maintainer positions',
    }
  }
  return {
    label: 'Active',
    classes: 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600',
    description: 'Contributing code without formal governance positions',
  }
}
