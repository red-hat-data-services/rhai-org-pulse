import { ref, computed } from 'vue'
import { getGithubContributions } from '../services/api'

const githubData = ref(null)
const loading = ref(false)

export function useGithubStats() {
  const contributionsMap = computed(() => {
    if (!githubData.value?.users) return {}
    return githubData.value.users
  })

  function getContributions(githubUsername) {
    if (!githubUsername) return null
    return contributionsMap.value[githubUsername] || null
  }

  async function loadGithubStats() {
    if (githubData.value) return
    loading.value = true
    try {
      await getGithubContributions((data) => {
        githubData.value = data
        loading.value = false
      })
    } catch (err) {
      console.error('Failed to load GitHub stats:', err)
    } finally {
      loading.value = false
    }
  }

  function setUserContributions(username, data) {
    if (!githubData.value) githubData.value = { users: {} }
    if (!githubData.value.users) githubData.value.users = {}
    githubData.value.users[username] = data
  }

  async function reloadGithubStats() {
    githubData.value = null
    return loadGithubStats()
  }

  return {
    contributionsMap,
    getContributions,
    loadGithubStats,
    reloadGithubStats,
    setUserContributions,
    loading
  }
}
