<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useFieldDefinitions } from '@shared/client/composables/useFieldDefinitions'

const { definitions, loading, demoToast, fetchDefinitions, createField, updateField, deleteField } = useFieldDefinitions()

const activeTab = ref('person')
const showCreateModal = ref(false)
const newFieldLabel = ref('')
const newFieldType = ref('free-text')
const newFieldMultiValue = ref(false)
const newFieldOptions = ref([])
const newOptionInput = ref('')
const editingFieldId = ref(null)
const editLabel = ref('')
const showOptionsModal = ref(null)
const editOptions = ref([])
const editOptionInput = ref('')
const error = ref(null)
const demoInfo = ref(null)

watch(demoToast, (msg) => {
  if (msg) { demoInfo.value = msg; setTimeout(() => { demoInfo.value = null }, 3000) }
})

const fieldTypes = [
  { value: 'free-text', label: 'Free Text' },
  { value: 'constrained', label: 'Constrained (dropdown)' },
  { value: 'person-reference-linked', label: 'Person Reference' }
]

const fieldTypeLabels = Object.fromEntries(fieldTypes.map(t => [t.value, t.label]))

onMounted(() => fetchDefinitions())

const activeFields = computed(() => {
  const key = activeTab.value === 'person' ? 'personFields' : 'teamFields'
  return (definitions.value[key] || []).filter(f => !f.deleted)
})

function openCreateModal() {
  newFieldLabel.value = ''
  newFieldType.value = 'free-text'
  newFieldMultiValue.value = false
  newFieldOptions.value = []
  newOptionInput.value = ''
  error.value = null
  showCreateModal.value = true
}

function addNewOption() {
  const val = newOptionInput.value.trim()
  if (val && !newFieldOptions.value.includes(val)) {
    newFieldOptions.value.push(val)
  }
  newOptionInput.value = ''
}

function removeNewOption(index) {
  newFieldOptions.value.splice(index, 1)
}

const createDisabled = computed(() => {
  if (!newFieldLabel.value.trim()) return true
  if (newFieldType.value === 'constrained' && newFieldOptions.value.length === 0) return true
  return false
})

async function handleCreate() {
  if (createDisabled.value) return
  error.value = null
  try {
    const body = {
      label: newFieldLabel.value.trim(),
      type: newFieldType.value
    }
    if (newFieldType.value === 'constrained') {
      body.allowedValues = newFieldOptions.value
      body.multiValue = newFieldMultiValue.value
    }
    await createField(activeTab.value, body)
    showCreateModal.value = false
  } catch (e) {
    error.value = e.message || 'Failed to create field'
  }
}

const editType = ref('')

function startEdit(field) {
  editingFieldId.value = field.id
  editLabel.value = field.label
  editType.value = field.type
}

async function saveEdit(fieldId) {
  if (!editLabel.value.trim()) return
  error.value = null
  try {
    const updates = { label: editLabel.value.trim() }
    const originalField = activeFields.value.find(f => f.id === fieldId)
    if (originalField && editType.value !== originalField.type) {
      updates.type = editType.value
    }
    await updateField(activeTab.value, fieldId, updates)
    editingFieldId.value = null
  } catch (e) {
    error.value = e.message || 'Failed to update field'
  }
}

function openOptionsModal(field) {
  showOptionsModal.value = field
  editOptions.value = [...(field.allowedValues || [])]
  editOptionInput.value = ''
  error.value = null
}

function addEditOption() {
  const val = editOptionInput.value.trim()
  if (val && !editOptions.value.includes(val)) {
    editOptions.value.push(val)
  }
  editOptionInput.value = ''
}

function removeEditOption(index) {
  editOptions.value.splice(index, 1)
}

async function saveOptions() {
  if (!showOptionsModal.value) return
  error.value = null
  try {
    await updateField(activeTab.value, showOptionsModal.value.id, { allowedValues: editOptions.value })
    showOptionsModal.value = null
  } catch (e) {
    error.value = e.message || 'Failed to update options'
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
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-medium text-gray-900">Field Definitions</h3>
      <button
        class="px-4 py-2 bg-primary-600 text-white text-sm rounded hover:bg-primary-700"
        @click="openCreateModal"
      >
        Add Field
      </button>
    </div>

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
    <div v-if="error && !showCreateModal && !showOptionsModal" class="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
      {{ error }}
    </div>

    <!-- Field list -->
    <div v-if="loading" class="text-sm text-gray-500">Loading...</div>
    <ul v-else class="divide-y divide-gray-200 border rounded">
      <li v-for="field in activeFields" :key="field.id" :class="['flex items-center justify-between p-3', editingFieldId === field.id ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-l-blue-300 dark:border-l-blue-700' : '']">
        <div v-if="editingFieldId === field.id" class="flex items-center gap-2 flex-1">
          <input
            v-model="editLabel"
            class="block flex-1 rounded border-gray-300 shadow-sm text-sm"
            @keyup.enter="saveEdit(field.id)"
            @keyup.escape="editingFieldId = null"
          >
          <select
            v-model="editType"
            class="rounded border-gray-300 shadow-sm text-sm focus:ring-primary-500 focus:border-primary-500"
          >
            <option v-for="t in fieldTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
          </select>
          <button class="px-2.5 py-1 text-xs font-medium text-white bg-primary-600 rounded hover:bg-primary-700 transition-colors" @click="saveEdit(field.id)">Save</button>
          <button class="px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" @click="editingFieldId = null">Cancel</button>
        </div>
        <div v-else class="flex-1">
          <span class="font-medium text-gray-900">{{ field.label }}</span>
          <span class="text-xs text-gray-500 ml-2">{{ fieldTypeLabels[field.type] || field.type }}</span>
          <span v-if="field.type === 'constrained'" class="text-xs text-gray-400 ml-1">
            ({{ (field.allowedValues || []).length }} options)
          </span>
          <span v-if="field.multiValue" class="text-xs text-primary-500 dark:text-primary-400 ml-1">(multi)</span>
        </div>
        <div v-if="editingFieldId !== field.id" class="flex items-center gap-2">
          <button
            class="text-xs"
            :class="field.visible ? 'text-green-600' : 'text-gray-400'"
            @click="toggleVisibility(field)"
          >
            {{ field.visible ? 'Visible' : 'Hidden' }}
          </button>
          <button v-if="field.type === 'constrained'" class="text-sm text-gray-500 hover:text-gray-700" @click="openOptionsModal(field)">Options</button>
          <button class="text-sm text-gray-500 hover:text-gray-700" @click="startEdit(field)">Edit</button>
          <button class="text-sm text-red-500 hover:text-red-700" @click="handleDelete(field.id)">Delete</button>
        </div>
      </li>
      <li v-if="activeFields.length === 0" class="p-3 text-sm text-gray-500 text-center">
        No fields defined yet
      </li>
    </ul>

    <!-- Create Field Modal -->
    <div v-if="showCreateModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showCreateModal = false">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Add {{ activeTab === 'person' ? 'Person' : 'Team' }} Field
        </h3>
        <div v-if="error" class="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {{ error }}
        </div>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Label</label>
            <input
              v-model="newFieldLabel"
              type="text"
              class="block w-full rounded border-gray-300 shadow-sm text-sm focus:ring-primary-500 focus:border-primary-500"
              placeholder="e.g., Focus Area"
              @keyup.enter="newFieldType !== 'constrained' && handleCreate()"
            >
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
            <select
              v-model="newFieldType"
              class="block w-full rounded border-gray-300 shadow-sm text-sm focus:ring-primary-500 focus:border-primary-500"
            >
              <option v-for="t in fieldTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
            </select>
          </div>
          <!-- Allowed values for constrained type -->
          <div v-if="newFieldType === 'constrained'">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Options</label>
            <div class="flex gap-2 mb-2">
              <input
                v-model="newOptionInput"
                type="text"
                class="block flex-1 rounded border-gray-300 shadow-sm text-sm focus:ring-primary-500 focus:border-primary-500"
                placeholder="Add an option..."
                @keyup.enter="addNewOption"
              >
              <button
                type="button"
                class="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                @click="addNewOption"
              >Add</button>
            </div>
            <ul v-if="newFieldOptions.length > 0" class="space-y-1">
              <li v-for="(opt, i) in newFieldOptions" :key="i" class="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded px-3 py-1.5 text-sm">
                <span class="text-gray-900 dark:text-gray-100">{{ opt }}</span>
                <button class="text-red-500 hover:text-red-700 text-xs ml-2" @click="removeNewOption(i)">&times;</button>
              </li>
            </ul>
            <p v-else class="text-xs text-gray-400 mt-1">Add at least one option.</p>
            <label class="flex items-center gap-2 mt-3">
              <input
                type="checkbox"
                v-model="newFieldMultiValue"
                class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
              />
              <span class="text-sm text-gray-700 dark:text-gray-300">Allow multiple values</span>
            </label>
          </div>
        </div>
        <div class="mt-6 flex justify-end gap-3">
          <button
            class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
            @click="showCreateModal = false"
          >Cancel</button>
          <button
            class="px-4 py-2 bg-primary-600 text-white text-sm rounded hover:bg-primary-700 disabled:opacity-50"
            :disabled="createDisabled"
            @click="handleCreate"
          >Add</button>
        </div>
      </div>
    </div>

    <!-- Edit Options Modal -->
    <div v-if="showOptionsModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showOptionsModal = null">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Options for "{{ showOptionsModal.label }}"
        </h3>
        <div v-if="error" class="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {{ error }}
        </div>
        <div class="space-y-3">
          <div class="flex gap-2">
            <input
              v-model="editOptionInput"
              type="text"
              class="block flex-1 rounded border-gray-300 shadow-sm text-sm focus:ring-primary-500 focus:border-primary-500"
              placeholder="Add an option..."
              @keyup.enter="addEditOption"
            >
            <button
              type="button"
              class="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
              @click="addEditOption"
            >Add</button>
          </div>
          <ul v-if="editOptions.length > 0" class="space-y-1">
            <li v-for="(opt, i) in editOptions" :key="i" class="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded px-3 py-1.5 text-sm">
              <span class="text-gray-900 dark:text-gray-100">{{ opt }}</span>
              <button class="text-red-500 hover:text-red-700 text-xs ml-2" @click="removeEditOption(i)">&times;</button>
            </li>
          </ul>
          <p v-else class="text-xs text-gray-400">No options defined.</p>
        </div>
        <div class="mt-6 flex justify-end gap-3">
          <button
            class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
            @click="showOptionsModal = null"
          >Cancel</button>
          <button
            class="px-4 py-2 bg-primary-600 text-white text-sm rounded hover:bg-primary-700"
            @click="saveOptions"
          >Save</button>
        </div>
      </div>
    </div>
  </div>
</template>
