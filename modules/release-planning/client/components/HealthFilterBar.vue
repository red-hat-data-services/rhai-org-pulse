<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

var props = defineProps({
  bigRockFilter: { type: String, default: '' },
  selectedComponents: { type: Array, default: () => [] },
  searchQuery: { type: String, default: '' },
  bigRocks: { type: Array, default: () => [] },
  components: { type: Array, default: () => [] },
  hasActiveFilters: { type: Boolean, default: false }
})

var emit = defineEmits([
  'update:bigRockFilter',
  'update:selectedComponents',
  'update:searchQuery',
  'clearFilters'
])

var selectClass = 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500'

var compOpen = ref(false)
var compDropdownRef = ref(null)

var compLabel = computed(function() {
  if (props.selectedComponents.length === 0) return 'All Components'
  if (props.selectedComponents.length === 1) return props.selectedComponents[0]
  return props.selectedComponents.length + ' components'
})

function toggleComponent(comp) {
  var current = props.selectedComponents.slice()
  var idx = current.indexOf(comp)
  if (idx === -1) {
    current.push(comp)
  } else {
    current.splice(idx, 1)
  }
  emit('update:selectedComponents', current)
}

function removeComponent(comp) {
  var current = props.selectedComponents.filter(function(c) { return c !== comp })
  emit('update:selectedComponents', current)
}

function handleClickOutside(event) {
  if (compDropdownRef.value && !compDropdownRef.value.contains(event.target)) {
    compOpen.value = false
  }
}

onMounted(function() {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(function() {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="flex flex-wrap gap-3 items-center">
    <input
      :value="searchQuery"
      @input="$emit('update:searchQuery', $event.target.value)"
      type="text"
      placeholder="Search features..."
      aria-label="Search features"
      class="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
    />

    <select
      v-if="bigRocks.length > 0"
      :value="bigRockFilter"
      @change="$emit('update:bigRockFilter', $event.target.value)"
      :class="selectClass"
      aria-label="Filter by Big Rock"
    >
      <option value="">All Big Rocks</option>
      <option v-for="rock in bigRocks" :key="rock" :value="rock">{{ rock }}</option>
    </select>

    <!-- Component multi-select with chips -->
    <div v-if="components.length > 0" ref="compDropdownRef" class="relative">
      <button
        type="button"
        @click="compOpen = !compOpen"
        @keydown.escape="compOpen = false"
        :aria-expanded="compOpen"
        aria-haspopup="listbox"
        aria-label="Filter by component"
        :class="[selectClass, 'flex items-center gap-1.5 cursor-pointer']"
      >
        <span class="truncate max-w-[180px]">{{ compLabel }}</span>
        <svg class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        v-if="compOpen"
        role="group"
        aria-label="Components"
        class="absolute z-50 mt-1 w-64 max-h-60 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg"
        @keydown.escape="compOpen = false"
      >
        <label
          v-for="comp in components"
          :key="comp"
          class="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
        >
          <input
            type="checkbox"
            :checked="selectedComponents.includes(comp)"
            @change="toggleComponent(comp)"
            class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
          />
          <span class="truncate">{{ comp }}</span>
        </label>
      </div>
    </div>

    <!-- Selected component chips -->
    <div v-if="selectedComponents.length > 0" class="flex flex-wrap gap-1.5">
      <span
        v-for="comp in selectedComponents"
        :key="comp"
        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-400"
      >
        {{ comp }}
        <button
          @click="removeComponent(comp)"
          class="hover:text-primary-900 dark:hover:text-primary-200"
          aria-label="Remove component filter"
        >&times;</button>
      </span>
    </div>

    <button
      v-if="hasActiveFilters"
      class="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
      @click="$emit('clearFilters')"
    >
      Clear Filters
    </button>
  </div>
</template>
