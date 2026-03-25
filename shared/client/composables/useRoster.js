import { ref, computed } from 'vue'
import { getRoster } from '../services/api'

const rosterData = ref(null)
const loading = ref(false)
const error = ref(null)
const selectedOrgKey = ref(null)

export function useRoster() {
  const orgs = computed(() => {
    if (!rosterData.value?.orgs) return []
    return rosterData.value.orgs
  })

  const visibleFields = computed(() => {
    return rosterData.value?.visibleFields || []
  })

  const primaryDisplayField = computed(() => {
    return rosterData.value?.primaryDisplayField || null
  })

  const selectedOrg = computed(() => {
    if (!selectedOrgKey.value) return null
    return orgs.value.find(o => o.key === selectedOrgKey.value) || null
  })

  const teams = computed(() => {
    // When no org is selected, show all teams across all orgs
    if (!selectedOrgKey.value) {
      const allTeams = []
      for (const org of orgs.value) {
        if (!org.teams) continue
        for (const [teamName, team] of Object.entries(org.teams)) {
          allTeams.push({
            key: `${org.key}::${teamName}`,
            displayName: team.displayName,
            members: team.members
          })
        }
      }
      return allTeams
    }
    const org = selectedOrg.value
    if (!org?.teams) return []
    return Object.entries(org.teams).map(([teamName, team]) => ({
      key: `${org.key}::${teamName}`,
      displayName: team.displayName,
      members: team.members
    }))
  })

  const multiTeamMembers = computed(() => {
    const nameCounts = {}
    for (const team of teams.value) {
      for (const member of team.members) {
        const name = member.jiraDisplayName
        nameCounts[name] = (nameCounts[name] || 0) + 1
      }
    }
    return new Set(
      Object.entries(nameCounts)
        .filter(([, count]) => count > 1)
        .map(([name]) => name)
    )
  })

  function getTeamsForPerson(jiraDisplayName) {
    return teams.value.filter(t =>
      t.members.some(m => m.jiraDisplayName === jiraDisplayName)
    )
  }

  const uniqueMemberCount = computed(() => {
    const names = new Set()
    for (const team of teams.value) {
      for (const member of team.members) {
        names.add(member.jiraDisplayName)
      }
    }
    return names.size
  })

  function selectOrg(orgKey) {
    selectedOrgKey.value = orgKey
  }

  async function reloadRoster() {
    rosterData.value = null
    return loadRoster()
  }

  async function loadRoster() {
    if (rosterData.value) return
    loading.value = true
    error.value = null
    try {
      await getRoster((data) => {
        rosterData.value = data
        if (!selectedOrgKey.value && data.orgs?.length > 0) {
          selectedOrgKey.value = data.orgs[0].key
        }
        loading.value = false
      })
    } catch (err) {
      error.value = err.message
      console.error('Failed to load roster:', err)
    } finally {
      loading.value = false
    }
  }

  return {
    rosterData,
    orgs,
    selectedOrg,
    selectedOrgKey,
    selectOrg,
    teams,
    loading,
    error,
    multiTeamMembers,
    getTeamsForPerson,
    uniqueMemberCount,
    visibleFields,
    primaryDisplayField,
    loadRoster,
    reloadRoster
  }
}
