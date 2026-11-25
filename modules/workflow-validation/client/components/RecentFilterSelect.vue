<template>
  <div ref="root" class="relative text-sm text-gray-700 dark:text-gray-200" @keydown.esc.stop="closeAndFocus">
    <label :id="labelId" class="block">{{ label }}</label>
    <button ref="trigger" type="button" :aria-expanded="open" :aria-labelledby="labelId" :aria-describedby="selectionId" :aria-controls="optionsId"
      class="mt-1 flex w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm dark:border-gray-600 dark:bg-gray-900"
      @click="open = !open" @keydown.down.prevent="openOptions">
      <span :id="selectionId" class="min-w-0 truncate" :title="summary">{{ summary }}</span><span aria-hidden="true">▾</span>
    </button>
    <div v-if="open" :id="optionsId" role="group" :aria-labelledby="labelId"
      class="absolute left-0 right-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border border-gray-300 bg-white p-2 shadow-lg dark:border-gray-600 dark:bg-gray-900">
      <label class="flex cursor-pointer items-center gap-2 rounded px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-700">
        <input type="checkbox" :checked="!selected.size" @change="selectAll">{{ allLabel }}
      </label>
      <label v-for="choice in choices" :key="choice" class="flex cursor-pointer items-center gap-2 rounded px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-700">
        <input type="checkbox" :checked="selected.has(choice)" :disabled="!selected.has(choice) && selected.size >= 50" @change="toggle(choice)"><span>{{ formatLabel(choice) }}</span>
      </label>
    </div>
  </div>
</template>
<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId } from 'vue'
const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  options: { type: Array, default: () => [] },
  label: { type: String, required: true },
  allLabel: { type: String, required: true },
  formatLabel: { type: Function, required: true },
  normalize: { type: Function, default: values => [...new Set(values)].sort() }
})
const emit = defineEmits(['update:modelValue'])
const instanceId = useId()
const labelId = `recent-filter-label-${instanceId}`, optionsId = `recent-filter-options-${instanceId}`
const selectionId = `recent-filter-selection-${instanceId}`
const root = ref(null), trigger = ref(null), open = ref(false)
const choices = computed(() => props.normalize([...props.options, ...props.modelValue]))
const selected = computed(() => new Set(props.normalize(props.modelValue)))
const summary = computed(() => selected.value.size ? [...selected.value].map(props.formatLabel).join(', ') : props.allLabel)
function selectAll(event) {
  if (!selected.value.size) event.target.checked = true
  else emit('update:modelValue', [])
}
/** Add or remove a choice without exceeding the API selection limit. */
function toggle(choice) {
  const next = new Set(selected.value)
  if (next.has(choice)) next.delete(choice)
  else if (next.size < 50) next.add(choice)
  else return
  emit('update:modelValue', props.normalize([...next]))
}
/** Close the popup and return keyboard focus to its trigger. */
function closeAndFocus() { open.value = false; trigger.value?.focus() }
/** Open the popup and focus its first checkbox after rendering. */
async function openOptions() { open.value = true; await nextTick(); root.value?.querySelector('input')?.focus() }
/** Close this popup when focus or a pointer moves outside its own instance. */
function closeOnExternalInteraction(event) { if (!root.value?.contains(event.target)) open.value = false }
onMounted(() => { document.addEventListener('pointerdown', closeOnExternalInteraction); document.addEventListener('focusin', closeOnExternalInteraction) })
onBeforeUnmount(() => { document.removeEventListener('pointerdown', closeOnExternalInteraction); document.removeEventListener('focusin', closeOnExternalInteraction) })
</script>
