<template>
  <div class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
    <div class="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800">
      <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ title }}</h4>
      <div class="flex items-center gap-2">
        <template v-if="validationResult">
          <span v-if="validationResult.valid" class="text-green-600 dark:text-green-400 text-xs flex items-center gap-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
            {{ validationResult.message || 'OK' }}
          </span>
          <span v-else class="text-red-600 dark:text-red-400 text-xs flex items-center gap-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            {{ validationResult.message || 'Failed' }}
          </span>
        </template>
        <button
          @click="showEditModal = true"
          class="text-xs px-3 py-1 rounded bg-primary-600 text-white hover:bg-primary-700 transition-colors"
        >
          Configure
        </button>
        <button
          v-if="hasValidator"
          @click="$emit('test')"
          :disabled="testing"
          class="text-xs px-3 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {{ testing ? 'Testing...' : 'Test' }}
        </button>
      </div>
    </div>
    <div class="divide-y divide-gray-100 dark:divide-gray-700">
      <template v-for="(secretGroup, gIdx) in groupedSecrets" :key="gIdx">
        <template v-if="secretGroup.exclusive">
          <div class="px-4 py-2">
            <template v-for="(secret, sIdx) in secretGroup.secrets" :key="secret.key">
              <div class="flex items-center justify-between py-1">
                <div>
                  <code class="text-xs font-mono text-gray-800 dark:text-gray-200">{{ secret.key }}</code>
                  <p v-if="secret.description" class="text-xs text-gray-500 dark:text-gray-400">{{ secret.description }}</p>
                </div>
                <SecretStatusBadge :configured="secret.configured" :required="secret.required" />
              </div>
              <div v-if="sIdx < secretGroup.secrets.length - 1" class="text-center text-xs text-gray-400 dark:text-gray-500 py-1">-- OR --</div>
            </template>
          </div>
        </template>
        <template v-else>
          <div v-for="secret in secretGroup.secrets" :key="secret.key" class="flex items-center justify-between px-4 py-2">
            <div>
              <code class="text-xs font-mono text-gray-800 dark:text-gray-200">{{ secret.key }}</code>
              <p v-if="secret.description" class="text-xs text-gray-500 dark:text-gray-400">{{ secret.description }}</p>
            </div>
            <SecretStatusBadge :configured="secret.configured" :required="secret.required" />
          </div>
        </template>
      </template>
      <div v-if="platformGroups && platformGroups.length > 0" class="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
        Platform: {{ platformGroups.join(', ') }}
      </div>
      <div v-if="dynamic" class="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
        Dynamic: {{ dynamic.pattern }} ({{ dynamic.description || 'per-instance' }})
      </div>
    </div>

    <!-- Edit Secrets Modal -->
    <div v-if="showEditModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" @click="showEditModal = false" />
      <div class="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Configure {{ title }}</h3>

        <div class="space-y-4">
          <div v-for="secret in secrets" :key="secret.key" class="space-y-2">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {{ secret.key }}
              <span v-if="secret.required" class="text-red-500">*</span>
            </label>
            <p v-if="secret.description" class="text-xs text-gray-500 dark:text-gray-400 mb-1">
              {{ secret.description }}
            </p>
            <div class="flex gap-2">
              <input
                v-model="editValues[secret.key]"
                :type="showValues[secret.key] ? 'text' : 'password'"
                :placeholder="secret.configured ? '••••••••' : 'Enter value'"
                class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <button
                @click="showValues[secret.key] = !showValues[secret.key]"
                class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Toggle visibility"
              >
                <svg v-if="showValues[secret.key]" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                </svg>
                <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
              </button>
            </div>
            <p v-if="secret.configured && !editValues[secret.key]" class="text-xs text-gray-500 dark:text-gray-400">
              Currently configured. Leave blank to keep existing value.
            </p>
          </div>
        </div>

        <div v-if="saveError" class="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
          {{ saveError }}
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <button
            @click="showEditModal = false; saveError = null"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >Cancel</button>
          <button
            @click="saveSecrets"
            :disabled="saving"
            class="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >{{ saving ? 'Saving...' : 'Save' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { apiRequest } from '@shared/client/services/api'
import SecretStatusBadge from './SecretStatusBadge.vue'

const props = defineProps({
  title: { type: String, required: true },
  secrets: { type: Array, default: () => [] },
  platformGroups: { type: Array, default: null },
  dynamic: { type: Object, default: null },
  exclusiveGroups: { type: Object, default: null },
  hasValidator: { type: Boolean, default: false },
  testing: { type: Boolean, default: false },
  validationResult: { type: Object, default: null }
})

const emit = defineEmits(['test', 'saved'])

const showEditModal = ref(false)
const editValues = ref({})
const showValues = ref({})
const saving = ref(false)
const saveError = ref(null)

// Initialize editValues when modal opens
watch(showEditModal, (isOpen) => {
  if (isOpen) {
    editValues.value = {}
    showValues.value = {}
    saveError.value = null
    // Initialize empty values for all secrets
    props.secrets.forEach(secret => {
      editValues.value[secret.key] = ''
      showValues.value[secret.key] = false
    })
  }
})

async function saveSecrets() {
  saving.value = true
  saveError.value = null

  try {
    // Only send non-empty values
    const updates = {}
    for (const [key, value] of Object.entries(editValues.value)) {
      if (value && value.trim()) {
        updates[key] = value.trim()
      }
    }

    if (Object.keys(updates).length === 0) {
      saveError.value = 'No changes to save'
      saving.value = false
      return
    }

    // Send to backend
    await apiRequest('/admin/secrets/update', {
      method: 'POST',
      body: JSON.stringify({ secrets: updates })
    })

    // Success
    showEditModal.value = false
    emit('saved')

    // Reload the page to refresh secret status
    setTimeout(() => {
      window.location.reload()
    }, 500)
  } catch (error) {
    saveError.value = error.message || 'Failed to save secrets'
  } finally {
    saving.value = false
  }
}

const groupedSecrets = computed(() => {
  const groups = []
  const exclusiveGroupMap = props.exclusiveGroups || {}
  const processedKeys = new Set()

  // Handle exclusive groups
  for (const [_groupName, groupData] of Object.entries(exclusiveGroupMap)) {
    if (!groupData.members || groupData.members.length === 0) continue
    const groupSecrets = props.secrets.filter(s => groupData.members.includes(s.key))
    if (groupSecrets.length > 0) {
      groups.push({ exclusive: true, secrets: groupSecrets })
      for (const s of groupSecrets) processedKeys.add(s.key)
    }
  }

  // Remaining secrets (non-exclusive)
  const remaining = props.secrets.filter(s => !processedKeys.has(s.key))
  if (remaining.length > 0) {
    groups.push({ exclusive: false, secrets: remaining })
  }

  return groups
})
</script>
