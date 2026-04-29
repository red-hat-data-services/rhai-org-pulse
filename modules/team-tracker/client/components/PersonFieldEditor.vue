<script setup>
import { ref, computed, watch, inject } from 'vue'
import { useFieldDefinitions } from '@shared/client/composables/useFieldDefinitions'
import PersonAutocomplete from './PersonAutocomplete.vue'

const props = defineProps({
  uid: { type: String, required: true },
  customFields: { type: Object, default: () => ({}) },
  fieldDefinitions: { type: Array, default: () => [] },
  canEdit: { type: Boolean, default: false },
  people: { type: Array, default: () => [] }
})

const emit = defineEmits(['updated'])
const nav = inject('moduleNav', null)

const { demoToast, updatePersonFields } = useFieldDefinitions()

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

function isMultiValue(field) {
  return field.type === 'constrained' && field.multiValue
}

function displayValues(field) {
  const raw = props.customFields[field.id]
  const vals = coerceForDisplay(raw, field)
  if (!Array.isArray(vals)) return []
  return vals.slice(0, 3)
}

function overflowCount(field) {
  const raw = props.customFields[field.id]
  const vals = coerceForDisplay(raw, field)
  if (!Array.isArray(vals)) return 0
  return Math.max(0, vals.length - 3)
}

function coercedDisplay(field) {
  const raw = props.customFields[field.id]
  return coerceForDisplay(raw, field)
}

function startEdit(fieldId) {
  editingFieldId.value = fieldId
  const field = props.fieldDefinitions.find(f => f.id === fieldId)
  const raw = props.customFields[fieldId] ?? null

  if (field?.type === 'constrained' && field?.multiValue) {
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

    const result = await updatePersonFields(props.uid, { [fieldId]: valueToSave })
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

function resolvePersonName(rawUid) {
  const uid = Array.isArray(rawUid) ? rawUid[0] : rawUid
  if (!uid) return null
  const person = props.people.find(p => p.uid === uid)
  return person ? person.name : null
}

function resolvePersonUid(rawUid) {
  return Array.isArray(rawUid) ? rawUid[0] : rawUid
}

function isPersonRefType(field) {
  return field?.type === 'person-reference-linked'
}
</script>

<template>
  <div>
    <div v-if="demoInfo" class="px-6 pb-2">
      <div class="p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-blue-700 dark:text-blue-300 text-xs">
        {{ demoInfo }}
      </div>
    </div>

    <!-- Divider between core info and custom fields -->
    <div v-if="visibleFields.length > 0" class="border-t border-gray-100 dark:border-gray-700/50 mt-4 pt-3">
      <div class="grid grid-cols-2 gap-3 text-sm">
        <div v-for="field in visibleFields" :key="field.id" :class="['group', editingFieldId === field.id ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md px-2 py-1.5' : '']">
          <!-- Edit mode -->
          <template v-if="editingFieldId === field.id">
            <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">
              {{ field.label }}<span v-if="field.required" class="text-red-500 ml-0.5">*</span>
            </div>
            <!-- Multi-value constrained: checkbox group (<=8) -->
            <div v-if="isMultiValue(field) && field.allowedValues && field.allowedValues.length <= 8" class="space-y-1">
              <label v-for="opt in field.allowedValues" :key="opt" class="flex items-center gap-2">
                <input
                  type="checkbox"
                  :value="opt"
                  v-model="editValue"
                  class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                />
                <span class="text-sm text-gray-700 dark:text-gray-300">{{ opt }}</span>
              </label>
            </div>
            <!-- Multi-value constrained: combobox (9+) -->
            <div v-else-if="isMultiValue(field) && field.allowedValues && field.allowedValues.length > 8" class="space-y-1">
              <div class="flex flex-wrap gap-1 mb-1">
                <span
                  v-for="v in editValue"
                  :key="v"
                  class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                >
                  {{ v }}
                  <button class="ml-1 text-primary-500 hover:text-primary-700" @click="editValue = editValue.filter(x => x !== v)">&times;</button>
                </span>
              </div>
              <select
                class="w-full rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 text-sm"
                @change="(e) => { if (e.target.value && !editValue.includes(e.target.value)) editValue.push(e.target.value); e.target.value = '' }"
              >
                <option value="">Add option...</option>
                <option v-for="opt in field.allowedValues.filter(o => !editValue.includes(o))" :key="opt" :value="opt">{{ opt }}</option>
              </select>
            </div>
            <!-- Single-value constrained -->
            <select
              v-else-if="field.type === 'constrained' && field.allowedValues"
              v-model="editValue"
              class="w-full rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 text-sm"
            >
              <option value="">—</option>
              <option v-for="val in field.allowedValues" :key="val" :value="val">{{ val }}</option>
            </select>
            <!-- Person reference -->
            <PersonAutocomplete
              v-else-if="isPersonRefType(field)"
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
              class="w-full rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 text-sm"
              @keyup.enter="saveEdit(field.id)"
              @keyup.escape="editingFieldId = null"
            >
            <div class="flex gap-1.5 mt-1.5">
              <button class="px-2 py-0.5 text-xs font-medium text-white bg-primary-600 rounded hover:bg-primary-700 disabled:opacity-50 transition-colors" :disabled="saving" @click="saveEdit(field.id)">Save</button>
              <button class="px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" @click="editingFieldId = null">Cancel</button>
            </div>
          </template>

          <!-- Display mode -->
          <template v-else>
            <div class="flex items-center gap-2.5">
              <!-- Generic field icon -->
              <svg class="h-4 w-4 text-gray-400 dark:text-gray-500 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <div class="flex-1 min-w-0">
                <div class="text-[11px] text-gray-400 dark:text-gray-500 leading-tight">{{ field.label }}<span v-if="field.required" class="text-red-500 ml-0.5">*</span></div>
                <!-- Multi-value display -->
                <div v-if="isMultiValue(field)" class="flex flex-wrap gap-1 mt-0.5">
                  <span
                    v-for="v in displayValues(field)"
                    :key="v"
                    class="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                  >{{ v }}</span>
                  <span v-if="overflowCount(field) > 0" class="text-xs text-gray-400 dark:text-gray-500">+{{ overflowCount(field) }}</span>
                  <span v-if="displayValues(field).length === 0" class="text-gray-400 dark:text-gray-500">—</span>
                </div>
                <!-- Person reference linked display -->
                <div v-else-if="field.type === 'person-reference-linked'" class="truncate">
                  <template v-if="resolvePersonUid(customFields[field.id])">
                    <button
                      v-if="resolvePersonName(customFields[field.id])"
                      class="text-primary-600 dark:text-primary-400 hover:underline"
                      @click="nav?.navigateTo('person-detail', { uid: resolvePersonUid(customFields[field.id]) })"
                    >{{ resolvePersonName(customFields[field.id]) }}</button>
                    <span v-else class="text-gray-400 dark:text-gray-500 text-xs">{{ resolvePersonUid(customFields[field.id]) }} (not found)</span>
                  </template>
                  <span v-else class="text-gray-400 dark:text-gray-500">—</span>
                </div>
                <!-- Single-value display -->
                <div v-else class="text-gray-900 dark:text-gray-100 truncate">{{ coercedDisplay(field) || '—' }}</div>
              </div>
              <!-- Edit pencil (hover-visible) -->
              <button
                v-if="canEdit"
                class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
                @click="startEdit(field.id)"
                :title="'Edit ' + field.label"
              >
                <svg class="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>
          </template>

          <!-- Required field warning -->
          <div
            v-if="field.required && touchedFields.has(field.id) && fieldWarnings[field.id]"
            class="text-xs text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded px-2 py-1 mt-1"
          >
            {{ fieldWarnings[field.id] }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
