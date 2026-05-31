<template>
  <div class="space-y-4">
    <div
      v-for="i in count"
      :key="i"
      class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 overflow-hidden"
    >
      <div class="flex items-start gap-3 mb-3">
        <div class="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 shimmer"></div>
        <div class="flex-1">
          <div class="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded shimmer mb-1.5"></div>
          <div class="h-3 w-24 bg-gray-100 dark:bg-gray-700/50 rounded shimmer"></div>
        </div>
        <div class="h-3 w-8 bg-gray-100 dark:bg-gray-700/50 rounded shimmer"></div>
      </div>

      <div class="space-y-2 mb-4">
        <div class="h-3.5 bg-gray-200 dark:bg-gray-700 rounded shimmer w-full"></div>
        <div class="h-3.5 bg-gray-200 dark:bg-gray-700 rounded shimmer w-5/6"></div>
        <div class="h-3.5 bg-gray-100 dark:bg-gray-700/50 rounded shimmer w-3/4"></div>
      </div>

      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="h-6 w-12 bg-gray-100 dark:bg-gray-700/50 rounded-full shimmer"></div>
          <div class="h-6 w-10 bg-gray-100 dark:bg-gray-700/50 rounded-full shimmer"></div>
        </div>
        <div class="h-4 w-20 bg-gray-100 dark:bg-gray-700/50 rounded shimmer"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  count: { type: Number, default: 3 }
})
</script>

<style scoped>
.shimmer {
  animation: shimmer 1.5s infinite;
  background-size: 200% 100%;
  background-image: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.15) 50%,
    transparent 100%
  );
}

:root.dark .shimmer {
  background-image: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.05) 50%,
    transparent 100%
  );
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
