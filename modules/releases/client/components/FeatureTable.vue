<script setup>
import { ref, computed } from 'vue'

function parentKeyUrl(feat) {
  if (feat.url) {
    const base = feat.url.substring(0, feat.url.lastIndexOf('/'))
    return base + '/' + feat.parent_key
  }
  return 'https://redhat.atlassian.net/browse/' + feat.parent_key
}

const props = defineProps({
  features: { type: Array, required: true },
  columns: {
    type: Array,
    default: () => ['key', 'summary', 'status', 'color_status', 'assignee'],
  },
  title: { type: String, default: '' },
  maxRows: { type: Number, default: 0 },
})

const sortCol = ref(null)
const sortDir = ref('asc')

function toggleSort(col) {
  if (sortCol.value === col) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortCol.value = col
    sortDir.value = 'asc'
  }
}

const sortedFeatures = computed(() => {
  if (!sortCol.value) return props.features
  const col = sortCol.value
  const dir = sortDir.value === 'asc' ? 1 : -1
  return [...props.features].sort((a, b) => {
    const va = (a[col] ?? '')
    const vb = (b[col] ?? '')
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
    return String(va).localeCompare(String(vb)) * dir
  })
})

const columnLabels = {
  key: 'Key',
  summary: 'Summary',
  status: 'Status',
  color_status: 'Color',
  assignee: 'Assignee',
  team: 'Team',
  days_since_update: 'Days Stale',
  parent_key: 'Outcome',
  has_status_summary: 'Has Summary',
  hops: 'Hops',
  hop_path: 'Drift Path',
  product_manager: 'PM',
  target_version: 'TV',
  fix_versions: 'FV',
  component: 'Component',
}

function colorBadgeClass(color) {
  const c = (color || '').toLowerCase()
  if (c === 'red') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
  if (c === 'yellow') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
  if (c === 'green') return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
  return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
}
</script>

<template>
  <div>
    <h4 v-if="title" class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
      {{ title }} ({{ features.length }})
    </h4>
    <div class="overflow-x-auto">
      <table class="min-w-full text-sm border border-gray-200 dark:border-gray-700">
        <thead>
          <tr class="bg-gray-50 dark:bg-gray-800">
            <th
              v-for="col in columns"
              :key="col"
              class="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              @click="toggleSort(col)"
            >
              {{ columnLabels[col] || col }}
              <span v-if="sortCol === col" class="ml-0.5">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
          <tr
            v-for="(feat, idx) in (maxRows > 0 ? sortedFeatures.slice(0, maxRows) : sortedFeatures)"
            :key="feat.key || idx"
            class="hover:bg-gray-50 dark:hover:bg-gray-800/50"
          >
            <td
              v-for="col in columns"
              :key="col"
              class="px-3 py-2 whitespace-nowrap"
            >
              <!-- Key column: clickable link to Jira -->
              <a
                v-if="col === 'key' && feat.url"
                :href="feat.url"
                target="_blank"
                rel="noopener noreferrer"
                class="text-blue-600 dark:text-blue-400 hover:underline font-mono text-xs"
              >
                {{ feat.key }}
              </a>
              <!-- Summary: truncated, full on hover -->
              <span
                v-else-if="col === 'summary'"
                class="max-w-xs truncate block"
                :title="feat.summary"
              >
                {{ feat.summary }}
              </span>
              <!-- Color status: badge -->
              <span
                v-else-if="col === 'color_status' && feat.color_status"
                class="inline-flex px-2 py-0.5 text-xs font-medium rounded-full"
                :class="colorBadgeClass(feat.color_status)"
              >
                {{ feat.color_status }}
              </span>
              <!-- Boolean columns -->
              <span
                v-else-if="col === 'has_status_summary'"
                class="text-xs"
                :class="feat[col] ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'"
              >
                {{ feat[col] ? 'Yes' : 'No' }}
              </span>
              <!-- Parent key: link to Jira -->
              <a
                v-else-if="col === 'parent_key' && feat.parent_key"
                :href="parentKeyUrl(feat)"
                target="_blank"
                rel="noopener noreferrer"
                class="text-blue-600 dark:text-blue-400 hover:underline font-mono text-xs"
              >
                {{ feat.parent_key }}
              </a>
              <!-- Default: plain text -->
              <span v-else class="text-gray-700 dark:text-gray-300 text-xs">
                {{ feat[col] ?? '' }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p
      v-if="maxRows > 0 && features.length > maxRows"
      class="mt-1 text-xs text-gray-500 dark:text-gray-400"
    >
      Showing {{ maxRows }} of {{ features.length }} features
    </p>
  </div>
</template>
