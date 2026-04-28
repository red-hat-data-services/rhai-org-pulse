<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useReleaseHealth } from '../composables/useReleaseHealth'

var { searchJiraFields, loadRiceConfig, saveRiceConfig, testRiceFields } = useReleaseHealth()

var enableRice = ref(false)
var fields = ref({
  riceReach: { id: '', name: '' },
  riceImpact: { id: '', name: '' },
  riceConfidence: { id: '', name: '' },
  riceEffort: { id: '', name: '' }
})

var activeSearch = ref(null)
var searchQuery = ref('')
var searchResults = ref([])
var searching = ref(false)
var saving = ref(false)
var saveMessage = ref('')
var testing = ref(false)
var testResults = ref(null)
var searchDebounce = null

var RICE_FIELDS = [
  { key: 'riceReach', label: 'Reach' },
  { key: 'riceImpact', label: 'Impact' },
  { key: 'riceConfidence', label: 'Confidence' },
  { key: 'riceEffort', label: 'Effort' }
]

onMounted(async function() {
  try {
    var config = await loadRiceConfig()
    enableRice.value = !!config.enableRice
    var ids = config.customFieldIds || {}
    for (var i = 0; i < RICE_FIELDS.length; i++) {
      var k = RICE_FIELDS[i].key
      if (ids[k]) {
        fields.value[k] = { id: ids[k], name: ids[k] }
      }
    }
  } catch {
    // Config not available
  }
})

onUnmounted(function() {
  if (searchDebounce) clearTimeout(searchDebounce)
})

function startSearch(fieldKey) {
  activeSearch.value = fieldKey
  searchQuery.value = ''
  searchResults.value = []
}

function cancelSearch() {
  activeSearch.value = null
  searchQuery.value = ''
  searchResults.value = []
}

function handleSearchInput() {
  if (searchDebounce) clearTimeout(searchDebounce)
  if (searchQuery.value.length < 2) {
    searchResults.value = []
    return
  }
  searchDebounce = setTimeout(async function() {
    searching.value = true
    try {
      var result = await searchJiraFields(searchQuery.value)
      searchResults.value = result.fields || []
    } catch {
      searchResults.value = []
    } finally {
      searching.value = false
    }
  }, 300)
}

function selectField(field) {
  if (activeSearch.value) {
    fields.value[activeSearch.value] = { id: field.id, name: field.name }
  }
  cancelSearch()
}

async function handleSave() {
  saving.value = true
  saveMessage.value = ''
  try {
    var fieldIds = {}
    for (var i = 0; i < RICE_FIELDS.length; i++) {
      var k = RICE_FIELDS[i].key
      fieldIds[k] = fields.value[k].id || ''
    }
    await saveRiceConfig(fieldIds, enableRice.value)
    saveMessage.value = 'Saved'
    setTimeout(function() { saveMessage.value = '' }, 3000)
  } catch (err) {
    saveMessage.value = 'Error: ' + (err.message || 'Save failed')
  } finally {
    saving.value = false
  }
}

async function handleTest() {
  testing.value = true
  testResults.value = null
  try {
    var result = await testRiceFields()
    testResults.value = result
  } catch (err) {
    testResults.value = { error: err.message || 'Test failed' }
  } finally {
    testing.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center gap-3">
      <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
        <input type="checkbox" v-model="enableRice" class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500" />
        Enable RICE Scoring
      </label>
      <span v-if="enableRice" class="text-xs text-green-600 dark:text-green-400">Active</span>
      <span v-else class="text-xs text-gray-400">Disabled</span>
    </div>

    <div v-if="enableRice" class="space-y-3">
      <div v-for="rf in RICE_FIELDS" :key="rf.key" class="flex items-center gap-3">
        <span class="text-xs font-medium text-gray-600 dark:text-gray-400 w-24">{{ rf.label }}</span>
        <div class="flex-1 relative">
          <div v-if="activeSearch !== rf.key" class="flex items-center gap-2">
            <span v-if="fields[rf.key].id" class="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-700 dark:text-gray-300">
              {{ fields[rf.key].name || fields[rf.key].id }}
            </span>
            <span v-else class="text-xs text-gray-400">Not configured</span>
            <button @click="startSearch(rf.key)" class="text-xs text-primary-600 dark:text-primary-400 hover:underline">
              {{ fields[rf.key].id ? 'Change' : 'Search' }}
            </button>
          </div>
          <div v-else class="space-y-1">
            <div class="flex items-center gap-2">
              <input
                v-model="searchQuery"
                @input="handleSearchInput"
                placeholder="Search Jira fields..."
                class="flex-1 text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                autofocus
              />
              <button @click="cancelSearch" class="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">Cancel</button>
            </div>
            <div v-if="searching" class="text-xs text-gray-400 px-1">Searching...</div>
            <div v-if="searchResults.length > 0" class="max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800">
              <button
                v-for="f in searchResults" :key="f.id"
                @click="selectField(f)"
                class="w-full text-left px-2 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
              >
                <div class="font-medium text-gray-900 dark:text-gray-100">{{ f.name }}</div>
                <div class="text-gray-400">{{ f.id }} ({{ f.type }})</div>
              </button>
            </div>
            <div v-if="searchQuery.length >= 2 && !searching && searchResults.length === 0" class="text-xs text-gray-400 px-1">
              No matching fields found
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-3">
      <button
        @click="handleSave"
        :disabled="saving"
        class="px-3 py-1.5 text-xs font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
      >{{ saving ? 'Saving...' : 'Save RICE Config' }}</button>
      <button
        v-if="enableRice"
        @click="handleTest"
        :disabled="testing"
        class="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
      >{{ testing ? 'Testing...' : 'Test RICE Fields' }}</button>
      <span v-if="saveMessage" class="text-xs" :class="saveMessage.startsWith('Error') ? 'text-red-600' : 'text-green-600'">
        {{ saveMessage }}
      </span>
    </div>

    <div v-if="testResults" class="mt-3 text-xs border border-gray-200 dark:border-gray-600 rounded p-3 bg-gray-50 dark:bg-gray-800">
      <div v-if="testResults.error" class="text-red-600">{{ testResults.error }}</div>
      <template v-else>
        <div class="font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{ testResults.validCount }}/{{ testResults.totalCount }} fields found in Jira
        </div>
        <div v-for="(val, key) in testResults.results" :key="key" class="flex items-center gap-2 py-0.5">
          <span v-if="val.found" class="text-green-600">&#10003;</span>
          <span v-else class="text-red-500">&#10007;</span>
          <span class="text-gray-600 dark:text-gray-400">{{ val.label }}:</span>
          <span v-if="val.found" class="text-gray-800 dark:text-gray-200">{{ val.name }} ({{ val.id }})</span>
          <span v-else-if="val.id" class="text-red-500">{{ val.id }} not found</span>
          <span v-else class="text-gray-400">Not configured</span>
        </div>
      </template>
    </div>
  </div>
</template>
