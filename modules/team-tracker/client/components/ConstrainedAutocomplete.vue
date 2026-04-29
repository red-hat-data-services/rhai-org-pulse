<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  modelValue: { type: [String, Array], default: null },
  options: { type: Array, default: () => [] },
  multiValue: { type: Boolean, default: false },
  placeholder: { type: String, default: 'Search...' }
})

const emit = defineEmits(['update:modelValue', 'save', 'cancel'])

const searchText = ref('')
const isOpen = ref(false)
const highlightedIndex = ref(-1)

const selectedValues = computed(() => {
  if (!props.multiValue) return []
  return Array.isArray(props.modelValue) ? props.modelValue : (props.modelValue ? [props.modelValue] : [])
})

const availableOptions = computed(() => {
  let opts = props.options
  if (props.multiValue) {
    opts = opts.filter(o => !selectedValues.value.includes(o))
  }
  if (!searchText.value) return opts.slice(0, 20)
  const term = searchText.value.toLowerCase()
  return opts.filter(o => o.toLowerCase().includes(term)).slice(0, 20)
})

function onInput() {
  isOpen.value = true
  highlightedIndex.value = -1
}

function selectOption(opt) {
  if (props.multiValue) {
    const updated = [...selectedValues.value, opt]
    emit('update:modelValue', updated)
    searchText.value = ''
  } else {
    emit('update:modelValue', opt)
    searchText.value = opt
    isOpen.value = false
  }
  highlightedIndex.value = -1
}

function removeTag(opt) {
  const updated = selectedValues.value.filter(v => v !== opt)
  emit('update:modelValue', updated)
}

function onKeydown(event) {
  const total = availableOptions.value.length
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    highlightedIndex.value = Math.min(highlightedIndex.value + 1, total - 1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    if (highlightedIndex.value >= 0 && highlightedIndex.value < total) {
      selectOption(availableOptions.value[highlightedIndex.value])
    } else if (!props.multiValue) {
      emit('save')
    }
  } else if (event.key === 'Escape') {
    isOpen.value = false
    emit('cancel')
  } else if (event.key === 'Backspace' && !searchText.value && props.multiValue && selectedValues.value.length > 0) {
    removeTag(selectedValues.value[selectedValues.value.length - 1])
  }
}

// Initialize search text for single-value mode
if (!props.multiValue && props.modelValue) {
  searchText.value = props.modelValue
}

const rootEl = ref(null)

function onClickOutside(e) {
  if (rootEl.value && !rootEl.value.contains(e.target)) {
    isOpen.value = false
  }
}

onMounted(() => document.addEventListener('mousedown', onClickOutside))
onBeforeUnmount(() => document.removeEventListener('mousedown', onClickOutside))
</script>

<template>
  <div ref="rootEl" class="relative">
    <!-- Multi-value tags -->
    <div v-if="multiValue && selectedValues.length > 0" class="flex flex-wrap gap-1 mb-1">
      <span
        v-for="v in selectedValues"
        :key="v"
        class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
      >
        {{ v }}
        <button class="ml-1 text-primary-500 hover:text-primary-700" @click="removeTag(v)">&times;</button>
      </span>
    </div>

    <input
      v-model="searchText"
      role="combobox"
      :aria-expanded="isOpen"
      aria-autocomplete="list"
      :aria-activedescendant="highlightedIndex >= 0 ? `ca-opt-${highlightedIndex}` : undefined"
      class="w-full rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 text-sm"
      :placeholder="multiValue ? 'Type to add...' : placeholder"
      @input="onInput"
      @focus="isOpen = true"
      @keydown="onKeydown"
    >
    <ul
      v-if="isOpen && availableOptions.length > 0"
      role="listbox"
      class="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded shadow-lg max-h-48 overflow-y-auto"
    >
      <li
        v-for="(opt, idx) in availableOptions"
        :key="opt"
        :id="`ca-opt-${idx}`"
        role="option"
        :aria-selected="highlightedIndex === idx"
        class="px-3 py-2 text-sm cursor-pointer"
        :class="highlightedIndex === idx ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'"
        @mousedown.prevent="selectOption(opt)"
      >
        {{ opt }}
      </li>
    </ul>
    <div v-if="isOpen && searchText && availableOptions.length === 0" class="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded shadow-lg px-3 py-2 text-sm text-gray-400 dark:text-gray-500">
      No matches
    </div>
  </div>
</template>
