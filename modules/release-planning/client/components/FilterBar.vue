<script setup>
defineProps({
  filterOptions: { type: Object, default: () => ({}) },
  selectedPillar: { type: String, default: '' },
  selectedRock: { type: String, default: '' },
  selectedStatus: { type: String, default: '' },
  selectedPriority: { type: String, default: '' },
  selectedTeam: { type: String, default: '' },
  searchQuery: { type: String, default: '' },
  hasActiveFilters: { type: Boolean, default: false }
})

defineEmits([
  'update:selectedPillar',
  'update:selectedRock',
  'update:selectedStatus',
  'update:selectedPriority',
  'update:selectedTeam',
  'update:searchQuery',
  'clearFilters'
])

const selectClass = 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500'
</script>

<template>
  <div class="flex flex-wrap gap-3 items-center">
    <input
      :value="searchQuery"
      @input="$emit('update:searchQuery', $event.target.value)"
      type="text"
      placeholder="Search issues..."
      class="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
    />

    <select
      :value="selectedPillar"
      @change="$emit('update:selectedPillar', $event.target.value)"
      :class="selectClass"
    >
      <option value="">All Pillars</option>
      <option v-for="p in (filterOptions.pillars || [])" :key="p" :value="p">{{ p }}</option>
    </select>

    <select
      :value="selectedRock"
      @change="$emit('update:selectedRock', $event.target.value)"
      :class="selectClass"
    >
      <option value="">All Rocks</option>
      <option v-for="r in (filterOptions.rocks || [])" :key="r" :value="r">{{ r }}</option>
    </select>

    <select
      :value="selectedStatus"
      @change="$emit('update:selectedStatus', $event.target.value)"
      :class="selectClass"
    >
      <option value="">All Statuses</option>
      <option v-for="s in (filterOptions.statuses || [])" :key="s" :value="s">{{ s }}</option>
    </select>

    <select
      :value="selectedPriority"
      @change="$emit('update:selectedPriority', $event.target.value)"
      :class="selectClass"
    >
      <option value="">All Priorities</option>
      <option v-for="p in (filterOptions.priorities || [])" :key="p" :value="p">{{ p }}</option>
    </select>

    <select
      v-if="filterOptions.teams && filterOptions.teams.length > 0"
      :value="selectedTeam"
      @change="$emit('update:selectedTeam', $event.target.value)"
      :class="selectClass"
    >
      <option value="">All Teams</option>
      <option v-for="t in filterOptions.teams" :key="t" :value="t">{{ t }}</option>
    </select>

    <button
      v-if="hasActiveFilters"
      class="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
      @click="$emit('clearFilters')"
    >
      Clear Filters
    </button>
  </div>
</template>
