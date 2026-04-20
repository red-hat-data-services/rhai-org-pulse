<script setup>
defineProps({
  value: { type: String, default: null },
  linked: { type: Boolean, default: false }
})

defineEmits(['navigate'])
</script>

<template>
  <span v-if="!value" class="text-gray-400">-</span>
  <button
    v-else-if="linked"
    class="text-primary-600 hover:text-primary-800 hover:underline"
    @click="$emit('navigate', value)"
  >
    {{ value }}
  </button>
  <span v-else>{{ value }}</span>
</template>
