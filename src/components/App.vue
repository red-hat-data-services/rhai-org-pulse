<template>
  <div id="app" class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Sidebar -->
    <AppSidebar
      :collapsed="sidebarCollapsed"
      :mobile-open="mobileMenuOpen"
      :active-module="activeModule"
      :active-view-id="activeViewId"
      :user="authUser"
      :is-admin="authIsAdmin"
      :modules="gitStaticModules"
      :built-in-manifests="builtInManifests"
      @navigate="handleSidebarNavigate"
      @toggle-collapse="sidebarCollapsed = !sidebarCollapsed"
      @close-mobile="mobileMenuOpen = false"
    />

    <!-- Main content area -->
    <div
      class="min-h-screen transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
      :class="sidebarCollapsed ? 'pl-[72px]' : 'pl-[260px]'"
    >
      <!-- Top bar -->
      <header class="sticky top-0 z-10 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-700/60">
        <div class="flex items-center justify-between px-6 lg:px-8 h-16">
          <div class="flex items-center gap-4">
            <!-- Mobile menu button -->
            <button
              class="lg:hidden p-2 -ml-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              @click="mobileMenuOpen = !mobileMenuOpen"
            >
              <MenuIcon :size="20" />
            </button>
            <div class="flex items-center gap-2">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ currentPageTitle }}</h2>
              <div v-if="activeModule === 'module-iframe' && activeModuleConfig?.description" class="relative group">
                <InfoIcon :size="16" class="text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-help" />
                <div class="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-3 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded-lg shadow-lg whitespace-normal w-64 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 z-20">
                  {{ activeModuleConfig.description }}
                </div>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <!-- Open in new tab for git-static modules -->
            <a
              v-if="activeModule === 'module-iframe' && activeModuleSlug"
              :href="'/modules/' + activeModuleSlug + '/index.html'"
              target="_blank"
              rel="noopener"
              class="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 shadow-sm"
              title="Open in new tab"
            >
              <ExternalLinkIcon :size="16" />
              <span class="hidden sm:inline">New tab</span>
            </a>
            <!-- Last updated + Refresh All (only for built-in module views) -->
            <template v-if="isBuiltInModuleView">
              <span
                v-if="lastRefreshedLabel"
                class="hidden md:inline text-xs text-gray-400 dark:text-gray-500"
              >{{ lastRefreshedLabel }}</span>
              <button
                v-if="authUser && authIsAdmin"
                @click="showRefreshModal = true"
                :disabled="isRefreshing"
                title="Refresh all metrics"
                class="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-gray-100 hover:border-gray-300 dark:hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
              >
                <RefreshCw :size="16" :class="{ 'animate-spin': isRefreshing }" />
                <span class="hidden sm:inline">{{ isRefreshing ? 'Refreshing...' : 'Refresh' }}</span>
              </button>
            </template>
            <!-- Theme toggle -->
            <button
              @click="cycleTheme"
              :title="'Theme: ' + themeMode"
              class="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
            >
              <SunIcon v-if="themeMode === 'light'" :size="18" />
              <MoonIcon v-if="themeMode === 'dark'" :size="18" />
              <MonitorIcon v-if="themeMode === 'system'" :size="18" />
            </button>
          </div>
        </div>
      </header>

      <!-- Page content -->
      <main :class="activeModule === 'module-iframe' ? 'p-0' : 'px-6 lg:px-8 py-6'">
        <!-- Landing Page -->
        <LandingPage
          v-if="activeModule === 'home'"
          :modules="gitStaticModules"
          :built-in-manifests="builtInManifests"
          :is-admin="authIsAdmin"
          @navigate="handleSidebarNavigate"
        />

        <!-- Dynamic built-in module view -->
        <component
          v-else-if="activeComponent"
          :is="activeComponent"
          v-bind="activeComponentProps"
        />

        <!-- Module iframe View (git-static) -->
        <ModuleIframeView
          v-else-if="activeModule === 'module-iframe'"
          :slug="activeModuleSlug"
          :module-name="activeModuleConfig?.name || activeModuleSlug"
          :sync-status="activeModuleConfig?.lastSyncStatus || null"
          :is-admin="authIsAdmin"
          @trigger-sync="handleModuleSync"
          @retry-sync="handleModuleSync"
        />

        <!-- API Tokens View -->
        <ApiTokensView
          v-else-if="activeModule === 'api-tokens'"
          :is-admin="authIsAdmin"
          @toast="({ message, type }) => showToast(message, type)"
        />

        <!-- Settings View -->
        <SettingsView
          v-else-if="activeModule === 'settings'"
          :built-in-manifests="builtInManifests"
          :initial-tab="settingsInitialTab"
          @toast="({ message, type }) => showToast(message, type)"
        />

        <!-- Help & Debug View -->
        <HelpView
          v-else-if="activeModule === 'help'"
          :is-admin="authIsAdmin"
        />

        <LoadingOverlay v-if="isLoading" />
      </main>
    </div>

    <RefreshModal
      v-if="showRefreshModal"
      scopeLabel="Refresh data for all teams and members"
      @confirm="handleRefreshAllConfirm"
      @cancel="showRefreshModal = false"
    />

    <Toast
      v-for="toast in toasts"
      :key="toast.id"
      :message="toast.message"
      :type="toast.type"
      :duration="toast.duration"
      @close="removeToast(toast.id)"
    />

    <BackendConnectivityModal />
  </div>
</template>

<script>
import { Menu as MenuIcon, RefreshCw, ExternalLink as ExternalLinkIcon, Sun as SunIcon, Moon as MoonIcon, Monitor as MonitorIcon, Info as InfoIcon } from 'lucide-vue-next'
import LoadingOverlay from '@shared/client/components/LoadingOverlay.vue'
import Toast from '@shared/client/components/Toast.vue'
import RefreshModal from '@shared/client/components/RefreshModal.vue'
import SettingsView from './SettingsView.vue'
import HelpView from './HelpView.vue'
import ApiTokensView from './ApiTokensView.vue'
import AppSidebar from './AppSidebar.vue'
import LandingPage from './LandingPage.vue'
import ModuleIframeView from './ModuleIframeView.vue'
import BackendConnectivityModal from './BackendConnectivityModal.vue'
import { computed, ref, readonly, provide, onUnmounted } from 'vue'
import { useAuth } from '@shared/client/composables/useAuth'
import { useRoster } from '@shared/client/composables/useRoster'
import { useGithubStats } from '@shared/client/composables/useGithubStats'
import { useGitlabStats } from '@shared/client/composables/useGitlabStats'
import { useModules } from '../composables/useModules'
import { useTheme } from '../composables/useTheme'
import { refreshMetrics, getLastRefreshed, apiRequest } from '@shared/client/services/api'
import { loadModuleManifests, loadModuleClient } from '../module-loader'

export default {
  name: 'App',
  components: {
    MenuIcon,
    RefreshCw,
    ExternalLinkIcon,
    SunIcon,
    MoonIcon,
    MonitorIcon,
    InfoIcon,
    LoadingOverlay,
    Toast,
    SettingsView,
    HelpView,
    ApiTokensView,
    AppSidebar,
    RefreshModal,
    LandingPage,
    ModuleIframeView,
    BackendConnectivityModal
  },
  setup() {
    const { user: authUser, isAdmin: authIsAdmin } = useAuth()
    const { loadRoster, teams, selectedOrgKey, selectOrg } = useRoster()
    const { loadGithubStats } = useGithubStats()
    const { loadGitlabStats } = useGitlabStats()
    const { modulesData, loadModules, enabledBuiltInSlugs, loadEnabledBuiltInSlugs } = useModules()
    const { mode: themeMode, cycle: cycleTheme } = useTheme()
    const lastRefreshedAt = ref(null)
    const tick = ref(0)
    const tickTimer = setInterval(() => { tick.value++ }, 30000)
    onUnmounted(() => clearInterval(tickTimer))
    const lastRefreshedLabel = computed(() => {
      tick.value
      if (!lastRefreshedAt.value) return null
      const ts = new Date(lastRefreshedAt.value)
      const now = new Date()
      const diff = now - ts
      const mins = Math.floor(diff / 60000)
      if (mins < 1) return 'Updated just now'
      if (mins === 1) return 'Updated 1 min ago'
      if (mins < 60) return `Updated ${mins} mins ago`
      const hours = Math.floor(mins / 60)
      if (hours === 1) return 'Updated 1 hr ago'
      if (hours < 24) return `Updated ${hours} hrs ago`
      return `Updated ${ts.toLocaleDateString()}`
    })
    const jiraConfigChangedAt = ref(null)
    async function fetchLastRefreshed() {
      try {
        const data = await getLastRefreshed()
        lastRefreshedAt.value = data.timestamp
        jiraConfigChangedAt.value = data.jiraConfigChangedAt
      } catch { /* ignore */ }
    }

    // Git-static modules (from API)
    const gitStaticModules = computed(() => {
      return modulesData.value?.modules || []
    })

    // Built-in module manifests: start from Vite glob, then replace with server discovery
    // so new modules under modules/ appear in the shell without restarting the dev bundler.
    const allBuiltInManifests = ref(loadModuleManifests())
    const builtInManifests = computed(() => {
      const list = allBuiltInManifests.value
      if (!enabledBuiltInSlugs.value) return list
      return list.filter(m => enabledBuiltInSlugs.value.includes(m.slug))
    })

    async function loadBuiltInManifestsFromApi() {
      const bundled = loadModuleManifests()
      try {
        const data = await apiRequest('/built-in-modules/manifests')
        if (!data.modules || !Array.isArray(data.modules)) {
          allBuiltInManifests.value = bundled
          return
        }
        const bySlug = new Map(bundled.map(m => [m.slug, { ...m }]))
        for (const m of data.modules) {
          const prev = bySlug.get(m.slug) || {}
          bySlug.set(m.slug, {
            ...prev,
            ...m,
            slug: m.slug,
            client: m.client || prev.client
          })
        }
        allBuiltInManifests.value = [...bySlug.values()].sort(
          (a, b) => (a.order ?? 100) - (b.order ?? 100)
        )
      } catch (err) {
        console.warn('Failed to load built-in manifests from API, using bundled manifests:', err.message)
        allBuiltInManifests.value = bundled
      }
    }

    // Module client cache
    const moduleClients = ref({})

    async function ensureModuleClient(slug) {
      if (moduleClients.value[slug]) return moduleClients.value[slug]
      const client = await loadModuleClient(slug)
      if (client) {
        moduleClients.value[slug] = client
      }
      return client
    }

    // --- Module navigation (provide/inject) ---
    const activeModuleSlugRef = ref(null)
    const routeParams = ref({})

    provide('moduleNav', {
      navigateTo(viewId, params = {}) {
        const slug = activeModuleSlugRef.value
        if (!slug) return
        routeParams.value = params
        // Build hash with query params
        let hash = `#/${slug}/${viewId}`
        const qs = Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== null)
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
          .join('&')
        if (qs) hash += `?${qs}`
        window.location.hash = hash
      },
      goBack() {
        history.back()
      },
      params: readonly(routeParams),
      moduleSlug: readonly(activeModuleSlugRef)
    })

    return {
      authUser,
      authIsAdmin,
      lastRefreshedLabel,
      lastRefreshedAt,
      jiraConfigChangedAt,
      fetchLastRefreshed,
      loadRoster,
      loadGithubStats,
      loadGitlabStats,
      loadModules,
      loadEnabledBuiltInSlugs,
      enabledBuiltInSlugs,
      gitStaticModules,
      allBuiltInManifests,
      builtInManifests,
      loadBuiltInManifestsFromApi,
      rosterTeams: teams,
      selectedOrgKey,
      selectOrg,
      moduleClients,
      ensureModuleClient,
      activeModuleSlugRef,
      routeParams,
      themeMode,
      cycleTheme
    }
  },
  data() {
    return {
      activeModule: 'home',
      activeViewId: null,
      activeModuleSlug: null,
      activeComponent: null,
      activeComponentProps: {},
      isLoading: false,
      isRefreshing: false,
      showRefreshModal: false,
      sidebarCollapsed: false,
      mobileMenuOpen: false,
      settingsInitialTab: null,
      toasts: []
    }
  },
  computed: {
    isBuiltInModuleView() {
      const manifest = this.builtInManifests.find(m => m.slug === this.activeModule)
      return !!manifest
    },
    activeModuleConfig() {
      if (!this.activeModuleSlug || !this.gitStaticModules) return null
      return this.gitStaticModules.find(m => m.slug === this.activeModuleSlug) || null
    },
    currentPageTitle() {
      if (this.activeModule === 'home') return 'Home'
      if (this.activeModule === 'module-iframe') {
        return this.activeModuleConfig?.name || this.activeModuleSlug || 'Module'
      }
      if (this.activeModule === 'api-tokens') return 'API Tokens'
      if (this.activeModule === 'settings') return 'Settings'
      if (this.activeModule === 'help') return 'Help & Debug'
      // Built-in module: find manifest name
      const manifest = this.builtInManifests.find(m => m.slug === this.activeModule)
      if (manifest) return manifest.name
      return 'Dashboard'
    }
  },
  watch: {
    authUser(newUser, oldUser) {
      if (newUser && !oldUser) {
        this.loadInitialData()
      }
    }
  },
  async mounted() {
    window.addEventListener('hashchange', this.onHashChange)
    window.addEventListener('keydown', this.onKeyDown)
    await this.loadBuiltInManifestsFromApi()
    if (this.authUser) {
      await this.loadInitialData()
    }
  },
  beforeUnmount() {
    window.removeEventListener('hashchange', this.onHashChange)
    window.removeEventListener('keydown', this.onKeyDown)
  },
  methods: {
    onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault()
        this.sidebarCollapsed = !this.sidebarCollapsed
      }
    },

    async loadInitialData() {
      this.isLoading = true
      try {
        const allSlugs = this.allBuiltInManifests.map(m => m.slug)
        await Promise.all([
          this.loadRoster(),
          this.loadGithubStats(),
          this.loadGitlabStats(),
          this.loadModules(),
          this.fetchLastRefreshed(),
          this.loadEnabledBuiltInSlugs(allSlugs)
        ])
        this.restoreFromHash()
      } catch (error) {
        console.error('Failed to load initial data:', error)
      } finally {
        this.isLoading = false
      }
    },

    parseHash(hash) {
      const raw = hash.slice(2) // remove #/
      const [pathPart, queryPart] = raw.split('?')
      const parts = pathPart.split('/').map(decodeURIComponent).filter(Boolean)
      const params = {}
      if (queryPart) {
        for (const pair of queryPart.split('&')) {
          const [k, v] = pair.split('=').map(decodeURIComponent)
          if (k) params[k] = v || ''
        }
      }
      return { parts, params }
    },

    async restoreFromHash() {
      const hash = window.location.hash || '#/'
      const { parts, params } = this.parseHash(hash)

      // Backward compatibility redirects
      if (parts[0] === 'team' && parts[1]) {
        const newHash = '#/team-tracker/team-roster?teamKey=' + encodeURIComponent(parts[1]) +
          (parts[2] === 'person' && parts[3] ? '&person=' + encodeURIComponent(parts[3]) : '')
        window.location.replace(newHash)
        return
      }
      if (parts[0] === 'people') { window.location.replace('#/team-tracker/people'); return }
      if (parts[0] === 'trends') { window.location.replace('#/team-tracker/trends'); return }
      if (parts[0] === 'reports') { window.location.replace('#/team-tracker/reports'); return }

      // Shell routes
      if (parts[0] === 'users') {
        // Redirect legacy #/users to #/settings?tab=users
        window.location.replace('#/settings?tab=users')
        return
      }
      if (parts[0] === 'api-tokens') {
        this.setShellView('api-tokens')
        return
      }
      if (parts[0] === 'settings') {
        this.settingsInitialTab = params.tab || null
        this.setShellView('settings')
        return
      }
      if (parts[0] === 'help') {
        this.setShellView('help')
        return
      }

      // Git-static iframe modules
      if (parts[0] === 'modules' && parts[1]) {
        this.activeModuleSlug = parts[1]
        this.activeModule = 'module-iframe'
        this.activeViewId = null
        this.activeComponent = null
        return
      }

      // Built-in module routing: #/<module-slug>/<view-id>?<params>
      // Redirect to home if navigating to a disabled module
      const isKnownBuiltIn = this.allBuiltInManifests.find(m => m.slug === parts[0])
      if (isKnownBuiltIn && this.enabledBuiltInSlugs && !this.enabledBuiltInSlugs.includes(parts[0])) {
        this.setShellView('home')
        window.location.hash = '#/'
        return
      }
      const manifest = this.builtInManifests.find(m => m.slug === parts[0])
      if (manifest) {
        this.activeModuleSlugRef = manifest.slug
        this.activeModule = manifest.slug
        this.routeParams = { ...params }

        // Legacy team-tracker deep-link compat: #/team-tracker/team/<key>/person/<name>
        if (manifest.slug === 'team-tracker' && parts[1] === 'team' && parts[2]) {
          const teamKey = parts[2]
          const viewId = (parts[3] === 'person' && parts[4]) ? 'person-detail' : 'team-roster'
          const legacyParams = { teamKey }
          if (parts[3] === 'person' && parts[4]) {
            legacyParams.person = parts[4]
          }
          // Redirect to new format
          let newHash = `#/${manifest.slug}/${viewId}?` + Object.entries(legacyParams)
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
            .join('&')
          window.location.replace(newHash)
          return
        }

        const viewId = parts[1] || this.getDefaultViewId(manifest)
        this.activeViewId = viewId
        await this.loadModuleView(manifest.slug, viewId)
        return
      }

      // Default: landing page
      this.setShellView('home')
    },

    getDefaultViewId(manifest) {
      const defaultNav = manifest.client?.navItems?.find(n => n.default)
      return defaultNav?.id || manifest.client?.navItems?.[0]?.id || 'dashboard'
    },

    async loadModuleView(slug, viewId) {
      const client = await this.ensureModuleClient(slug)
      if (!client) {
        console.error(`[App] Module client not found for "${slug}"`)
        this.activeComponent = null
        return
      }
      const component = client.routes?.[viewId]
      if (!component) {
        console.error(`[App] View "${viewId}" not found in module "${slug}"`)
        this.activeComponent = null
        return
      }
      this.activeComponent = component
      this.activeComponentProps = {}
    },

    setShellView(module) {
      this.activeModule = module
      this.activeViewId = null
      this.activeComponent = null
      this.activeModuleSlug = null
    },

    navigateHome() {
      this.setShellView('home')
      window.location.hash = '#/'
    },

    onHashChange() {
      this.restoreFromHash()
    },

    handleSidebarNavigate(target) {
      this.mobileMenuOpen = false

      if (target === 'home') {
        this.navigateHome()
        return
      }

      // Git-static module
      if (target.startsWith('modules/')) {
        this.activeModuleSlug = target.slice('modules/'.length)
        this.activeModule = 'module-iframe'
        this.activeViewId = null
        this.activeComponent = null
        window.location.hash = `#/${target}`
        return
      }

      // Shell routes
      if (target === 'api-tokens') {
        this.setShellView('api-tokens')
        window.location.hash = '#/api-tokens'
        return
      }
      if (target === 'settings') {
        this.settingsInitialTab = null
        this.setShellView('settings')
        window.location.hash = '#/settings'
        return
      }
      if (target === 'help') {
        this.setShellView('help')
        window.location.hash = '#/help'
        return
      }

      // Built-in module: target could be slug or slug::viewId
      const [slug, viewId] = target.includes('::') ? target.split('::') : [target, null]
      const manifest = this.builtInManifests.find(m => m.slug === slug)
      if (manifest) {
        const resolvedViewId = viewId || this.getDefaultViewId(manifest)
        this.activeModuleSlugRef = manifest.slug
        this.activeModule = manifest.slug
        this.activeViewId = resolvedViewId
        this.routeParams = {}
        window.location.hash = `#/${manifest.slug}/${resolvedViewId}`
        return
      }

      // Fallback: treat as a view within the active module
      if (this.activeModule && this.builtInManifests.find(m => m.slug === this.activeModule)) {
        this.activeViewId = target
        this.routeParams = {}
        window.location.hash = `#/${this.activeModule}/${target}`
      }
    },

    handleModuleSync() {
      if (!this.activeModuleSlug) return
      fetch(`/api/admin/modules/${encodeURIComponent(this.activeModuleSlug)}/sync`, {
        method: 'POST'
      }).then(() => {
        this.showToast('Sync started')
      }).catch(() => {
        this.showToast('Sync failed', 'error')
      })
    },

    async handleRefreshAllConfirm({ force, sources }) {
      this.showRefreshModal = false
      this.isRefreshing = true
      try {
        await refreshMetrics({ scope: 'all', force, sources })
        this.showToast('Refresh started — data will update shortly')
      } catch (err) {
        console.error('Failed to start refresh:', err)
        this.showToast('Failed to start refresh', 'error')
      } finally {
        setTimeout(() => {
          this.isRefreshing = false
        }, 5000)
      }
    },

    showToast(message, type = 'success', duration = 3000) {
      const id = Date.now()
      this.toasts.push({ id, message, type, duration })
    },

    removeToast(id) {
      this.toasts = this.toasts.filter(t => t.id !== id)
    }
  }
}
</script>
