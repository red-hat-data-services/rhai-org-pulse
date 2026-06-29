<template>
  <div class="mb-6">
    <div class="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <button
        class="rounded-xl border-2 px-4 py-3 text-left transition-all duration-150"
        :class="!selectedPillar
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'"
        @click="$emit('update:selectedPillar', null)"
      >
        <div class="text-sm font-semibold">All Pillars</div>
        <div class="text-xs mt-0.5 opacity-75">{{ totalCount }} projects</div>
      </button>

      <button
        v-for="pillar in pillars"
        :key="pillar.pillarKey"
        class="rounded-xl border-2 px-4 py-3 text-left transition-all duration-150 relative overflow-hidden"
        :class="selectedPillar === pillar.pillarKey
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'"
        @click="$emit('update:selectedPillar', selectedPillar === pillar.pillarKey ? null : pillar.pillarKey)"
      >
        <div
          class="text-sm font-semibold"
          :class="selectedPillar === pillar.pillarKey
            ? 'text-primary-700 dark:text-primary-300'
            : 'text-gray-900 dark:text-gray-100'"
        >
          {{ pillar.title }}
        </div>
        <div
          class="text-xs mt-0.5 line-clamp-2"
          :class="selectedPillar === pillar.pillarKey
            ? 'text-primary-600 dark:text-primary-400'
            : 'text-gray-500 dark:text-gray-400'"
        >
          {{ pillar.summary }}
        </div>
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  pillars: { type: Array, required: true },
  selectedPillar: { type: String, default: null },
  totalCount: { type: Number, default: 0 },
})

defineEmits(['update:selectedPillar'])
</script>
