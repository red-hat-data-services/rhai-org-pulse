import { ref, onMounted } from 'vue'

const ONBOARDING_KEY = 'customer-insights-onboarding-completed'

export function useOnboarding() {
  const showOnboarding = ref(false)
  const isOnboardingComplete = ref(false)

  onMounted(async () => {
    // Check if onboarding was completed before
    const completed = localStorage.getItem(ONBOARDING_KEY)

    if (completed === 'true') {
      isOnboardingComplete.value = true
      return
    }

    // Check if user has already connected Google Drive
    try {
      const response = await fetch('/api/modules/customer-insights/auth/google/status')
      const data = await response.json()

      if (data.connected) {
        // If already connected, check if spreadsheet is configured
        const configResponse = await fetch('/api/modules/customer-insights/spreadsheet/config')
        const configData = await configResponse.json()

        if (configData.spreadsheetId) {
          // Already fully configured, mark as complete
          markOnboardingComplete()
          return
        }
      }
    } catch (error) {
      console.error('Failed to check onboarding status:', error)
    }

    // Show onboarding if not complete
    showOnboarding.value = true
  })

  function markOnboardingComplete() {
    localStorage.setItem(ONBOARDING_KEY, 'true')
    isOnboardingComplete.value = true
    showOnboarding.value = false
  }

  function resetOnboarding() {
    localStorage.removeItem(ONBOARDING_KEY)
    isOnboardingComplete.value = false
    showOnboarding.value = true
  }

  return {
    showOnboarding,
    isOnboardingComplete,
    markOnboardingComplete,
    resetOnboarding
  }
}
