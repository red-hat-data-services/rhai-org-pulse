<script setup>
// Related Jira key, delivery date and business justification: the fields
// every AIPCC-E request requires.
const jiraId = defineModel('jiraId', { type: String, required: true })
const deliveryTimeline = defineModel('deliveryTimeline', { type: String, required: true })
const justification = defineModel('justification', { type: String, required: true })

defineProps({
  idPrefix: { type: String, required: true },
  errors: { type: Object, default: () => ({}) },
  minDate: { type: String, required: true },
  minDateLabel: { type: String, required: true },
  jiraPlaceholder: { type: String, default: 'e.g. RHAISTRAT-1234' },
  jiraHint: { type: String, default: 'The STRAT or Epic that explains why this is needed.' },
  justificationPlaceholder: { type: String, default: 'Why does your team need this?' }
})
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label :for="`${idPrefix}-jira-id`" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Related Jira key <span class="text-red-500" aria-hidden="true">*</span>
      </label>
      <input
        :id="`${idPrefix}-jira-id`"
        v-model="jiraId"
        type="text"
        required
        autocomplete="off"
        :placeholder="jiraPlaceholder"
        aria-required="true"
        :aria-invalid="!!errors.jira_id"
        :aria-describedby="errors.jira_id ? `${idPrefix}-jira-id-error` : `${idPrefix}-jira-id-hint`"
        class="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        :class="errors.jira_id ? 'border-red-400 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'"
      />
      <p :id="`${idPrefix}-jira-id-hint`" class="mt-1 text-xs text-gray-400 dark:text-gray-500">{{ jiraHint }}</p>
      <p v-if="errors.jira_id" :id="`${idPrefix}-jira-id-error`" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ errors.jira_id }}</p>
    </div>

    <div>
      <label :for="`${idPrefix}-delivery-timeline`" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Delivery date <span class="text-red-500" aria-hidden="true">*</span>
      </label>
      <input
        :id="`${idPrefix}-delivery-timeline`"
        v-model="deliveryTimeline"
        type="date"
        required
        :min="minDate"
        aria-required="true"
        :aria-invalid="!!errors.delivery_timeline"
        :aria-describedby="errors.delivery_timeline ? `${idPrefix}-delivery-timeline-error` : `${idPrefix}-delivery-timeline-hint`"
        class="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        :class="errors.delivery_timeline ? 'border-red-400 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'"
      />
      <p :id="`${idPrefix}-delivery-timeline-hint`" class="mt-1 text-xs text-gray-400 dark:text-gray-500">
        Earliest available date: {{ minDateLabel }}.
      </p>
      <p v-if="errors.delivery_timeline" :id="`${idPrefix}-delivery-timeline-error`" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ errors.delivery_timeline }}</p>
    </div>

    <div class="md:col-span-2">
      <label :for="`${idPrefix}-justification`" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Business justification <span class="text-red-500" aria-hidden="true">*</span>
      </label>
      <textarea
        :id="`${idPrefix}-justification`"
        v-model="justification"
        rows="3"
        required
        :placeholder="justificationPlaceholder"
        aria-required="true"
        :aria-invalid="!!errors.justification"
        :aria-describedby="errors.justification ? `${idPrefix}-justification-error` : null"
        class="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        :class="errors.justification ? 'border-red-400 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'"
      ></textarea>
      <p v-if="errors.justification" :id="`${idPrefix}-justification-error`" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ errors.justification }}</p>
    </div>
  </div>
</template>
