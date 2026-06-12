<template>
  <div>
    <!-- Welcome modal (first visit only) -->
    <div
      v-if="showWelcome"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="dismissWelcome"
    >
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div class="px-6 py-5">
          <div class="flex items-center gap-3 mb-4">
            <div class="p-2 bg-primary-50 dark:bg-primary-900/30 rounded-lg text-primary-600 dark:text-primary-400">
              <Sparkles :size="24" />
            </div>
            <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Welcome to State of the Union</h2>
          </div>
          <p class="text-sm text-gray-600 dark:text-gray-300 mb-3">
            Your home page now shows a personalized overview of what needs your attention across the platform.
          </p>
          <ul class="text-sm text-gray-600 dark:text-gray-300 space-y-2 mb-5">
            <li class="flex items-start gap-2">
              <span class="text-primary-500 mt-0.5">&#x2022;</span>
              <span>See action items and status updates tailored to your areas of responsibility</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="text-primary-500 mt-0.5">&#x2022;</span>
              <span>Use the <strong>Browse Modules</strong> button to navigate to specific tools</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="text-primary-500 mt-0.5">&#x2022;</span>
              <span>Customize which components you're watching via the settings gear</span>
            </li>
          </ul>
          <div class="flex items-center justify-between">
            <label class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 cursor-pointer select-none">
              <input
                v-model="dontShowAgain"
                type="checkbox"
                class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
              />
              Don't show this again
            </label>
            <button
              @click="dismissWelcome"
              class="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- SOTU view (when providers exist) -->
    <template v-if="sotuModules.length > 0 && !showModuleGrid">
      <!-- Hero section -->
      <div class="relative overflow-hidden bg-gradient-to-br from-primary-50 via-white to-blue-50 dark:from-gray-800 dark:via-gray-850 dark:to-gray-800 rounded-xl border border-primary-100 dark:border-gray-700 px-6 py-5 mb-6">
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-start gap-4">
            <div class="p-2.5 bg-primary-100 dark:bg-primary-900/40 rounded-xl text-primary-600 dark:text-primary-400 shrink-0 mt-0.5">
              <Activity :size="22" />
            </div>
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                A personalized overview of what needs your attention across the platform.
                Each tab surfaces actionable items from a different module, tailored to your role and areas of responsibility.
              </p>
            </div>
          </div>
          <button
            @click="showModuleGrid = true"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shrink-0"
          >
            <LayoutGrid :size="16" />
            Browse Modules
          </button>
        </div>
      </div>

      <!-- Tab bar (only when multiple providers) -->
      <div v-if="sotuModules.length > 1" class="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav class="flex gap-6" aria-label="SOTU module tabs">
          <button
            v-for="mod in sotuModules"
            :key="mod.slug"
            @click="setActiveTab(mod.slug)"
            class="pb-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2"
            :class="activeTab === mod.slug
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'"
          >
            <component :is="getIcon(mod.icon)" :size="16" />
            {{ mod.name }}
          </button>
        </nav>
      </div>

      <!-- Active SOTU tab content -->
      <component
        v-if="activeSotuComponent"
        :is="activeSotuComponent"
      />
    </template>

    <!-- Module grid view -->
    <template v-else>
      <!-- Header with back button when toggled from SOTU -->
      <div class="mb-6">
        <div v-if="sotuModules.length > 0" class="flex items-center justify-between">
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
import { computed, ref } from 'vue'
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
  LayoutGrid,
  Network,
  ChartCandlestick,
  Sparkles,
  Hospital
} from 'lucide-vue-next'
import { loadModuleSotuComponent } from '../module-loader'

const props = defineProps({
  modules: { type: Array, default: () => [] },
  builtInManifests: { type: Array, default: () => [] },
  isAdmin: Boolean
})

defineEmits(['navigate'])

const showModuleGrid = ref(false)

const externalModules = computed(() =>
  props.modules.filter(m => m.type === 'git-static').sort((a, b) => (a.order || 0) - (b.order || 0))
)

// SOTU modules: those with a sotuComponent declared
const sotuModules = computed(() =>
  props.builtInManifests
    .filter(m => m.client?.sotuComponent)
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
)

// Welcome modal (first visit only)
const WELCOME_DISMISSED_KEY = 'orgpulse_sotu_welcome_dismissed'
const showWelcome = ref(
  sotuModules.value.length > 0 && !localStorage.getItem(WELCOME_DISMISSED_KEY)
)
const dontShowAgain = ref(false)

function dismissWelcome() {
  showWelcome.value = false
  if (dontShowAgain.value) {
    localStorage.setItem(WELCOME_DISMISSED_KEY, '1')
  }
}

// Resolved SOTU components cache
const sotuComponentCache = {}

function getSotuComponent(mod) {
  if (!sotuComponentCache[mod.slug]) {
    sotuComponentCache[mod.slug] = loadModuleSotuComponent(mod.slug, mod.client.sotuComponent)
  }
  return sotuComponentCache[mod.slug]
}

// Active tab persistence
const STORAGE_KEY = 'orgpulse_sotu_active_tab'

const activeTab = ref(
  localStorage.getItem(STORAGE_KEY) || sotuModules.value[0]?.slug || ''
)

function setActiveTab(slug) {
  activeTab.value = slug
  localStorage.setItem(STORAGE_KEY, slug)
}

// Ensure active tab is valid
const resolvedActiveTab = computed(() => {
  const slugs = sotuModules.value.map(m => m.slug)
  if (slugs.includes(activeTab.value)) return activeTab.value
  return slugs[0] || ''
})

const activeSotuComponent = computed(() => {
  const mod = sotuModules.value.find(m => m.slug === resolvedActiveTab.value)
  if (!mod) return null
  return getSotuComponent(mod)
})

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
  'sparkles': Sparkles,
  'hospital': Hospital
}

function getIcon(iconName) {
  return iconMap[iconName] || Box
}
</script>
