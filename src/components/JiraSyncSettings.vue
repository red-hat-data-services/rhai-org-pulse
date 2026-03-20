<template>
  <div class="space-y-6">
    <!-- Project Keys -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <h3 class="text-lg font-semibold text-gray-900 mb-3">Jira Project Filter</h3>
      <p class="text-sm text-gray-500 mb-4">
        Restrict Jira metrics to specific projects. When configured, only issues from these projects are included in person metrics.
        Leave empty to include all projects.
      </p>

      <div class="space-y-2 mb-4">
        <div
          v-for="(key, idx) in editKeys"
          :key="idx"
          class="flex items-center gap-2"
        >
          <input
            v-model="editKeys[idx]"
            placeholder="e.g. RHOAIENG"
            class="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 uppercase"
          />
          <button
            @click="editKeys.splice(idx, 1)"
            class="p-1 text-gray-400 hover:text-red-600 transition-colors"
            title="Remove"
          >
            <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <button
        @click="editKeys.push('')"
        class="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
      >
        <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Add project key
      </button>
    </div>

    <!-- Save -->
    <div class="flex items-center gap-3">
      <button
        @click="handleSave"
        :disabled="saving"
        class="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {{ saving ? 'Saving...' : 'Save Configuration' }}
      </button>
      <span v-if="saveMessage" class="text-sm" :class="saveError ? 'text-red-600' : 'text-green-600'">
        {{ saveMessage }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useJiraSync } from '../composables/useJiraSync'

const emit = defineEmits(['toast'])

const { config, saving, fetchConfig, saveConfig } = useJiraSync()

const editKeys = ref([])
const saveMessage = ref(null)
const saveError = ref(false)

function populateForm() {
  if (config.value && Array.isArray(config.value.projectKeys)) {
    editKeys.value = [...config.value.projectKeys]
  } else {
    editKeys.value = []
  }
}

watch(config, populateForm)

onMounted(async () => {
  await fetchConfig()
  populateForm()
})

async function handleSave() {
  saveMessage.value = null
  saveError.value = false

  const projectKeys = editKeys.value
    .map(k => k.trim().toUpperCase())
    .filter(Boolean)

  try {
    await saveConfig({ projectKeys })
    saveMessage.value = 'Configuration saved. Changes will take effect on the next refresh.'
    emit('toast', { message: 'Jira sync configuration saved', type: 'success' })
    setTimeout(() => { saveMessage.value = null }, 5000)
  } catch (err) {
    saveMessage.value = err.message
    saveError.value = true
  }
}
</script>
