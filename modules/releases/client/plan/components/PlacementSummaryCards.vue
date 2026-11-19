<script setup>
defineProps({
  counts: { type: Object, required: true },
  recommendedCount: { type: Number, default: null }
})
</script>

<template>
  <div class="grid gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-800/40 border-b border-gray-200 dark:border-gray-700" :class="recommendedCount != null ? 'grid-cols-5' : 'grid-cols-4'">
    <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-center">
      <div class="text-lg font-bold text-blue-700 dark:text-blue-300">{{ counts.EA1 }}</div>
      <div class="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">EA1</div>
    </div>
    <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-center">
      <div class="text-lg font-bold text-indigo-700 dark:text-indigo-300">{{ counts.EA2 }}</div>
      <div class="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">EA2</div>
    </div>
    <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-center">
      <div class="text-lg font-bold text-green-700 dark:text-green-300">{{ counts.GA }}</div>
      <div class="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">GA</div>
    </div>
    <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-center">
      <div class="text-lg font-bold text-gray-600 dark:text-gray-300">{{ counts.No }}</div>
      <div class="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">No</div>
    </div>
    <div v-if="recommendedCount != null" class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-center">
      <div class="text-lg font-bold text-primary-700 dark:text-primary-300">{{ recommendedCount }}</div>
      <div class="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">PM+DO Recommended</div>
    </div>
  </div>
</template>
