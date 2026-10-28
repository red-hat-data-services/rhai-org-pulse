<script setup>
import { ref, nextTick } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { ChevronDown } from 'lucide-vue-next'

const props = defineProps({
  id: { type: String, required: true },
  label: { type: String, required: true },
  options: { type: Array, required: true },
  modelValue: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue'])
const open = ref(false)
const container = ref(null)
const trigger = ref(null)
const dropdown = ref(null)

onClickOutside(container, () => { open.value = false })

function toggle(value) {
  emit('update:modelValue', props.modelValue.includes(value)
    ? props.modelValue.filter(selected => selected !== value)
    : [...props.modelValue, value])
}

function close() {
  open.value = false
  trigger.value?.focus()
}

async function focusOptions() {
  open.value = true
  await nextTick()
  dropdown.value?.querySelector('input')?.focus()
}

function onFocusOut(event) {
  if (!container.value?.contains(event.relatedTarget)) open.value = false
}
</script>

<template>
  <div ref="container" class="static sm:relative" @keydown.esc.stop.prevent="close" @focusout="onFocusOut">
    <button
      ref="trigger"
      type="button"
      class="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      :class="modelValue.length
        ? 'border-primary-300 bg-primary-50 text-primary-800 dark:border-blue-600 dark:bg-blue-900/30 dark:text-blue-200'
        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'"
      :aria-label="`${label} filter${modelValue.length ? `, ${modelValue.length} selected` : ''}`"
      :aria-expanded="open"
      :aria-controls="id"
      @click="open = !open"
      @keydown.down.prevent="focusOptions"
    >
      {{ label }}
      <span v-if="modelValue.length" class="rounded-full bg-primary-100 px-1.5 text-xs tabular-nums dark:bg-blue-800" aria-hidden="true">{{ modelValue.length }}</span>
      <ChevronDown :size="14" :class="open ? 'rotate-180' : ''" aria-hidden="true" />
    </button>
    <div
      v-if="open"
      :id="id"
      ref="dropdown"
      role="group"
      :aria-label="`${label} options`"
      class="absolute left-0 top-full z-20 mt-2 w-56 max-w-full rounded-xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-600 dark:bg-gray-800 sm:max-w-none"
    >
      <div class="flex items-center justify-between px-2 py-1.5">
        <span class="text-xs text-gray-500 dark:text-gray-400">{{ modelValue.length ? `${modelValue.length} selected` : 'Any value' }}</span>
        <button
          v-if="modelValue.length"
          type="button"
          class="rounded text-xs font-medium text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-blue-400"
          :aria-label="`Clear ${label} filter`"
          @click="emit('update:modelValue', [])"
        >Clear</button>
      </div>
      <div class="max-h-56 overflow-y-auto">
        <label
          v-for="option in options"
          :key="option.value"
          class="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          <input
            type="checkbox"
            :value="option.value"
            :checked="modelValue.includes(option.value)"
            class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-500 dark:bg-gray-700"
            @change="toggle(option.value)"
          />
          {{ option.label }}
        </label>
      </div>
    </div>
  </div>
</template>
