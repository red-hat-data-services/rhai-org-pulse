<script setup>
defineProps({
  options: { type: Array, required: true }
})

defineEmits(['select'])
</script>

<template>
  <div class="space-y-6">
    <p class="text-sm text-gray-600 dark:text-gray-300">
      Pick the request that matches what you need. Each request files a Jira Epic that AIPCC tracks to delivery.
    </p>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <button
        v-for="option in options"
        :key="option.id"
        type="button"
        :data-testid="`request-card-${option.id}`"
        class="text-left bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-sm transition flex flex-col"
        @click="$emit('select', option.id)"
      >
        <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ option.label }}</h2>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">{{ option.summary }}</p>
        <ul class="mt-3 space-y-1 text-xs text-gray-500 dark:text-gray-400 list-disc pl-4">
          <li v-for="point in option.points" :key="point">{{ point }}</li>
        </ul>
        <span class="mt-auto pt-4 text-sm font-medium text-primary-600 dark:text-primary-400">{{ option.cta }} &rarr;</span>
      </button>
    </div>

    <div
      id="requests-help"
      role="note"
      class="p-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-sm text-blue-800 dark:text-blue-300"
    >
      <p class="font-semibold">Not sure what to request?</p>
      <p class="mt-1">
        Ask in <strong>#forum-aipcc</strong> and tag <strong>@aipcc-support</strong>. We will point you to the right request.
      </p>
    </div>
  </div>
</template>
