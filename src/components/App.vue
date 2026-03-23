<template>
  <div id="app" class="min-h-screen bg-gray-50">
    <!-- Sidebar -->
    <AppSidebar
      :collapsed="sidebarCollapsed"
      :mobile-open="mobileMenuOpen"
      :active-module="activeModule"
      :current-view="currentView"
      :user="authUser"
      :is-admin="authIsAdmin"
      :modules="modulesList"
      @navigate="navigateToModule"
      @toggle-collapse="sidebarCollapsed = !sidebarCollapsed"
      @close-mobile="mobileMenuOpen = false"
    />

    <!-- Main content area -->
    <div
      class="min-h-screen transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
      :class="sidebarCollapsed ? 'pl-[72px]' : 'pl-[260px]'"
    >
      <!-- Top bar -->
      <header class="sticky top-0 z-10 bg-white/80 backdrop-blur-xl border-b border-gray-200/60">
        <div class="flex items-center justify-between px-6 lg:px-8 h-16">
          <div class="flex items-center gap-4">
            <!-- Mobile menu button -->
            <button
              class="lg:hidden p-2 -ml-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              @click="mobileMenuOpen = !mobileMenuOpen"
            >
              <MenuIcon :size="20" />
            </button>
            <!-- Page title & sub-nav -->
            <div>
              <h2 class="text-lg font-semibold text-gray-900">{{ currentPageTitle }}</h2>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <!-- Sub-navigation tabs (for dashboard drill-down views) -->
            <nav
              v-if="activeModule === 'team-tracker' && hasSubViews"
              class="hidden sm:flex items-center gap-1 bg-gray-100 rounded-lg p-1"
            >
              <button
                v-for="tab in subTabs"
                :key="tab.view"
                @click="navigateToSubView(tab.view)"
                class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-200"
                :class="isSubViewActive(tab.view)
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'"
              >{{ tab.label }}</button>
            </nav>
            <!-- Open in new tab for external modules -->
            <a
              v-if="currentView === 'module-iframe' && activeModuleSlug"
              :href="'/modules/' + activeModuleSlug + '/index.html'"
              target="_blank"
              rel="noopener"
              class="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 shadow-sm"
              title="Open in new tab"
            >
              <ExternalLinkIcon :size="16" />
              <span class="hidden sm:inline">New tab</span>
            </a>
            <!-- Last updated + Refresh All (only for Team Tracker views) -->
            <template v-if="isTeamTrackerView">
              <span
                v-if="lastRefreshedLabel"
                class="hidden md:inline text-xs text-gray-400"
              >{{ lastRefreshedLabel }}</span>
              <button
                v-if="authUser && authIsAdmin"
                @click="showRefreshModal = true"
                :disabled="isRefreshing"
                title="Refresh all metrics"
                class="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
              >
                <RefreshCw :size="16" :class="{ 'animate-spin': isRefreshing }" />
                <span class="hidden sm:inline">{{ isRefreshing ? 'Refreshing...' : 'Refresh' }}</span>
              </button>
            </template>
          </div>
        </div>
      </header>

      <!-- Setup Banner -->
      <SetupBanner
        v-if="authUser && currentView === 'dashboard'"
        @go-settings="navigateToModule('settings')"
      />

      <!-- Stale Data Banner -->
      <StaleDataBanner
        v-if="authUser && isTeamTrackerView"
        :config-changed-at="jiraConfigChangedAt"
        :last-refreshed-at="lastRefreshedAt"
      />

      <!-- Page content -->
      <main class="px-6 lg:px-8 py-6">
        <!-- Landing Page -->
        <LandingPage
          v-if="currentView === 'landing'"
          :modules="modulesList"
          :is-admin="authIsAdmin"
          @navigate="navigateToModule"
        />

        <!-- Dashboard View -->
        <template v-else-if="currentView === 'dashboard'">
          <Dashboard
            @select-team="handleSelectTeam"
          />
          <LoadingOverlay v-if="isLoading" />
        </template>

        <!-- Team Roster View -->
        <TeamRosterView
          v-else-if="currentView === 'team-roster'"
          :team="selectedTeam"
          @select-person="handleSelectPerson"
          @back="navigateToDashboard"
        />

        <!-- Person Detail View -->
        <PersonDetail
          v-else-if="currentView === 'person-detail'"
          :person="selectedPerson"
          :teamName="selectedTeam?.displayName || ''"
          @back="handleBackFromPerson"
          @go-dashboard="navigateToDashboard"
        />

        <!-- People View -->
        <PeopleView v-else-if="currentView === 'people'" />

        <!-- Trends View -->
        <TrendsView v-else-if="currentView === 'trends'" />

        <!-- Reports View -->
        <ReportsView
          v-else-if="currentView === 'reports'"
          @back="navigateToDashboard"
        />

        <!-- Module iframe View -->
        <ModuleIframeView
          v-else-if="currentView === 'module-iframe'"
          :slug="activeModuleSlug"
          :module-name="activeModuleConfig?.name || activeModuleSlug"
          :sync-status="activeModuleConfig?.lastSyncStatus || null"
          :is-admin="authIsAdmin"
          @trigger-sync="handleModuleSync"
          @retry-sync="handleModuleSync"
        />

        <!-- User Management View -->
        <UserManagement
          v-else-if="currentView === 'user-management'"
          @back="navigateToDashboard"
          @toast="({ message, type }) => showToast(message, type)"
        />

        <!-- Settings View -->
        <SettingsView
          v-else-if="currentView === 'settings'"
          @toast="({ message, type }) => showToast(message, type)"
        />
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
  </div>
</template>

<script>
import { Menu as MenuIcon, RefreshCw, ExternalLink as ExternalLinkIcon } from 'lucide-vue-next'
import Dashboard from './Dashboard.vue'
import LoadingOverlay from './LoadingOverlay.vue'
import PersonDetail from './PersonDetail.vue'
import TeamRosterView from './TeamRosterView.vue'
import Toast from './Toast.vue'
import PeopleView from './PeopleView.vue'
import ReportsView from './ReportsView.vue'
import TrendsView from './TrendsView.vue'
import UserManagement from './UserManagement.vue'
import SettingsView from './SettingsView.vue'
import SetupBanner from './SetupBanner.vue'
import StaleDataBanner from './StaleDataBanner.vue'
import AppSidebar from './AppSidebar.vue'
import RefreshModal from './RefreshModal.vue'
import LandingPage from './LandingPage.vue'
import ModuleIframeView from './ModuleIframeView.vue'
import { computed, ref, onUnmounted } from 'vue'
import { useAuth } from '../composables/useAuth'
import { useRoster } from '../composables/useRoster'
import { useGithubStats } from '../composables/useGithubStats'
import { useGitlabStats } from '../composables/useGitlabStats'
import { useModules } from '../composables/useModules'
import { refreshMetrics, getLastRefreshed } from '../services/api'

export default {
  name: 'App',
  components: {
    MenuIcon,
    RefreshCw,
    ExternalLinkIcon,
    Dashboard,
    LoadingOverlay,
    PeopleView,
    PersonDetail,
    ReportsView,
    TrendsView,
    TeamRosterView,
    Toast,
    UserManagement,
    SettingsView,
    SetupBanner,
    StaleDataBanner,
    AppSidebar,
    RefreshModal,
    LandingPage,
    ModuleIframeView
  },
  setup() {
    const { user: authUser, isAdmin: authIsAdmin } = useAuth()
    const { loadRoster, teams, selectedOrgKey, selectOrg, loading: rosterLoading } = useRoster()
    const { loadGithubStats } = useGithubStats()
    const { loadGitlabStats } = useGitlabStats()
    const { modulesData, loadModules } = useModules()
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

    const modulesList = computed(() => {
      return modulesData.value?.modules || []
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
      modulesList,
      rosterLoading,
      rosterTeams: teams,
      selectedOrgKey,
      selectOrg
    }
  },
  data() {
    return {
      currentView: 'landing',
      activeModuleSlug: null,
      selectedTeam: null,
      selectedPerson: null,
      isLoading: false,
      isRefreshing: false,
      showRefreshModal: false,
      sidebarCollapsed: false,
      mobileMenuOpen: false,
      toasts: [],
      subTabs: [
        { view: 'dashboard', label: 'Teams' },
        { view: 'team-roster', label: 'Roster' },
        { view: 'person-detail', label: 'Person' },
      ]
    }
  },
  computed: {
    activeModule() {
      if (this.currentView === 'landing') return 'home'
      if (['dashboard', 'team-roster', 'person-detail', 'people', 'trends', 'reports'].includes(this.currentView)) {
        return 'team-tracker'
      }
      if (this.currentView === 'module-iframe') {
        return `module:${this.activeModuleSlug}`
      }
      return this.currentView
    },
    isTeamTrackerView() {
      return ['dashboard', 'team-roster', 'person-detail', 'people', 'trends', 'reports'].includes(this.currentView)
    },
    activeModuleConfig() {
      if (!this.activeModuleSlug || !this.modulesList) return null
      return this.modulesList.find(m => m.slug === this.activeModuleSlug) || null
    },
    currentPageTitle() {
      if (this.currentView === 'landing') return 'Home'
      if (this.currentView === 'module-iframe') {
        return this.activeModuleConfig?.name || this.activeModuleSlug || 'Module'
      }
      const titles = {
        'dashboard': 'Dashboard',
        'team-roster': this.selectedTeam?.displayName || 'Team Roster',
        'person-detail': this.selectedPerson?.name || 'Person Detail',
        'people': 'People',
        'trends': 'Trends',
        'reports': 'Reports',
        'user-management': 'Users',
        'settings': 'Settings'
      }
      return titles[this.currentView] || 'Dashboard'
    },
    hasSubViews() {
      return this.selectedTeam != null
    }
  },
  watch: {
    authUser(newUser, oldUser) {
      if (newUser && !oldUser) {
        this.loadInitialData()
      }
    }
  },
  mounted() {
    window.addEventListener('hashchange', this.onHashChange)
    window.addEventListener('keydown', this.onKeyDown)
    if (this.authUser) {
      this.loadInitialData()
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
        await Promise.all([
          this.loadRoster(),
          this.loadGithubStats(),
          this.loadGitlabStats(),
          this.loadModules(),
          this.fetchLastRefreshed()
        ])
        this.restoreFromHash()
      } catch (error) {
        console.error('Failed to load initial data:', error)
      } finally {
        this.isLoading = false
      }
    },

    updateHash() {
      let hash = '#/'
      if (this.currentView === 'dashboard') {
        hash = '#/team-tracker'
      } else if (this.currentView === 'team-roster' && this.selectedTeam) {
        hash = `#/team-tracker/team/${encodeURIComponent(this.selectedTeam.key)}`
      } else if (this.currentView === 'person-detail' && this.selectedTeam && this.selectedPerson) {
        hash = `#/team-tracker/team/${encodeURIComponent(this.selectedTeam.key)}/person/${encodeURIComponent(this.selectedPerson.jiraDisplayName || this.selectedPerson.name)}`
      } else if (this.currentView === 'people') {
        hash = '#/team-tracker/people'
      } else if (this.currentView === 'trends') {
        hash = '#/team-tracker/trends'
      } else if (this.currentView === 'reports') {
        hash = '#/team-tracker/reports'
      } else if (this.currentView === 'module-iframe' && this.activeModuleSlug) {
        hash = `#/modules/${this.activeModuleSlug}`
      } else if (this.currentView === 'user-management') {
        hash = '#/users'
      } else if (this.currentView === 'settings') {
        hash = '#/settings'
      }
      if (window.location.hash !== hash) {
        window.location.hash = hash
      }
    },

    restoreFromHash() {
      const hash = window.location.hash || '#/'
      const parts = hash.slice(2).split('/').map(decodeURIComponent)

      // Backward compatibility redirects: old routes -> new #/team-tracker/* routes
      if (parts[0] === 'team' && parts[1]) {
        const newHash = '#/team-tracker/team/' + encodeURIComponent(parts[1]) +
          (parts[2] === 'person' && parts[3] ? '/person/' + encodeURIComponent(parts[3]) : '')
        window.location.replace(newHash)
        return
      }
      if (parts[0] === 'people') {
        window.location.replace('#/team-tracker/people')
        return
      }
      if (parts[0] === 'trends') {
        window.location.replace('#/team-tracker/trends')
        return
      }
      if (parts[0] === 'reports') {
        window.location.replace('#/team-tracker/reports')
        return
      }

      // New routes
      if (parts[0] === 'team-tracker') {
        if (parts[1] === 'team' && parts[2]) {
          const teamKey = parts[2]
          const orgKey = teamKey.split('::')[0]
          if (orgKey && this.selectedOrgKey !== orgKey) {
            this.selectOrg(orgKey)
          }
          const team = this.rosterTeams.find(t => t.key === teamKey)
          if (team) {
            this.selectedTeam = team
            if (parts[3] === 'person' && parts[4]) {
              const personName = parts[4]
              const person = team.members.find(m => (m.jiraDisplayName || m.name) === personName)
              if (person) {
                this.selectedPerson = person
                this.currentView = 'person-detail'
                return
              }
            }
            this.selectedPerson = null
            this.currentView = 'team-roster'
            return
          }
        } else if (parts[1] === 'people') {
          this.currentView = 'people'
          return
        } else if (parts[1] === 'trends') {
          this.currentView = 'trends'
          return
        } else if (parts[1] === 'reports') {
          this.currentView = 'reports'
          return
        }
        // Default team-tracker view = dashboard
        this.currentView = 'dashboard'
        this.selectedTeam = null
        this.selectedPerson = null
        return
      } else if (parts[0] === 'modules' && parts[1]) {
        this.activeModuleSlug = parts[1]
        this.currentView = 'module-iframe'
        return
      } else if (parts[0] === 'users') {
        this.currentView = 'user-management'
        return
      } else if (parts[0] === 'settings') {
        this.currentView = 'settings'
        return
      }

      // Default: landing page
      this.currentView = 'landing'
      this.activeModuleSlug = null
      this.selectedTeam = null
      this.selectedPerson = null
    },

    onHashChange() {
      this.restoreFromHash()
    },

    navigateToDashboard() {
      this.currentView = 'dashboard'
      this.selectedTeam = null
      this.selectedPerson = null
      this.updateHash()
    },

    navigateToModule(moduleId) {
      this.mobileMenuOpen = false
      if (moduleId === 'home') {
        this.currentView = 'landing'
        this.activeModuleSlug = null
        this.selectedTeam = null
        this.selectedPerson = null
        window.location.hash = '#/'
        return
      }
      if (moduleId === 'team-tracker' || moduleId === 'dashboard') {
        this.navigateToDashboard()
      } else if (moduleId.startsWith('modules/')) {
        this.activeModuleSlug = moduleId.slice('modules/'.length)
        this.currentView = 'module-iframe'
        this.selectedTeam = null
        this.selectedPerson = null
        this.updateHash()
      } else {
        this.currentView = moduleId
        this.selectedTeam = null
        this.selectedPerson = null
        this.updateHash()
      }
    },

    navigateToSubView(view) {
      if (view === 'dashboard') {
        this.navigateToDashboard()
      } else {
        this.currentView = view
        this.updateHash()
      }
    },

    isSubViewActive(tabView) {
      return this.currentView === tabView
    },

    handleSelectTeam(team) {
      this.selectedTeam = team
      this.selectedPerson = null
      this.currentView = 'team-roster'
      this.updateHash()
    },

    handleSelectPerson(member) {
      this.selectedPerson = member
      this.currentView = 'person-detail'
      this.updateHash()
    },

    handleBackFromPerson() {
      this.currentView = 'team-roster'
      this.selectedPerson = null
      this.updateHash()
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
