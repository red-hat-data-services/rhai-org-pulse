<script setup>
import { ref, computed, nextTick } from 'vue'
import { onClickOutside } from '@vueuse/core'

const props = defineProps({
  packages: { type: Array, required: true },
  modelValue: { type: String, default: null },
})

const emit = defineEmits(['update:modelValue'])

const isOpen = ref(false)
const filterText = ref('')
const focusedIndex = ref(-1)
const containerRef = ref(null)
const inputRef = ref(null)

onClickOutside(containerRef, () => {
  isOpen.value = false
})

const filteredPackages = computed(() => {
  if (!filterText.value) return props.packages
  const search = filterText.value.toLowerCase()
  return props.packages.filter(pkg => pkg.displayLabel.toLowerCase().includes(search))
})

const selectedLabel = computed(() => {
  if (!props.modelValue) return ''
  const pkg = props.packages.find(p => p.key === props.modelValue)
  return pkg ? pkg.displayLabel : props.modelValue
})

function openDropdown() {
  isOpen.value = true
  filterText.value = ''
  focusedIndex.value = -1
  nextTick(() => inputRef.value?.focus())
}

function toggleDropdown() {
  if (isOpen.value) {
    isOpen.value = false
  } else {
    openDropdown()
  }
}

function selectPackage(key) {
  emit('update:modelValue', key)
  isOpen.value = false
  filterText.value = ''
}

function clearSelection() {
  emit('update:modelValue', null)
  filterText.value = ''
}

function onKeydown(event) {
  const list = filteredPackages.value
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    focusedIndex.value = Math.min(focusedIndex.value + 1, list.length - 1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    focusedIndex.value = Math.max(focusedIndex.value - 1, 0)
  } else if (event.key === 'Enter' && focusedIndex.value >= 0 && focusedIndex.value < list.length) {
    event.preventDefault()
    selectPackage(list[focusedIndex.value].key)
  } else if (event.key === 'Escape') {
    isOpen.value = false
  }
}
</script>

<template>
  <div
    ref="containerRef"
    class="flex items-center gap-3 py-2 px-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 mb-3"
  >
    <label class="text-sm font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
      Select Package:
    </label>

    <div class="relative flex-1 max-w-[500px]">
      <button
        v-if="!isOpen"
        type="button"
        class="w-full text-left px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:border-gray-400 dark:hover:border-gray-500"
        @click="toggleDropdown"
      >
        <span v-if="modelValue" class="font-mono">{{ selectedLabel }}</span>
        <span v-else class="text-gray-400 dark:text-gray-500">Choose a package...</span>
      </button>

      <div v-else>
        <input
          ref="inputRef"
          v-model="filterText"
          type="text"
          class="w-full px-3 py-1.5 text-sm border border-blue-500 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 outline-none"
          placeholder="Search packages..."
          @keydown="onKeydown"
        />
      </div>

      <ul
        v-if="isOpen"
        class="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg"
      >
        <li
          v-if="filteredPackages.length === 0"
          class="px-3 py-2 text-sm text-gray-400 dark:text-gray-500"
        >
          No packages found
        </li>
        <li
          v-for="(pkg, index) in filteredPackages"
          :key="pkg.key"
          class="px-3 py-1.5 text-[13px] font-mono cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
          :class="{ 'bg-blue-50 dark:bg-blue-900/30': index === focusedIndex }"
          @click="selectPackage(pkg.key)"
        >
          {{ pkg.displayLabel }}
          <span
            v-if="pkg.preBuilt"
            class="text-[11px] text-teal-600 dark:text-teal-400 italic ml-2 font-sans"
          >
            (pre-built)
          </span>
        </li>
      </ul>
    </div>

    <button
      v-if="modelValue"
      type="button"
      class="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
      @click="clearSelection"
    >
      Clear
    </button>

    <span class="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
      {{ packages.length }} {{ packages.length === 1 ? 'package' : 'packages' }}
    </span>
  </div>
</template>
