<template>
  <div class="relative inline-block group">
    <button
      type="button"
      class="inline-flex items-center justify-center w-5 h-5 text-gray-400 hover:text-gray-600 focus:outline-none"
      @mouseenter="show = true"
      @mouseleave="show = false"
      @focus="show = true"
      @blur="show = false"
    >
      <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
      </svg>
    </button>

    <!-- Tooltip -->
    <div
      v-show="show"
      class="absolute z-10 w-64 px-3 py-2 text-sm text-white bg-gray-900 rounded-lg shadow-lg -top-2 left-7 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
      role="tooltip"
    >
      <slot>{{ text }}</slot>
      <!-- Arrow -->
      <div class="absolute w-2 h-2 bg-gray-900 transform rotate-45 -left-1 top-3"></div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  text: {
    type: String,
    default: ''
  }
})

const show = ref(false)
</script>
