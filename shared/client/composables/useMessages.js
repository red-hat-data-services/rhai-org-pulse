import { ref, computed } from 'vue'
import { apiRequest } from '@shared/client/services/api'
import { useAuth } from './useAuth'

const allMessages = ref([])
const dismissedIds = ref(new Set())

function storageKey(email) {
  return `app_messages_dismissed:${email || 'anonymous'}`
}

function loadDismissed(email) {
  try {
    const raw = sessionStorage.getItem(storageKey(email))
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

function saveDismissed(email, ids) {
  try {
    sessionStorage.setItem(storageKey(email), JSON.stringify([...ids]))
  } catch {
    // Silently ignore -- alert will reappear but app won't crash
  }
}

export function useMessages() {
  const { user } = useAuth()

  async function fetchMessages() {
    try {
      const data = await apiRequest('/messages')
      allMessages.value = data.messages || []
    } catch {
      allMessages.value = []
    }
    dismissedIds.value = loadDismissed(user.value?.email)
  }

  function dismiss(id) {
    dismissedIds.value.add(id)
    dismissedIds.value = new Set(dismissedIds.value) // trigger Vue reactivity
    saveDismissed(user.value?.email, dismissedIds.value)
  }

  const messages = computed(() =>
    allMessages.value.filter(m => !dismissedIds.value.has(m.id))
  )

  return { messages, fetchMessages, dismiss }
}
