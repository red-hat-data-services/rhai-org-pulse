<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

var props = defineProps({
  filterOptions: { type: Object, default: () => ({}) },
  activeTab: { type: String, default: 'big-rocks' },
  selectedPillar: { type: String, default: '' },
  selectedRock: { type: String, default: '' },
  selectedStatus: { type: String, default: '' },
  selectedPriority: { type: String, default: '' },
  selectedTeams: { type: Array, default: () => [] },
  searchQuery: { type: String, default: '' },
  hasActiveFilters: { type: Boolean, default: false }
})

var emit = defineEmits([
  'update:selectedPillar',
  'update:selectedRock',
  'update:selectedStatus',
  'update:selectedPriority',
  'update:selectedTeams',
  'update:searchQuery',
  'clearFilters'
])

var selectClass = 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500'

var teamsOpen = ref(false)
var teamsDropdownRef = ref(null)

var teamsLabel = computed(function() {
  if (props.selectedTeams.length === 0) return 'Component Teams'
  if (props.selectedTeams.length === 1) return props.selectedTeams[0]
  return props.selectedTeams.length + ' teams selected'
})

function toggleTeam(team) {
  var current = props.selectedTeams.slice()
  var idx = current.indexOf(team)
  if (idx >= 0) {
    current.splice(idx, 1)
  } else {
    current.push(team)
  }
  emit('update:selectedTeams', current)
}

function handleClickOutside(event) {
  if (teamsDropdownRef.value && !teamsDropdownRef.value.contains(event.target)) {
    teamsOpen.value = false
  }
}

onMounted(function() {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(function() {
  document.removeEventListener('click', handleClickOutside)
})
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
      v-if="activeTab === 'big-rocks'"
      :value="selectedPillar"
      @change="$emit('update:selectedPillar', $event.target.value)"
      :class="selectClass"
    >
      <option value="">All Pillars</option>
      <option v-for="p in (filterOptions.pillars || [])" :key="p" :value="p">{{ p }}</option>
    </select>

    <select
      v-if="activeTab !== 'big-rocks'"
      :value="selectedRock"
      @change="$emit('update:selectedRock', $event.target.value)"
      :class="selectClass"
    >
      <option value="">All Rocks</option>
      <option v-for="r in (filterOptions.rocks || [])" :key="r" :value="r">{{ r }}</option>
    </select>

    <select
      v-if="activeTab !== 'big-rocks'"
      :value="selectedStatus"
      @change="$emit('update:selectedStatus', $event.target.value)"
      :class="selectClass"
    >
      <option value="">All Statuses</option>
      <option v-for="s in (filterOptions.statuses || [])" :key="s" :value="s">{{ s }}</option>
    </select>

    <select
      v-if="activeTab !== 'big-rocks'"
      :value="selectedPriority"
      @change="$emit('update:selectedPriority', $event.target.value)"
      :class="selectClass"
    >
      <option value="">All Priorities</option>
      <option v-for="p in (filterOptions.priorities || [])" :key="p" :value="p">{{ p }}</option>
    </select>

    <!-- Component Teams multi-select -->
    <div
      v-if="activeTab === 'features' && filterOptions.teams && filterOptions.teams.length > 0"
      ref="teamsDropdownRef"
      class="relative"
    >
      <button
        type="button"
        @click="teamsOpen = !teamsOpen"
        :class="[selectClass, 'flex items-center gap-1.5 cursor-pointer']"
      >
        <span class="truncate max-w-[180px]">{{ teamsLabel }}</span>
        <svg class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        v-if="teamsOpen"
        class="absolute z-50 mt-1 w-64 max-h-60 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg"
      >
        <label
          v-for="t in filterOptions.teams"
          :key="t"
          class="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
        >
          <input
            type="checkbox"
            :checked="selectedTeams.includes(t)"
            @change="toggleTeam(t)"
            class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
          />
          <span class="truncate">{{ t }}</span>
        </label>
      </div>
    </div>

    <button
      v-if="hasActiveFilters"
      class="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
      @click="$emit('clearFilters')"
    >
      Clear Filters
    </button>
  </div>
</template>
