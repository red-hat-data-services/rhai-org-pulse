<template>
  <div class="flex flex-wrap items-center gap-3">
    <div
      v-if="versionOpen || projectOpen"
      class="fixed inset-0 z-10"
      @click="versionOpen = false; projectOpen = false"
    />

    <!-- Version Filter -->
    <div class="relative z-20">
      <button
        class="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
        :class="selectedVersions.size
          ? 'border-violet-300 dark:border-violet-600 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'"
        @click="versionOpen = !versionOpen; projectOpen = false"
      >
        <svg class="h-4 w-4 shrink-0 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6z" />
        </svg>
        <span>Version</span>
        <span
          v-if="selectedVersions.size"
          class="inline-flex items-center justify-center h-5 min-w-[1.25rem] rounded-full bg-violet-600 dark:bg-violet-500 text-white text-[10px] font-bold px-1.5"
        >{{ selectedVersions.size }}</span>
        <svg class="h-3.5 w-3.5 text-gray-400 transition-transform" :class="{ 'rotate-180': versionOpen }" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
        </svg>
      </button>
      <div
        v-if="versionOpen"
        class="absolute left-0 top-full mt-1.5 w-56 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg ring-1 ring-black/5 dark:ring-white/5 overflow-hidden"
      >
        <div class="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800">
          <span class="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Versions</span>
          <button
            v-if="selectedVersions.size"
            class="text-[11px] font-medium text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-300"
            @click="clearVersions"
          >Clear All</button>
        </div>
        <div class="max-h-52 overflow-y-auto py-1">
          <label
            v-for="version in visibleVersions"
            :key="version"
            class="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
          >
            <input
              type="checkbox"
              :checked="selectedVersions.has(version)"
              class="h-3.5 w-3.5 rounded border-gray-300 dark:border-gray-600 text-violet-600 focus:ring-violet-500"
              @change="toggleVersion(version)"
            />
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ version }}</span>
          </label>
        </div>
      </div>
    </div>

    <!-- Project Filter -->
    <div class="relative z-20">
      <button
        class="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
        :class="selectedProjects.size
          ? 'border-sky-300 dark:border-sky-600 bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'"
        @click="projectOpen = !projectOpen; versionOpen = false"
      >
        <svg class="h-4 w-4 shrink-0 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
        </svg>
        <span>Project</span>
        <span
          v-if="selectedProjects.size"
          class="inline-flex items-center justify-center h-5 min-w-[1.25rem] rounded-full bg-sky-600 dark:bg-sky-500 text-white text-[10px] font-bold px-1.5"
        >{{ selectedProjects.size }}</span>
        <svg class="h-3.5 w-3.5 text-gray-400 transition-transform" :class="{ 'rotate-180': projectOpen }" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
        </svg>
      </button>
      <div
        v-if="projectOpen"
        class="absolute left-0 top-full mt-1.5 w-56 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg ring-1 ring-black/5 dark:ring-white/5 overflow-hidden"
      >
        <div class="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800">
          <span class="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Projects</span>
          <button
            v-if="selectedProjects.size"
            class="text-[11px] font-medium text-sky-600 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300"
            @click="clearProjects"
          >Clear All</button>
        </div>
        <div class="max-h-52 overflow-y-auto py-1">
          <label
            v-for="project in visibleProjects"
            :key="project"
            class="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
          >
            <input
              type="checkbox"
              :checked="selectedProjects.has(project)"
              class="h-3.5 w-3.5 rounded border-gray-300 dark:border-gray-600 text-sky-600 focus:ring-sky-500"
              @change="toggleProject(project)"
            />
            <span class="text-sm font-bold uppercase tracking-wide text-gray-700 dark:text-gray-300">{{ project }}</span>
          </label>
        </div>
      </div>
    </div>

    <!-- Active filter pills + summary -->
    <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
      <span>{{ filteredCount }} of {{ totalCount }} releases</span>
      <button
        v-if="selectedVersions.size || selectedProjects.size"
        class="text-xs font-medium text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
        @click="resetFilters"
      >Reset filters</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  selectedVersions: { type: Set, required: true },
  visibleVersions: { type: Array, required: true },
  selectedProjects: { type: Set, required: true },
  visibleProjects: { type: Array, required: true },
  filteredCount: { type: Number, required: true },
  totalCount: { type: Number, required: true },
  toggleVersion: { type: Function, required: true },
  clearVersions: { type: Function, required: true },
  toggleProject: { type: Function, required: true },
  clearProjects: { type: Function, required: true },
  resetFilters: { type: Function, required: true }
})

const versionOpen = ref(false)
const projectOpen = ref(false)
</script>
