<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">
          AI Engineering OKR Scorecard — {{ data.year }}
        </h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Quarter-over-quarter tracking of all engineering OKRs.
        </p>
      </div>
      <div class="flex items-center gap-3">
        <span
          v-for="s in statusList"
          :key="s.key"
          class="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-600 dark:text-gray-300"
        >
          <span class="inline-block w-2.5 h-2.5 rounded-full" :class="s.dot" />
          {{ s.label }}
        </span>
      </div>
    </div>

    <div v-for="category in data.categories" :key="category.name" class="space-y-2">
      <button
        class="w-full flex items-center gap-2 text-left group"
        @click="toggleCategory(category.name)"
      >
        <svg
          class="w-4 h-4 text-gray-400 transition-transform duration-200"
          :class="{ 'rotate-90': isCategoryOpen(category.name) }"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <h3 class="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
          {{ category.name }}
        </h3>
        <span class="text-xs text-gray-400 dark:text-gray-500 font-medium">
          {{ category.objectives.length }} objective{{ category.objectives.length === 1 ? '' : 's' }}
        </span>
      </button>

      <div
        v-show="isCategoryOpen(category.name)"
        class="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm"
      >
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr class="bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700">
              <th class="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-48">Objective</th>
              <th class="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-56">Measure of Success</th>
              <th
                v-for="q in quarters"
                :key="q"
                class="px-4 py-3 text-center text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-40"
              >{{ q }} {{ shortYear }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="obj in category.objectives"
              :key="obj.id"
              class="border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
              @click="navigateToDeepDive(obj.id)"
            >
              <td class="px-4 py-3">
                <span class="font-semibold text-gray-900 dark:text-gray-100 text-sm">{{ obj.name }}</span>
              </td>
              <td class="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 whitespace-pre-line leading-relaxed">
                {{ obj.measure }}
              </td>
              <td
                v-for="q in quarters"
                :key="q"
                class="px-3 py-3 text-center"
              >
                <div
                  v-if="obj.quarters[q]"
                  class="rounded-lg px-2 py-2 min-h-[3rem] flex items-center justify-center"
                  :class="statusConfig[obj.quarters[q].status].bg"
                >
                  <span
                    v-if="obj.quarters[q].summary"
                    class="text-[11px] font-medium leading-tight whitespace-pre-line"
                    :class="statusConfig[obj.quarters[q].status].text"
                  >{{ obj.quarters[q].summary }}</span>
                  <span v-else class="text-xs text-gray-300 dark:text-gray-600">—</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, inject } from 'vue'
import { OKR_DATA, STATUS_CONFIG, QUARTERS } from '../data/mock-okrs.js'

var nav = inject('moduleNav', null)

var data = OKR_DATA
var statusConfig = STATUS_CONFIG
var quarters = QUARTERS
var shortYear = String(data.year).slice(-2)

var statusList = [
  { key: 'green', label: 'On Track', dot: statusConfig.green.dot },
  { key: 'yellow', label: 'Partial', dot: statusConfig.yellow.dot },
  { key: 'red', label: 'At Risk', dot: statusConfig.red.dot },
  { key: 'not-started', label: 'Not Started', dot: statusConfig['not-started'].dot }
]

var openCategories = reactive({})
for (var i = 0; i < data.categories.length; i++) {
  openCategories[data.categories[i].name] = true
}

function isCategoryOpen(name) {
  return !!openCategories[name]
}

function toggleCategory(name) {
  openCategories[name] = !openCategories[name]
}

function navigateToDeepDive(objectiveId) {
  if (nav) nav.navigateTo('deep-dive', { okr: objectiveId })
}
</script>
