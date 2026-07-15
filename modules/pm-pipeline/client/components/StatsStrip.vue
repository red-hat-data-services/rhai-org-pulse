<script setup>
defineProps({
  stats: {
    type: Object,
    default: () => ({ needAction: 0, inProgress: 0, ready: 0, complete: 0, total: 0 })
  }
})
</script>

<template>
  <div class="grid grid-cols-2 lg:grid-cols-5 gap-3">
    <div class="bg-white rounded-lg border border-gray-200 p-4">
      <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Need action</p>
      <p class="text-2xl font-bold text-red-600 mt-1">{{ stats.needAction }}</p>
    </div>
    <div class="bg-white rounded-lg border border-gray-200 p-4">
      <p class="text-xs font-medium uppercase tracking-wide text-gray-500">In progress</p>
      <p class="text-2xl font-bold text-amber-600 mt-1">{{ stats.inProgress }}</p>
    </div>
    <div class="bg-white rounded-lg border border-gray-200 p-4">
      <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Ready for planning</p>
      <p class="text-2xl font-bold text-blue-600 mt-1">{{ stats.ready }}</p>
    </div>
    <div class="bg-white rounded-lg border border-gray-200 p-4">
      <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Complete</p>
      <p class="text-2xl font-bold text-green-600 mt-1">{{ stats.complete }}</p>
    </div>
    <div class="bg-white rounded-lg border border-gray-200 p-4 col-span-2 lg:col-span-1">
      <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Total items</p>
      <p class="text-2xl font-bold text-gray-800 mt-1">{{ stats.total }}</p>
    </div>
  </div>
</template>
