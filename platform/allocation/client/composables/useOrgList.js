import { ref } from 'vue'
import { apiRequest } from '@shared/client/services/api'

/**
 * Minimal org list loader for the allocation report.
 *
 * Replaces team-tracker's internal `useOrgRoster` composable (which this
 * extension must not deep-import). Fetches the org list over team-tracker's
 * public HTTP endpoint — the sanctioned cross-module data-read pattern — rather
 * than importing module internals.
 */
const orgs = ref([])

export function useOrgList() {
  async function loadOrgs() {
    try {
      const data = await apiRequest('/modules/team-tracker/org-list')
      orgs.value = data.orgs || []
    } catch (err) {
      console.warn('[allocation] Failed to load orgs:', err.message)
    }
  }

  return { orgs, loadOrgs }
}
