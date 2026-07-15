<template>
  <div>
    <div v-if="type === 'pillars'" class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      <div v-for="i in 4" :key="i" class="h-28 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
    </div>
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="i in 6" :key="i" class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 overflow-hidden">
        <div class="aspect-video bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div class="p-4 space-y-3">
          <div class="h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4" />
          <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-full" />
          <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-2/3" />
          <div class="flex gap-1.5 pt-1">
            <div class="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div class="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  type: { type: String, default: 'cards' },
})
</script>
