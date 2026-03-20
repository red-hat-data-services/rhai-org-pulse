<template>
  <div id="app" class="min-h-screen bg-gray-50">
    <!-- Sidebar -->
    <AppSidebar
      :collapsed="sidebarCollapsed"
      :mobile-open="mobileMenuOpen"
      :active-module="activeModule"
      :user="authUser"
      :is-admin="authIsAdmin"
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
              v-if="activeModule === 'dashboard' && hasSubViews"
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
            <!-- Last updated + Refresh All -->
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
        v-if="authUser"
        :config-changed-at="jiraConfigChangedAt"
        :last-refreshed-at="lastRefreshedAt"
      />

      <!-- Page content -->
      <main class="px-6 lg:px-8 py-6">
        <!-- Dashboard View -->
        <template v-if="currentView === 'dashboard'">
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
import { Menu as MenuIcon, RefreshCw } from 'lucide-vue-next'
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
import { computed, ref, onUnmounted } from 'vue'
import { useAuth } from '../composables/useAuth'
import { useRoster } from '../composables/useRoster'
import { useGithubStats } from '../composables/useGithubStats'
import { useGitlabStats } from '../composables/useGitlabStats'
import { refreshMetrics, getLastRefreshed } from '../services/api'

export default {
  name: 'App',
  components: {
    MenuIcon,
    RefreshCw,
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
    RefreshModal
  },
  setup() {
    const { user: authUser, isAdmin: authIsAdmin } = useAuth()
    const { loadRoster, teams, selectedOrgKey, selectOrg, loading: rosterLoading } = useRoster()
    const { loadGithubStats } = useGithubStats()
    const { loadGitlabStats } = useGitlabStats()
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
      rosterLoading,
      rosterTeams: teams,
      selectedOrgKey,
      selectOrg
    }
  },
  data() {
    return {
      currentView: 'dashboard',
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
      if (['dashboard', 'team-roster', 'person-detail'].includes(this.currentView)) {
        return 'dashboard'
      }
      return this.currentView
    },
    currentPageTitle() {
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
      if (this.currentView === 'team-roster' && this.selectedTeam) {
        hash = `#/team/${encodeURIComponent(this.selectedTeam.key)}`
      } else if (this.currentView === 'person-detail' && this.selectedTeam && this.selectedPerson) {
        hash = `#/team/${encodeURIComponent(this.selectedTeam.key)}/person/${encodeURIComponent(this.selectedPerson.jiraDisplayName || this.selectedPerson.name)}`
      } else if (this.currentView === 'people') {
        hash = '#/people'
      } else if (this.currentView === 'trends') {
        hash = '#/trends'
      } else if (this.currentView === 'reports') {
        hash = '#/reports'
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

      if (parts[0] === 'team' && parts[1]) {
        const teamKey = parts[1]
        const orgKey = teamKey.split('::')[0]
        if (orgKey && this.selectedOrgKey !== orgKey) {
          this.selectOrg(orgKey)
        }
        const team = this.rosterTeams.find(t => t.key === teamKey)
        if (team) {
          this.selectedTeam = team
          if (parts[2] === 'person' && parts[3]) {
            const personName = parts[3]
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
      } else if (parts[0] === 'people') {
        this.currentView = 'people'
        return
      } else if (parts[0] === 'trends') {
        this.currentView = 'trends'
        return
      } else if (parts[0] === 'reports') {
        this.currentView = 'reports'
        return
      } else if (parts[0] === 'users') {
        this.currentView = 'user-management'
        return
      } else if (parts[0] === 'settings') {
        this.currentView = 'settings'
        return
      }

      this.currentView = 'dashboard'
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
      if (moduleId === 'dashboard') {
        this.navigateToDashboard()
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
