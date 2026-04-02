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
  'Done': 'bg-green-500/20 text-green-400 border-green-500/30',
  'In Progress': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'New': 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  'Backlog': 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  'Refinement': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'Review': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  'Testing': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
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
    :class="statusColors[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'"
  >
    {{ status }}
  </span>
</template>
