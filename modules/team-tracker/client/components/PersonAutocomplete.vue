<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  people: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Search by name...' }
})

const emit = defineEmits(['update:modelValue', 'save', 'cancel'])

const searchText = ref('')
const isOpen = ref(false)
const highlightedIndex = ref(-1)

const filteredPeople = computed(() => {
  if (!searchText.value) return props.people.slice(0, 10)
  const term = searchText.value.toLowerCase()
  return props.people
    .filter(p => p.name.toLowerCase().includes(term) || (p.title || '').toLowerCase().includes(term))
    .slice(0, 10)
})

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

function onInput() {
  isOpen.value = true
  highlightedIndex.value = -1
}

function selectPerson(person) {
  emit('update:modelValue', person.uid)
  searchText.value = person.name
  isOpen.value = false
}

function onKeydown(event) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    highlightedIndex.value = Math.min(highlightedIndex.value + 1, filteredPeople.value.length - 1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    if (highlightedIndex.value >= 0 && filteredPeople.value[highlightedIndex.value]) {
      selectPerson(filteredPeople.value[highlightedIndex.value])
    }
    emit('save')
  } else if (event.key === 'Escape') {
    isOpen.value = false
    emit('cancel')
  }
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
      v-if="isOpen && filteredPeople.length > 0"
      role="listbox"
      class="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded shadow-lg max-h-48 overflow-y-auto"
    >
      <li
        v-for="(p, idx) in filteredPeople"
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
    </ul>
  </div>
</template>
