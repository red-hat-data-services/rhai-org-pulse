<template>
  <Teleport to="body">
    <div v-if="filters.filterModalOpen.value" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/40 dark:bg-black/60" @click="filters.closeFilterModal()"></div>
      <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-xl max-h-[80vh] flex flex-col">
        <!-- Header with tabs -->
        <div class="shrink-0">
          <div class="flex items-center justify-between px-6 pt-4 pb-0">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Filters</h3>
            <button @click="filters.closeFilterModal()" class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="flex gap-6 px-6 mt-3 border-b border-gray-200 dark:border-gray-700">
            <button
              @click="filters.setFilterModalTab('fields')"
              class="pb-2.5 text-sm font-medium transition-colors whitespace-nowrap border-b-2"
              :class="filters.filterModalTab.value === 'fields'
                ? 'border-primary-600 text-primary-600 dark:text-primary-400 dark:border-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'"
            >Filter Fields</button>
            <button
              @click="filters.setFilterModalTab('presets')"
              class="pb-2.5 text-sm font-medium transition-colors whitespace-nowrap border-b-2 inline-flex items-center gap-1.5"
              :class="filters.filterModalTab.value === 'presets'
                ? 'border-primary-600 text-primary-600 dark:text-primary-400 dark:border-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'"
            >
              Saved Presets
              <span
                v-if="filters.savedFilters.value.length > 0"
                class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                :class="filters.filterModalTab.value === 'presets'
                  ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'"
              >{{ filters.savedFilters.value.length }}</span>
            </button>
          </div>
        </div>

        <!-- Tab: Filter Fields -->
        <div v-if="filters.filterModalTab.value === 'fields'" class="flex flex-1 min-h-0" style="min-height: 320px">
          <!-- Field list (left) -->
          <div class="w-44 shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col bg-gray-50/50 dark:bg-gray-900/20">
            <div class="flex-1 overflow-y-auto">
              <button
                v-for="f in filters.filterFields"
                :key="f.key"
                @click="filters.selectFilterField(f.key)"
                class="w-full px-4 py-2.5 text-sm text-left transition-colors"
                :class="filters.filterModalField.value === f.key
                  ? 'bg-white dark:bg-gray-800 text-primary-700 dark:text-primary-300 font-medium border-r-2 border-primary-600 dark:border-primary-400'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="truncate">{{ f.label }}</span>
                  <span
                    v-if="filters.activeFilters[f.key]?.length"
                    class="text-[10px] font-semibold text-primary-600 dark:text-primary-400 bg-primary-100 dark:bg-primary-900/40 px-1.5 py-0.5 rounded-full shrink-0"
                  >{{ filters.activeFilters[f.key].length }}</span>
                </div>
              </button>
            </div>
            <!-- Cross-field mode -->
            <div v-if="filters.activeFieldCount.value > 1" class="border-t border-gray-200 dark:border-gray-700 px-3 py-2.5">
              <div class="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Across fields</div>
              <button
                @click="filters.setCrossFieldMode(filters.crossFieldMode.value === 'and' ? 'or' : 'and')"
                class="w-full px-2 py-1 rounded text-[11px] font-medium text-center transition-colors"
                :class="filters.crossFieldMode.value === 'and'
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                  : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'"
              >{{ filters.crossFieldMode.value === 'and' ? 'ALL fields (AND)' : 'ANY field (OR)' }}</button>
            </div>
          </div>

          <!-- Value list (right) -->
          <div class="flex-1 flex flex-col min-w-0">
            <div v-if="!filters.filterModalField.value" class="flex-1 flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">
              Select a field to filter by
            </div>
            <template v-else>
              <!-- Search + match mode -->
              <div class="px-4 pt-3 pb-2 shrink-0 space-y-2">
                <input
                  :value="filters.filterModalSearch.value"
                  @input="filters.setFilterModalSearch($event.target.value)"
                  type="text"
                  :placeholder="'Search ' + filters.filterFieldLabel(filters.filterModalField.value).toLowerCase() + 's...'"
                  class="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                />
                <div v-if="filters.activeFilters[filters.filterModalField.value]?.length > 1" class="flex items-center gap-2">
                  <span class="text-[11px] text-gray-500 dark:text-gray-400">Match:</span>
                  <button
                    @click="filters.toggleFilterMode(filters.filterModalField.value)"
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors"
                    :class="(filters.filterModes[filters.filterModalField.value] || 'or') === 'and'
                      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'"
                  >
                    {{ (filters.filterModes[filters.filterModalField.value] || 'or') === 'and' ? 'ALL (AND)' : 'ANY (OR)' }}
                  </button>
                </div>
              </div>

              <!-- Values -->
              <div class="flex-1 overflow-y-auto px-4 pb-3">
                <div v-if="modalValues.selected.length === 0 && modalValues.unselected.length === 0" class="text-sm text-gray-400 dark:text-gray-500 text-center py-8">
                  {{ filters.filterModalSearch.value ? 'No matching values' : 'No values available' }}
                </div>
                <template v-else>
                  <!-- Selected values -->
                  <div v-if="modalValues.selected.length > 0" class="space-y-0.5">
                    <label
                      v-for="val in modalValues.selected"
                      :key="val"
                      class="flex items-center gap-2.5 px-3 py-1.5 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked
                        @change="filters.toggleFilterValue(filters.filterModalField.value, val)"
                        class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                      />
                      <span class="text-gray-700 dark:text-gray-300 truncate">{{ val }}</span>
                    </label>
                  </div>
                  <!-- Separator -->
                  <div v-if="modalValues.selected.length > 0 && modalValues.unselected.length > 0" class="my-2 border-t border-gray-200 dark:border-gray-700"></div>
                  <!-- Unselected values -->
                  <div v-if="modalValues.unselected.length > 0" class="space-y-0.5">
                    <label
                      v-for="val in modalValues.unselected"
                      :key="val"
                      class="flex items-center gap-2.5 px-3 py-1.5 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        @change="filters.toggleFilterValue(filters.filterModalField.value, val)"
                        class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                      />
                      <span class="text-gray-700 dark:text-gray-300 truncate">{{ val }}</span>
                    </label>
                  </div>
                </template>
              </div>
            </template>
          </div>
        </div>

        <!-- Tab: Saved Presets -->
        <div v-if="filters.filterModalTab.value === 'presets'" class="flex-1 flex flex-col min-h-0" style="min-height: 320px">
          <div class="flex-1 overflow-y-auto">
            <div v-if="filters.savedFilters.value.length === 0" class="px-6 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
              No saved presets yet.
            </div>
            <div v-else class="divide-y divide-gray-200 dark:divide-gray-700">
              <div
                v-for="preset in filters.savedFilters.value"
                :key="preset.id"
                class="px-6 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ preset.name }}</div>
                    <div v-if="preset.description" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ preset.description }}</div>
                    <div class="flex flex-wrap gap-1 mt-1.5">
                      <span
                        v-for="(values, field) in preset.filters"
                        :key="field"
                        class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                      >{{ filters.filterFieldLabel(field) }}: {{ filters.formatFilterValues(values) }}</span>
                    </div>
                  </div>
                  <div class="flex items-center gap-1 shrink-0">
                    <button @click="filters.applySavedFilter(preset)" class="p-1 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded transition-colors" title="Apply">
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    </button>
                    <button @click="filters.editSavedFilter(preset)" class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors" title="Edit">
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                      </svg>
                    </button>
                    <button @click="filters.deleteSavedFilter(preset.id)" class="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors" title="Delete">
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="border-t border-gray-200 dark:border-gray-700 shrink-0">
          <!-- Save form (expandable) -->
          <div v-if="filters.showSaveForm.value && filters.hasActiveFilters.value" class="px-6 py-3 bg-gray-50/50 dark:bg-gray-900/30 border-b border-gray-200 dark:border-gray-700">
            <div class="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              {{ filters.editingFilterId.value ? 'Update Preset' : 'Save as Preset' }}
            </div>
            <div class="space-y-2">
              <input
                :value="filters.savedFilterName.value"
                @input="filters.setSavedFilterName($event.target.value)"
                type="text"
                placeholder="Name (required)"
                class="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
              <input
                :value="filters.savedFilterDescription.value"
                @input="filters.setSavedFilterDescription($event.target.value)"
                type="text"
                placeholder="Description (optional)"
                class="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
              <div class="flex items-center gap-2">
                <button
                  @click="filters.saveCurrentFilters()"
                  :disabled="!filters.savedFilterName.value.trim()"
                  class="px-3 py-1.5 text-sm font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >{{ filters.editingFilterId.value ? 'Update' : 'Save' }}</button>
                <button
                  @click="filters.cancelSaveForm()"
                  class="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >Cancel</button>
              </div>
            </div>
          </div>

          <!-- Button bar -->
          <div class="flex items-center justify-between px-6 py-3">
            <button
              v-if="filters.hasActiveFilters.value"
              @click="filters.clearAllFilters()"
              class="text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            >Clear All Filters</button>
            <span v-else></span>
            <div class="flex items-center gap-2">
              <button
                v-if="filters.hasActiveFilters.value && !filters.showSaveForm.value"
                @click="filters.setShowSaveForm(true)"
                class="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >Save as Preset</button>
              <button
                @click="filters.closeFilterModal()"
                class="px-4 py-2 text-sm font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700 transition-colors"
              >Done</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  filters: {
    type: Object,
    required: true
  },
  availableFilterValues: {
    type: Object,
    default: () => ({})
  }
})

const modalValues = computed(() => {
  return props.filters.getFilterModalValues(props.availableFilterValues)
})
</script>
