<script setup>
import { ref } from 'vue'
import StatusBadge from './StatusBadge.vue'

const _props = defineProps({
  features: { type: Array, required: true }
})

const emit = defineEmits(['select', 'sort'])

const sortBy = ref('key')
const sortDir = ref('asc')

const JIRA_BASE = 'https://redhat.atlassian.net/browse/'

function toggleSort(field) {
  if (sortBy.value === field) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = field
    sortDir.value = 'asc'
  }
  emit('sort', { sortBy: sortBy.value, sortDir: sortDir.value })
}

function sortIcon(field) {
  if (sortBy.value !== field) return ''
  return sortDir.value === 'asc' ? ' \u25B2' : ' \u25BC'
}

const columns = [
  { key: 'key', label: 'Key' },
  { key: 'summary', label: 'Summary' },
  { key: 'status', label: 'Status' },
  { key: 'health', label: 'Health' },
  { key: 'completionPct', label: 'Progress' },
  { key: 'epicCount', label: 'Epics' },
  { key: 'issueCount', label: 'Issues' },
  { key: 'blockerCount', label: 'Blockers' }
]
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-gray-700">
          <th
            v-for="col in columns"
            :key="col.key"
            class="px-3 py-2 text-left text-gray-400 font-medium cursor-pointer hover:text-white select-none"
            @click="toggleSort(col.key)"
          >
            {{ col.label }}{{ sortIcon(col.key) }}
          </th>
          <th class="px-3 py-2 text-left text-gray-400 font-medium">Version</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="f in features"
          :key="f.key"
          class="border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer transition-colors"
          @click="$emit('select', f.key)"
        >
          <td class="px-3 py-2">
            <a
              :href="JIRA_BASE + f.key"
              class="text-blue-400 hover:underline font-mono text-xs"
              @click.stop
              target="_blank"
            >{{ f.key }}</a>
          </td>
          <td class="px-3 py-2 text-white max-w-xs truncate">{{ f.summary }}</td>
          <td class="px-3 py-2"><StatusBadge :status="f.status" /></td>
          <td class="px-3 py-2"><StatusBadge :health="f.health">{{ f.health }}</StatusBadge></td>
          <td class="px-3 py-2">
            <div class="flex items-center gap-2">
              <div class="w-16 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  class="h-full rounded-full transition-all"
                  :class="{
                    'bg-green-500': f.completionPct >= 70,
                    'bg-yellow-500': f.completionPct >= 40 && f.completionPct < 70,
                    'bg-red-500': f.completionPct < 40
                  }"
                  :style="{ width: f.completionPct + '%' }"
                />
              </div>
              <span class="text-gray-400 text-xs">{{ f.completionPct }}%</span>
            </div>
          </td>
          <td class="px-3 py-2 text-gray-300">{{ f.epicCount }}</td>
          <td class="px-3 py-2 text-gray-300">{{ f.issueCount }}</td>
          <td class="px-3 py-2">
            <span v-if="f.blockerCount > 0" class="text-red-400 font-medium">{{ f.blockerCount }}</span>
            <span v-else class="text-gray-600">0</span>
          </td>
          <td class="px-3 py-2">
            <span
              v-for="v in (f.fixVersions || []).slice(0, 2)"
              :key="v"
              class="inline-block px-1.5 py-0.5 rounded bg-gray-700 text-gray-300 text-xs mr-1"
            >{{ v }}</span>
          </td>
        </tr>
        <tr v-if="features.length === 0">
          <td :colspan="columns.length + 1" class="px-3 py-8 text-center text-gray-500">
            No features found matching the current filters.
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
