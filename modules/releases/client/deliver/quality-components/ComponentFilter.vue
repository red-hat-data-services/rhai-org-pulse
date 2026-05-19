<template>
  <div class="w-full max-w-sm">
    <label class="block text-sm font-medium mb-2">Filter by Component (optional)</label>
    <select
      :value="modelValue"
      @change="emit('update:modelValue', $event.target.value || null)"
      class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
    >
      <option value="">All Components</option>
      <option v-for="comp in components" :key="comp.name" :value="comp.name">
        {{ comp.name }} ({{ comp.count }} {{ comp.count === 1 ? 'bug' : 'bugs' }})
      </option>
    </select>
  </div>
</template>

<script setup>
defineProps({
  modelValue: { type: String, default: null },
  components: { type: Array, required: true }
});

const emit = defineEmits(['update:modelValue']);
</script>
