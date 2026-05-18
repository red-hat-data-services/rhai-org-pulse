<template>
  <div>
    <div class="flex items-center gap-2 mb-1">
      <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Orgs</label>
      <button
        v-if="orgs.length > 1"
        @click="toggleAll"
        class="text-xs text-primary-600 hover:text-primary-800 dark:hover:text-primary-400"
      >
        {{ modelValue.length === orgs.length ? 'Clear' : 'All' }}
      </button>
    </div>
    <div class="space-y-1 max-h-48 overflow-y-auto" role="group" aria-label="Organization filter">
      <label
        v-for="org in orgs"
        :key="org.key"
        class="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
      >
        <input
          type="checkbox"
          :value="org.key"
          :checked="modelValue.includes(org.key)"
          @change="toggle(org.key)"
          class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
        />
        <span class="text-sm text-gray-700 dark:text-gray-300">{{ org.displayName || org.key }}</span>
      </label>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  orgs: { type: Array, required: true },
  modelValue: { type: Array, required: true },
})
const emit = defineEmits(['update:modelValue'])

function toggle(key) {
  const current = [...props.modelValue]
  const idx = current.indexOf(key)
  if (idx >= 0) {
    current.splice(idx, 1)
  } else {
    current.push(key)
  }
  emit('update:modelValue', current)
}

function toggleAll() {
  if (props.modelValue.length === props.orgs.length) {
    emit('update:modelValue', [])
  } else {
    emit('update:modelValue', props.orgs.map(o => o.key))
  }
}
</script>
