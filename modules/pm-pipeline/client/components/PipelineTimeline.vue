<script setup>
defineProps({
  timeline: { type: Array, default: () => [] }
})

const statusStyles = {
  complete: 'bg-green-100 border-green-400 text-green-800',
  current: 'bg-blue-100 border-blue-500 text-blue-900 ring-2 ring-blue-200',
  pending: 'bg-gray-50 border-gray-300 text-gray-500'
}
</script>

<template>
  <ol class="flex flex-col sm:flex-row gap-2 sm:gap-0 sm:justify-between">
    <li
      v-for="(phase, idx) in timeline"
      :key="phase.id"
      class="flex sm:flex-col sm:items-center sm:flex-1 gap-2 sm:gap-1 relative"
    >
      <div
        class="flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold"
        :class="statusStyles[phase.status] || statusStyles.pending"
      >
        {{ idx + 1 }}
      </div>
      <div class="sm:text-center min-w-0">
        <p class="text-xs font-semibold text-gray-800">{{ phase.label }}</p>
        <p class="text-xs text-gray-500 truncate max-w-[140px] sm:mx-auto">{{ phase.detail }}</p>
      </div>
      <div
        v-if="idx < timeline.length - 1"
        class="hidden sm:block absolute top-4 left-[calc(50%+1rem)] right-0 h-0.5 bg-gray-200 -z-10"
        style="width: calc(100% - 2rem); margin-left: 50%;"
      />
    </li>
  </ol>
</template>
