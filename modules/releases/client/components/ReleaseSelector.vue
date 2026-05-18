<template>
  <div class="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
    <label class="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Release:</label>
    <select
      v-model="selectedId"
      class="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-w-[200px]"
      :disabled="loading || releases.length === 0"
    >
      <option v-if="loading" value="" disabled>Loading releases...</option>
      <option v-else-if="releases.length === 0" value="" disabled>No releases available</option>
      <optgroup v-if="activeReleases.length > 0" label="Active">
        <option v-for="r in activeReleases" :key="r.id" :value="r.id">
          {{ r.displayName }}{{ r.milestones?.ga ? ` (GA: ${r.milestones.ga})` : '' }}
        </option>
      </optgroup>
      <optgroup v-if="archivedReleases.length > 0" label="Archived">
        <option v-for="r in archivedReleases" :key="r.id" :value="r.id">
          {{ r.displayName }}
        </option>
      </optgroup>
    </select>
    <span
      v-if="selectedRelease"
      class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      :class="selectedRelease.state === 'active'
        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'"
    >
      {{ selectedRelease.state }}
    </span>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, provide } from 'vue'
import { apiRequest } from '@shared/client/services/api'

const releases = ref([])
const loading = ref(true)
const selectedId = ref('')

const activeReleases = computed(() =>
  releases.value.filter(r => r.state === 'active')
)

const archivedReleases = computed(() =>
  releases.value.filter(r => r.state === 'archived')
)

const selectedRelease = computed(() =>
  releases.value.find(r => r.id === selectedId.value) || null
)

provide('selectedRelease', selectedRelease)

watch(selectedId, (newId) => {
  if (newId) {
    sessionStorage.setItem('releases_selectedReleaseId', newId)
  }
})

async function fetchReleases() {
  loading.value = true
  try {
    const data = await apiRequest('/modules/releases/registry')
    releases.value = data.releases || []

    // Restore previous selection or pick first active
    const saved = sessionStorage.getItem('releases_selectedReleaseId')
    if (saved && releases.value.some(r => r.id === saved)) {
      selectedId.value = saved
    } else if (activeReleases.value.length > 0) {
      selectedId.value = activeReleases.value[0].id
    } else if (releases.value.length > 0) {
      selectedId.value = releases.value[0].id
    }
  } catch {
    // API not available yet
  } finally {
    loading.value = false
  }
}

onMounted(fetchReleases)
</script>
