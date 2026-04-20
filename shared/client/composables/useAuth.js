import { ref, computed } from 'vue'
import { getApiBase } from '@shared/client/services/api'

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
      const res = await fetch(`${getApiBase()}/whoami`)
      if (res.ok) {
        user.value = await res.json()
      }
    } catch {
      // Server not available (local dev without backend)
    } finally {
      loading.value = false
    }
  }

  const isAdmin = computed(() => user.value?.isAdmin === true)
  const permissionTier = computed(() => user.value?.permissionTier || 'user')

  return {
    user,
    loading,
    isAdmin,
    permissionTier
  }
}
