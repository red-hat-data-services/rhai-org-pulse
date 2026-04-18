<template>
  <div
    class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 border-t-4 p-5 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all"
    :style="{ borderTopColor: accentColor }"
    @click="$emit('select', team)"
  >
    <!-- Header -->
    <div class="flex items-start gap-3 mb-2">
      <div
        class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-white font-bold text-sm"
        :style="{ backgroundColor: accentColor }"
      >
        {{ initials }}
      </div>
      <div class="flex-1 min-w-0">
        <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">{{ team.name }}</h3>
        <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span>{{ team.org }}</span>
          <span class="text-gray-300 dark:text-gray-600">·</span>
          <span>{{ team.memberCount || 0 }} members</span>
        </div>
      </div>
    </div>

    <!-- PMs & Eng Lead -->
    <div class="space-y-1 mb-3 text-sm text-gray-600 dark:text-gray-400">
      <div v-if="team.productManagers && team.productManagers.length > 0" class="flex items-start gap-1.5">
        <span class="text-gray-400 dark:text-gray-500 shrink-0">PM:</span>
        <span>{{ team.productManagers.join(', ') }}</span>
      </div>
      <div v-if="team.engLeads && team.engLeads.length > 0" class="flex items-start gap-1.5">
        <span class="text-gray-400 dark:text-gray-500 shrink-0">Eng Lead:</span>
        <span>{{ team.engLeads.join(', ') }}</span>
      </div>
    </div>

    <!-- Components -->
    <div v-if="team.components && team.components.length > 0" class="mb-3">
      <span class="text-xs text-gray-400 dark:text-gray-500 mb-1 block">Components:</span>
      <div class="flex flex-wrap gap-1">
      <span
        v-for="comp in team.components.slice(0, 3)"
        :key="comp"
        class="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
      >
        {{ comp }}
      </span>
      <span
        v-if="team.components.length > 3"
        class="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
      >
        +{{ team.components.length - 3 }} more
      </span>
      </div>
    </div>

    <!-- Footer: Board link + RFE count -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <a
          v-if="team.boardUrls && team.boardUrls.length > 0"
          :href="team.boardUrls[0]"
          target="_blank"
          rel="noopener noreferrer"
          class="text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400"
          title="Jira Board"
          @click.stop
        >
          <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
      <span
        v-if="team.rfeCount > 0"
        class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-400"
      >
        {{ team.rfeCount }} open RFEs
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  team: { type: Object, required: true }
})
defineEmits(['select'])

const COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
  '#06b6d4', '#6366f1', '#f43f5e', '#84cc16', '#14b8a6',
  '#e11d48', '#7c3aed', '#0ea5e9', '#d97706', '#059669',
]

function hashString(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

const accentColor = computed(() => {
  const key = `${props.team.org}::${props.team.name}`
  return COLORS[hashString(key) % COLORS.length]
})

const initials = computed(() => {
  return props.team.name
    .split(/[\s\-/+]+/)
    .filter(w => w.length > 0)
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
})
</script>
