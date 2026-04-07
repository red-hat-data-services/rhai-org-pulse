import { computed } from 'vue'

/**
 * Builds governance stat cards from the leadership API response,
 * with an optional "Project Coverage" card appended.
 *
 * @param {import('vue').Ref} leadership  - ref to the leadership API response
 * @param {import('vue').Ref} dashboard   - ref to the dashboard API response (optional, for coverage card)
 * @param {import('vue').ComputedRef} projectCoveragePercent - precomputed coverage % (optional)
 */
export function useGovernanceCards(leadership, dashboard, projectCoveragePercent) {
  const governanceCards = computed(() => {
    const summary = leadership.value?.summary
    if (!summary) return []

    const cards = summary.governanceByType?.length > 0
      ? summary.governanceByType.filter(g => g.total > 0).map(g => ({
          ...g,
          percent: g.total > 0 ? (g.team / g.total) * 100 : 0,
          percentThreshold: g.positionType === 'reviewer' ? 5 : 10,
        }))
      : [
          ...(summary.totalApprovers > 0 ? [{ positionType: 'maintainer', label: 'Approvers', team: summary.teamApprovers, total: summary.totalApprovers, percent: summary.approverPercent, percentThreshold: 10 }] : []),
          ...(summary.totalReviewers > 0 ? [{ positionType: 'reviewer', label: 'Reviewers', team: summary.teamReviewers, total: summary.totalReviewers, percent: summary.reviewerPercent, percentThreshold: 5 }] : []),
        ].filter(c => c.total > 0)

    if (dashboard && projectCoveragePercent) {
      cards.push({
        positionType: 'coverage', label: 'Project Coverage',
        team: summary.projectsWithTeamLeadership || 0,
        total: dashboard.value?.summary?.trackedProjects || 0,
        percent: projectCoveragePercent.value,
        percentThreshold: 50,
      })
    }

    return cards
  })

  return { governanceCards }
}

export function uniqueRoles(member) {
  return [...new Set(member.roles?.map(r => r.role) || [])]
}
