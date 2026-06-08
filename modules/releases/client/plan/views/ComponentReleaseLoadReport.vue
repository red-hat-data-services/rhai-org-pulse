<template>
  <div class="space-y-6">
    <div class="flex items-start justify-between">
      <div>
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Component Release Load Tracking</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Track component workload distribution across releases.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button
          v-if="groups.length > 0"
          @click="handleExpandAll"
          class="px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >Expand All</button>
        <button
          v-if="groups.length > 0"
          @click="handleCollapseAll"
          class="px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >Collapse All</button>
      </div>
    </div>

    <div class="flex flex-wrap items-start gap-4">
      <!-- Jira Component Filter -->
      <div class="min-w-[280px] max-w-[400px] relative" ref="componentDropdownRef">
        <div class="flex items-center justify-between mb-1">
          <label class="text-xs font-medium text-gray-600 dark:text-gray-400">Jira Component</label>
          <button
            v-if="selectedComponents.length > 0"
            type="button"
            @click="selectedComponents = []; componentSearch = ''"
            class="text-[10px] font-medium text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
          >Clear</button>
        </div>
        <div
          class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 px-2 py-1.5 cursor-text flex flex-wrap items-center gap-1 min-h-[38px]"
          :class="{ 'ring-2 ring-primary-500 border-primary-500': componentDropdownOpen }"
          @click="openComponentDropdown"
        >
          <span
            v-for="name in selectedComponents"
            :key="name"
            class="inline-flex items-center gap-1 bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 rounded px-1.5 py-0.5 text-xs font-medium"
          >
            {{ name }}
            <button type="button" class="hover:text-primary-900 dark:hover:text-primary-100" @click.stop="toggleComponent(name)">&times;</button>
          </span>
          <input
            ref="componentInputRef"
            v-model="componentSearch"
            type="text"
            class="flex-1 min-w-[80px] bg-transparent outline-none text-sm placeholder-gray-400 dark:placeholder-gray-500"
            :placeholder="selectedComponents.length ? '' : 'Search components…'"
            @focus="componentDropdownOpen = true"
            @keydown.backspace="onComponentBackspace"
          />
        </div>
        <div
          v-if="componentDropdownOpen"
          class="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg"
        >
          <div v-if="loadingComponents" class="px-3 py-2 text-xs text-gray-400">Loading…</div>
          <div v-else-if="filteredComponents.length === 0" class="px-3 py-2 text-xs text-gray-400">No matches</div>
          <button
            v-for="name in filteredComponents"
            :key="name"
            type="button"
            class="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            @mousedown.prevent="toggleComponent(name)"
          >
            <span
              class="w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center text-xs"
              :class="selectedComponents.includes(name)
                ? 'bg-primary-500 border-primary-500 text-white'
                : 'border-gray-300 dark:border-gray-500'"
            >
              <span v-if="selectedComponents.includes(name)">&#10003;</span>
            </span>
            {{ name }}
          </button>
        </div>
        <p v-if="componentError" class="text-xs text-red-500 mt-1">{{ componentError }}</p>
      </div>

      <!-- Release / Version Filter -->
      <div class="min-w-[280px] max-w-[400px] relative" ref="versionDropdownRef">
        <div class="flex items-center justify-between mb-1">
          <label class="text-xs font-medium text-gray-600 dark:text-gray-400">Release</label>
          <button
            v-if="selectedVersions.length > 0"
            type="button"
            @click="selectedVersions = []; versionSearch = ''"
            class="text-[10px] font-medium text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
          >Clear</button>
        </div>
        <div
          class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 px-2 py-1.5 cursor-text flex flex-wrap items-center gap-1 min-h-[38px]"
          :class="{ 'ring-2 ring-primary-500 border-primary-500': versionDropdownOpen }"
          @click="openVersionDropdown"
        >
          <span
            v-for="name in selectedVersions"
            :key="name"
            class="inline-flex items-center gap-1 bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 rounded px-1.5 py-0.5 text-xs font-medium"
          >
            {{ name }}
            <button type="button" class="hover:text-primary-900 dark:hover:text-primary-100" @click.stop="toggleVersion(name)">&times;</button>
          </span>
          <input
            ref="versionInputRef"
            v-model="versionSearch"
            type="text"
            class="flex-1 min-w-[80px] bg-transparent outline-none text-sm placeholder-gray-400 dark:placeholder-gray-500"
            :placeholder="selectedVersions.length ? '' : 'Search releases…'"
            @focus="versionDropdownOpen = true"
            @keydown.backspace="onVersionBackspace"
          />
        </div>
        <div
          v-if="versionDropdownOpen"
          class="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg"
        >
          <div v-if="loadingVersions" class="px-3 py-2 text-xs text-gray-400">Loading…</div>
          <div v-else-if="filteredVersions.length === 0" class="px-3 py-2 text-xs text-gray-400">No matches</div>
          <button
            v-for="name in filteredVersions"
            :key="name"
            type="button"
            class="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            @mousedown.prevent="toggleVersion(name)"
          >
            <span
              class="w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center text-xs"
              :class="selectedVersions.includes(name)
                ? 'bg-primary-500 border-primary-500 text-white'
                : 'border-gray-300 dark:border-gray-500'"
            >
              <span v-if="selectedVersions.includes(name)">&#10003;</span>
            </span>
            {{ name }}
          </button>
        </div>
        <p v-if="versionError" class="text-xs text-red-500 mt-1">{{ versionError }}</p>
      </div>
    </div>

    <!-- Summary cards -->
    <div v-if="groups.length > 0 && !loadingData" class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <!-- Features Requested -->
      <div
        @click="totalRequested > 0 ? setFilter('requested') : undefined"
        class="relative overflow-hidden bg-white dark:bg-gray-800 rounded-xl border px-4 py-3.5 transition-all duration-150"
        :class="[
          activeFilter === 'requested'
            ? 'border-blue-400 dark:border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800 shadow-sm'
            : 'border-gray-200 dark:border-gray-700',
          totalRequested > 0 ? 'cursor-pointer hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600' : ''
        ]"
      >
        <div class="absolute top-0 left-0 w-1 h-full bg-blue-500 rounded-l-xl" />
        <div class="flex items-center gap-2 mb-1.5">
          <span class="inline-flex items-center justify-center w-5 h-5 rounded bg-blue-100 dark:bg-blue-900/40">
            <svg class="w-3 h-3 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </span>
          <span class="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Features Requested</span>
          <svg v-if="activeFilter === 'requested'" class="ml-auto w-3.5 h-3.5 text-blue-500 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <div class="text-2xl font-bold text-blue-600 dark:text-blue-400 ml-7">{{ totalRequested }}</div>
      </div>
      <!-- Features Committed -->
      <div
        @click="totalCommitted > 0 ? setFilter('committed') : undefined"
        class="relative overflow-hidden bg-white dark:bg-gray-800 rounded-xl border px-4 py-3.5 transition-all duration-150"
        :class="[
          activeFilter === 'committed'
            ? 'border-emerald-400 dark:border-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-800 shadow-sm'
            : 'border-gray-200 dark:border-gray-700',
          totalCommitted > 0 ? 'cursor-pointer hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-600' : ''
        ]"
      >
        <div class="absolute top-0 left-0 w-1 h-full bg-emerald-500 rounded-l-xl" />
        <div class="flex items-center gap-2 mb-1.5">
          <span class="inline-flex items-center justify-center w-5 h-5 rounded bg-emerald-100 dark:bg-emerald-900/40">
            <svg class="w-3 h-3 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
          <span class="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Features Committed</span>
          <svg v-if="activeFilter === 'committed'" class="ml-auto w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <div class="text-2xl font-bold text-emerald-600 dark:text-emerald-400 ml-7">{{ totalCommitted }}</div>
      </div>
      <!-- Blocked -->
      <div
        @click="totalBlocked > 0 ? setFilter('blocked') : undefined"
        class="relative overflow-hidden bg-white dark:bg-gray-800 rounded-xl border px-4 py-3.5 transition-all duration-150"
        :class="[
          activeFilter === 'blocked'
            ? 'border-red-400 dark:border-red-500 ring-2 ring-red-200 dark:ring-red-800 shadow-sm'
            : 'border-gray-200 dark:border-gray-700',
          totalBlocked > 0 ? 'cursor-pointer hover:shadow-md hover:border-red-300 dark:hover:border-red-600' : ''
        ]"
      >
        <div class="absolute top-0 left-0 w-1 h-full bg-red-500 rounded-l-xl" />
        <div class="flex items-center gap-2 mb-1.5">
          <span class="inline-flex items-center justify-center w-5 h-5 rounded bg-red-100 dark:bg-red-900/40">
            <svg class="w-3 h-3 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </span>
          <span class="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Blocked</span>
          <svg v-if="activeFilter === 'blocked'" class="ml-auto w-3.5 h-3.5 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <div class="text-2xl font-bold ml-7" :class="totalBlocked > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'">{{ totalBlocked }}</div>
      </div>
      <!-- Versions Selected -->
      <div class="relative overflow-hidden bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3.5">
        <div class="absolute top-0 left-0 w-1 h-full bg-gray-400 rounded-l-xl" />
        <div class="flex items-center gap-2 mb-1.5">
          <span class="inline-flex items-center justify-center w-5 h-5 rounded bg-gray-100 dark:bg-gray-700">
            <svg class="w-3 h-3 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
            </svg>
          </span>
          <span class="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Versions Selected</span>
        </div>
        <div class="text-2xl font-bold text-gray-900 dark:text-gray-100 ml-7">{{ groups.length }}</div>
      </div>
    </div>

    <!-- Active filter indicator -->
    <div
      v-if="activeFilter && groups.length > 0 && !loadingData"
      class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
      :class="{
        'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300': activeFilter === 'requested',
        'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300': activeFilter === 'committed',
        'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300': activeFilter === 'blocked'
      }"
    >
      <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
      </svg>
      <span>Showing {{ activeFilter === 'requested' ? 'requested' : activeFilter === 'committed' ? 'committed' : 'blocked' }} features only</span>
      <button
        @click="setFilter(null)"
        class="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold hover:bg-white/50 dark:hover:bg-gray-800/50 transition-colors"
      >
        Clear filter
        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Loading state -->
    <div v-if="loadingData" class="flex flex-col items-center justify-center py-16 gap-3">
      <svg class="animate-spin h-8 w-8 text-primary-500" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      <span class="text-sm text-gray-500 dark:text-gray-400">Loading data from Jira…</span>
    </div>

    <!-- Error state -->
    <div v-else-if="dataError" class="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-5 py-4 text-sm text-red-700 dark:text-red-400 flex items-start gap-3">
      <svg class="w-5 h-5 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
      {{ dataError }}
    </div>

    <!-- Empty prompt -->
    <div v-else-if="groups.length === 0 && !hasFetched" class="text-center py-16 text-gray-400 dark:text-gray-500">
      <svg class="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <p class="text-sm font-medium">Select components and/or releases to view data.</p>
    </div>

    <!-- No results -->
    <div v-else-if="groups.length === 0 && hasFetched" class="text-center py-16 text-gray-400 dark:text-gray-500">
      <svg class="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
      </svg>
      <p class="text-sm font-medium">No features found for the selected filters.</p>
    </div>

    <!-- Data table -->
    <ComponentReleaseLoadTable
      v-if="groups.length > 0 && !loadingData"
      ref="tableRef"
      :groups="groups"
      :activeFilter="activeFilter"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { getApiBase } from '@shared/client/services/api'
import ComponentReleaseLoadTable from '../components/ComponentReleaseLoadTable.vue'

const API_BASE = '/modules/releases/pm-hub'

var selectedComponents = ref([])
var selectedVersions = ref([])

var componentSearch = ref('')
var versionSearch = ref('')

var componentDropdownOpen = ref(false)
var versionDropdownOpen = ref(false)

var componentDropdownRef = ref(null)
var versionDropdownRef = ref(null)
var componentInputRef = ref(null)
var versionInputRef = ref(null)

var components = ref([])
var loadingComponents = ref(false)
var componentError = ref(null)

var versions = ref([])
var loadingVersions = ref(false)
var versionError = ref(null)

var groups = ref([])
var loadingData = ref(false)
var dataError = ref(null)
var hasFetched = ref(false)
var tableRef = ref(null)
var activeFilter = ref(null)

function setFilter(type) {
  if (type === null || activeFilter.value === type) {
    activeFilter.value = null
  } else {
    activeFilter.value = type
  }
}

var uniqueComponents = computed(function() {
  var seen = new Set()
  var result = []
  for (var i = 0; i < components.value.length; i++) {
    var name = components.value[i].name
    if (!seen.has(name)) {
      seen.add(name)
      result.push(name)
    }
  }
  return result
})

var uniqueVersions = computed(function() {
  var seen = new Set()
  var result = []
  for (var i = 0; i < versions.value.length; i++) {
    var name = versions.value[i].name
    if (!seen.has(name)) {
      seen.add(name)
      result.push(name)
    }
  }
  return result
})

var filteredComponents = computed(function() {
  var q = componentSearch.value.toLowerCase().trim()
  if (!q) return uniqueComponents.value
  return uniqueComponents.value.filter(function(name) {
    return name.toLowerCase().includes(q)
  })
})

var filteredVersions = computed(function() {
  var q = versionSearch.value.toLowerCase().trim()
  if (!q) return uniqueVersions.value
  return uniqueVersions.value.filter(function(name) {
    return name.toLowerCase().includes(q)
  })
})

var totalRequested = computed(function() {
  var count = 0
  for (var i = 0; i < groups.value.length; i++) {
    count += groups.value[i].requestedCount || 0
  }
  return count
})

var totalCommitted = computed(function() {
  var count = 0
  for (var i = 0; i < groups.value.length; i++) {
    count += groups.value[i].committedCount || 0
  }
  return count
})

var totalBlocked = computed(function() {
  var count = 0
  for (var i = 0; i < groups.value.length; i++) {
    count += groups.value[i].blockedCount || 0
  }
  return count
})

function toggleComponent(name) {
  var idx = selectedComponents.value.indexOf(name)
  if (idx >= 0) {
    selectedComponents.value.splice(idx, 1)
  } else {
    selectedComponents.value.push(name)
  }
  componentSearch.value = ''
}

function toggleVersion(name) {
  var idx = selectedVersions.value.indexOf(name)
  if (idx >= 0) {
    selectedVersions.value.splice(idx, 1)
  } else {
    selectedVersions.value.push(name)
  }
  versionSearch.value = ''
}

function openComponentDropdown() {
  componentDropdownOpen.value = true
  if (componentInputRef.value) componentInputRef.value.focus()
}

function openVersionDropdown() {
  versionDropdownOpen.value = true
  if (versionInputRef.value) versionInputRef.value.focus()
}

function onComponentBackspace() {
  if (!componentSearch.value && selectedComponents.value.length) {
    selectedComponents.value.pop()
  }
}

function onVersionBackspace() {
  if (!versionSearch.value && selectedVersions.value.length) {
    selectedVersions.value.pop()
  }
}

function handleClickOutside(e) {
  if (componentDropdownRef.value && !componentDropdownRef.value.contains(e.target)) {
    componentDropdownOpen.value = false
    componentSearch.value = ''
  }
  if (versionDropdownRef.value && !versionDropdownRef.value.contains(e.target)) {
    versionDropdownOpen.value = false
    versionSearch.value = ''
  }
}

function handleExpandAll() {
  if (tableRef.value) tableRef.value.expandAll()
}

function handleCollapseAll() {
  if (tableRef.value) tableRef.value.collapseAll()
}

async function fetchComponents() {
  loadingComponents.value = true
  componentError.value = null
  try {
    var response = await fetch(getApiBase() + API_BASE + '/jira/components')
    if (!response.ok) {
      var errData = await response.json().catch(function() { return {} })
      throw new Error(errData.error || 'HTTP ' + response.status)
    }
    var data = await response.json()
    components.value = data.components || []
  } catch (err) {
    componentError.value = err.message
  } finally {
    loadingComponents.value = false
  }
}

async function fetchVersions() {
  loadingVersions.value = true
  versionError.value = null
  try {
    var response = await fetch(getApiBase() + API_BASE + '/jira/versions')
    if (!response.ok) {
      var errData = await response.json().catch(function() { return {} })
      throw new Error(errData.error || 'HTTP ' + response.status)
    }
    var data = await response.json()
    versions.value = data.versions || []
  } catch (err) {
    versionError.value = err.message
  } finally {
    loadingVersions.value = false
  }
}

async function loadData() {
  if (selectedComponents.value.length === 0 && selectedVersions.value.length === 0) return
  loadingData.value = true
  dataError.value = null
  hasFetched.value = true

  try {
    var params = new URLSearchParams()
    if (selectedComponents.value.length > 0) {
      params.set('components', selectedComponents.value.join(','))
    }
    if (selectedVersions.value.length > 0) {
      params.set('versions', selectedVersions.value.join(','))
    }

    var response = await fetch(getApiBase() + API_BASE + '/component-release-load?' + params.toString())
    if (!response.ok) {
      var errData = await response.json().catch(function() { return {} })
      throw new Error(errData.error || 'HTTP ' + response.status)
    }
    var data = await response.json()
    groups.value = data.groups || []
  } catch (err) {
    dataError.value = err.message
    groups.value = []
  } finally {
    loadingData.value = false
  }
}

watch([selectedComponents, selectedVersions], function() {
  activeFilter.value = null
  if (selectedComponents.value.length === 0 && selectedVersions.value.length === 0) {
    groups.value = []
    hasFetched.value = false
    return
  }
  loadData()
}, { deep: true })

onMounted(function() {
  fetchComponents()
  fetchVersions()
  document.addEventListener('mousedown', handleClickOutside)
})

onBeforeUnmount(function() {
  document.removeEventListener('mousedown', handleClickOutside)
})
</script>
