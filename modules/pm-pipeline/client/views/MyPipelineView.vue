<script setup>
import { toRef } from 'vue'
import PipelineFilters from '../components/PipelineFilters.vue'
import PipelineCard from '../components/PipelineCard.vue'
import { usePipelineFilters } from '../composables/usePipelineFilters.js'

const props = defineProps({
  items: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: null }
})

const emit = defineEmits(['select'])

const itemsRef = toRef(props, 'items')
const {
  stageFilter,
  priorityFilter,
  typeFilter,
  search,
  stageOptions,
  priorityOptions,
  filteredItems,
  itemsByPhase,
  clearFilters
} = usePipelineFilters(itemsRef)
</script>

<template>
  <main class="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">
    <div v-if="error" class="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
      {{ error }}
    </div>

    <div v-if="loading" class="text-center py-16 text-gray-500">
      Loading pipeline…
    </div>

    <template v-else-if="items.length > 0">
      <div>
        <h2 class="text-lg font-semibold text-gray-900 mb-1">My Pipeline</h2>
        <p class="text-sm text-gray-500">All your RFEs and features by pipeline phase</p>
      </div>

      <PipelineFilters
        v-model:stage-filter="stageFilter"
        v-model:priority-filter="priorityFilter"
        v-model:type-filter="typeFilter"
        v-model:search="search"
        :stage-options="stageOptions"
        :priority-options="priorityOptions"
        :result-count="filteredItems.length"
        @clear="clearFilters"
      />

      <div v-if="filteredItems.length === 0" class="text-center py-12 text-gray-500">
        No items match your filters.
      </div>

      <div v-else class="flex gap-4 overflow-x-auto pb-4 min-h-[320px]">
        <div
          v-for="column in itemsByPhase"
          :key="column.id"
          class="flex-shrink-0 w-72 sm:w-80"
        >
          <div class="flex items-center justify-between mb-3 px-1">
            <h3 class="text-sm font-semibold text-gray-800">{{ column.label }}</h3>
            <span class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {{ column.items.length }}
            </span>
          </div>
          <div class="space-y-2">
            <PipelineCard
              v-for="item in column.items"
              :key="item.id"
              :item="item"
              @select="emit('select', $event)"
            />
            <p v-if="column.items.length === 0" class="text-xs text-gray-400 text-center py-8 border border-dashed border-gray-200 rounded-lg">
              None
            </p>
          </div>
        </div>
      </div>
    </template>

    <div v-else-if="!error" class="text-center py-16 text-gray-500">
      Load your pipeline using the header above.
    </div>
  </main>
</template>
