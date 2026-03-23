<template>
  <div>
    <div class="mb-6">
      <h1 class="text-xl font-bold text-gray-900">Org Pulse</h1>
      <p class="text-sm text-gray-500">Select a module to get started</p>
    </div>

    <!-- Empty state -->
    <div
      v-if="modules.length === 0"
      class="flex flex-col items-center justify-center py-16 text-center"
    >
      <Package :size="48" class="text-gray-300 mb-4" />
      <h3 class="text-lg font-medium text-gray-600 mb-2">No modules configured yet</h3>
      <p v-if="isAdmin" class="text-sm text-gray-400">
        Go to <button class="text-primary-600 hover:underline" @click="$emit('navigate', 'settings')">Settings</button> to add modules.
      </p>
    </div>

    <!-- Built-in Modules -->
    <div v-if="builtInModules.length > 0" class="mb-8">
      <p class="px-1 mb-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
        Built-in Modules
      </p>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <button
          v-for="mod in builtInModules"
          :key="mod.slug"
          @click="handleClick(mod)"
          class="bg-white rounded-lg border border-gray-200 p-5 cursor-pointer hover:border-primary-300 hover:shadow-md transition-all text-left focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        >
          <div class="flex items-start gap-3">
            <div class="p-2 bg-primary-50 rounded-lg text-primary-600">
              <component :is="getIcon(mod.icon)" :size="20" />
            </div>
            <div class="min-w-0 flex-1">
              <h3 class="text-base font-semibold text-gray-900">{{ mod.name }}</h3>
              <p class="text-sm text-gray-500 mt-1">{{ mod.description }}</p>
            </div>
          </div>
        </button>
      </div>
    </div>

    <!-- External Modules -->
    <div v-if="externalModules.length > 0">
      <p class="px-1 mb-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
        External Modules
      </p>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <button
          v-for="mod in externalModules"
          :key="mod.slug"
          @click="handleClick(mod)"
          class="bg-white rounded-lg border border-gray-200 p-5 cursor-pointer hover:border-primary-300 hover:shadow-md transition-all text-left focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        >
          <div class="flex items-start gap-3">
            <div class="p-2 bg-gray-50 rounded-lg text-gray-600">
              <component :is="getIcon(mod.icon)" :size="20" />
            </div>
            <div class="min-w-0 flex-1">
              <h3 class="text-base font-semibold text-gray-900">{{ mod.name }}</h3>
              <p class="text-sm text-gray-500 mt-1">{{ mod.description }}</p>
              <span class="inline-block mt-2 px-2 py-0.5 text-[10px] font-medium text-gray-400 bg-gray-100 rounded-full">
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
  Globe,
  FileText,
  Zap,
  Layout
} from 'lucide-vue-next'

const props = defineProps({
  modules: { type: Array, default: () => [] },
  isAdmin: Boolean
})

const emit = defineEmits(['navigate', 'select-module'])

const builtInModules = computed(() =>
  props.modules.filter(m => m.type === 'built-in').sort((a, b) => (a.order || 0) - (b.order || 0))
)

const externalModules = computed(() =>
  props.modules.filter(m => m.type !== 'built-in').sort((a, b) => (a.order || 0) - (b.order || 0))
)

const iconMap = {
  'bar-chart': BarChart3,
  'search': Search,
  'activity': Activity,
  'globe': Globe,
  'file-text': FileText,
  'zap': Zap,
  'layout': Layout,
  'box': Box
}

function getIcon(iconName) {
  return iconMap[iconName] || Box
}

function handleClick(mod) {
  if (mod.type === 'built-in' && mod.slug === 'team-tracker') {
    emit('navigate', 'team-tracker')
  } else if (mod.type === 'git-static') {
    emit('navigate', `modules/${mod.slug}`)
  }
}
</script>
