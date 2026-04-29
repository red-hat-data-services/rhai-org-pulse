<script setup>
import { ref, computed, watch } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  people: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Search by name...' }
})

const emit = defineEmits(['update:modelValue', 'save', 'cancel'])

const searchText = ref('')
const isOpen = ref(false)
const highlightedIndex = ref(-1)
const ldapResults = ref([])
const ldapLoading = ref(false)
const ldapAvailable = ref(true)
const ldapError = ref(null)
let ldapDebounceTimer = null

const filteredPeople = computed(() => {
  if (!searchText.value) return props.people.slice(0, 10)
  const term = searchText.value.toLowerCase()
  return props.people
    .filter(p => p.name.toLowerCase().includes(term) || (p.title || '').toLowerCase().includes(term))
    .slice(0, 10)
})

const allOptions = computed(() => {
  const local = filteredPeople.value
  // Filter LDAP results to exclude people already in local list
  const localUids = new Set(local.map(p => p.uid))
  const ldap = ldapResults.value.filter(p => !localUids.has(p.uid))
  return { local, ldap }
})

const totalOptions = computed(() => allOptions.value.local.length + allOptions.value.ldap.length)

// Initialize search text from modelValue (UID -> display name)
function initSearchText() {
  const person = props.people.find(p => p.uid === props.modelValue)
  searchText.value = person ? person.name : (props.modelValue || '')
}

initSearchText()

// Re-initialize when modelValue changes externally
watch(() => props.modelValue, () => {
  initSearchText()
})

function searchLdap(term) {
  if (ldapDebounceTimer) clearTimeout(ldapDebounceTimer)
  if (!term || term.length < 3 || !ldapAvailable.value) {
    ldapResults.value = []
    return
  }
  // Only search LDAP if local results are sparse
  if (filteredPeople.value.length >= 3) {
    ldapResults.value = []
    return
  }
  ldapDebounceTimer = setTimeout(async () => {
    ldapLoading.value = true
    ldapError.value = null
    try {
      const data = await apiRequest('/modules/team-tracker/registry/people/search/ldap?q=' + encodeURIComponent(term) + '&limit=5')
      ldapResults.value = (data.results || []).map(p => ({
        uid: p.uid,
        name: p.name,
        title: p.title,
        email: p.email,
        inRegistry: p.inRegistry,
        _fromLdap: true
      }))
    } catch (err) {
      if (err.status === 503 || err.message?.includes('503')) {
        ldapAvailable.value = false
      }
      // 429 or other errors: silently suppress LDAP section
      ldapResults.value = []
    } finally {
      ldapLoading.value = false
    }
  }, 300)
}

function onInput() {
  isOpen.value = true
  highlightedIndex.value = -1
  searchLdap(searchText.value)
}

async function selectPerson(person) {
  if (person._fromLdap && !person.inRegistry) {
    // Import from LDAP first
    ldapError.value = null
    try {
      await apiRequest('/modules/team-tracker/registry/people/ldap-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: person.uid })
      })
      // Successfully imported
      emit('update:modelValue', person.uid)
      searchText.value = props.modelValue === '' ? '' : person.name
      isOpen.value = false
    } catch (err) {
      ldapError.value = err.message || 'Failed to import person (requires team-admin permissions)'
      return
    }
  } else {
    emit('update:modelValue', person.uid)
    searchText.value = props.modelValue === '' ? '' : person.name
    isOpen.value = false
  }
}

function onKeydown(event) {
  const total = totalOptions.value
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    highlightedIndex.value = Math.min(highlightedIndex.value + 1, total - 1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    if (highlightedIndex.value >= 0) {
      const localLen = allOptions.value.local.length
      if (highlightedIndex.value < localLen) {
        selectPerson(allOptions.value.local[highlightedIndex.value])
      } else {
        selectPerson(allOptions.value.ldap[highlightedIndex.value - localLen])
      }
    }
    emit('save')
  } else if (event.key === 'Escape') {
    isOpen.value = false
    emit('cancel')
  }
}

function getOptionIndex(localIdx, isLdap) {
  return isLdap ? allOptions.value.local.length + localIdx : localIdx
}
</script>

<template>
  <div class="relative">
    <input
      v-model="searchText"
      role="combobox"
      :aria-expanded="isOpen"
      aria-autocomplete="list"
      :aria-activedescendant="highlightedIndex >= 0 ? `pac-opt-${highlightedIndex}` : undefined"
      class="w-full rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 text-sm"
      :placeholder="placeholder"
      @input="onInput"
      @focus="isOpen = true"
      @blur="setTimeout(() => isOpen = false, 200)"
      @keydown="onKeydown"
    >
    <ul
      v-if="isOpen && (totalOptions > 0 || ldapLoading)"
      role="listbox"
      class="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded shadow-lg max-h-48 overflow-y-auto"
    >
      <!-- Local results -->
      <li
        v-for="(p, idx) in allOptions.local"
        :key="p.uid || p.name"
        :id="`pac-opt-${idx}`"
        role="option"
        :aria-selected="highlightedIndex === idx"
        class="px-3 py-2 text-sm cursor-pointer"
        :class="highlightedIndex === idx ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'"
        @mousedown.prevent="selectPerson(p)"
      >
        <div class="font-medium">{{ p.name }}</div>
        <div v-if="p.title" class="text-xs text-gray-400 dark:text-gray-500">{{ p.title }}</div>
      </li>

      <!-- LDAP divider -->
      <li
        v-if="allOptions.ldap.length > 0 || ldapLoading"
        role="separator"
        class="px-3 py-1.5 text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-600"
      >
        From directory
        <span v-if="ldapLoading" class="inline-block ml-1 w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin align-middle"></span>
      </li>

      <!-- LDAP results -->
      <li
        v-for="(p, idx) in allOptions.ldap"
        :key="'ldap-' + p.uid"
        :id="`pac-opt-${getOptionIndex(idx, true)}`"
        role="option"
        :aria-selected="highlightedIndex === getOptionIndex(idx, true)"
        class="px-3 py-2 text-sm cursor-pointer"
        :class="highlightedIndex === getOptionIndex(idx, true) ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'"
        @mousedown.prevent="selectPerson(p)"
      >
        <div class="font-medium">{{ p.name }}</div>
        <div v-if="p.title" class="text-xs text-gray-400 dark:text-gray-500">{{ p.title }}</div>
      </li>
    </ul>

    <!-- Import error message -->
    <div v-if="ldapError" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ ldapError }}</div>
  </div>
</template>
