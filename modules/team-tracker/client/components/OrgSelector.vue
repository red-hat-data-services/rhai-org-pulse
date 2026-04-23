<template>
  <div class="flex flex-wrap gap-2">
    <button
      @click="$emit('select', null)"
      class="px-4 py-2 rounded-lg text-sm font-medium transition-colors border"
      :class="!modelValue
        ? 'bg-primary-600 text-white border-primary-600'
        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-600 hover:bg-primary-50 dark:hover:bg-gray-600'"
    >
      All
    </button>
    <button
      v-for="org in orgs"
      :key="org.name"
      @click="$emit('select', org.name)"
      class="px-4 py-2 rounded-lg text-sm font-medium transition-colors border"
      :class="modelValue === org.name
        ? 'bg-primary-600 text-white border-primary-600'
        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-600 hover:bg-primary-50 dark:hover:bg-gray-600'"
    >
      {{ org.name }}
    </button>
  </div>
</template>

<script setup>
defineProps({
  orgs: { type: Array, required: true },
  modelValue: { type: String, default: null }
})
defineEmits(['select'])
</script>
