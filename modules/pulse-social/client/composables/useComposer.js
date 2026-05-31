import { ref, computed } from 'vue'
import { apiRequest } from '@shared/client/services/api'

const API_BASE = '/modules/pulse-social'

const PLACEHOLDERS = [
  'What did you ship this week?',
  'Learn something interesting today?',
  'Want to recognize someone\'s work?',
  'Hit a milestone worth celebrating?',
  'Stuck on something? Ask the team.'
]

export function useComposer() {
  const body = ref('')
  const label = ref(null)
  const submitting = ref(false)
  const error = ref(null)

  const placeholder = ref(PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)])

  const canSubmit = computed(() => body.value.trim().length > 0 && !submitting.value)

  function selectLabel(newLabel) {
    if (label.value === newLabel) {
      label.value = null
    } else {
      label.value = newLabel
    }
  }

  function reset() {
    body.value = ''
    label.value = null
    error.value = null
    placeholder.value = PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)]
  }

  async function submit() {
    if (!canSubmit.value) return null
    submitting.value = true
    error.value = null

    try {
      const payload = {
        body: body.value.trim(),
        label: label.value,
        mentions: []
      }

      const post = await apiRequest(`${API_BASE}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      reset()
      return post
    } catch (err) {
      error.value = err.message
      console.error('[pulse-social] Submit error:', err)
      return null
    } finally {
      submitting.value = false
    }
  }

  return {
    body,
    label,
    submitting,
    error,
    placeholder,
    canSubmit,
    selectLabel,
    reset,
    submit
  }
}
