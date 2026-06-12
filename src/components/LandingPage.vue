<template>
  <div>
    <!-- Widget dashboard (when widgets exist) -->
    <template v-if="allWidgets.length > 0 && !showModuleGrid">
      <!-- Dashboard header -->
      <div class="flex items-start justify-between gap-4 mb-6">
        <div>
          <p class="text-sm text-gray-600 dark:text-gray-300">
            Your personalized overview across the platform
          </p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button
            @click="showWidgetPicker = true"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
          >
            <Plus :size="16" />
            Add Widgets
          </button>
          <button
            @click="showModuleGrid = true"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <LayoutGrid :size="16" />
            Browse Modules
          </button>
        </div>
      </div>

      <!-- Widget grid -->
      <div
        ref="gridRef"
        class="sotu-grid max-w-[90rem] mx-auto"
      >
        <SotuWidget
          v-for="item in resolvedLayout"
          :key="item.widgetId"
          :widget-id="item.widgetId"
          :name="item.widget.name"
          :module-name="item.widget.moduleName"
          :size="item.size"
          :component="item.component"
          @resize="handleResize"
          @remove="handleRemove"
        />
      </div>

      <!-- Empty layout state -->
      <div
        v-if="resolvedLayout.length === 0"
        class="flex flex-col items-center justify-center py-16 text-center"
      >
        <LayoutGrid :size="48" class="text-gray-300 dark:text-gray-600 mb-4" />
        <h3 class="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">Build Your Dashboard</h3>
        <p class="text-sm text-gray-400 dark:text-gray-500 mb-4 max-w-md">Choose from available widgets to create a personalized overview of what matters to you across the platform.</p>
        <button
          @click="showWidgetPicker = true"
          class="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
        >
          <Plus :size="16" />
          Add Widgets
        </button>
      </div>

      <!-- Widget picker -->
      <WidgetPicker
        v-if="showWidgetPicker"
        :available-widgets="allWidgets"
        :active-widget-ids="activeWidgetIds"
        @close="showWidgetPicker = false"
        @toggle="handleToggleWidget"
      />
    </template>

    <!-- Module grid view -->
    <template v-else>
      <!-- Header with back button when toggled from widget dashboard -->
      <div class="mb-6">
        <div v-if="allWidgets.length > 0" class="flex items-center justify-between">
          <div>
            <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">Org Pulse</h1>
            <p class="text-sm text-gray-500 dark:text-gray-400">Select a module to get started</p>
          </div>
          <button
            @click="showModuleGrid = false"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            &larr; Back to Overview
          </button>
        </div>
        <div v-else>
          <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">Org Pulse</h1>
          <p class="text-sm text-gray-500 dark:text-gray-400">Select a module to get started</p>
        </div>
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
    </template>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import {
  BarChart3,
  Search,
  Box,
  Package,
  GitBranch,
  Globe,
  FileText,
  FileCode2,
  PieChart,
  UsersRound,
  Zap,
  Layout,
  LayoutGrid,
  Network,
  ChartCandlestick,
  Sparkles,
  Hospital,
  Plus
} from 'lucide-vue-next'
import Sortable from 'sortablejs'
import { useAuth } from '@shared/client/composables/useAuth.js'
import { loadModuleWidget } from '../module-loader'
import { useSotuLayout } from '../composables/useSotuLayout.js'
import SotuWidget from './SotuWidget.vue'
import WidgetPicker from './WidgetPicker.vue'

const props = defineProps({
  modules: { type: Array, default: () => [] },
  builtInManifests: { type: Array, default: () => [] },
  isAdmin: Boolean
})

defineEmits(['navigate'])

const { isManager } = useAuth()
const showModuleGrid = ref(false)
const showWidgetPicker = ref(false)
const gridRef = ref(null)
let sortableInstance = null

const {
  layout,
  pruneStaleWidgets,
  addWidget,
  removeWidget,
  moveWidget,
  resizeWidget,
  hasWidget
} = useSotuLayout()

const externalModules = computed(() =>
  props.modules.filter(m => m.type === 'git-static').sort((a, b) => (a.order || 0) - (b.order || 0))
)

// Build flat list of all available widgets from all modules
const allWidgets = computed(() => {
  const widgets = []
  for (const mod of props.builtInManifests) {
    const sotuWidgets = mod.client?.sotuWidgets
    if (!sotuWidgets || !Array.isArray(sotuWidgets)) continue
    for (const w of sotuWidgets) {
      if (w.requireRole === 'manager' && !isManager.value) continue
      widgets.push({
        qualifiedId: `${mod.slug}:${w.id}`,
        moduleSlug: mod.slug,
        moduleName: mod.name,
        name: w.name,
        description: w.description,
        component: w.component,
        defaultSize: w.defaultSize || 'half',
        icon: w.icon,
        category: w.category
      })
    }
  }
  return widgets
})

// Prune stale widgets when manifests change
watch(allWidgets, (widgets) => {
  if (widgets.length === 0) return
  pruneStaleWidgets(widgets.map(w => w.qualifiedId))
}, { immediate: true })

// Widget component cache
const widgetComponentCache = {}

function getWidgetComponent(widget) {
  const cacheKey = widget.qualifiedId
  if (!widgetComponentCache[cacheKey]) {
    widgetComponentCache[cacheKey] = loadModuleWidget(widget.moduleSlug, widget.component)
  }
  return widgetComponentCache[cacheKey]
}

// Resolve layout items to actual components
const resolvedLayout = computed(() => {
  if (!layout.value) return []
  const widgetMap = {}
  for (const w of allWidgets.value) {
    widgetMap[w.qualifiedId] = w
  }
  return layout.value
    .filter(item => widgetMap[item.widgetId])
    .map(item => ({
      widgetId: item.widgetId,
      size: item.size,
      widget: widgetMap[item.widgetId],
      component: getWidgetComponent(widgetMap[item.widgetId])
    }))
})

// Set of active widget IDs for the picker
const activeWidgetIds = computed(() => {
  if (!layout.value) return new Set()
  return new Set(layout.value.map(item => item.widgetId))
})

function handleResize(widgetId, newSize) {
  resizeWidget(widgetId, newSize)
}

function handleRemove(widgetId) {
  removeWidget(widgetId)
}

function handleToggleWidget(widgetId, defaultSize) {
  if (hasWidget(widgetId)) {
    removeWidget(widgetId)
  } else {
    addWidget(widgetId, defaultSize)
  }
}

// SortableJS integration
function initSortable() {
  if (!gridRef.value) return
  if (sortableInstance) {
    sortableInstance.destroy()
    sortableInstance = null
  }
  sortableInstance = Sortable.create(gridRef.value, {
    animation: 150,
    handle: '.drag-handle',
    ghostClass: 'opacity-30',
    onEnd(evt) {
      if (evt.oldIndex !== evt.newIndex) {
        moveWidget(evt.oldIndex, evt.newIndex)
      }
    }
  })
}

watch(resolvedLayout, () => {
  nextTick(() => initSortable())
})

onMounted(() => {
  nextTick(() => initSortable())
})

onBeforeUnmount(() => {
  if (sortableInstance) {
    sortableInstance.destroy()
    sortableInstance = null
  }
})

const iconMap = {
  'bar-chart': BarChart3,
  'search': Search,
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
  'sparkles': Sparkles,
  'hospital': Hospital
}

function getIcon(iconName) {
  return iconMap[iconName] || Box
}
</script>

<style>
.sotu-grid {
  columns: 2;
  column-gap: 1rem;
}

.sotu-grid > .sotu-widget {
  break-inside: avoid;
  margin-bottom: 1rem;
}

.sotu-widget-full {
  column-span: all;
}

/* Mobile: single column */
@media (max-width: 768px) {
  .sotu-grid {
    columns: 1;
  }
  .sotu-widget-full {
    column-span: none;
  }
}
</style>
