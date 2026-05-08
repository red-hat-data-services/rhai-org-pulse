<script setup>
import { computed } from 'vue'

const props = defineProps({
  features: { type: Array, default: () => [] },
  colspan: { type: Number, default: 7 },
  loading: { type: Boolean, default: false },
  rockName: { type: String, default: '' }
})

var DOT_CLASS = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500'
}

function truncate(text, max) {
  if (!text) return ''
  return text.length > max ? text.slice(0, max) + '...' : text
}

var featuresTabHref = computed(function() {
  if (!props.rockName) return '#/release-planning/health'
  return '#/release-planning/health?bigRock=' + encodeURIComponent(props.rockName)
})
</script>

<template>
  <td :colspan="colspan" class="p-0 border border-gray-300 dark:border-gray-600 border-t-2 border-t-primary-200 dark:border-t-primary-700 bg-gray-50 dark:bg-gray-900/40">
    <!-- Loading state -->
    <div v-if="loading" class="flex items-center justify-center py-6 gap-2 text-gray-500 dark:text-gray-400 text-xs">
      <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      Loading feature health...
    </div>

    <!-- Empty / error state -->
    <div v-else-if="!features || features.length === 0" class="py-6 text-center text-gray-500 dark:text-gray-400 text-xs">
      No feature health data available
    </div>

    <!-- Feature detail table -->
    <div v-else class="p-3 max-h-80 overflow-y-auto" role="region" :aria-label="'Feature health details for ' + rockName">
      <table class="w-full text-xs">
        <thead>
          <tr>
            <th class="px-2 py-1 text-left text-gray-600 dark:text-gray-400 font-semibold">Feature</th>
            <th class="px-2 py-1 text-left text-gray-600 dark:text-gray-400 font-semibold">Summary</th>
            <th class="px-2 py-1 text-left text-gray-600 dark:text-gray-400 font-semibold">Risk Flags</th>
            <th class="px-2 py-1 text-left text-gray-600 dark:text-gray-400 font-semibold">Owner</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="f in features"
            :key="f.key"
            class="odd:bg-white dark:odd:bg-gray-800/30 even:bg-gray-50 dark:even:bg-gray-900/20"
          >
            <td class="px-2 py-1.5">
              <span class="inline-flex items-center gap-1.5">
                <span
                  class="inline-block w-2 h-2 rounded-full flex-shrink-0"
                  :class="DOT_CLASS[f.level] || DOT_CLASS.green"
                  role="img"
                  :aria-label="'Risk level: ' + f.level"
                ></span>
                <a
                  v-if="f.jiraUrl"
                  :href="f.jiraUrl"
                  target="_blank"
                  rel="noopener"
                  class="text-primary-600 dark:text-blue-400 font-mono hover:underline"
                  @click.stop
                >{{ f.key }}</a>
                <span v-else class="font-mono text-gray-700 dark:text-gray-300">{{ f.key }}</span>
              </span>
              <span v-if="f.override" class="ml-1 text-[9px] text-amber-600 dark:text-amber-400" title="Risk level manually overridden">M</span>
            </td>
            <td class="px-2 py-1.5 text-gray-700 dark:text-gray-300 max-w-[250px]">
              <span :title="f.summary">{{ truncate(f.summary, 60) }}</span>
            </td>
            <td class="px-2 py-1.5 text-gray-600 dark:text-gray-400">
              {{ f.flagCategories && f.flagCategories.length > 0 ? f.flagCategories.join(', ') : '--' }}
            </td>
            <td class="px-2 py-1.5 text-gray-600 dark:text-gray-400">
              {{ f.deliveryOwner || '-' }}
            </td>
          </tr>
        </tbody>
      </table>
      <div class="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
        <a
          :href="featuresTabHref"
          class="text-xs text-primary-600 dark:text-blue-400 hover:underline"
        >View all in Features tab &rarr;</a>
      </div>
    </div>
  </td>
</template>
