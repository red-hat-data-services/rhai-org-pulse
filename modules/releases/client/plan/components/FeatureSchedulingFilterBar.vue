<script setup>
import { ref, computed } from 'vue'
import { useClickOutside } from '../composables/useClickOutside'

const props = defineProps({
  filterMeta: { type: Object, default: () => ({}) },
  modelValue: { type: Object, required: true }
})

const emit = defineEmits(['update:modelValue', 'clear'])

const selectClass = 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500'
const btnClass = 'flex items-center gap-1.5 cursor-pointer text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500'
const btnActiveClass = 'flex items-center gap-1.5 cursor-pointer text-xs rounded-md border border-primary-400 dark:border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500'
const dropdownClass = 'absolute z-50 mt-1 w-56 max-h-60 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg'
const optionClass = 'flex items-center gap-2 px-3 py-1.5 text-xs text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer'

function update(key, value) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}

function updateFromEvent(key, event) {
  update(key, event.target.value)
}

// Component / Team multi-selects, same dropdown-button pattern as
// FilterBar.vue / FeatureReadinessFilterBar.vue.
const compOpen = ref(false)
const teamOpen = ref(false)
const compRef = ref(null)
const teamRef = ref(null)
useClickOutside(compRef, () => { compOpen.value = false })
useClickOutside(teamRef, () => { teamOpen.value = false })

function toggleMulti(key, value) {
  const current = (props.modelValue[key] || []).slice()
  const idx = current.indexOf(value)
  if (idx === -1) current.push(value)
  else current.splice(idx, 1)
  update(key, current)
}

function multiLabel(selected, allLabel) {
  if (!selected || !selected.length) return allLabel
  if (selected.length === 1) return selected[0]
  return selected.length + ' selected'
}

const components = computed(() => props.filterMeta.components || [])
const teams = computed(() => props.filterMeta.teams || [])

const hasActiveFilters = computed(() => {
  const f = props.modelValue
  return !!(
    f.rel || f.read || f.place || f.outcome || f.pri || f.assign || f.fail || f.pm ||
    f.bigRockOnly || (f.tv && f.tv.length) || (f.comp && f.comp.length) || (f.team && f.team.length)
  )
})
</script>

<template>
  <div class="flex flex-wrap items-end gap-3 py-3 px-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">

    <div class="flex flex-col gap-0.5">
      <label class="text-xs font-medium text-gray-600 dark:text-gray-400">Release</label>
      <select :value="modelValue.rel" @change="updateFromEvent('rel', $event)" :class="selectClass">
        <option value="">All releases</option>
        <option v-for="v in (filterMeta.versions || [])" :key="v" :value="v">{{ v }}</option>
      </select>
    </div>

    <div class="flex flex-col gap-0.5">
      <label class="text-xs font-medium text-gray-600 dark:text-gray-400">Readiness</label>
      <select :value="modelValue.read" @change="updateFromEvent('read', $event)" :class="selectClass">
        <option value="">All</option>
        <option value="committed">Committed</option>
        <option value="not-ready">Not Ready</option>
      </select>
    </div>

    <div class="flex flex-col gap-0.5">
      <label class="text-xs font-medium text-gray-600 dark:text-gray-400">Placement</label>
      <select :value="modelValue.place" @change="updateFromEvent('place', $event)" :class="selectClass">
        <option value="">All</option>
        <option value="EA1">EA1</option>
        <option value="EA2">EA2</option>
        <option value="EA1+EA2">EA1 + EA2</option>
        <option value="GA">GA</option>
        <option value="No">No</option>
      </select>
    </div>

    <div class="flex flex-col gap-0.5">
      <label class="text-xs font-medium text-gray-600 dark:text-gray-400">PM</label>
      <select :value="modelValue.pm" @change="updateFromEvent('pm', $event)" :class="selectClass">
        <option value="">All PMs</option>
        <option v-for="pm in (filterMeta.pms || [])" :key="pm" :value="pm">{{ pm }}</option>
      </select>
    </div>

    <div class="flex flex-col gap-0.5">
      <label class="text-xs font-medium text-gray-600 dark:text-gray-400">Outcome</label>
      <select :value="modelValue.outcome" @change="updateFromEvent('outcome', $event)" :class="selectClass">
        <option value="">All outcomes</option>
        <option v-for="o in (filterMeta.outcomes || [])" :key="o" :value="o">{{ o }}</option>
      </select>
    </div>

    <!-- Component (multi) -->
    <div v-if="components.length" class="flex flex-col gap-0.5">
      <label class="text-xs font-medium text-gray-600 dark:text-gray-400">Component</label>
      <div ref="compRef" class="relative">
        <button type="button" @click="compOpen = !compOpen" :aria-expanded="compOpen" :class="(modelValue.comp || []).length ? btnActiveClass : btnClass">
          <span class="truncate max-w-[120px]">{{ multiLabel(modelValue.comp, 'All components') }}</span>
        </button>
        <div v-if="compOpen" role="group" :class="dropdownClass">
          <label v-for="c in components" :key="c" :class="optionClass">
            <input type="checkbox" :checked="(modelValue.comp || []).includes(c)" @change="toggleMulti('comp', c)" class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500" />
            <span class="truncate">{{ c }}</span>
          </label>
        </div>
      </div>
    </div>

    <!-- Team (multi) -->
    <div v-if="teams.length" class="flex flex-col gap-0.5">
      <label class="text-xs font-medium text-gray-600 dark:text-gray-400">Team</label>
      <div ref="teamRef" class="relative">
        <button type="button" @click="teamOpen = !teamOpen" :aria-expanded="teamOpen" :class="(modelValue.team || []).length ? btnActiveClass : btnClass">
          <span class="truncate max-w-[120px]">{{ multiLabel(modelValue.team, 'All teams') }}</span>
        </button>
        <div v-if="teamOpen" role="group" :class="dropdownClass">
          <label v-for="t in teams" :key="t" :class="optionClass">
            <input type="checkbox" :checked="(modelValue.team || []).includes(t)" @change="toggleMulti('team', t)" class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500" />
            <span class="truncate">{{ t }}</span>
          </label>
        </div>
      </div>
    </div>

    <div class="flex flex-col gap-0.5">
      <label class="text-xs font-medium text-gray-600 dark:text-gray-400">Priority</label>
      <select :value="modelValue.pri" @change="updateFromEvent('pri', $event)" :class="selectClass">
        <option value="">All priorities</option>
        <option v-for="p in (filterMeta.priorities || [])" :key="p" :value="p">{{ p }}</option>
      </select>
    </div>

    <div class="flex flex-col gap-0.5">
      <label class="text-xs font-medium text-gray-600 dark:text-gray-400">Assignee</label>
      <select :value="modelValue.assign" @change="updateFromEvent('assign', $event)" :class="selectClass">
        <option value="">All assignees</option>
        <option v-for="a in (filterMeta.assignees || [])" :key="a" :value="a">{{ a }}</option>
      </select>
    </div>

    <div class="flex flex-col gap-0.5">
      <label class="text-xs font-medium text-gray-600 dark:text-gray-400">Failed FPDoR contains</label>
      <input
        type="text"
        :value="modelValue.fail"
        @input="updateFromEvent('fail', $event)"
        placeholder="e.g. Components"
        :class="selectClass"
      />
    </div>

    <label class="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 pb-1.5">
      <input
        type="checkbox"
        :checked="modelValue.bigRockOnly"
        @change="update('bigRockOnly', $event.target.checked)"
        class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
      />
      Big Rock only
    </label>

    <button
      v-if="hasActiveFilters"
      type="button"
      @click="emit('clear')"
      class="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 border border-transparent hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
    >
      Clear filters
    </button>
  </div>
</template>
