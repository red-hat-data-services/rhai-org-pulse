<script setup>
import { ref, computed, watch } from 'vue'

// Typeahead multi-select: type to filter, Enter or click to toggle, Backspace on an empty query removes the last pick.
const selected = defineModel({ type: Array, default: () => [] })
const props = defineProps({
  id: { type: String, required: true },
  options: { type: Array, default: () => [] },
  invalid: { type: Boolean, default: false },
  describedBy: { type: String, default: null },
  disabled: { type: Boolean, default: false }
})

const input = ref(null)
const query = ref('')
const open = ref(false)
const activeIndex = ref(0)

const listboxId = computed(() => `${props.id}-listbox`)
const filtered = computed(() => {
  const needle = query.value.trim().toLowerCase()
  if (!needle) return props.options
  return props.options.filter(option => option.name.toLowerCase().includes(needle))
})
const activeDescendant = computed(() => (
  open.value && filtered.value.length ? `${props.id}-option-${activeIndex.value}` : null
))

watch(filtered, () => { activeIndex.value = 0 })

function isSelected(name) {
  return selected.value.includes(name)
}

function toggle(name) {
  selected.value = isSelected(name)
    ? selected.value.filter(value => value !== name)
    : [...selected.value, name]
  query.value = ''
}

function remove(name) {
  selected.value = selected.value.filter(value => value !== name)
}

function openList() {
  if (!props.disabled) open.value = true
}

function move(step) {
  openList()
  const count = filtered.value.length
  if (count) activeIndex.value = (activeIndex.value + step + count) % count
}

function chooseActive() {
  const option = open.value ? filtered.value[activeIndex.value] : null
  if (option) toggle(option.name)
}

function onBackspace() {
  if (!query.value && selected.value.length) remove(selected.value[selected.value.length - 1])
}

function focusInput() {
  if (input.value) input.value.focus()
}
</script>

<template>
  <div class="relative">
    <div
      class="flex flex-wrap items-center gap-1.5 w-full px-2 py-1.5 border rounded-lg bg-white dark:bg-gray-800 focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500"
      :class="[
        invalid ? 'border-red-400 dark:border-red-600' : 'border-gray-300 dark:border-gray-600',
        disabled ? 'opacity-60' : 'cursor-text'
      ]"
      @click="focusInput"
    >
      <span
        v-for="name in selected"
        :key="name"
        data-testid="channel-chip"
        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-900/40 text-primary-800 dark:text-primary-200 text-xs font-mono"
      >
        {{ name }}
        <button
          type="button"
          class="text-primary-600 dark:text-primary-300 hover:text-primary-900 dark:hover:text-primary-100 font-bold leading-none"
          :aria-label="`Remove ${name}`"
          :disabled="disabled"
          @click.stop="remove(name)"
        >&times;</button>
      </span>
      <input
        :id="id"
        ref="input"
        v-model="query"
        type="text"
        role="combobox"
        autocomplete="off"
        aria-autocomplete="list"
        :aria-expanded="open"
        :aria-controls="listboxId"
        :aria-activedescendant="activeDescendant"
        :aria-invalid="invalid"
        :aria-describedby="describedBy"
        :disabled="disabled"
        :placeholder="selected.length ? 'Add another channel' : 'Type to search channels'"
        class="flex-1 min-w-[12rem] border-0 bg-transparent p-1 text-sm font-mono text-gray-900 dark:text-gray-100 focus:ring-0 focus:outline-none"
        @focus="openList"
        @input="openList"
        @blur="open = false"
        @keydown.down.prevent="move(1)"
        @keydown.up.prevent="move(-1)"
        @keydown.enter.prevent="chooseActive"
        @keydown.esc="open = false"
        @keydown.backspace="onBackspace"
      />
    </div>

    <ul
      v-show="open"
      :id="listboxId"
      role="listbox"
      aria-multiselectable="true"
      class="absolute z-10 w-full mt-1 max-h-60 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1"
    >
      <li
        v-for="(option, index) in filtered"
        :id="`${id}-option-${index}`"
        :key="option.name"
        role="option"
        :data-value="option.name"
        :aria-selected="isSelected(option.name)"
        class="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer text-gray-700 dark:text-gray-300"
        :class="index === activeIndex ? 'bg-gray-100 dark:bg-gray-700' : ''"
        @mousedown.prevent="toggle(option.name)"
        @mouseenter="activeIndex = index"
      >
        <span
          class="flex items-center justify-center w-4 h-4 shrink-0 border rounded text-[10px]"
          :class="isSelected(option.name) ? 'bg-primary-600 border-primary-600 text-white' : 'border-gray-400 dark:border-gray-500'"
          aria-hidden="true"
        ><span v-if="isSelected(option.name)">&check;</span></span>
        <span class="font-mono">{{ option.name }}</span>
        <span v-if="option.maturity" class="text-xs text-gray-400 dark:text-gray-500">({{ option.maturity }})</span>
      </li>
      <li v-if="!filtered.length" class="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
        No channels match "{{ query.trim() }}"
      </li>
    </ul>
  </div>
</template>
