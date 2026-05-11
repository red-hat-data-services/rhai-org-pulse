import { ref, computed } from 'vue'
import { apiRequest } from '@shared/client/services/api'

const user = ref(null)
const loading = ref(true)

let initialized = false

export function useAuth() {
  if (!initialized) {
    initialized = true
    fetchCurrentUser()
  }

  async function fetchCurrentUser() {
    try {
      user.value = await apiRequest('/whoami')
    } catch {
      // Server not available (local dev without backend)
    } finally {
      loading.value = false
    }
  }

  async function refresh() {
    loading.value = true
    await fetchCurrentUser()
  }

  const isAdmin = computed(() => user.value?.isAdmin === true)
  const isTeamAdmin = computed(() => user.value?.isTeamAdmin === true || user.value?.isAdmin === true)
  const roles = computed(() => user.value?.roles || [])
  const permissionTier = computed(() => user.value?.permissionTier || 'user')

  return {
    user,
    loading,
    isAdmin,
    isTeamAdmin,
    roles,
    permissionTier,
    refresh
  }
}
