<template>
  <div class="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-700/60 rounded-lg p-0.5">
    <button
      v-for="opt in options"
      :key="opt.value"
      @click="$emit('update:modelValue', opt.value)"
      class="px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-all duration-200"
      :class="modelValue === opt.value
        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'"
    >{{ opt.label }}</button>
  </div>
</template>

<script setup>
defineProps({
  modelValue: { type: String, required: true },
  options: {
    type: Array,
    default: () => [
      { label: '30d', value: '30' },
      { label: '60d', value: '60' },
      { label: '90d', value: '90' },
      { label: 'All', value: '0' },
    ],
  },
})

defineEmits(['update:modelValue'])
</script>
