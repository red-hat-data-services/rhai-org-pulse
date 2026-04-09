import { ref, computed } from 'vue'
import { getGitlabContributions } from '../services/api'

const gitlabData = ref(null)
const loading = ref(false)

export function useGitlabStats() {
  const contributionsMap = computed(() => {
    if (!gitlabData.value?.users) return {}
    return gitlabData.value.users
  })

  function getContributions(gitlabUsername) {
    if (!gitlabUsername) return null
    return contributionsMap.value[gitlabUsername] || null
  }

  async function loadGitlabStats() {
    if (gitlabData.value) return
    loading.value = true
    try {
      await getGitlabContributions((data) => {
        gitlabData.value = data
        loading.value = false
      })
    } catch (err) {
      console.error('Failed to load GitLab stats:', err)
    } finally {
      loading.value = false
    }
  }

  function setUserContributions(username, data) {
    if (!gitlabData.value) gitlabData.value = { users: {} }
    if (!gitlabData.value.users) gitlabData.value.users = {}
    gitlabData.value.users[username] = data
  }

  function getProfileUrls(gitlabUsername) {
    const contrib = getContributions(gitlabUsername)
    if (!contrib) return []
    if (!contrib.instances || contrib.instances.length === 0) {
      return [{ baseUrl: 'https://gitlab.com', label: 'GitLab', url: `https://gitlab.com/${gitlabUsername}` }]
    }
    return contrib.instances.map(i => ({
      baseUrl: i.baseUrl,
      label: i.label,
      url: `${i.baseUrl}/${gitlabUsername}`
    }))
  }

  return {
    contributionsMap,
    getContributions,
    loadGitlabStats,
    setUserContributions,
    getProfileUrls,
    loading
  }
}
