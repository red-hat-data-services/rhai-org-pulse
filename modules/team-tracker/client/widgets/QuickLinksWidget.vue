<script setup>
import { computed } from 'vue'
import { useModuleLink } from '@shared/client/composables/useModuleLink.js'
import { useAuth } from '@shared/client/composables/useAuth.js'

defineProps({
  size: { type: String, default: 'half' }
})

const { navigateTo: crossNavigate } = useModuleLink()
const { isManager } = useAuth()

const allLinks = [
  {
    id: 'manager-dashboard',
    label: 'My Teams',
    description: 'View your full manager dashboard',
    viewId: 'manager-dashboard',
    icon: 'dashboard',
    requireRole: 'manager'
  },
  {
    id: 'team-directory',
    label: 'Team Directory',
    description: 'Browse all teams and people',
    viewId: 'home',
    icon: 'users'
  },
  {
    id: 'people',
    label: 'People',
    description: 'Search the people registry',
    viewId: 'people',
    icon: 'person'
  }
]

const links = computed(() =>
  allLinks.filter(link => {
    if (link.requireRole === 'manager' && !isManager.value) return false
    return true
  })
)

function handleClick(link) {
  crossNavigate('team-tracker', link.viewId, { from: 'sotu' })
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
    <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Quick Links</h3>

    <div class="space-y-2">
      <button
        v-for="link in links"
        :key="link.id"
        @click="handleClick(link)"
        class="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 text-left cursor-pointer hover:border-primary-300 dark:hover:border-primary-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        <div class="p-2 bg-primary-50 dark:bg-primary-900/30 rounded-lg text-primary-600 dark:text-primary-400">
          <svg v-if="link.icon === 'dashboard'" class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
          <svg v-else-if="link.icon === 'users'" class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <svg v-else class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <div>
          <div class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ link.label }}</div>
          <div class="text-xs text-gray-500 dark:text-gray-400">{{ link.description }}</div>
        </div>
      </button>
    </div>
  </div>
</template>
