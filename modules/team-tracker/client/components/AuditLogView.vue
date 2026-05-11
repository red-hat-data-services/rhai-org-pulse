<script setup>
import { ref, onMounted } from 'vue'
import { useAuditLog } from '../composables/useAuditLog'

const { entries, total, loading, fetchEntries } = useAuditLog()

const filters = ref({
  action: '',
  actor: '',
  entityId: '',
  limit: 50,
  offset: 0
})

onMounted(() => fetchEntries(filters.value))

function applyFilters() {
  filters.value.offset = 0
  fetchEntries(filters.value)
}

function nextPage() {
  filters.value.offset += filters.value.limit
  fetchEntries(filters.value)
}

function prevPage() {
  filters.value.offset = Math.max(0, filters.value.offset - filters.value.limit)
  fetchEntries(filters.value)
}

const actionLabels = {
  'team.create': 'Team Created',
  'team.rename': 'Team Renamed',
  'team.delete': 'Team Deleted',
  'person.team.assign': 'Assigned to Team',
  'person.team.unassign': 'Unassigned from Team',
  'person.field.update': 'Field Updated',
  'team.field.update': 'Team Field Updated',
  'field.create': 'Field Created',
  'field.update': 'Field Updated',
  'field.delete': 'Field Deleted',
  'field.reorder': 'Fields Reordered',
  'migration.sheets_to_inapp': 'Migration'
}

function formatDate(ts) {
  return new Date(ts).toLocaleString()
}
</script>

<template>
  <div class="space-y-4">
    <h3 class="text-lg font-medium text-gray-900">Audit Log</h3>

    <!-- Filters -->
    <div class="flex items-end gap-3 flex-wrap">
      <div>
        <label class="block text-xs text-gray-600 mb-1">Action</label>
        <select v-model="filters.action" class="rounded border-gray-300 text-sm" @change="applyFilters">
          <option value="">All</option>
          <option v-for="(label, key) in actionLabels" :key="key" :value="key">{{ label }}</option>
        </select>
      </div>
      <div>
        <label class="block text-xs text-gray-600 mb-1">Actor</label>
        <input v-model="filters.actor" class="rounded border-gray-300 text-sm" placeholder="email" @keyup.enter="applyFilters">
      </div>
      <div>
        <label class="block text-xs text-gray-600 mb-1">Entity ID</label>
        <input v-model="filters.entityId" class="rounded border-gray-300 text-sm" placeholder="uid or team id" @keyup.enter="applyFilters">
      </div>
      <button class="px-3 py-2 text-sm text-primary-600 hover:text-primary-800" @click="applyFilters">Filter</button>
    </div>

    <!-- Results -->
    <div v-if="loading" class="text-sm text-gray-500">Loading...</div>
    <div v-else>
      <table class="min-w-full divide-y divide-gray-200 text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actor</th>
            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Entity</th>
            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Detail</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="entry in entries" :key="entry.id">
            <td class="px-3 py-2 text-gray-600 whitespace-nowrap">{{ formatDate(entry.timestamp) }}</td>
            <td class="px-3 py-2">
              <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                {{ actionLabels[entry.action] || entry.action }}
              </span>
            </td>
            <td class="px-3 py-2 text-gray-600">{{ entry.actor }}</td>
            <td class="px-3 py-2 text-gray-900">{{ entry.entityLabel || entry.entityId }}</td>
            <td class="px-3 py-2 text-gray-600">{{ entry.detail }}</td>
          </tr>
          <tr v-if="entries.length === 0">
            <td colspan="5" class="px-3 py-4 text-center text-gray-500">No audit log entries</td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination -->
      <div v-if="total > filters.limit" class="flex items-center justify-between mt-3">
        <span class="text-sm text-gray-600">
          Showing {{ filters.offset + 1 }}-{{ Math.min(filters.offset + filters.limit, total) }} of {{ total }}
        </span>
        <div class="flex gap-2">
          <button
            class="px-3 py-1 text-sm rounded border disabled:opacity-50"
            :disabled="filters.offset === 0"
            @click="prevPage"
          >Prev</button>
          <button
            class="px-3 py-1 text-sm rounded border disabled:opacity-50"
            :disabled="filters.offset + filters.limit >= total"
            @click="nextPage"
          >Next</button>
        </div>
      </div>
    </div>
  </div>
</template>
