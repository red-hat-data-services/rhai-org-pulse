<script setup>
import { ref, onMounted, inject, defineAsyncComponent } from 'vue'
import { useOverviewData } from '../composables/useOverviewData'
import { formatDate } from '../utils/formatting'
import DropTimeline from '../components/DropTimeline.vue'

const ImageDependencyGraph = defineAsyncComponent(() => import('../components/ImageDependencyGraph.vue'))
const ProductionTimelineChart = defineAsyncComponent(() => import('../components/ProductionTimelineChart.vue'))

const nav = inject('moduleNav')
const {
  loading,
  error,
  stats,
  recentProductionDrops,
  dropMetrics,
  dependencyGraphData,
  loadAll,
  PRODUCT_COLORS,
} = useOverviewData()

onMounted(() => loadAll())

const hoveredCard = ref(null)

function navigateToDrop(drop, productKey) {
  nav.navigateTo('drop-detail', { key: drop.key, product: productKey })
}

function onGraphNodeClick(node) {
  const productKey = node.data?.productKey || ''
  nav.navigateTo('artifact-detail', { key: node.id, product: productKey })
}

function productBadgeStyle(productKey) {
  const colors = PRODUCT_COLORS[productKey]
  if (!colors) return {}
  return {
    color: colors.text,
    backgroundColor: colors.border + '20',
    borderColor: colors.border,
  }
}

function shortDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">Product Builds Overview</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
        Cross-product build and release dashboard
      </p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="space-y-4">
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div v-for="i in 4" :key="i" class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 p-5 animate-pulse">
          <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-3"></div>
          <div class="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
        </div>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 p-5 animate-pulse">
        <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-4"></div>
        <div class="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
      <p class="text-sm text-red-700 dark:text-red-300">{{ error }}</p>
    </div>

    <template v-else>
      <!-- Stat Cards -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Recent Drops -->
        <div
          class="relative bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-5 cursor-default"
          @mouseenter="hoveredCard = 'recent'"
          @mouseleave="hoveredCard = null"
        >
          <div class="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Recent Drops</div>
          <div class="flex items-baseline gap-1.5">
            <span class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ stats.totalDrops }}</span>
            <span class="text-xs text-gray-400 dark:text-gray-500">last 10d</span>
          </div>
          <div
            v-if="hoveredCard === 'recent' && stats.recentDropsDetail.length"
            class="absolute z-10 left-0 right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-xs space-y-1.5"
          >
            <div v-for="d in stats.recentDropsDetail" :key="d.name" class="flex items-center gap-2">
              <span
                class="inline-flex items-center px-1 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide border shrink-0"
                :style="productBadgeStyle(d.productKey)"
              >{{ PRODUCT_COLORS[d.productKey]?.label || d.productKey }}</span>
              <span class="truncate text-gray-700 dark:text-gray-300">{{ d.name }}</span>
              <span class="text-gray-400 dark:text-gray-500 whitespace-nowrap ml-auto">{{ shortDate(d.date) }}</span>
            </div>
            <div v-if="stats.totalDrops > 5" class="text-gray-400 dark:text-gray-500 text-center pt-1 border-t border-gray-100 dark:border-gray-700">
              showing 5 of {{ stats.totalDrops }}
            </div>
          </div>
        </div>

        <!-- Reached Production -->
        <div
          class="relative bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-5 cursor-default"
          @mouseenter="hoveredCard = 'prod'"
          @mouseleave="hoveredCard = null"
        >
          <div class="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Reached Production</div>
          <div class="flex items-baseline gap-1.5">
            <span class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ stats.reachedProduction }}</span>
            <span class="text-xs text-gray-400 dark:text-gray-500">last 10d</span>
          </div>
          <div
            v-if="hoveredCard === 'prod' && stats.prodDropsDetail.length"
            class="absolute z-10 left-0 right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-xs space-y-1.5"
          >
            <div v-for="d in stats.prodDropsDetail" :key="d.name" class="flex items-center gap-2">
              <span
                class="inline-flex items-center px-1 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide border shrink-0"
                :style="productBadgeStyle(d.productKey)"
              >{{ PRODUCT_COLORS[d.productKey]?.label || d.productKey }}</span>
              <span class="truncate text-gray-700 dark:text-gray-300">{{ d.name }}</span>
              <span v-if="d.days != null" class="text-gray-400 dark:text-gray-500 whitespace-nowrap ml-auto">{{ d.days }}d</span>
            </div>
            <div v-if="stats.reachedProduction > 5" class="text-gray-400 dark:text-gray-500 text-center pt-1 border-t border-gray-100 dark:border-gray-700">
              showing 5 of {{ stats.reachedProduction }}
            </div>
          </div>
        </div>

        <!-- Avg Days to Production -->
        <div
          class="relative bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-5 cursor-default"
          @mouseenter="hoveredCard = 'days'"
          @mouseleave="hoveredCard = null"
        >
          <div class="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Avg. Days to Production</div>
          <div class="flex items-baseline gap-1.5">
            <span class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ stats.avgDaysToProduction ?? '—' }}</span>
            <span v-if="stats.avgDaysToProduction != null" class="text-sm text-gray-500 dark:text-gray-400">days</span>
          </div>
          <div
            v-if="hoveredCard === 'days' && stats.daysDetail.length"
            class="absolute z-10 left-0 right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-xs space-y-1.5"
          >
            <div v-for="d in stats.daysDetail" :key="d.name" class="flex items-center justify-between gap-2">
              <span class="truncate text-gray-700 dark:text-gray-300">{{ d.name }}</span>
              <span class="text-gray-400 dark:text-gray-500 whitespace-nowrap">{{ d.days }}d</span>
            </div>
          </div>
        </div>

        <!-- Prod Artifacts Shipped -->
        <div
          class="relative bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-5 cursor-default"
          @mouseenter="hoveredCard = 'artifacts'"
          @mouseleave="hoveredCard = null"
        >
          <div class="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Prod Artifacts Shipped</div>
          <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ stats.totalArtifactsShipped }}</div>
          <div
            v-if="hoveredCard === 'artifacts' && stats.activeProductsList.length"
            class="absolute z-10 left-0 right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-xs space-y-1.5"
          >
            <div v-for="pk in stats.activeProductsList" :key="pk" class="flex items-center gap-2">
              <span
                class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border"
                :style="productBadgeStyle(pk)"
              >{{ PRODUCT_COLORS[pk]?.label || pk }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Image Dependency Graph -->
      <section class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-5">
        <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Image Dependency Chain</h2>
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Latest RHAIIS production containers with their base image and wheel dependencies
        </p>
        <ImageDependencyGraph
          :graph-data="dependencyGraphData"
          @node-click="onGraphNodeClick"
        />
      </section>

      <!-- Bottom two-column layout -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Recent Production Releases -->
        <section class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-5">
          <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Recent Production Releases</h2>
          <div v-if="recentProductionDrops.length === 0" class="text-sm text-gray-500 dark:text-gray-400">
            No production releases found
          </div>
          <div v-else class="space-y-4">
            <div
              v-for="entry in recentProductionDrops"
              :key="entry.drop.key"
              class="border border-gray-100 dark:border-gray-700 rounded-lg p-3"
            >
              <div class="flex items-center gap-2 mb-2">
                <span
                  class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border"
                  :style="productBadgeStyle(entry.productKey)"
                >{{ PRODUCT_COLORS[entry.productKey]?.label || entry.productKey }}</span>
                <button
                  class="text-sm font-medium text-primary-600 dark:text-blue-400 hover:underline"
                  @click="navigateToDrop(entry.drop, entry.productKey)"
                >{{ entry.drop.name }}</button>
                <span class="text-xs text-gray-400 dark:text-gray-500 ml-auto">{{ formatDate(entry.drop.created_at) }}</span>
              </div>
              <div v-if="dropMetrics[entry.drop.key]" class="mt-1">
                <DropTimeline :metrics="dropMetrics[entry.drop.key]" />
              </div>
              <div v-else class="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Timeline data not available
              </div>
            </div>
          </div>
        </section>

        <!-- Build-to-Production Time Chart -->
        <section class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-5">
          <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Build-to-Production Time</h2>
          <p class="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Days from first build to production release
          </p>
          <ProductionTimelineChart
            :drops="recentProductionDrops"
            :metrics="dropMetrics"
            :product-colors="PRODUCT_COLORS"
          />
        </section>
      </div>
    </template>
  </div>
</template>
