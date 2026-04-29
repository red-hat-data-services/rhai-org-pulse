<template>
  <div class="inline-flex rounded-md shadow-sm">
    <button
      @click="$emit('update:modelValue', 'points')"
      class="px-3 py-1.5 text-sm font-medium rounded-l-md border"
      :class="modelValue === 'points'
        ? 'bg-primary-600 text-white border-primary-600'
        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'"
      data-testid="metric-toggle-points"
    >
      Story Points
    </button>
    <button
      @click="$emit('update:modelValue', 'counts')"
      class="px-3 py-1.5 text-sm font-medium rounded-r-md border border-l-0"
      :class="modelValue === 'counts'
        ? 'bg-primary-600 text-white border-primary-600'
        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'"
      data-testid="metric-toggle-counts"
    >
      Issue Count
    </button>
  </div>
</template>

<script setup>
defineProps({
  modelValue: { type: String, required: true }
})
defineEmits(['update:modelValue'])
</script>
