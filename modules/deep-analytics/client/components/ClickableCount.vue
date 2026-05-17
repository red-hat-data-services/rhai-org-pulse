<script setup>
defineProps({
  count: { type: Number, required: true },
  jql: { type: String, default: '' },
  items: { type: Array, default: () => [] },
  color: { type: String, default: '' },
  label: { type: String, default: '' },
})

const emit = defineEmits(['drill-down'])
</script>

<template>
  <a
    v-if="jql"
    :href="jql"
    target="_blank"
    rel="noopener noreferrer"
    class="inline-flex items-center gap-1 font-semibold underline decoration-dotted hover:decoration-solid cursor-pointer transition-colors"
    :class="{
      'text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300': color === 'red',
      'text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300': color === 'yellow',
      'text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300': color === 'green',
      'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300': !color || color === 'default',
      'text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300': color === 'muted',
    }"
    :title="label ? `${label}: ${count} — click to view in Jira` : `${count} — click to view in Jira`"
  >
    {{ count }}
    <svg class="w-3 h-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  </a>
  <button
    v-else-if="items.length > 0"
    class="font-semibold underline decoration-dotted hover:decoration-solid cursor-pointer transition-colors"
    :class="{
      'text-red-600 dark:text-red-400': color === 'red',
      'text-yellow-600 dark:text-yellow-400': color === 'yellow',
      'text-green-600 dark:text-green-400': color === 'green',
      'text-blue-600 dark:text-blue-400': !color || color === 'default',
    }"
    :title="label ? `${label}: ${count} — click to see list` : `${count} — click to see list`"
    @click="emit('drill-down', items)"
  >
    {{ count }}
  </button>
  <span v-else class="font-semibold text-gray-600 dark:text-gray-400">
    {{ count }}
  </span>
</template>
