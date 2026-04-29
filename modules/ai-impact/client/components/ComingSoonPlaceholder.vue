<script setup>
defineProps({
  phaseName: {
    type: String,
    default: 'this phase'
  }
})
</script>

<template>
  <div class="flex-1 flex flex-col items-center justify-center">
    <div class="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
      <svg class="h-8 w-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    </div>
    <h2 class="text-xl font-semibold mb-2 dark:text-gray-100">Coming Soon</h2>
    <p class="text-gray-500 dark:text-gray-400 text-center max-w-md">
      AI adoption tracking for {{ phaseName }} is not yet available.
    </p>
  </div>
</template>
