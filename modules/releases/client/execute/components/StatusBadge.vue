<script setup>
defineProps({
  status: { type: String, default: '' },
  health: { type: String, default: null },
  size: { type: String, default: 'sm' }
})

const healthColors = {
  GREEN: 'bg-green-500',
  YELLOW: 'bg-yellow-500',
  RED: 'bg-red-500'
}

const statusColors = {
  'Done': 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-green-300 dark:border-green-500/30',
  'In Progress': 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-500/30',
  'To Do': 'bg-gray-100 dark:bg-gray-500/20 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-500/30',
  'New': 'bg-gray-100 dark:bg-gray-500/20 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-500/30',
  'Backlog': 'bg-gray-100 dark:bg-gray-500/20 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-500/30',
  'Refinement': 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-300 dark:border-purple-500/30',
  'Review': 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-500/30',
  'Testing': 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 border-cyan-300 dark:border-cyan-500/30'
}
</script>

<template>
  <span v-if="health" class="inline-flex items-center gap-1.5">
    <span class="w-2.5 h-2.5 rounded-full" :class="healthColors[health] || 'bg-gray-500'" />
    <span v-if="$slots.default" class="text-xs"><slot /></span>
  </span>
  <span
    v-else
    class="inline-block px-2 py-0.5 rounded border text-xs font-medium"
    :class="statusColors[status] || 'bg-gray-100 dark:bg-gray-500/20 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-500/30'"
  >
    {{ status }}
  </span>
</template>
