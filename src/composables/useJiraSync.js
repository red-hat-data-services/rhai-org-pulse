import { ref } from 'vue'
import { getJiraSyncConfig, saveJiraSyncConfig } from '../services/api'

const config = ref(null)
const loading = ref(false)
const saving = ref(false)

async function fetchConfig() {
  loading.value = true
  try {
    config.value = await getJiraSyncConfig()
  } catch (err) {
    console.error('Failed to fetch jira sync config:', err)
  } finally {
    loading.value = false
  }
}

async function saveConfig(data) {
  saving.value = true
  try {
    config.value = await saveJiraSyncConfig(data)
    return config.value
  } finally {
    saving.value = false
  }
}

export function useJiraSync() {
  return {
    config,
    loading,
    saving,
    fetchConfig,
    saveConfig
  }
}
