<script setup>
import { ref, computed, watch } from 'vue'
import { useTeams } from '@shared/client/composables/useTeams'
import PersonAutocomplete from './PersonAutocomplete.vue'
import ConstrainedAutocomplete from './ConstrainedAutocomplete.vue'

const props = defineProps({
  teamId: { type: String, required: true },
  metadata: { type: Object, default: () => ({}) },
  fieldDefinitions: { type: Array, default: () => [] },
  canEdit: { type: Boolean, default: false },
  people: { type: Array, default: () => [] },
  inline: { type: Boolean, default: false }
})

const emit = defineEmits(['updated', 'navigate-person'])

const { demoToast, updateTeamFields } = useTeams()

const editingFieldId = ref(null)
const editValue = ref(null)
const saving = ref(false)
const demoInfo = ref(null)
const touchedFields = ref(new Set())
const fieldWarnings = ref({})

watch(demoToast, (msg) => {
  if (msg) { demoInfo.value = msg; setTimeout(() => { demoInfo.value = null }, 3000) }
})

const visibleFields = computed(() =>
  props.fieldDefinitions.filter(f => f.visible && !f.deleted)
)

function coerceForDisplay(value, fieldDef) {
  if (fieldDef.multiValue) {
    return Array.isArray(value) ? value : (value ? [value] : [])
  }
  return Array.isArray(value) ? (value[0] || null) : value
}

function isMultiValueConstrained(field) {
  return field.type === 'constrained' && field.multiValue
}

function isMultiValuePersonRef(field) {
  return field.type === 'person-reference-linked' && field.multiValue
}

function personNameByUid(uid) {
  const person = props.people.find(p => p.uid === uid)
  return person?.name || uid
}

function addPersonToEditValue(uid) {
  if (Array.isArray(editValue.value) && !editValue.value.includes(uid)) {
    editValue.value.push(uid)
  }
}

function removePersonFromEditValue(uid) {
  if (Array.isArray(editValue.value)) {
    editValue.value = editValue.value.filter(u => u !== uid)
  }
}

function displayValues(field) {
  const raw = props.metadata[field.id]
  const vals = coerceForDisplay(raw, field)
  if (!Array.isArray(vals)) return []
  return vals.slice(0, 3)
}

function overflowCount(field) {
  const raw = props.metadata[field.id]
  const vals = coerceForDisplay(raw, field)
  if (!Array.isArray(vals)) return 0
  return Math.max(0, vals.length - 3)
}

function coercedDisplay(field) {
  const raw = props.metadata[field.id]
  return coerceForDisplay(raw, field)
}

function startEdit(fieldId) {
  editingFieldId.value = fieldId
  const field = props.fieldDefinitions.find(f => f.id === fieldId)
  const raw = props.metadata[fieldId] ?? null

  if (field?.multiValue) {
    editValue.value = Array.isArray(raw) ? [...raw] : (raw ? [raw] : [])
  } else if (isPersonRefType(field)) {
    editValue.value = (Array.isArray(raw) ? raw[0] : raw) || ''
  } else {
    editValue.value = Array.isArray(raw) ? (raw[0] || '') : (raw || '')
  }
}

async function saveEdit(fieldId) {
  saving.value = true
  touchedFields.value.add(fieldId)
  try {
    const field = props.fieldDefinitions.find(f => f.id === fieldId)
    let valueToSave = editValue.value

    if (field?.type === 'constrained' && !field?.multiValue) {
      valueToSave = valueToSave || null
    }
    if (field?.type !== 'constrained' && !field?.multiValue) {
      valueToSave = valueToSave || null
    }

    const result = await updateTeamFields(props.teamId, { [fieldId]: valueToSave })
    editingFieldId.value = null

    // Handle warnings
    if (result && result._warnings) {
      for (const w of result._warnings) {
        const matchField = visibleFields.value.find(f => w.includes(f.label))
        if (matchField) {
          fieldWarnings.value[matchField.id] = w
        }
      }
    } else {
      delete fieldWarnings.value[fieldId]
    }

    emit('updated')
  } catch {
    // Error handled by composable
  } finally {
    saving.value = false
  }
}

function resolvePersonEntries(field) {
  const raw = props.metadata[field.id]
  const uids = Array.isArray(raw) ? raw : (raw ? [raw] : [])
  return uids.map(uid => {
    const person = props.people.find(p => p.uid === uid)
    return { uid, name: person?.name || null }
  })
}

function isPersonRefType(field) {
  return field?.type === 'person-reference-linked'
}
</script>

<template>
  <div :class="inline ? 'flex flex-wrap items-center gap-x-6 gap-y-2' : 'space-y-2'">
    <div v-if="demoInfo" class="p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-blue-700 dark:text-blue-300 text-xs w-full">
      {{ demoInfo }}
    </div>
    <div
      v-for="field in visibleFields"
      :key="field.id"
      :class="[
        inline ? 'flex items-center gap-1.5' : 'flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2',
        editingFieldId === field.id ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md px-2 py-1' : ''
      ]"
    >
      <span :class="inline ? 'text-sm text-gray-400 dark:text-gray-500 shrink-0' : 'text-sm text-gray-600 dark:text-gray-400 w-32 shrink-0'">
        {{ field.label }}<span v-if="field.required" class="text-red-500 ml-0.5">*</span>:
      </span>
      <template v-if="editingFieldId === field.id">
        <!-- Constrained field (single or multi-value): autocomplete -->
        <ConstrainedAutocomplete
          v-if="field.type === 'constrained' && field.allowedValues"
          class="flex-1"
          :model-value="editValue"
          :options="field.allowedValues"
          :multi-value="!!field.multiValue"
          @update:model-value="editValue = $event"
          @save="saveEdit(field.id)"
          @cancel="editingFieldId = null"
        />
        <!-- Multi-value person reference -->
        <div v-else-if="isMultiValuePersonRef(field)" class="flex-1 space-y-1">
          <div class="flex flex-wrap gap-1 mb-1">
            <span
              v-for="uid in editValue"
              :key="uid"
              class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
            >
              {{ personNameByUid(uid) }}
              <button class="ml-1 text-primary-500 hover:text-primary-700" @click="removePersonFromEditValue(uid)">&times;</button>
            </span>
          </div>
          <PersonAutocomplete
            :model-value="''"
            :people="people.filter(p => !editValue.includes(p.uid))"
            placeholder="Add person..."
            @update:model-value="addPersonToEditValue($event)"
            @save="saveEdit(field.id)"
            @cancel="editingFieldId = null"
          />
        </div>
        <!-- Single-value person reference -->
        <PersonAutocomplete
          v-else-if="isPersonRefType(field)"
          class="flex-1"
          :model-value="editValue"
          :people="people"
          @update:model-value="editValue = $event"
          @save="saveEdit(field.id)"
          @cancel="editingFieldId = null"
        />
        <!-- Free text -->
        <input
          v-else
          v-model="editValue"
          class="flex-1 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 text-sm"
          @keyup.enter="saveEdit(field.id)"
          @keyup.escape="editingFieldId = null"
        >
        <div class="flex gap-1.5 shrink-0">
          <button class="px-2 py-0.5 text-xs font-medium text-white bg-primary-600 rounded hover:bg-primary-700 disabled:opacity-50 transition-colors" :disabled="saving" @click="saveEdit(field.id)">Save</button>
          <button class="px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" @click="editingFieldId = null">Cancel</button>
        </div>
      </template>
      <template v-else>
        <!-- Multi-value display -->
        <div v-if="isMultiValueConstrained(field)" class="flex flex-wrap gap-1 flex-1">
          <span
            v-for="v in displayValues(field)"
            :key="v"
            class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            {{ v }}
          </span>
          <span v-if="overflowCount(field) > 0" class="text-xs text-gray-400 dark:text-gray-500">+{{ overflowCount(field) }} more</span>
          <span v-if="displayValues(field).length === 0" class="text-sm text-gray-400 dark:text-gray-500">-</span>
        </div>
        <!-- Person reference linked display -->
        <span v-else-if="field.type === 'person-reference-linked'" class="text-sm text-gray-900 dark:text-gray-100 flex-1">
          <template v-if="resolvePersonEntries(field).length > 0">
            <template v-for="(entry, i) in resolvePersonEntries(field)" :key="entry.uid">
              <template v-if="i > 0">, </template>
              <button
                v-if="entry.name"
                class="text-primary-600 dark:text-primary-400 hover:underline"
                @click="emit('navigate-person', entry.uid)"
              >{{ entry.name }}</button>
              <span v-else class="text-gray-400 dark:text-gray-500">{{ entry.uid }} <span class="text-xs">(not found)</span></span>
            </template>
          </template>
          <span v-else class="text-gray-400 dark:text-gray-500">-</span>
        </span>
        <!-- Single-value display -->
        <span v-else class="text-sm text-gray-900 dark:text-gray-100 flex-1">{{ coercedDisplay(field) || '-' }}</span>
        <button
          v-if="canEdit"
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
          @click="startEdit(field.id)"
          :title="'Edit ' + field.label"
        >
          <svg class="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
      </template>
      <!-- Required field warning -->
      <div
        v-if="field.required && touchedFields.has(field.id) && fieldWarnings[field.id]"
        class="w-full text-xs text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded px-2 py-1 mt-0.5"
      >
        {{ fieldWarnings[field.id] }}
      </div>
    </div>
  </div>
</template>
