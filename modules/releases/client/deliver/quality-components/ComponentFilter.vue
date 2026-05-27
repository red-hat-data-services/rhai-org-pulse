<template>
  <select
    :value="modelValue"
    @change="emit('update:modelValue', $event.target.value || null)"
    class="w-full px-3 py-2 text-sm border-2 rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900"
  >
    <option value="">All Components</option>
    <option v-for="comp in components" :key="comp.name" :value="comp.name">
      {{ comp.name }} ({{ comp.count }})
    </option>
  </select>
</template>

<script setup>
defineProps({
  modelValue: { type: String, default: null },
  components: { type: Array, required: true }
});

const emit = defineEmits(['update:modelValue']);
</script>
