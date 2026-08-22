<script setup>
const props = defineProps({
  stageOptions: { type: Array, default: () => [] },
  priorityOptions: { type: Array, default: () => [] },
  stageFilter: { type: Array, default: () => [] },
  priorityFilter: { type: Array, default: () => [] },
  typeFilter: { type: String, default: '' },
  search: { type: String, default: '' },
  resultCount: { type: Number, default: 0 }
})

const emit = defineEmits([
  'update:stageFilter',
  'update:priorityFilter',
  'update:typeFilter',
  'update:search',
  'clear'
])

function toggleStage(id) {
  const next = props.stageFilter.includes(id)
    ? props.stageFilter.filter(s => s !== id)
    : [...props.stageFilter, id]
  emit('update:stageFilter', next)
}

function togglePriority(p) {
  const next = props.priorityFilter.includes(p)
    ? props.priorityFilter.filter(x => x !== p)
    : [...props.priorityFilter, p]
  emit('update:priorityFilter', next)
}
</script>

<template>
  <div class="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
    <div class="flex flex-col sm:flex-row gap-3 sm:items-center">
      <input
        :value="search"
        type="search"
        placeholder="Search by key or summary…"
        class="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        @input="emit('update:search', $event.target.value)"
      />
      <select
        :value="typeFilter"
        class="rounded-md border border-gray-300 px-3 py-2 text-sm"
        @change="emit('update:typeFilter', $event.target.value)"
      >
        <option value="">All types</option>
        <option value="rfe">RFE</option>
        <option value="feature">Feature</option>
      </select>
      <button
        type="button"
        class="text-sm text-gray-500 hover:text-gray-800"
        @click="emit('clear')"
      >
        Clear filters
      </button>
    </div>

    <div v-if="stageOptions.length" class="flex flex-wrap gap-2">
      <span class="text-xs font-medium text-gray-500 self-center mr-1">Stage:</span>
      <button
        v-for="opt in stageOptions"
        :key="opt.id"
        type="button"
        class="text-xs px-2 py-1 rounded-full border transition-colors"
        :class="stageFilter.includes(opt.id)
          ? 'bg-blue-100 border-blue-300 text-blue-800'
          : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'"
        @click="toggleStage(opt.id)"
      >
        {{ opt.label }}
      </button>
    </div>

    <div v-if="priorityOptions.length" class="flex flex-wrap gap-2">
      <span class="text-xs font-medium text-gray-500 self-center mr-1">Priority:</span>
      <button
        v-for="p in priorityOptions"
        :key="p"
        type="button"
        class="text-xs px-2 py-1 rounded-full border transition-colors"
        :class="priorityFilter.includes(p)
          ? 'bg-amber-100 border-amber-300 text-amber-900'
          : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'"
        @click="togglePriority(p)"
      >
        {{ p }}
      </button>
    </div>

    <p class="text-xs text-gray-400">{{ resultCount }} item(s) shown</p>
  </div>
</template>
