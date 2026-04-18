<template>
  <aside
    class="fixed top-0 left-0 h-screen z-30 flex flex-col transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
    :class="collapsed ? 'w-[72px]' : 'w-[260px]'"
  >
    <!-- Collapse/Expand toggle (floating outside sidebar) -->
    <button
      @click="$emit('toggle-collapse')"
      class="absolute top-7 -right-3.5 z-10 h-7 w-7 flex items-center justify-center rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 shadow-sm transition-colors duration-200"
      :title="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
    >
      <component :is="collapsed ? ChevronRight : ChevronLeft" :size="14" :stroke-width="2" />
    </button>

    <div class="flex flex-col h-full m-2.5 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-gray-200/60 dark:border-gray-700/60 rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.03)] overflow-hidden">
      <!-- Header -->
      <div
        class="flex items-center py-5 border-b border-gray-100 dark:border-gray-700 transition-all duration-300"
        :class="collapsed ? 'justify-center px-0' : 'gap-3 px-4'"
      >
        <img src="/redhat-logo.svg" alt="Red Hat" class="h-8 w-8 flex-shrink-0" />
        <transition name="fade">
          <div v-if="!collapsed" class="overflow-hidden whitespace-nowrap flex-1">
            <h1 class="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight">Org Pulse</h1>
            <p v-if="titlePrefix" class="text-xs text-gray-400 dark:text-gray-500">{{ titlePrefix }}</p>
          </div>
        </transition>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div v-for="section in navSections" :key="section.label || section.id">
          <!-- Section label -->
          <p
            v-if="!collapsed && section.label"
            class="px-3 mb-2 mt-4 first:mt-0 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500"
          >{{ section.label }}</p>

          <!-- Collapsible section header (built-in modules) -->
          <template v-if="section.collapsible && !collapsed">
            <button
              @click="toggleSection(section.id)"
              class="group relative w-full flex items-center py-2.5 rounded-xl text-sm font-medium transition-all duration-200 gap-3 px-3"
              :class="activeModule === section.id
                ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 shadow-sm'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'"
              :aria-expanded="section.expanded"
              :aria-label="section.headerLabel"
            >
              <component
                :is="section.headerIcon"
                :size="20"
                :stroke-width="activeModule === section.id ? 2 : 1.7"
                class="flex-shrink-0"
              />
              <span class="truncate flex-1 text-left">{{ section.headerLabel }}</span>
              <component
                :is="section.expanded ? ChevronDown : ChevronRight"
                :size="16"
                class="flex-shrink-0 opacity-50"
              />
            </button>
            <!-- Sub-items when expanded -->
            <div v-if="section.expanded" class="ml-4 mt-1 space-y-0.5">
              <button
                v-for="item in section.items"
                :key="item.id"
                @click="$emit('navigate', item.id)"
                :aria-current="isNavItemActive(item, section) ? 'page' : undefined"
                :aria-label="item.label"
                class="group relative w-full flex items-center py-2 rounded-lg text-sm font-medium transition-all duration-200 gap-3 px-3"
                :class="isNavItemActive(item, section)
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-700 dark:hover:text-gray-200'"
              >
                <component
                  :is="item.icon"
                  :size="18"
                  :stroke-width="1.5"
                  class="flex-shrink-0"
                />
                <span class="truncate">{{ item.label }}</span>
              </button>
            </div>
          </template>

          <!-- Regular items (or collapsed mode) -->
          <template v-else>
            <template v-for="item in section.items" :key="item.id">
              <button
                v-if="!section.collapsible || collapsed"
                @click="$emit('navigate', item.id)"
                :aria-current="isNavItemActive(item, section) ? 'page' : undefined"
                :aria-label="item.label"
                class="group relative w-full flex items-center py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
                :class="[
                  isNavItemActive(item, section)
                    ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100',
                  collapsed ? 'justify-center px-0' : 'gap-3 px-3'
                ]"
              >
                <component
                  :is="item.icon"
                  :size="20"
                  :stroke-width="isNavItemActive(item, section) ? 2 : 1.7"
                  class="flex-shrink-0"
                />
                <transition name="fade">
                  <span v-if="!collapsed" class="truncate">{{ item.label }}</span>
                </transition>
                <!-- Collapsed tooltip -->
                <span
                  v-if="collapsed"
                  class="absolute left-full ml-3 px-2.5 py-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-medium rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 shadow-lg"
                >
                  {{ item.label }}
                </span>
              </button>
            </template>
          </template>
        </div>
      </nav>

      <!-- Docs (bottom-justified, above user) -->
      <div class="px-3 pt-3 pb-1 border-t border-gray-100 dark:border-gray-700">
        <button
          @click="$emit('navigate', 'docs')"
          :aria-current="activeModule === 'docs' ? 'page' : undefined"
          class="group relative w-full flex items-center py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
          :class="[
            activeModule === 'docs'
              ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 shadow-sm'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100',
            collapsed ? 'justify-center px-0' : 'gap-3 px-3'
          ]"
        >
          <BookOpen :size="20" :stroke-width="activeModule === 'docs' ? 2 : 1.7" class="flex-shrink-0" />
          <transition name="fade">
            <span v-if="!collapsed" class="truncate">Docs</span>
          </transition>
          <span
            v-if="collapsed"
            class="absolute left-full ml-3 px-2.5 py-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-medium rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 shadow-lg"
          >
            Docs
          </span>
        </button>
      </div>

      <!-- Footer -->
      <div class="px-3 py-3 border-t border-gray-100 dark:border-gray-700 space-y-1">
        <!-- User (clickable with popover) -->
        <div v-if="user" class="relative" ref="userContainer">
          <button
            @click="userMenuOpen = !userMenuOpen"
            class="group relative w-full flex items-center py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
            :class="[
              collapsed ? 'justify-center px-0' : 'gap-3 px-3',
              activeModule === 'api-tokens' ? 'bg-gray-100 dark:bg-gray-700' : ''
            ]"
          >
            <div class="h-8 w-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
              {{ getUserInitials(user) }}
            </div>
            <transition name="fade">
              <div v-if="!collapsed" class="overflow-hidden min-w-0 text-left">
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{{ user.displayName || user.email }}</p>
                <p class="text-xs text-gray-400 dark:text-gray-500 truncate">{{ user.email }}</p>
              </div>
            </transition>
            <span
              v-if="collapsed"
              class="absolute left-full ml-3 px-2.5 py-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-medium rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 shadow-lg"
            >
              {{ user.displayName || user.email }}
            </span>
          </button>

          <!-- User menu popover -->
          <transition name="fade">
            <div
              v-if="userMenuOpen"
              class="absolute bottom-full mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1 min-w-[180px] z-40"
              :class="collapsed ? 'left-full ml-2' : 'left-0'"
            >
              <button
                @click="userMenuOpen = false; $emit('navigate', 'api-tokens')"
                class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                <KeyRound :size="18" :stroke-width="1.7" class="flex-shrink-0" />
                API Tokens
              </button>
              <div class="my-1 border-t border-gray-100 dark:border-gray-700" />
              <a
                href="/api/docs"
                target="_blank"
                rel="noopener"
                @click="userMenuOpen = false"
                class="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                <FileCode2 :size="18" :stroke-width="1.7" class="flex-shrink-0" />
                API Docs
              </a>
              <button
                @click="userMenuOpen = false; $emit('navigate', 'help')"
                class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                <Wrench :size="18" :stroke-width="1.7" class="flex-shrink-0" />
                Help & Debug
              </button>
            </div>
          </transition>
        </div>

      </div>
    </div>
  </aside>

  <!-- Mobile overlay -->
  <transition name="fade">
    <div
      v-if="mobileOpen"
      class="fixed inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-sm z-20 lg:hidden"
      @click="$emit('close-mobile')"
    />
  </transition>

</template>

<script setup>
import {
  Home,
  BarChart3,
  Building2,
  Users,
  UsersRound,
  User,
  TrendingUp,
  FileText,
  FileCode2,
  Shield,
  Settings,
  ExternalLink,
  Network,
  Layers,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChartCandlestick,
  Sparkles,
  Activity,
  Wrench,
  KeyRound,
  BookOpen
} from 'lucide-vue-next'
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'

const ICON_MAP = {
  BarChart3,
  Users,
  UsersRound,
  User,
  TrendingUp,
  FileText,
  Home,
  Shield,
  Settings,
  ExternalLink,
  Network,
  Layers,
  Sparkles,
  Activity,
  Building2,
  'bar-chart': BarChart3,
  'users-round': UsersRound,
  'chart-candlestick': ChartCandlestick,
  'sparkles': Sparkles,
  'activity': Activity,
  'network': Network
}

const props = defineProps({
  collapsed: Boolean,
  mobileOpen: Boolean,
  activeModule: String,
  activeViewId: String,
  user: Object,
  isAdmin: Boolean,
  modules: { type: Array, default: () => [] },
  builtInManifests: { type: Array, default: () => [] },
  titlePrefix: { type: String, default: '' }
})

defineEmits(['navigate', 'toggle-collapse', 'close-mobile'])

const expandedSections = ref({})
const userMenuOpen = ref(false)
const userContainer = ref(null)

// Close help popover on outside click
function onClickOutside(e) {
  if (userContainer.value && !userContainer.value.contains(e.target)) {
    userMenuOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside)
})

// Auto-expand active module section
watch(() => props.activeModule, (newVal) => {
  if (newVal && props.builtInManifests.some(m => m.slug === newVal)) {
    expandedSections.value[newVal] = true
  }
}, { immediate: true })

function toggleSection(sectionId) {
  expandedSections.value[sectionId] = !expandedSections.value[sectionId]
}

function resolveIcon(iconName) {
  return ICON_MAP[iconName] || BarChart3
}

const externalModules = computed(() => {
  return props.modules.filter(m => m.type === 'git-static')
})

const navSections = computed(() => {
  const sections = [
    {
      id: 'home',
      label: '',
      items: [
        { id: 'home', label: 'Home', icon: Home }
      ]
    }
  ]

  // Built-in modules from manifests
  for (const manifest of props.builtInManifests) {
    const navItems = manifest.client?.navItems || []
    sections.push({
      id: manifest.slug,
      label: '',
      collapsible: true,
      expanded: expandedSections.value[manifest.slug] || false,
      headerLabel: manifest.name,
      headerIcon: resolveIcon(manifest.icon),
      items: navItems.map(item => ({
        id: `${manifest.slug}::${item.id}`,
        label: item.label,
        icon: resolveIcon(item.icon)
      }))
    })
  }

  // Git-static external modules
  if (externalModules.value.length > 0) {
    sections.push({
      id: 'modules',
      label: 'Modules',
      items: externalModules.value.map(m => ({
        id: `modules/${m.slug}`,
        label: m.name,
        icon: ExternalLink
      }))
    })
  }

  if (props.isAdmin) {
    sections.push({
      id: 'admin',
      label: 'Admin',
      items: [
        { id: 'settings', label: 'Settings', icon: Settings },
      ]
    })
  }

  return sections
})

function isNavItemActive(item, section) {
  if (item.id === 'home') return props.activeModule === 'home'
  if (item.id.startsWith('modules/')) {
    const slug = item.id.slice('modules/'.length)
    return props.activeModule === 'module-iframe' && props.activeViewId === null && slug === props.activeModule
  }
  if (section.collapsible) {
    // item.id is "slug::viewId"
    const [slug, viewId] = item.id.split('::')
    if (props.activeModule !== slug) return false
    // Mark dashboard-like views as active for the default nav item
    const manifest = props.builtInManifests.find(m => m.slug === slug)
    const defaultItem = manifest?.client?.navItems?.find(n => n.default)
    if (defaultItem && viewId === defaultItem.id) {
      // Active for the default view AND any internal-only views
      const navViewIds = new Set((manifest.client?.navItems || []).map(n => n.id))
      return props.activeViewId === viewId || !navViewIds.has(props.activeViewId)
    }
    return props.activeViewId === viewId
  }
  return props.activeModule === item.id
}

function getUserInitials(user) {
  if (!user) return '?'
  if (user.displayName) {
    const parts = user.displayName.split(' ')
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return user.displayName.substring(0, 2).toUpperCase()
  }
  if (user.email) {
    return user.email.substring(0, 2).toUpperCase()
  }
  return '??'
}
</script>
