<script setup>
defineProps({
  releases: { type: Array, default: () => [] },
  modelValue: { type: String, default: '' },
  canEdit: { type: Boolean, default: false }
})

defineEmits(['update:modelValue', 'newRelease'])
</script>

<template>
  <div class="flex items-center gap-2">
    <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Release:</label>
    <select
      :value="modelValue"
      @change="$emit('update:modelValue', $event.target.value)"
      class="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
    >
      <option v-for="r in releases" :key="r.version" :value="r.version">
        {{ r.version }}
      </option>
    </select>
    <button
      v-if="canEdit"
      @click="$emit('newRelease')"
      class="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
      title="Create a new release"
    >
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
      </svg>
      New Release
    </button>
  </div>
</template>
