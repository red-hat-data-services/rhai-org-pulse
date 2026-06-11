<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  filterMeta: {
    type: Object,
    default: () => ({})
  },
  modelValue: {
    type: Object,
    default: () => ({
      outcome: [],
      targetVersion: [],
      fixVersion: [],
      component: [],
      priority: [],
      team: [],
      readiness: null
    })
  }
})

const emit = defineEmits(['update:modelValue'])

const outcomeOpen = ref(false)
const targetVersionOpen = ref(false)
const fixVersionOpen = ref(false)
const componentOpen = ref(false)
const teamOpen = ref(false)
const priorityOpen = ref(false)

const outcomeRef = ref(null)
const targetVersionRef = ref(null)
const fixVersionRef = ref(null)
const componentRef = ref(null)
const teamRef = ref(null)
const priorityRef = ref(null)

function closeAll() {
  outcomeOpen.value = false
  targetVersionOpen.value = false
  fixVersionOpen.value = false
  componentOpen.value = false
  teamOpen.value = false
  priorityOpen.value = false
}

function toggleDropdown(name) {
  var map = { outcome: outcomeOpen, targetVersion: targetVersionOpen, fixVersion: fixVersionOpen, component: componentOpen, team: teamOpen, priority: priorityOpen }
  var wasOpen = map[name].value
  closeAll()
  if (!wasOpen) map[name].value = true
}

function handleClickOutside(event) {
  var refs = [outcomeRef, targetVersionRef, fixVersionRef, componentRef, teamRef, priorityRef]
  for (var i = 0; i < refs.length; i++) {
    if (refs[i].value && refs[i].value.contains(event.target)) return
  }
  closeAll()
}

onMounted(function() { document.addEventListener('click', handleClickOutside) })
onUnmounted(function() { document.removeEventListener('click', handleClickOutside) })

function toggleValue(key, value) {
  var current = (props.modelValue[key] || []).slice()
  var idx = current.indexOf(value)
  if (idx === -1) current.push(value)
  else current.splice(idx, 1)
  emit('update:modelValue', { ...props.modelValue, [key]: current })
}

function updateReadiness(value) {
  emit('update:modelValue', { ...props.modelValue, readiness: value })
}

function clearFilters() {
  emit('update:modelValue', {
    outcome: [],
    targetVersion: [],
    fixVersion: [],
    component: [],
    priority: [],
    team: [],
    readiness: null
  })
}

const hasActiveFilters = computed(() => {
  const f = props.modelValue
  return !!(
    (f.outcome && f.outcome.length) ||
    (f.targetVersion && f.targetVersion.length) ||
    (f.fixVersion && f.fixVersion.length) ||
    (f.component && f.component.length) ||
    (f.priority && f.priority.length) ||
    (f.team && f.team.length) ||
    f.readiness
  )
})

function multiLabel(selected, allLabel) {
  if (!selected || selected.length === 0) return allLabel
  if (selected.length === 1) return selected[0]
  return selected.length + ' selected'
}

const outcomes = computed(() => props.filterMeta.bigRocks || [])
const targetVersions = computed(() => props.filterMeta.targetVersions || [])
const fixVersions = computed(() => props.filterMeta.fixVersions || [])
const components = computed(() => props.filterMeta.components || [])
const priorities = computed(() => props.filterMeta.priorities || [])
const teams = computed(() => props.filterMeta.teams || [])

const btnClass = 'flex items-center gap-1.5 cursor-pointer text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400'
const btnActiveClass = 'flex items-center gap-1.5 cursor-pointer text-xs rounded-md border border-primary-400 dark:border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400'
const dropdownClass = 'absolute z-50 mt-1 w-64 max-h-60 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg'
const optionClass = 'flex items-center gap-2 px-3 py-1.5 text-xs text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer'
</script>

<template>
  <div class="flex flex-wrap items-center gap-3 py-3 px-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">

    <!-- Readiness (single-select) -->
    <div class="flex flex-col gap-0.5">
      <label class="text-xs font-medium text-gray-600 dark:text-gray-400">Readiness</label>
      <select
        :value="modelValue.readiness || ''"
        @change="updateReadiness($event.target.value || null)"
        class="text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400"
      >
        <option value="">All</option>
        <option value="ready">Ready</option>
        <option value="not-ready">Not Ready</option>
      </select>
    </div>

    <!-- Outcome -->
    <div v-if="outcomes.length > 0" class="flex flex-col gap-0.5">
      <label class="text-xs font-medium text-gray-600 dark:text-gray-400">Outcome</label>
      <div ref="outcomeRef" class="relative">
        <button type="button" @click="toggleDropdown('outcome')" @keydown.escape="outcomeOpen = false" :aria-expanded="outcomeOpen" aria-haspopup="listbox" :class="(modelValue.outcome || []).length ? btnActiveClass : btnClass">
          <span class="truncate max-w-[140px]">{{ multiLabel(modelValue.outcome, 'All outcomes') }}</span>
          <svg class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
        </button>
        <div v-if="outcomeOpen" role="group" :class="dropdownClass" @keydown.escape="outcomeOpen = false">
          <label v-for="o in outcomes" :key="o" :class="optionClass">
            <input type="checkbox" :checked="(modelValue.outcome || []).includes(o)" @change="toggleValue('outcome', o)" class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500" />
            <span class="truncate">{{ o }}</span>
          </label>
        </div>
      </div>
    </div>

    <!-- Target Version -->
    <div v-if="targetVersions.length > 0" class="flex flex-col gap-0.5">
      <label class="text-xs font-medium text-gray-600 dark:text-gray-400">Target Version</label>
      <div ref="targetVersionRef" class="relative">
        <button type="button" @click="toggleDropdown('targetVersion')" @keydown.escape="targetVersionOpen = false" :aria-expanded="targetVersionOpen" aria-haspopup="listbox" :class="(modelValue.targetVersion || []).length ? btnActiveClass : btnClass">
          <span class="truncate max-w-[140px]">{{ multiLabel(modelValue.targetVersion, 'All versions') }}</span>
          <svg class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
        </button>
        <div v-if="targetVersionOpen" role="group" :class="dropdownClass" @keydown.escape="targetVersionOpen = false">
          <label v-for="tv in targetVersions" :key="tv" :class="optionClass">
            <input type="checkbox" :checked="(modelValue.targetVersion || []).includes(tv)" @change="toggleValue('targetVersion', tv)" class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500" />
            <span class="truncate">{{ tv }}</span>
          </label>
        </div>
      </div>
    </div>

    <!-- Fix Version -->
    <div v-if="fixVersions.length > 0" class="flex flex-col gap-0.5">
      <label class="text-xs font-medium text-gray-600 dark:text-gray-400">Fix Version</label>
      <div ref="fixVersionRef" class="relative">
        <button type="button" @click="toggleDropdown('fixVersion')" @keydown.escape="fixVersionOpen = false" :aria-expanded="fixVersionOpen" aria-haspopup="listbox" :class="(modelValue.fixVersion || []).length ? btnActiveClass : btnClass">
          <span class="truncate max-w-[140px]">{{ multiLabel(modelValue.fixVersion, 'All fix versions') }}</span>
          <svg class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
        </button>
        <div v-if="fixVersionOpen" role="group" :class="dropdownClass" @keydown.escape="fixVersionOpen = false">
          <label v-for="fv in fixVersions" :key="fv" :class="optionClass">
            <input type="checkbox" :checked="(modelValue.fixVersion || []).includes(fv)" @change="toggleValue('fixVersion', fv)" class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500" />
            <span class="truncate">{{ fv }}</span>
          </label>
        </div>
      </div>
    </div>

    <!-- Component -->
    <div v-if="components.length > 0" class="flex flex-col gap-0.5">
      <label class="text-xs font-medium text-gray-600 dark:text-gray-400">Component</label>
      <div ref="componentRef" class="relative">
        <button type="button" @click="toggleDropdown('component')" @keydown.escape="componentOpen = false" :aria-expanded="componentOpen" aria-haspopup="listbox" :class="(modelValue.component || []).length ? btnActiveClass : btnClass">
          <span class="truncate max-w-[140px]">{{ multiLabel(modelValue.component, 'All components') }}</span>
          <svg class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
        </button>
        <div v-if="componentOpen" role="group" :class="dropdownClass" @keydown.escape="componentOpen = false">
          <label v-for="c in components" :key="c" :class="optionClass">
            <input type="checkbox" :checked="(modelValue.component || []).includes(c)" @change="toggleValue('component', c)" class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500" />
            <span class="truncate">{{ c }}</span>
          </label>
        </div>
      </div>
    </div>

    <!-- Team -->
    <div v-if="teams.length > 0" class="flex flex-col gap-0.5">
      <label class="text-xs font-medium text-gray-600 dark:text-gray-400">Team</label>
      <div ref="teamRef" class="relative">
        <button type="button" @click="toggleDropdown('team')" @keydown.escape="teamOpen = false" :aria-expanded="teamOpen" aria-haspopup="listbox" :class="(modelValue.team || []).length ? btnActiveClass : btnClass">
          <span class="truncate max-w-[140px]">{{ multiLabel(modelValue.team, 'All teams') }}</span>
          <svg class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
        </button>
        <div v-if="teamOpen" role="group" :class="dropdownClass" @keydown.escape="teamOpen = false">
          <label v-for="t in teams" :key="t" :class="optionClass">
            <input type="checkbox" :checked="(modelValue.team || []).includes(t)" @change="toggleValue('team', t)" class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500" />
            <span class="truncate">{{ t }}</span>
          </label>
        </div>
      </div>
    </div>

    <!-- Priority -->
    <div v-if="priorities.length > 0" class="flex flex-col gap-0.5">
      <label class="text-xs font-medium text-gray-600 dark:text-gray-400">Priority</label>
      <div ref="priorityRef" class="relative">
        <button type="button" @click="toggleDropdown('priority')" @keydown.escape="priorityOpen = false" :aria-expanded="priorityOpen" aria-haspopup="listbox" :class="(modelValue.priority || []).length ? btnActiveClass : btnClass">
          <span class="truncate max-w-[140px]">{{ multiLabel(modelValue.priority, 'All priorities') }}</span>
          <svg class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
        </button>
        <div v-if="priorityOpen" role="group" :class="dropdownClass" @keydown.escape="priorityOpen = false">
          <label v-for="p in priorities" :key="p" :class="optionClass">
            <input type="checkbox" :checked="(modelValue.priority || []).includes(p)" @change="toggleValue('priority', p)" class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500" />
            <span class="truncate">{{ p }}</span>
          </label>
        </div>
      </div>
    </div>

    <!-- Clear filters -->
    <div v-if="hasActiveFilters" class="flex flex-col gap-0.5 justify-end">
      <span class="text-xs font-medium text-transparent select-none">Clear</span>
      <button type="button" @click="clearFilters" class="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 border border-transparent hover:border-gray-300 dark:hover:border-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400">
        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        Clear filters
      </button>
    </div>

  </div>
</template>
