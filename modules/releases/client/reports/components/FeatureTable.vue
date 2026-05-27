<template>
  <div class="overflow-x-auto">
    <table class="w-full text-sm">
      <thead class="bg-gray-50 dark:bg-gray-700/50">
        <tr>
          <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Key</th>
          <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Summary</th>
          <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Components</th>
          <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Owner</th>
          <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
        <tr
          v-for="feature in features"
          :key="feature.key"
          class="hover:bg-gray-50 dark:hover:bg-gray-700/30"
        >
          <td class="px-4 py-3">
            <a
              :href="`https://redhat.atlassian.net/browse/${feature.key}`"
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary-600 dark:text-primary-400 hover:underline font-medium"
            >
              {{ feature.key }}
            </a>
          </td>
          <td class="px-4 py-3 text-gray-900 dark:text-gray-100">
            {{ feature.summary || 'No summary' }}
          </td>
          <td class="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">
            {{ feature.components || '-' }}
          </td>
          <td class="px-4 py-3 text-gray-600 dark:text-gray-400">
            {{ feature.deliveryOwner || '-' }}
          </td>
          <td class="px-4 py-3">
            <span
              v-if="feature.status"
              class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
              :class="statusClass(feature.status)"
            >
              {{ feature.status }}
            </span>
            <span v-else class="text-gray-400 dark:text-gray-500 text-xs">-</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
defineProps({
  features: { type: Array, default: () => [] }
})

function statusClass(status) {
  const normalized = (status || '').toLowerCase()
  if (normalized.includes('done') || normalized.includes('closed') || normalized.includes('resolved')) {
    return 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
  }
  if (normalized.includes('progress') || normalized.includes('review')) {
    return 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400'
  }
  return 'bg-gray-100 dark:bg-gray-500/20 text-gray-600 dark:text-gray-400'
}
</script>
