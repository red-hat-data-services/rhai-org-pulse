<script setup>
defineProps({
  title: { type: String, required: true },
  result: { type: Object, required: true }
})

defineEmits(['reset'])
</script>

<template>
  <div class="bg-white dark:bg-gray-800 border border-green-200 dark:border-green-800/40 rounded-lg p-6">
    <div class="flex items-center gap-3 mb-4">
      <div class="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
        <svg class="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div>
        <h3 class="text-lg font-bold text-green-800 dark:text-green-300">{{ title }}</h3>
        <p class="text-sm text-green-600 dark:text-green-400/80">
          {{ result.summary || 'Request accepted' }}
          <span v-if="result.demo"> (demo mode)</span>
        </p>
      </div>
    </div>

    <dl class="space-y-3 text-sm">
      <div class="flex items-center gap-2">
        <dt class="text-gray-500 dark:text-gray-400 w-40 flex-shrink-0">Jira Epic</dt>
        <dd>
          <a
            v-if="result.jira && result.jira.url"
            :href="result.jira.url"
            target="_blank"
            rel="noopener noreferrer"
            class="font-semibold text-blue-600 hover:underline"
          >{{ result.jira.key }}</a>
          <span v-else class="font-semibold text-gray-900 dark:text-gray-200">{{ result.jira ? result.jira.key : 'N/A' }}</span>
        </dd>
      </div>
      <div v-if="result.requester" class="flex items-center gap-2">
        <dt class="text-gray-500 dark:text-gray-400 w-40 flex-shrink-0">Requester</dt>
        <dd class="text-gray-900 dark:text-gray-200">{{ result.requester }}</dd>
      </div>
      <div class="flex items-center gap-2">
        <dt class="text-gray-500 dark:text-gray-400 w-40 flex-shrink-0">Next step</dt>
        <dd class="text-gray-900 dark:text-gray-200">
          AIPCC triages the request and follows up on the Jira Epic.
        </dd>
      </div>
    </dl>

    <button
      type="button"
      @click="$emit('reset')"
      class="mt-5 px-4 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
    >
      Submit another request
    </button>
  </div>
</template>
