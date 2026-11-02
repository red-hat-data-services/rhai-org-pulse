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
      Every request needs a related Jira issue, a delivery date and a business justification.
    </p>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <button
        v-for="option in options"
        :key="option.id"
        type="button"
        :data-testid="`request-card-${option.id}`"
        class="group text-left cursor-pointer bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 flex flex-col transition hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
        @click="$emit('select', option.id)"
      >
        <h2 class="text-base font-semibold text-gray-900 dark:text-white group-hover:text-primary-700 dark:group-hover:text-primary-300">{{ option.label }}</h2>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-300" data-testid="card-description">{{ option.description }}</p>

        <h3 class="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Prerequisites</h3>
        <ul class="mt-1 space-y-1 text-xs text-gray-600 dark:text-gray-300 list-disc pl-4" data-testid="card-prerequisites">
          <li v-for="item in option.prerequisites" :key="item">{{ item }}</li>
        </ul>

        <h3 class="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Turnaround</h3>
        <p class="mt-1 text-xs text-gray-600 dark:text-gray-300" data-testid="card-turnaround">{{ option.turnaround }}</p>

        <span class="mt-auto pt-4 text-sm font-medium text-primary-600 dark:text-primary-400">
          {{ option.cta }}
          <span class="inline-block transition-transform group-hover:translate-x-1" aria-hidden="true">&rarr;</span>
        </span>
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
