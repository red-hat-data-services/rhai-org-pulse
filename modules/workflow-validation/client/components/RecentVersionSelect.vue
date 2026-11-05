<template>
  <div ref="root" class="relative text-sm text-gray-700 dark:text-gray-200" @keydown.esc.stop="closeAndFocus">
    <label :id="labelId" class="block">RHOAI versions</label>
    <button ref="trigger" type="button" :aria-expanded="open" :aria-labelledby="labelId" aria-controls="recent-version-options"
      class="mt-1 flex w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm dark:border-gray-600 dark:bg-gray-900"
      @click="open = !open" @keydown.down.prevent="openOptions">
      <span class="min-w-0 truncate" :title="summary">{{ summary }}</span><span aria-hidden="true">▾</span>
    </button>
    <div v-if="open" id="recent-version-options" role="group" :aria-labelledby="labelId"
      class="absolute left-0 right-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border border-gray-300 bg-white p-2 shadow-lg dark:border-gray-600 dark:bg-gray-900">
      <label class="flex cursor-pointer items-center gap-2 rounded px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-700">
        <input type="checkbox" :checked="!modelValue.length" @change="$emit('update:modelValue', [])">All versions
      </label>
      <label v-for="version in choices" :key="version" class="flex cursor-pointer items-center gap-2 rounded px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-700">
        <input type="checkbox" :checked="selected.has(version)" @change="toggle(version)"><span>{{ versionLabel(version) }}</span>
      </label>
    </div>
  </div>
</template>
<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import * as versionRules from '../../lib/versions.js'
const { normalizeVersions, versionLabel } = versionRules
const props = defineProps({ modelValue: { type: Array, default: () => [] }, options: { type: Array, default: () => [] } })
const emit = defineEmits(['update:modelValue'])
const labelId = 'recent-versions-label'
const root = ref(null), trigger = ref(null), open = ref(false)
const choices = computed(() => normalizeVersions([...props.options, ...props.modelValue]))
const selected = computed(() => new Set(normalizeVersions(props.modelValue)))
const summary = computed(() => props.modelValue.length ? normalizeVersions(props.modelValue).map(versionLabel).join(', ') : 'All versions')
function toggle(version) {
  const next = new Set(selected.value)
  if (next.has(version)) next.delete(version)
  else next.add(version)
  emit('update:modelValue', normalizeVersions([...next]))
}
function closeAndFocus() { open.value = false; trigger.value?.focus() }
async function openOptions() { open.value = true; await nextTick(); root.value?.querySelector('input')?.focus() }
function outside(event) { if (!root.value?.contains(event.target)) open.value = false }
function focusOutside(event) { if (!root.value?.contains(event.target)) open.value = false }
onMounted(() => { document.addEventListener('pointerdown', outside); document.addEventListener('focusin', focusOutside) })
onBeforeUnmount(() => { document.removeEventListener('pointerdown', outside); document.removeEventListener('focusin', focusOutside) })
</script>
