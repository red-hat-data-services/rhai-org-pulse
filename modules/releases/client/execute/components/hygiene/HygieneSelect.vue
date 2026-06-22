<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  modelValue: { default: null },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'All' },
  mode: { type: String, default: 'multi' }
})

const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const dropdownRef = ref(null)

const normalizedOptions = computed(() =>
  props.options.map(opt =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  )
)

const label = computed(() => {
  if (props.mode === 'single') {
    if (!props.modelValue) return props.placeholder
    const opt = normalizedOptions.value.find(o => o.value === props.modelValue)
    return opt ? opt.label : props.modelValue
  }
  const val = props.modelValue || []
  if (val.length === 0) return props.placeholder
  if (val.length === 1) {
    const opt = normalizedOptions.value.find(o => o.value === val[0])
    return opt ? opt.label : val[0]
  }
  return `${val.length} selected`
})

const isActive = computed(() => {
  if (props.mode === 'single') return !!props.modelValue
  return (props.modelValue || []).length > 0
})

function selectSingle(value) {
  emit('update:modelValue', value)
  open.value = false
}

function toggleMulti(value) {
  const current = [...(props.modelValue || [])]
  const idx = current.indexOf(value)
  if (idx >= 0) {
    current.splice(idx, 1)
  } else {
    current.push(value)
  }
  emit('update:modelValue', current)
}

function clearAll() {
  emit('update:modelValue', props.mode === 'single' ? null : [])
}

function handleClickOutside(e) {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target)) {
    open.value = false
  }
}

onMounted(() => document.addEventListener('mousedown', handleClickOutside))
onUnmounted(() => document.removeEventListener('mousedown', handleClickOutside))
</script>

<template>
  <div ref="dropdownRef" class="relative">
    <button
      @click="open = !open"
      type="button"
      class="h-8 text-xs border rounded-md px-2.5 py-1 flex items-center gap-1.5 min-w-[9rem] transition-colors"
      :class="isActive
        ? 'border-primary-300 dark:border-primary-600 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'"
    >
      <span class="flex-1 text-left truncate">{{ label }}</span>
      <svg class="h-3.5 w-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <div
      v-if="open"
      class="absolute z-30 mt-1 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 max-h-60 overflow-y-auto"
    >
      <!-- Clear / All option -->
      <button
        v-if="isActive"
        @click="clearAll"
        type="button"
        class="w-full text-left px-3 py-1.5 text-xs text-primary-600 dark:text-primary-400 hover:bg-gray-50 dark:hover:bg-gray-700"
      >{{ mode === 'single' ? 'All' : 'Clear all' }}</button>

      <!-- Single-select options -->
      <template v-if="mode === 'single'">
        <button
          v-for="opt in normalizedOptions"
          :key="opt.value"
          @click="selectSingle(opt.value)"
          type="button"
          class="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
          :class="modelValue === opt.value
            ? 'text-primary-700 dark:text-primary-300 font-medium'
            : 'text-gray-700 dark:text-gray-300'"
        >
          <svg
            v-if="modelValue === opt.value"
            class="w-3.5 h-3.5 text-primary-500 shrink-0"
            fill="currentColor" viewBox="0 0 20 20"
          >
            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
          </svg>
          <span v-else class="w-3.5 shrink-0" />
          <span class="truncate">{{ opt.label }}</span>
        </button>
      </template>

      <!-- Multi-select options -->
      <template v-else>
        <label
          v-for="opt in normalizedOptions"
          :key="opt.value"
          class="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
        >
          <input
            type="checkbox"
            :checked="(modelValue || []).includes(opt.value)"
            @change="toggleMulti(opt.value)"
            class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
          />
          <span class="text-xs text-gray-700 dark:text-gray-300 truncate">{{ opt.label }}</span>
        </label>
      </template>

      <div v-if="normalizedOptions.length === 0" class="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">
        No options available
      </div>
    </div>
  </div>
</template>
