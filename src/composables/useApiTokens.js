import { ref } from 'vue'
import { apiRequest } from '@shared/client/services/api'

// Module-scoped refs — intentional singleton pattern so all consumers
// share the same token cache (same approach as useAllowlist)
const tokens = ref([])
const allTokens = ref([])
const loading = ref(false)
const error = ref(null)

export function useApiTokens() {
  async function loadTokens() {
    loading.value = true
    error.value = null
    try {
      const data = await apiRequest('/tokens')
      tokens.value = data.tokens || []
    } catch (err) {
      error.value = err.message
      console.error('Failed to load tokens:', err)
    } finally {
      loading.value = false
    }
  }

  async function loadAllTokens() {
    try {
      const data = await apiRequest('/admin/tokens')
      allTokens.value = data.tokens || []
    } catch (err) {
      console.error('Failed to load all tokens:', err)
    }
  }

  async function createToken(name, expiresIn) {
    const data = await apiRequest('/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, expiresIn })
    })
    await loadTokens()
    return data
  }

  async function revokeToken(id) {
    await apiRequest(`/tokens/${id}`, { method: 'DELETE' })
    await loadTokens()
  }

  async function adminRevokeToken(id) {
    await apiRequest(`/admin/tokens/${id}`, { method: 'DELETE' })
    await loadAllTokens()
    await loadTokens()
  }

  return {
    tokens,
    allTokens,
    loading,
    error,
    loadTokens,
    loadAllTokens,
    createToken,
    revokeToken,
    adminRevokeToken
  }
}
