import { ref, onMounted } from 'vue'

const ONBOARDING_KEY = 'customer-insights-onboarding-completed'

export function useOnboarding() {
  const showOnboarding = ref(false)
  const isOnboardingComplete = ref(false)

  onMounted(() => {
    isOnboardingComplete.value = localStorage.getItem(ONBOARDING_KEY) === 'true'
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
