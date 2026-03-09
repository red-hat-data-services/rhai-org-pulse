import { ref, computed } from 'vue'
import { getGithubContributions, refreshGithubContributions, refreshGithubContribution } from '../services/api'

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

  async function refreshStats() {
    loading.value = true
    try {
      await refreshGithubContributions()
      // Wait a moment for the background job to process, then reload
      setTimeout(async () => {
        try {
          githubData.value = await getGithubContributions()
        } finally {
          loading.value = false
        }
      }, 5000)
    } catch (err) {
      console.error('Failed to refresh GitHub stats:', err)
      loading.value = false
    }
  }

  async function refreshUserStats(username) {
    if (!username) return null
    try {
      const data = await refreshGithubContribution(username)
      if (data && githubData.value) {
        if (!githubData.value.users) githubData.value.users = {}
        githubData.value.users[username] = data
      }
      return data
    } catch (err) {
      console.error('Failed to refresh GitHub stats for', username, err)
      return null
    }
  }

  return {
    contributionsMap,
    getContributions,
    loadGithubStats,
    refreshStats,
    refreshUserStats,
    loading
  }
}
