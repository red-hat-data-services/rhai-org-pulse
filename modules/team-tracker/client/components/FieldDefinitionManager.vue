<script setup>
import { ref, onMounted, watch } from 'vue'
import { useFieldDefinitions } from '@shared/client/composables/useFieldDefinitions'

const { definitions, loading, demoToast, fetchDefinitions, createField, updateField, deleteField } = useFieldDefinitions()

const activeTab = ref('person')
const newFieldLabel = ref('')
const newFieldType = ref('free-text')
const editingFieldId = ref(null)
const editLabel = ref('')
const error = ref(null)
const demoInfo = ref(null)

watch(demoToast, (msg) => {
  if (msg) { demoInfo.value = msg; setTimeout(() => { demoInfo.value = null }, 3000) }
})

const fieldTypes = [
  { value: 'free-text', label: 'Free Text' },
  { value: 'constrained', label: 'Constrained (dropdown)' },
  { value: 'person-reference-linked', label: 'Person Reference (linked)' },
  { value: 'person-reference-unlinked', label: 'Person Reference (unlinked)' }
]

onMounted(() => fetchDefinitions())

const activeFields = () => {
  const key = activeTab.value === 'person' ? 'personFields' : 'teamFields'
  return (definitions.value[key] || []).filter(f => !f.deleted)
}

async function handleCreate() {
  if (!newFieldLabel.value.trim()) return
  error.value = null
  try {
    await createField(activeTab.value, {
      label: newFieldLabel.value.trim(),
      type: newFieldType.value
    })
    newFieldLabel.value = ''
    newFieldType.value = 'free-text'
  } catch (e) {
    error.value = e.message || 'Failed to create field'
  }
}

function startEdit(field) {
  editingFieldId.value = field.id
  editLabel.value = field.label
}

async function saveEdit(fieldId) {
  if (!editLabel.value.trim()) return
  error.value = null
  try {
    await updateField(activeTab.value, fieldId, { label: editLabel.value.trim() })
    editingFieldId.value = null
  } catch (e) {
    error.value = e.message || 'Failed to update field'
  }
}

async function handleDelete(fieldId) {
  if (!confirm('Delete this field? Existing values will be hidden.')) return
  error.value = null
  try {
    await deleteField(activeTab.value, fieldId)
  } catch (e) {
    error.value = e.message || 'Failed to delete field'
  }
}

async function toggleVisibility(field) {
  await updateField(activeTab.value, field.id, { visible: !field.visible })
}
</script>

<template>
  <div class="space-y-4">
    <h3 class="text-lg font-medium text-gray-900">Field Definitions</h3>

    <!-- Tabs -->
    <div class="flex border-b">
      <button
        class="px-4 py-2 text-sm font-medium -mb-px border-b-2"
        :class="activeTab === 'person' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'"
        @click="activeTab = 'person'"
      >Person Fields</button>
      <button
        class="px-4 py-2 text-sm font-medium -mb-px border-b-2"
        :class="activeTab === 'team' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'"
        @click="activeTab = 'team'"
      >Team Fields</button>
    </div>

    <div v-if="demoInfo" class="p-2 bg-blue-50 border border-blue-200 rounded text-blue-700 text-sm">
      {{ demoInfo }}
    </div>
    <div v-if="error" class="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
      {{ error }}
    </div>

    <!-- Create form -->
    <div class="flex items-end gap-3">
      <div class="flex-1">
        <label class="block text-sm font-medium text-gray-700 mb-1">Label</label>
        <input
          v-model="newFieldLabel"
          type="text"
          class="block w-full rounded border-gray-300 shadow-sm text-sm"
          placeholder="e.g., Focus Area"
          @keyup.enter="handleCreate"
        >
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Type</label>
        <select v-model="newFieldType" class="rounded border-gray-300 text-sm">
          <option v-for="t in fieldTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
        </select>
      </div>
      <button
        class="px-4 py-2 bg-primary-600 text-white text-sm rounded hover:bg-primary-700 disabled:opacity-50"
        :disabled="!newFieldLabel.trim()"
        @click="handleCreate"
      >
        Add
      </button>
    </div>

    <!-- Field list -->
    <div v-if="loading" class="text-sm text-gray-500">Loading...</div>
    <ul v-else class="divide-y divide-gray-200 border rounded">
      <li v-for="field in activeFields()" :key="field.id" class="flex items-center justify-between p-3">
        <div v-if="editingFieldId === field.id" class="flex items-center gap-2 flex-1">
          <input
            v-model="editLabel"
            class="block flex-1 rounded border-gray-300 shadow-sm text-sm"
            @keyup.enter="saveEdit(field.id)"
            @keyup.escape="editingFieldId = null"
          >
          <button class="text-sm text-primary-600" @click="saveEdit(field.id)">Save</button>
          <button class="text-sm text-gray-500" @click="editingFieldId = null">Cancel</button>
        </div>
        <div v-else class="flex-1">
          <span class="font-medium text-gray-900">{{ field.label }}</span>
          <span class="text-xs text-gray-500 ml-2">{{ field.type }}</span>
        </div>
        <div v-if="editingFieldId !== field.id" class="flex items-center gap-2">
          <button
            class="text-xs"
            :class="field.visible ? 'text-green-600' : 'text-gray-400'"
            @click="toggleVisibility(field)"
          >
            {{ field.visible ? 'Visible' : 'Hidden' }}
          </button>
          <button class="text-sm text-gray-500 hover:text-gray-700" @click="startEdit(field)">Edit</button>
          <button class="text-sm text-red-500 hover:text-red-700" @click="handleDelete(field.id)">Delete</button>
        </div>
      </li>
      <li v-if="activeFields().length === 0" class="p-3 text-sm text-gray-500 text-center">
        No fields defined yet
      </li>
    </ul>
  </div>
</template>
