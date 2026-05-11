<template>
  <div>
    <!-- List view -->
    <div v-if="!selectedOption && !showCreate && !showCreateNew">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Field Option Sets</h3>
        <div class="flex gap-2">
          <button
            @click="showCreateNew = true"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Create New
          </button>
          <button
            v-if="eligibleFields.length > 0"
            @click="showCreate = true"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 transition-colors"
          >
            Create from Existing Field
          </button>
        </div>
      </div>
      <div v-if="loading" class="text-sm text-gray-500 dark:text-gray-400">Loading...</div>
      <div v-else-if="options.length === 0" class="space-y-4">
        <p class="text-sm text-gray-500 dark:text-gray-400">
          No field option sets configured.
        </p>
        <div v-if="eligibleFields.length > 0" class="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h4 class="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">Create a Shared Option Set</h4>
          <p class="text-sm text-blue-700 dark:text-blue-300 mb-3">
            Convert an existing field's values into a shared option set that can be used across both person and team fields.
          </p>
          <button
            @click="showCreate = true"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
          >
            Create from Existing Field
          </button>
        </div>
      </div>
      <div v-else class="space-y-2">
        <button
          v-for="opt in options"
          :key="opt.name"
          @click="selectOption(opt.name)"
          class="w-full text-left px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <div class="flex items-center justify-between">
            <div>
              <span class="font-medium text-gray-900 dark:text-gray-100">{{ opt.label }}</span>
              <span class="ml-2 text-sm text-gray-500 dark:text-gray-400">({{ opt.name }})</span>
            </div>
            <span class="text-sm text-gray-500 dark:text-gray-400">{{ opt.count }} values</span>
          </div>
        </button>
      </div>
    </div>

    <!-- Create from existing field flow -->
    <div v-if="showCreate">
      <div class="flex items-center gap-3 mb-4">
        <button
          @click="resetCreate"
          class="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400"
        >
          &larr; Back
        </button>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Create Field Option Set</h3>
      </div>

      <!-- Step 1: Pick source field -->
      <div v-if="!createPreview" class="space-y-4">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Select a field to extract its values into a shared option set. The field will be converted
          to use the shared options, and you can optionally create a matching field on the other scope.
        </p>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Source Field</label>
          <select
            v-model="createSourceFieldId"
            class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
          >
            <option value="">Select a field...</option>
            <optgroup label="Person Fields">
              <option v-for="f in eligiblePersonFields" :key="f.id" :value="f.id">
                {{ f.label }} ({{ f.type }}{{ f.multiValue ? ', multi' : '' }})
              </option>
            </optgroup>
            <optgroup label="Team Fields">
              <option v-for="f in eligibleTeamFields" :key="f.id" :value="f.id">
                {{ f.label }} ({{ f.type }}{{ f.multiValue ? ', multi' : '' }})
              </option>
            </optgroup>
          </select>
        </div>
        <button
          @click="loadPreview"
          :disabled="!createSourceFieldId || previewLoading"
          class="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <svg v-if="previewLoading" class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          {{ previewLoading ? 'Loading...' : 'Preview' }}
        </button>
      </div>

      <!-- Step 2: Preview and configure -->
      <div v-else class="space-y-4">
        <div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2">
          <div class="text-sm">
            <span class="font-medium text-gray-700 dark:text-gray-300">Source:</span>
            <span class="ml-1 text-gray-900 dark:text-gray-100">{{ createPreview.field.label }}</span>
            <span class="ml-1 text-gray-500 dark:text-gray-400">({{ createPreview.scope }}-level)</span>
          </div>
          <div class="text-sm">
            <span class="font-medium text-gray-700 dark:text-gray-300">Values found:</span>
            <span class="ml-1 text-gray-900 dark:text-gray-100">{{ createPreview.uniqueValues.length }}</span>
            <span class="ml-1 text-gray-500 dark:text-gray-400">across {{ createPreview.recordCount }} records</span>
          </div>
          <div v-if="createPreview.uniqueValues.length > 0" class="mt-2">
            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="val in createPreview.uniqueValues"
                :key="val"
                class="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded"
              >
                {{ val }}
              </span>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Option Set Name</label>
            <input
              v-model="createName"
              type="text"
              placeholder="e.g. components"
              class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
            />
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Lowercase, hyphens, underscores only</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display Label</label>
            <input
              v-model="createLabel"
              type="text"
              placeholder="e.g. Components"
              class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>

        <!-- Counterpart field option -->
        <div class="p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3">
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              v-model="createCounterpart"
              class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
            />
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
              Also create a {{ createPreview.scope === 'person' ? 'team' : 'person' }}-level field using these options
            </span>
          </label>

          <div v-if="createCounterpart" class="ml-6 space-y-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {{ createPreview.scope === 'person' ? 'Team' : 'Person' }} Field Label
              </label>
              <input
                v-model="counterpartLabel"
                type="text"
                :placeholder="createLabel"
                class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
              />
            </div>

            <label v-if="createPreview.scope === 'person'" class="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                v-model="seedFromMembers"
                class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
              />
              <span class="text-sm text-gray-700 dark:text-gray-300">
                Pre-populate each team's values from its current members
              </span>
            </label>
          </div>
        </div>

        <div class="flex gap-2">
          <button
            @click="createPreview = null"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            Back
          </button>
          <button
            @click="executeCreate"
            :disabled="!createName || !createLabel || executing"
            class="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg v-if="executing" class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            {{ executing ? 'Creating...' : 'Create Option Set' }}
          </button>
        </div>

        <p v-if="createResult" class="text-sm" :class="createError ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'">
          {{ createResult }}
        </p>
      </div>
    </div>

    <!-- Create new (empty) option set -->
    <div v-if="showCreateNew">
      <div class="flex items-center gap-3 mb-4">
        <button
          @click="resetCreateNew"
          class="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400"
        >
          &larr; Back
        </button>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Create New Option Set</h3>
      </div>

      <div class="space-y-4">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Create an empty option set. You can add values after creation.
        </p>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Option Set Name</label>
            <input
              v-model="newSetName"
              type="text"
              placeholder="e.g. regions"
              class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
            />
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Lowercase, hyphens, underscores only</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display Label</label>
            <input
              v-model="newSetLabel"
              type="text"
              placeholder="e.g. Regions"
              class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>
        <button
          @click="executeCreateNew"
          :disabled="!newSetName || !newSetLabel || executingNew"
          class="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {{ executingNew ? 'Creating...' : 'Create Option Set' }}
        </button>
        <p v-if="createNewResult" class="text-sm" :class="createNewError ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'">
          {{ createNewResult }}
        </p>
      </div>
    </div>

    <!-- Detail view -->
    <div v-if="selectedOption && !showCreate">
      <div class="flex items-center gap-3 mb-4">
        <button
          @click="selectedOption = null"
          class="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400"
        >
          &larr; Back
        </button>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {{ detail?.label || selectedOption }}
        </h3>
      </div>

      <!-- Jira component mapping warnings (specific to "components" option set) -->
      <div v-if="selectedOption === 'components' && jiraWarnings.length > 0" class="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <h4 class="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">Jira Component Mapping Warnings</h4>
        <ul class="text-sm text-yellow-700 dark:text-yellow-300 list-disc list-inside space-y-0.5">
          <li v-for="w in jiraWarnings" :key="w">{{ w }}</li>
        </ul>
      </div>

      <div v-if="detailLoading" class="text-sm text-gray-500 dark:text-gray-400">Loading...</div>
      <template v-else>
        <!-- Add new values -->
        <div class="flex gap-2 mb-4">
          <input
            v-model="newValue"
            @keyup.enter="addValue"
            type="text"
            placeholder="Add a new value..."
            class="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          <button
            @click="addValue"
            :disabled="!newValue.trim()"
            class="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>

        <!-- Values list -->
        <div v-if="(detail?.values || []).length === 0" class="text-sm text-gray-500 dark:text-gray-400">
          No values in this option set.
        </div>
        <ul v-else class="space-y-1">
          <li
            v-for="val in detail.values"
            :key="val"
            class="flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 group"
          >
            <span class="text-sm text-gray-900 dark:text-gray-100">{{ val }}</span>
            <button
              @click="confirmRemove(val)"
              class="text-sm text-red-600 hover:text-red-700 dark:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              Remove
            </button>
          </li>
        </ul>
      </template>
    </div>

    <!-- Confirm remove dialog -->
    <div v-if="removeTarget" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
        <h4 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Remove Value</h4>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Are you sure you want to remove "{{ removeTarget }}" from the {{ detail?.label }} option set?
          Existing teams or people with this value will keep it, but it will show as a warning.
        </p>
        <div class="flex justify-end gap-2">
          <button
            @click="removeTarget = null"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
          >
            Cancel
          </button>
          <button
            @click="removeValue"
            class="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'

// ─── List view state ───
const options = ref([])
const loading = ref(true)
const selectedOption = ref(null)
const detail = ref(null)
const detailLoading = ref(false)
const newValue = ref('')
const removeTarget = ref(null)
const rfeConfig = ref(null)

// ─── Field definitions for the create flow ───
const fieldDefs = ref({ personFields: [], teamFields: [] })

const eligiblePersonFields = computed(() =>
  (fieldDefs.value.personFields || []).filter(f => !f.deleted && !f.optionsRef)
)
const eligibleTeamFields = computed(() =>
  (fieldDefs.value.teamFields || []).filter(f => !f.deleted && !f.optionsRef)
)
const eligibleFields = computed(() => [...eligiblePersonFields.value, ...eligibleTeamFields.value])

// ─── Create new (empty) state ───
const showCreateNew = ref(false)
const newSetName = ref('')
const newSetLabel = ref('')
const executingNew = ref(false)
const createNewResult = ref(null)
const createNewError = ref(false)

// ─── Create from existing field state ───
const showCreate = ref(false)
const createSourceFieldId = ref('')
const createPreview = ref(null)
const previewLoading = ref(false)
const createName = ref('')
const createLabel = ref('')
const createCounterpart = ref(false)
const counterpartLabel = ref('')
const seedFromMembers = ref(true)
const executing = ref(false)
const createResult = ref(null)
const createError = ref(false)

async function loadOptions() {
  loading.value = true
  try {
    const data = await apiRequest('/modules/team-tracker/field-options')
    options.value = data.options || []
  } catch {
    options.value = []
  } finally {
    loading.value = false
  }
}

async function loadFieldDefs() {
  try {
    const data = await apiRequest('/modules/team-tracker/structure/field-definitions')
    fieldDefs.value = data
  } catch {
    fieldDefs.value = { personFields: [], teamFields: [] }
  }
}

async function selectOption(name) {
  selectedOption.value = name
  detailLoading.value = true
  try {
    detail.value = await apiRequest(`/modules/team-tracker/field-options/${name}`)
    if (name === 'components') {
      try {
        rfeConfig.value = await apiRequest('/modules/team-tracker/rfe-config')
      } catch {
        rfeConfig.value = null
      }
    }
  } catch {
    detail.value = null
  } finally {
    detailLoading.value = false
  }
}

const jiraWarnings = computed(() => {
  if (selectedOption.value !== 'components' || !detail.value?.values || !rfeConfig.value) return []
  const mapping = rfeConfig.value.componentMapping || {}
  const warnings = []
  for (const val of detail.value.values) {
    if (!mapping[val] && Object.keys(mapping).length > 0) {
      warnings.push(`"${val}" has no Jira component mapping — it will be used as-is in RFE queries`)
    }
  }
  return warnings
})

async function addValue() {
  const val = newValue.value.trim()
  if (!val) return
  try {
    await apiRequest(`/modules/team-tracker/field-options/${selectedOption.value}/values`, {
      method: 'POST',
      body: JSON.stringify({ values: [val] }),
      headers: { 'Content-Type': 'application/json' }
    })
    newValue.value = ''
    await selectOption(selectedOption.value)
    await loadOptions()
  } catch (err) {
    console.error('Failed to add value:', err)
  }
}

function confirmRemove(val) {
  removeTarget.value = val
}

async function removeValue() {
  const val = removeTarget.value
  removeTarget.value = null
  try {
    await apiRequest(`/modules/team-tracker/field-options/${selectedOption.value}/values`, {
      method: 'DELETE',
      body: JSON.stringify({ values: [val] }),
      headers: { 'Content-Type': 'application/json' }
    })
    await selectOption(selectedOption.value)
    await loadOptions()
  } catch (err) {
    console.error('Failed to remove value:', err)
  }
}

// ─── Create flow ───

async function loadPreview() {
  previewLoading.value = true
  try {
    const data = await apiRequest(`/modules/team-tracker/structure/migrate/field-to-options/preview?fieldId=${createSourceFieldId.value}`)
    createPreview.value = data
    // Default the name and label from the field label
    const label = data.field.label
    createLabel.value = label
    createName.value = label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '')
    counterpartLabel.value = label
  } catch (err) {
    console.error('Preview failed:', err)
  } finally {
    previewLoading.value = false
  }
}

async function executeCreate() {
  executing.value = true
  createResult.value = null
  createError.value = false
  try {
    const result = await apiRequest('/modules/team-tracker/structure/migrate/field-to-options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceFieldId: createSourceFieldId.value,
        optionSetName: createName.value,
        optionSetLabel: createLabel.value,
        createCounterpart: createCounterpart.value,
        counterpartLabel: counterpartLabel.value || createLabel.value,
        seedFromMembers: seedFromMembers.value
      })
    })
    createResult.value = `Created "${result.optionSetCreated}" with ${result.valuesExtracted} values.` +
      (result.counterpartFieldCreated ? ' Counterpart field created.' : '') +
      (result.teamsSeeded > 0 ? ` ${result.teamsSeeded} teams pre-populated from members.` : '') +
      (result.valuesConverted > 0 ? ` ${result.valuesConverted} records converted.` : '')
    await loadOptions()
    await loadFieldDefs()
    // Auto-navigate to the new option set after a short delay
    setTimeout(() => {
      resetCreate()
      selectOption(createName.value)
    }, 2000)
  } catch (err) {
    createError.value = true
    createResult.value = `Failed: ${err.message}`
  } finally {
    executing.value = false
  }
}

// ─── Create new (empty) flow ───

async function executeCreateNew() {
  executingNew.value = true
  createNewResult.value = null
  createNewError.value = false
  try {
    await apiRequest(`/modules/team-tracker/field-options/${newSetName.value}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [], label: newSetLabel.value })
    })
    createNewResult.value = `Created "${newSetLabel.value}" option set.`
    await loadOptions()
    setTimeout(() => {
      const name = newSetName.value
      resetCreateNew()
      selectOption(name)
    }, 1000)
  } catch (err) {
    createNewError.value = true
    createNewResult.value = `Failed: ${err.message}`
  } finally {
    executingNew.value = false
  }
}

function resetCreateNew() {
  showCreateNew.value = false
  newSetName.value = ''
  newSetLabel.value = ''
  createNewResult.value = null
  createNewError.value = false
}

function resetCreate() {
  showCreate.value = false
  createSourceFieldId.value = ''
  createPreview.value = null
  createName.value = ''
  createLabel.value = ''
  createCounterpart.value = false
  counterpartLabel.value = ''
  seedFromMembers.value = true
  createResult.value = null
  createError.value = false
}

onMounted(() => {
  loadOptions()
  loadFieldDefs()
})
</script>
