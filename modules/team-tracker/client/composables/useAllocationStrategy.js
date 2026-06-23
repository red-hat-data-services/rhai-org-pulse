import { computed } from 'vue'
import { loadAllocationStrategy } from '@/platform-loader'

const strategy = loadAllocationStrategy()

export function useAllocationStrategy() {
  return {
    configured: computed(() => strategy !== null),
    strategyId: computed(() => strategy?.id ?? null),
    name: computed(() => strategy?.name ?? null),
    description: computed(() => strategy?.description ?? null),
    categories: computed(() => strategy?.categories ?? []),
    settingsComponent: computed(() => strategy?.settingsComponent ?? null)
  }
}
