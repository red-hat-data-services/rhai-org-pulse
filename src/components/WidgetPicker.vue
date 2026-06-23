<script setup>
import { computed } from 'vue'
import { X, Plus, Check, Box } from 'lucide-vue-next'
import {
  ClipboardList, Columns, BarChart3, UsersRound, Users, Link2,
  Sparkles, LayoutDashboard, Search, CalendarDays
} from 'lucide-vue-next'

const props = defineProps({
  availableWidgets: { type: Array, default: () => [] },
  activeWidgetIds: { type: Set, default: () => new Set() }
})

const emit = defineEmits(['close', 'toggle'])

const iconMap = {
  ClipboardList, Columns, BarChart3, UsersRound, Users, Link2,
  Sparkles, LayoutDashboard, Search, CalendarDays, Box
}

function getIcon(iconName) {
  return iconMap[iconName] || Box
}

const groupedByModule = computed(() => {
  const groups = {}
  for (const widget of props.availableWidgets) {
    const key = widget.moduleSlug
    if (!groups[key]) {
      groups[key] = { moduleName: widget.moduleName, widgets: [] }
    }
    groups[key].widgets.push(widget)
  }
  return Object.values(groups)
})
</script>

<template>
  <!-- Backdrop -->
  <div class="fixed inset-0 bg-black bg-opacity-30 z-40" @click="emit('close')" />

  <!-- Slide-over panel -->
  <div class="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white dark:bg-gray-800 shadow-xl flex flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Add Widgets</h2>
      <button
        @click="emit('close')"
        class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        <X :size="20" />
      </button>
    </div>

    <!-- Widget list -->
    <div class="flex-1 overflow-y-auto px-6 py-4 space-y-6">
      <div v-for="group in groupedByModule" :key="group.moduleName">
        <p class="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">
          {{ group.moduleName }}
        </p>
        <div class="space-y-2">
          <button
            v-for="widget in group.widgets"
            :key="widget.qualifiedId"
            @click="emit('toggle', widget.qualifiedId, widget.defaultSize)"
            class="w-full flex items-start gap-3 p-3 rounded-lg border transition-colors text-left"
            :class="activeWidgetIds.has(widget.qualifiedId)
              ? 'border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/20'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'"
          >
            <div class="p-1.5 bg-gray-100 dark:bg-gray-700 rounded-md text-gray-500 dark:text-gray-400 shrink-0">
              <component :is="getIcon(widget.icon)" :size="16" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ widget.name }}</span>
                <span v-if="activeWidgetIds.has(widget.qualifiedId)" class="text-primary-600 dark:text-primary-400">
                  <Check :size="16" />
                </span>
                <span v-else class="text-gray-400">
                  <Plus :size="16" />
                </span>
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ widget.description }}</p>
            </div>
          </button>
        </div>
      </div>

      <div v-if="availableWidgets.length === 0" class="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
        No widgets available. Modules can register widgets via <code>sotuWidgets</code> in module.json.
      </div>
    </div>
  </div>
</template>
