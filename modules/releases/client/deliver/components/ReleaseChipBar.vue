<template>
  <div data-testid="deliver-release-chip-bar" class="space-y-2 px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200
              dark:border-gray-700">
    <!-- Product row -->
    <div class="flex items-center gap-2">
      <span class="text-xs font-medium text-gray-500 dark:text-gray-400 w-16 shrink-0">
        Product
      </span>
      <div class="flex flex-wrap gap-1.5">
        <button
          @click="filter.clearProducts()"
          :class="filter.selectedProducts.size === 0 ? activeChipClass : inactiveChipClass"
        >All</button>
        <button
          v-for="product in filter.visibleProducts.value"
          :key="product"
          @click="filter.toggleProduct(product)"
          :class="filter.selectedProducts.has(product) ? activeChipClass : inactiveChipClass"
        >{{ product.toUpperCase() }}</button>
      </div>
    </div>
    <!-- Version row -->
    <div class="flex items-center gap-2">
      <span class="text-xs font-medium text-gray-500 dark:text-gray-400 w-16 shrink-0">
        Version
      </span>
      <div class="flex flex-wrap gap-1.5">
        <button
          @click="filter.clearVersions()"
          :class="filter.selectedVersions.size === 0 ? activeChipClass : inactiveChipClass"
        >All</button>
        <button
          v-for="version in filter.visibleVersions.value"
          :key="version"
          @click="filter.toggleVersion(version)"
          :class="filter.selectedVersions.has(version) ? activeChipClass : inactiveChipClass"
        >{{ version }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'

const filter = inject('releaseFilter')

const activeChipClass = 'px-2.5 py-1 text-xs font-medium rounded-full border ' +
  'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 ' +
  'border-primary-300 dark:border-primary-600'

const inactiveChipClass = 'px-2.5 py-1 text-xs font-medium rounded-full border ' +
  'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 ' +
  'border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700'
</script>
