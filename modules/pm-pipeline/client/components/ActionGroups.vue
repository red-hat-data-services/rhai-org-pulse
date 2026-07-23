<script setup>
import { ref } from 'vue'
import PipelineCard from './PipelineCard.vue'

defineProps({
  groups: { type: Array, default: () => [] }
})

const emit = defineEmits(['select'])

const expanded = ref({})

function toggle(id) {
  expanded.value[id] = !expanded.value[id]
}

function isOpen(id) {
  return expanded.value[id] !== false
}
</script>

<template>
  <div v-if="groups.length === 0" class="text-center py-12 text-gray-500">
    <p class="text-lg font-medium text-gray-700">Nothing needs your action right now</p>
    <p class="text-sm mt-1">Check items waiting on others below, or verify your release filter.</p>
  </div>

  <div v-else class="space-y-4">
    <section v-for="group in groups" :key="group.id">
      <button
        type="button"
        class="w-full flex items-center justify-between px-4 py-3 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 text-left"
        @click="toggle(group.id)"
      >
        <span class="font-medium text-gray-900">{{ group.label }}</span>
        <span class="flex items-center gap-2 text-sm text-gray-500">
          <span class="bg-gray-100 px-2 py-0.5 rounded-full">{{ group.items.length }}</span>
          <svg
            class="h-4 w-4 transition-transform"
            :class="{ 'rotate-180': isOpen(group.id) }"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>
      <div v-show="isOpen(group.id)" class="mt-2 space-y-2 pl-1">
        <PipelineCard
          v-for="item in group.items"
          :key="item.id"
          :item="item"
          @select="emit('select', $event)"
        />
      </div>
    </section>
  </div>
</template>
