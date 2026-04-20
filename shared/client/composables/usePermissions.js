import { ref, computed } from 'vue'
import { apiRequest } from '@shared/client/services/api'

const permissionData = ref(null)
const loading = ref(true)

let initialized = false

export function usePermissions() {
  if (!initialized) {
    initialized = true
    fetchPermissions()
  }

  async function fetchPermissions() {
    try {
      const data = await apiRequest('/modules/team-tracker/permissions/me')
      permissionData.value = data
    } catch {
      // Server not available
    } finally {
      loading.value = false
    }
  }

  const tier = computed(() => permissionData.value?.tier || 'user')
  const managedUids = computed(() => new Set(permissionData.value?.managedUids || []))
  const userUid = computed(() => permissionData.value?.uid || null)
  const isAdmin = computed(() => tier.value === 'admin')
  const isManager = computed(() => tier.value === 'manager' || tier.value === 'admin')

  function canEdit(uid) {
    if (isAdmin.value) return true
    return managedUids.value.has(uid)
  }

  function canEditTeam(_teamId) {
    return isAdmin.value
  }

  return {
    loading,
    tier,
    managedUids,
    userUid,
    isAdmin,
    isManager,
    canEdit,
    canEditTeam,
    refresh: fetchPermissions
  }
}
