import { ref } from 'vue'
import { apiRequest } from '@shared/client/services/api'

const MODULE_API = '/modules/upstream-pulse'

export function useStrategyPermissions() {
  const canManageStrategy = ref(false)
  const permissionsLoaded = ref(false)

  async function loadPermissions() {
    try {
      const data = await apiRequest(MODULE_API + '/strategy/permissions')
      canManageStrategy.value = data.canManageStrategy
    } catch {
      canManageStrategy.value = false
    } finally {
      permissionsLoaded.value = true
    }
  }

  return { canManageStrategy, permissionsLoaded, loadPermissions }
}
