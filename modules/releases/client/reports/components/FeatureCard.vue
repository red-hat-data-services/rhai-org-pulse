<template>
  <div
    class="border rounded-lg p-4 transition-shadow hover:shadow-md"
    :class="cardBorderClass"
  >
    <!-- Header: Jira Key + Status -->
    <div class="flex items-start justify-between gap-3 mb-3">
      <a
        :href="`https://redhat.atlassian.net/browse/${feature.key}`"
        target="_blank"
        rel="noopener noreferrer"
        class="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-semibold text-sm inline-flex items-center gap-1 hover:underline"
        @click.stop
      >
        {{ feature.key }}
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </a>

      <span
        v-if="feature.status"
        class="px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap"
        :class="statusBadgeClass"
      >
        {{ feature.status }}
      </span>
    </div>

    <!-- Summary -->
    <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3 leading-snug">
      {{ feature.summary }}
    </h3>

    <!-- Metadata Grid -->
    <div class="grid grid-cols-2 gap-3 text-xs">
      <!-- Components -->
      <div v-if="feature.components?.length">
        <div class="text-gray-500 dark:text-gray-400 mb-1">Components</div>
        <div class="text-gray-900 dark:text-gray-100 font-medium">
          {{ Array.isArray(feature.components) ? feature.components.join(', ') : feature.components }}
        </div>
      </div>

      <!-- Delivery Owner -->
      <div v-if="feature.deliveryOwner">
        <div class="text-gray-500 dark:text-gray-400 mb-1">Owner</div>
        <div class="text-gray-900 dark:text-gray-100 font-medium">
          {{ feature.deliveryOwner }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  feature: {
    type: Object,
    required: true
  },
  variant: {
    type: String,
    default: 'default', // 'delivered', 'in-progress', 'added', 'removed'
    validator: (val) => ['default', 'delivered', 'in-progress', 'not-started', 'added', 'removed'].includes(val)
  }
})

const cardBorderClass = computed(() => {
  const baseClass = 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'

  switch (props.variant) {
    case 'delivered':
      return `${baseClass} border-l-4 border-l-green-500`
    case 'in-progress':
      return `${baseClass} border-l-4 border-l-yellow-500`
    case 'not-started':
      return `${baseClass} border-l-4 border-l-gray-400`
    case 'added':
      return `${baseClass} border-l-4 border-l-blue-500 bg-blue-50/30 dark:bg-blue-500/5`
    case 'removed':
      return `${baseClass} border-l-4 border-l-red-500 bg-red-50/30 dark:bg-red-500/5`
    default:
      return baseClass
  }
})

const statusBadgeClass = computed(() => {
  const status = props.feature.status?.toLowerCase() || ''

  if (status.includes('done') || status.includes('closed') || status.includes('resolved')) {
    return 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
  }

  if (status.includes('progress') || status.includes('review')) {
    return 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400'
  }

  if (status.includes('blocked')) {
    return 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'
  }

  return 'bg-gray-100 dark:bg-gray-500/20 text-gray-700 dark:text-gray-400'
})
</script>
