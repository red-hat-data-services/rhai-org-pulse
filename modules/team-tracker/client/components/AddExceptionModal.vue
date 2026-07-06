<template>
  <div
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    @click.self="$emit('close')"
  >
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Add Field Exception</h2>
        <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Body -->
      <div class="px-6 py-5 space-y-4">
        <div v-if="error" class="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-400 text-sm">
          {{ error }}
        </div>

        <!-- Entity Type -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
          <select
            v-model="entityType"
            :disabled="isPrefilled"
            class="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm disabled:opacity-60"
          >
            <option value="person">Person</option>
            <option value="team">Team</option>
          </select>
        </div>

        <!-- Entity Selector -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {{ entityType === 'person' ? 'Person' : 'Team' }}
          </label>
          <template v-if="isPrefilled && selectedEntity">
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300">
                {{ selectedEntity.label }}
              </span>
            </div>
          </template>
          <template v-else>
            <div class="relative">
              <input
                v-model="entitySearch"
                type="text"
                :placeholder="entityType === 'person' ? 'Search by name or UID...' : 'Search by team name...'"
                class="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
              />
            </div>
            <ul v-if="entitySearch && filteredEntities.length > 0" class="mt-1 max-h-36 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md divide-y divide-gray-100 dark:divide-gray-700">
              <li
                v-for="entity in filteredEntities"
                :key="entity.id"
                @click="selectEntity(entity)"
                class="px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <span class="font-medium text-gray-900 dark:text-gray-100">{{ entity.label }}</span>
                <span v-if="entity.sub" class="ml-2 text-xs text-gray-500 dark:text-gray-400">{{ entity.sub }}</span>
              </li>
            </ul>
            <div v-if="selectedEntity" class="mt-1 flex items-center gap-2">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300">
                {{ selectedEntity.label }}
              </span>
              <button @click="clearEntity" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <svg class="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </template>
        </div>

        <!-- Field Selector -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Field</label>
          <select
            v-model="selectedFieldId"
            :disabled="isPrefilled"
            class="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm disabled:opacity-60"
          >
            <option value="">Select a field...</option>
            <option v-for="field in availableFields" :key="field.id" :value="field.id">{{ field.label }}</option>
          </select>
        </div>

        <!-- Reason -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason</label>
          <textarea
            v-model="reason"
            rows="3"
            maxlength="500"
            placeholder="Why is this field intentionally unset?"
            class="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
          />
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">{{ reason.length }}/500</p>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
        <button
          @click="$emit('close')"
          class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
        >
          Cancel
        </button>
        <button
          @click="handleCreate"
          :disabled="!canSubmit || saving"
          class="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50"
        >
          {{ saving ? 'Creating...' : 'Create Exception' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { apiRequest } from '@shared/client/services/api'

const props = defineProps({
  people: { type: Array, default: () => [] },
  teams: { type: Array, default: () => [] },
  orgKeys: { type: Array, default: () => [] },
  fieldDefinitions: { type: Object, default: () => ({ person: [], team: [] }) },
  prefillEntityType: { type: String, default: null },
  prefillEntityId: { type: String, default: null },
  prefillEntityLabel: { type: String, default: null },
  prefillFieldId: { type: String, default: null }
})

const emit = defineEmits(['close', 'created'])

const entityType = ref(props.prefillEntityType || 'person')
const entitySearch = ref('')
const selectedEntity = ref(
  props.prefillEntityId
    ? { id: props.prefillEntityId, label: props.prefillEntityLabel || props.prefillEntityId }
    : null
)
const selectedFieldId = ref(props.prefillFieldId || '')
const reason = ref('')
const saving = ref(false)
const error = ref(null)

const isPrefilled = computed(() => !!props.prefillEntityId)

// Clear selection when type changes (skip if pre-filled on mount)
watch(entityType, (newVal, oldVal) => {
  if (oldVal === null) return
  selectedEntity.value = null
  entitySearch.value = ''
  selectedFieldId.value = ''
})

const filteredEntities = computed(() => {
  const q = entitySearch.value.trim().toLowerCase()
  if (!q) return []

  if (entityType.value === 'person') {
    return props.people
      .filter(p => p.name?.toLowerCase().includes(q) || p.uid?.toLowerCase().includes(q))
      .slice(0, 20)
      .map(p => ({ id: p.uid, label: p.name, sub: p.uid }))
  } else {
    return props.teams
      .filter(t => t.name?.toLowerCase().includes(q))
      .slice(0, 20)
      .map(t => {
        const org = props.orgKeys.find(o => o.key === t.orgKey)
        return { id: t.id, label: t.name, sub: org?.displayName || t.orgKey }
      })
  }
})

const availableFields = computed(() => {
  const scope = entityType.value === 'person' ? 'person' : 'team'
  const fields = (props.fieldDefinitions[scope] || [])
    .filter(f => !f.deleted && f.visible)
    .map(f => ({ id: f.id, label: f.label }))

  if (entityType.value === 'team') {
    fields.push({ id: '__boards__', label: 'Boards' })
  }

  return fields
})

const canSubmit = computed(() =>
  selectedEntity.value && selectedFieldId.value && reason.value.trim()
)

function selectEntity(entity) {
  selectedEntity.value = entity
  entitySearch.value = ''
}

function clearEntity() {
  selectedEntity.value = null
  entitySearch.value = ''
}

async function handleCreate() {
  if (!canSubmit.value) return
  saving.value = true
  error.value = null

  try {
    await apiRequest('/modules/team-tracker/field-exceptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entityType: entityType.value,
        entityId: selectedEntity.value.id,
        fieldId: selectedFieldId.value,
        reason: reason.value.trim()
      })
    })
    emit('created')
    emit('close')
  } catch (err) {
    error.value = err.message || 'Failed to create exception'
  } finally {
    saving.value = false
  }
}
</script>
