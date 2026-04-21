<script setup>
import { ref, computed, watch } from 'vue'
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
    editValue.value = raw || ''
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

function resolvePersonName(uid) {
  const person = props.people.find(p => p.uid === uid)
  return person ? person.name : null
}

function isPersonRefType(field) {
  return field?.type === 'person-reference-linked'
}
</script>

<template>
  <div class="space-y-2">
    <div v-if="demoInfo" class="p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-blue-700 dark:text-blue-300 text-xs">
      {{ demoInfo }}
    </div>
    <div v-for="field in visibleFields" :key="field.id" class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
      <span class="text-sm text-gray-600 dark:text-gray-400 w-32 shrink-0">
        {{ field.label }}<span v-if="field.required" class="text-red-500 ml-0.5">*</span>:
      </span>
      <template v-if="editingFieldId === field.id">
        <!-- Multi-value constrained: checkbox group (<=8) -->
        <div v-if="isMultiValue(field) && field.allowedValues && field.allowedValues.length <= 8" class="flex-1 space-y-1">
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
        <div v-else-if="isMultiValue(field) && field.allowedValues && field.allowedValues.length > 8" class="flex-1 space-y-1">
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
            class="flex-1 w-full rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 text-sm"
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
          class="flex-1 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 text-sm"
        >
          <option value="">-</option>
          <option v-for="val in field.allowedValues" :key="val" :value="val">{{ val }}</option>
        </select>
        <!-- Person reference -->
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
        <div class="flex gap-1 shrink-0">
          <button class="text-xs text-primary-600 dark:text-primary-400" :disabled="saving" @click="saveEdit(field.id)">Save</button>
          <button class="text-xs text-gray-500 dark:text-gray-400" @click="editingFieldId = null">Cancel</button>
        </div>
      </template>
      <template v-else>
        <!-- Multi-value display -->
        <div v-if="isMultiValue(field)" class="flex flex-wrap gap-1 flex-1">
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
          <template v-if="customFields[field.id]">
            <span v-if="resolvePersonName(customFields[field.id])" class="text-primary-600 dark:text-primary-400">{{ resolvePersonName(customFields[field.id]) }}</span>
            <span v-else class="text-gray-400 dark:text-gray-500">{{ customFields[field.id] }} <span class="text-xs">(not found)</span></span>
          </template>
          <span v-else class="text-gray-400 dark:text-gray-500">-</span>
        </span>
        <!-- Single-value display -->
        <span v-else class="text-sm text-gray-900 dark:text-gray-100 flex-1">{{ coercedDisplay(field) || '-' }}</span>
        <button
          v-if="canEdit"
          class="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
          @click="startEdit(field.id)"
        >Edit</button>
      </template>
      <!-- Required field warning -->
      <div
        v-if="field.required && touchedFields.has(field.id) && fieldWarnings[field.id]"
        class="w-full text-xs text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded px-2 py-1 mt-0.5"
      >
        {{ fieldWarnings[field.id] }}
      </div>
    </div>
    <div v-if="visibleFields.length === 0" class="text-sm text-gray-500 dark:text-gray-400">
      No custom fields configured
    </div>
  </div>
</template>
