<script setup>
import { computed } from 'vue'

const props = defineProps({
  filterMeta: {
    type: Object,
    default: () => ({})
  },
  modelValue: {
    type: Object,
    default: () => ({
      outcome: null,
      targetVersion: null,
      fixVersion: null,
      component: null,
      priority: null,
      team: null,
      needsAttention: false
    })
  }
})

const emit = defineEmits(['update:modelValue'])

function update(key, value) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}

function toggleNeedsAttention() {
  update('needsAttention', !props.modelValue.needsAttention)
}

function clearFilters() {
  emit('update:modelValue', {
    outcome: null,
    targetVersion: null,
    fixVersion: null,
    component: null,
    priority: null,
    team: null,
    needsAttention: false
  })
}

const hasActiveFilters = computed(() => {
  const f = props.modelValue
  return !!(
    f.outcome ||
    f.targetVersion ||
    f.fixVersion ||
    f.component ||
    f.priority ||
    f.team ||
    f.needsAttention
  )
})

const outcomes = computed(() => props.filterMeta.bigRocks || [])
const targetVersions = computed(() => props.filterMeta.targetVersions || [])
const fixVersions = computed(() => props.filterMeta.fixVersions || [])
const components = computed(() => props.filterMeta.components || [])
const priorities = computed(() => props.filterMeta.priorities || [])
const teams = computed(() => props.filterMeta.teams || [])
</script>

<template>
  <div class="flex flex-wrap items-center gap-3 py-3 px-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">

    <!-- Outcome / Big Rock -->
    <div class="flex flex-col gap-0.5">
      <label class="text-sm font-medium text-gray-600 dark:text-gray-400">Outcome</label>
      <select
        :value="modelValue.outcome || ''"
        @change="update('outcome', $event.target.value || null)"
        class="text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400"
      >
        <option value="">All outcomes</option>
        <option v-for="o in outcomes" :key="o" :value="o" class="text-xs">{{ o }}</option>
      </select>
    </div>

    <!-- Target Version -->
    <div class="flex flex-col gap-0.5">
      <label class="text-sm font-medium text-gray-600 dark:text-gray-400">Target Version</label>
      <select
        :value="modelValue.targetVersion || ''"
        @change="update('targetVersion', $event.target.value || null)"
        class="text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400"
      >
        <option value="">All versions</option>
        <option v-for="r in targetVersions" :key="r" :value="r" class="text-xs">{{ r }}</option>
      </select>
    </div>

    <!-- Fix Version -->
    <div class="flex flex-col gap-0.5">
      <label class="text-sm font-medium text-gray-600 dark:text-gray-400">Fix Version</label>
      <select
        :value="modelValue.fixVersion || ''"
        @change="update('fixVersion', $event.target.value || null)"
        class="text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400"
      >
        <option value="">All fix versions</option>
        <option v-for="fv in fixVersions" :key="fv" :value="fv" class="text-xs">{{ fv }}</option>
      </select>
    </div>

    <!-- Component -->
    <div class="flex flex-col gap-0.5">
      <label class="text-sm font-medium text-gray-600 dark:text-gray-400">Component</label>
      <select
        :value="modelValue.component || ''"
        @change="update('component', $event.target.value || null)"
        class="text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400"
      >
        <option value="">All components</option>
        <option v-for="c in components" :key="c" :value="c" class="text-xs">{{ c }}</option>
      </select>
    </div>

    <!-- Team / Delivery Owner -->
    <div class="flex flex-col gap-0.5">
      <label class="text-sm font-medium text-gray-600 dark:text-gray-400">Team</label>
      <select
        :value="modelValue.team || ''"
        @change="update('team', $event.target.value || null)"
        class="text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400"
      >
        <option value="">All teams</option>
        <option v-for="t in teams" :key="t" :value="t" class="text-xs">{{ t }}</option>
      </select>
    </div>

    <!-- Priority -->
    <div class="flex flex-col gap-0.5">
      <label class="text-sm font-medium text-gray-600 dark:text-gray-400">Priority</label>
      <select
        :value="modelValue.priority || ''"
        @change="update('priority', $event.target.value || null)"
        class="text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400"
      >
        <option value="">All priorities</option>
        <option v-for="p in priorities" :key="p" :value="p" class="text-xs">{{ p }}</option>
      </select>
    </div>

    <!-- Needs Attention toggle -->
    <div class="flex flex-col gap-0.5">
      <label class="text-sm font-medium text-gray-600 dark:text-gray-400">Needs Attention</label>
      <button
        type="button"
        @click="toggleNeedsAttention"
        :aria-pressed="modelValue.needsAttention"
        class="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md border text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400"
        :class="modelValue.needsAttention
          ? 'bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-600 text-amber-800 dark:text-amber-300'
          : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'"
      >
        <span aria-hidden="true">⚠</span>
        {{ modelValue.needsAttention ? 'On' : 'Off' }}
      </button>
    </div>

    <!-- Clear filters button -->
    <div v-if="hasActiveFilters" class="flex flex-col gap-0.5 justify-end">
      <span class="text-sm font-medium text-transparent select-none">Clear</span>
      <button
        type="button"
        @click="clearFilters"
        class="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 border border-transparent hover:border-gray-300 dark:hover:border-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400"
      >
        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
        Clear filters
      </button>
    </div>

  </div>
</template>
