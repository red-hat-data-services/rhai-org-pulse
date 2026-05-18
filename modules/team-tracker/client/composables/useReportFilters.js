import { ref, computed, watch } from 'vue'
import { useRoster } from '@shared/client/composables/useRoster'

// Module-level singleton filter state (intentional -- provides continuity
// across reports). Reports needing independent state declare `filters: []`
// in the registry and manage their own selections internally.
const selectedOrgKeys = ref([])
const selectedTeamKeys = ref([])

export function useReportFilters() {
  const { orgs, loadRoster } = useRoster()

  // Ensure roster data is loaded (defensive -- App.vue also calls this,
  // but loadRoster() is a no-op if data is already present)
  loadRoster()

  // Derive full team list from orgs -- DO NOT use useRoster().teams
  // because it is pre-filtered by the singleton selectedOrgKey ref.
  // Each team object includes `members` (needed by TeamComparisonReport
  // for GitHub/GitLab contribution summation) and `memberCount` (shown
  // as a badge in TeamFilter).
  const allTeams = computed(() => {
    const result = []
    for (const org of orgs.value) {
      if (!org.teams) continue
      for (const [name, team] of Object.entries(org.teams)) {
        const members = team.members || []
        result.push({
          key: `${org.key}::${name}`,
          displayName: team.displayName,
          orgKey: org.key,
          orgDisplayName: org.displayName || org.key,
          members,
          memberCount: members.length,
        })
      }
    }
    return result.sort((a, b) => a.displayName.localeCompare(b.displayName))
  })

  const availableTeams = computed(() => {
    if (selectedOrgKeys.value.length === 0) return allTeams.value
    return allTeams.value.filter(t =>
      selectedOrgKeys.value.includes(t.orgKey)
    )
  })

  // When orgs change, retain team selections that are still valid.
  // This is an intentional improvement over the old TrendsView behavior
  // which fully cleared all team selections on any org change.
  // Retaining valid selections is better UX: e.g., if a user has teams
  // selected across two orgs and deselects one org, the teams from the
  // remaining org stay selected.
  watch(selectedOrgKeys, () => {
    selectedTeamKeys.value = selectedTeamKeys.value.filter(
      tk => availableTeams.value.some(t => t.key === tk)
    )
  })

  return {
    orgs,
    selectedOrgKeys,
    selectedTeamKeys,
    allTeams,
    availableTeams,
  }
}
