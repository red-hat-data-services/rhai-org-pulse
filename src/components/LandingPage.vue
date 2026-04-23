<template>
  <div>
    <div class="mb-6">
      <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">Org Pulse</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400">Select a module to get started</p>
    </div>

    <!-- Empty state -->
    <div
      v-if="builtInManifests.length === 0 && modules.length === 0"
      class="flex flex-col items-center justify-center py-16 text-center"
    >
      <Package :size="48" class="text-gray-300 dark:text-gray-600 mb-4" />
      <h3 class="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">No modules configured yet</h3>
      <p v-if="isAdmin" class="text-sm text-gray-400 dark:text-gray-500">
        Go to <button class="text-primary-600 hover:underline" @click="$emit('navigate', 'settings')">Settings</button> to add modules.
      </p>
    </div>

    <!-- Built-in Modules (from manifests) -->
    <div v-if="builtInManifests.length > 0" class="mb-8">
      <p class="px-1 mb-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
        Built-in Modules
      </p>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <button
          v-for="mod in builtInManifests"
          :key="mod.slug"
          @click="$emit('navigate', mod.slug)"
          class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 cursor-pointer hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-md transition-all text-left focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        >
          <div class="flex items-start gap-3">
            <div class="p-2 bg-primary-50 dark:bg-primary-900/30 rounded-lg text-primary-600 dark:text-primary-400">
              <component :is="getIcon(mod.icon)" :size="20" />
            </div>
            <div class="min-w-0 flex-1">
              <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">{{ mod.name }}</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ mod.description }}</p>
            </div>
          </div>
        </button>
      </div>
    </div>

    <!-- Utilities -->
    <div class="mb-8">
      <p class="px-1 mb-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
        Utilities
      </p>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <a
          href="/api/docs"
          target="_blank"
          rel="noopener"
          class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 cursor-pointer hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-md transition-all text-left focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        >
          <div class="flex items-start gap-3">
            <div class="p-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300">
              <FileCode2 :size="20" />
            </div>
            <div class="min-w-0 flex-1">
              <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">API Docs</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Interactive OpenAPI documentation for all API endpoints</p>
            </div>
          </div>
        </a>
      </div>
    </div>

    <!-- External Modules (git-static) -->
    <div v-if="externalModules.length > 0">
      <p class="px-1 mb-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
        External Modules
      </p>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <button
          v-for="mod in externalModules"
          :key="mod.slug"
          @click="$emit('navigate', `modules/${mod.slug}`)"
          class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 cursor-pointer hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-md transition-all text-left focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        >
          <div class="flex items-start gap-3">
            <div class="p-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300">
              <component :is="getIcon(mod.icon)" :size="20" />
            </div>
            <div class="min-w-0 flex-1">
              <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">{{ mod.name }}</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ mod.description }}</p>
              <span class="inline-block mt-2 px-2 py-0.5 text-[10px] font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 rounded-full">
                External
              </span>
            </div>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import {
  BarChart3,
  Search,
  Box,
  Package,
  Activity,
  GitBranch,
  Globe,
  FileText,
  FileCode2,
  PieChart,
  UsersRound,
  Zap,
  Layout,
  Network,
  ChartCandlestick,
  Sparkles
} from 'lucide-vue-next'

const props = defineProps({
  modules: { type: Array, default: () => [] },
  builtInManifests: { type: Array, default: () => [] },
  isAdmin: Boolean
})

defineEmits(['navigate'])

const externalModules = computed(() =>
  props.modules.filter(m => m.type === 'git-static').sort((a, b) => (a.order || 0) - (b.order || 0))
)

const iconMap = {
  'bar-chart': BarChart3,
  'search': Search,
  'activity': Activity,
  'git-branch': GitBranch,
  'globe': Globe,
  'file-text': FileText,
  'pie-chart': PieChart,
  'users-round': UsersRound,
  'zap': Zap,
  'layout': Layout,
  'box': Box,
  'network': Network,
  'chart-candlestick': ChartCandlestick,
  'sparkles': Sparkles
}

function getIcon(iconName) {
  return iconMap[iconName] || Box
}
</script>
