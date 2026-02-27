<template>
  <AuthGuard>
    <div id="app" class="min-h-screen bg-gray-50">
      <header class="bg-primary-700 text-white shadow-lg">
        <div class="container mx-auto px-6 py-2 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <img src="/redhat-logo.svg" alt="Red Hat" class="h-8" />
            <h1 class="text-xl font-bold cursor-pointer" @click="navigateToDashboard">AI Platform Team Tracker</h1>
          </div>
          <div class="flex items-center gap-4">
            <div v-if="lastUpdated" class="text-sm flex items-center gap-1.5" :class="isDataStale ? 'text-amber-300' : 'text-primary-100'">
              <svg v-if="isDataStale" class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
              Last Updated: {{ formatDateTime(lastUpdated) }}
            </div>
            <button
              @click="currentView = 'user-management'"
              class="p-1 text-primary-100 hover:text-white transition-colors"
              title="Manage Users"
            >
              <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </button>
            <button
              @click="currentView = 'board-settings'"
              class="p-1 text-primary-100 hover:text-white transition-colors"
              title="Board Settings"
            >
              <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <div class="relative">
              <div class="flex items-stretch">
                <button
                  @click="refreshData(false)"
                  :disabled="isRefreshing"
                  class="px-3 py-1 text-sm bg-white text-primary-700 rounded-l-md font-medium hover:bg-primary-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                >
                  <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </button>
                <button
                  @click="showRefreshMenu = !showRefreshMenu"
                  :disabled="isRefreshing"
                  class="px-1.5 py-1 text-sm bg-white text-primary-700 rounded-r-md font-medium hover:bg-primary-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border-l border-primary-200"
                >
                  <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              <div
                v-if="showRefreshMenu"
                class="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg py-1 z-10"
              >
                <button
                  @click="refreshData(false); showRefreshMenu = false"
                  class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Refresh
                </button>
                <button
                  @click="refreshData(true); showRefreshMenu = false"
                  class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Full Refresh
                </button>
                <div class="border-t border-gray-100 my-1"></div>
                <label class="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer">
                  <input
                    type="checkbox"
                    :checked="refreshMode === 'foreground'"
                    @change="refreshMode = $event.target.checked ? 'foreground' : 'background'"
                    class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  Show progress
                </label>
              </div>
            </div>

            <!-- User Avatar and Sign Out -->
            <div class="relative" v-if="authUser">
              <button
                @click="showUserMenu = !showUserMenu"
                class="flex items-center gap-2 hover:bg-primary-600 rounded-full p-1 transition-colors"
              >
                <div
                  v-if="!authUser.photoURL || avatarLoadError"
                  class="h-8 w-8 rounded-full border-2 border-white bg-white text-primary-700 flex items-center justify-center font-bold text-xs"
                >
                  {{ getUserInitials(authUser) }}
                </div>
                <img
                  v-else
                  :src="authUser.photoURL"
                  :alt="authUser.displayName || authUser.email"
                  class="h-8 w-8 rounded-full border-2 border-white"
                  @error="avatarLoadError = true"
                />
              </button>

              <div
                v-if="showUserMenu"
                class="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg py-1 z-10"
              >
                <div class="px-4 py-2 border-b border-gray-200">
                  <p class="text-sm font-medium text-gray-900">{{ authUser.displayName }}</p>
                  <p class="text-xs text-gray-500 truncate">{{ authUser.email }}</p>
                </div>
                <button
                  @click="handleSignOut"
                  class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                >
                  <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <RefreshProgressBar
        :visible="isRefreshing && refreshMode === 'foreground'"
        :totalBoards="refreshProgress.totalBoards"
        :completedBoards="refreshProgress.completedBoards"
        :currentBoard="refreshProgress.currentBoard"
        :totalSprints="refreshProgress.totalSprints"
        :completedSprints="refreshProgress.completedSprints"
        :currentSprint="refreshProgress.currentSprint"
      />

      <!-- Dashboard View -->
      <main v-if="currentView === 'dashboard'" class="relative">
        <Dashboard
          :boards="boards"
          :dashboardSummary="dashboardSummary"
          :filters="filters"
          :activeFilterId="activeFilterId"
          :activeFilter="activeFilter"
          :isLoading="isLoading"
          @select-team="handleSelectTeam"
          @select-filter="setActiveFilter"
          @create-filter="openCreateFilter"
          @edit-filter="openEditFilter"
          @delete-filter="handleDeleteFilter"
        />
        <LoadingOverlay v-if="isLoading" />
      </main>

      <!-- Team Detail View -->
      <main v-else-if="currentView === 'team-detail'">
        <TeamDetail
          :board="selectedTeam"
          :sprints="teamSprints"
          :selectedSprint="selectedSprint"
          :sprintData="teamSprintData"
          :trendData="teamTrendData"
          :isLoading="isTeamDetailLoading"
          :viewMode="teamViewMode"
          @select-sprint="handleSelectSprint"
          @switch-mode="handleSwitchMode"
          @back="navigateToDashboard"
        />
      </main>

      <!-- Board Settings View -->
      <main v-else-if="currentView === 'board-settings'">
        <BoardSettings
          @back="navigateToDashboard"
          @saved="handleSettingsSaved"
        />
      </main>

      <!-- User Management View -->
      <main v-else-if="currentView === 'user-management'">
        <UserManagement
          @back="navigateToDashboard"
          @toast="({ message, type }) => showToast(message, type)"
        />
      </main>

      <FilterEditor
        v-if="showFilterEditor"
        :boards="boards"
        :filter="editingFilter"
        @save="handleSaveFilter"
        @cancel="showFilterEditor = false"
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
  </AuthGuard>
</template>

<script>
import AuthGuard from './AuthGuard.vue'
import BoardSettings from './BoardSettings.vue'
import Dashboard from './Dashboard.vue'
import FilterEditor from './FilterEditor.vue'
import LoadingOverlay from './LoadingOverlay.vue'
import RefreshProgressBar from './RefreshProgressBar.vue'
import TeamDetail from './TeamDetail.vue'
import Toast from './Toast.vue'
import UserManagement from './UserManagement.vue'
import { useAuth } from '../composables/useAuth'
import { useSavedFilters } from '../composables/useSavedFilters'
import {
  refreshData as apiRefreshData,
  refreshDataForeground,
  refreshDataPolling,
  isProduction,
  getBoards,
  getSprintsForBoard,
  getSprintData,
  getBoardTrend,
  getDashboardSummary
} from '../services/api'

export default {
  name: 'App',
  components: {
    AuthGuard,
    BoardSettings,
    Dashboard,
    FilterEditor,
    LoadingOverlay,
    RefreshProgressBar,
    TeamDetail,
    Toast,
    UserManagement
  },
  setup() {
    const { user: authUser, signOut } = useAuth()
    const { filters, activeFilterId, activeFilter, createFilter, updateFilter, deleteFilter, setActiveFilter } = useSavedFilters()
    return {
      authUser,
      signOut,
      filters,
      activeFilterId,
      activeFilter,
      createFilter,
      updateFilter,
      deleteFilter,
      setActiveFilter
    }
  },
  data() {
    return {
      currentView: 'dashboard',
      boards: [],
      dashboardSummary: null,
      selectedTeam: null,
      teamSprints: [],
      selectedSprint: null,
      teamSprintData: null,
      teamTrendData: null,
      teamViewMode: 'overview',
      isTeamDetailLoading: false,
      lastUpdated: null,
      isRefreshing: false,
      isLoading: false,
      showUserMenu: false,
      showRefreshMenu: false,
      avatarLoadError: false,
      toasts: [],
      showFilterEditor: false,
      editingFilter: null,
      refreshMode: 'foreground',
      refreshProgress: {
        totalBoards: 0,
        completedBoards: 0,
        currentBoard: '',
        totalSprints: 0,
        completedSprints: 0,
        currentSprint: ''
      },
      refreshAbortController: null
    }
  },
  computed: {
    isDataStale() {
      if (!this.lastUpdated) return false
      const age = Date.now() - new Date(this.lastUpdated).getTime()
      return age > 60 * 60 * 1000
    }
  },
  watch: {
    authUser(newUser, oldUser) {
      this.avatarLoadError = false
      if (newUser && !oldUser) {
        this.loadInitialData()
      }
    }
  },
  mounted() {
    document.addEventListener('click', this.handleClickOutside)
    if (this.authUser) {
      this.loadInitialData()
    }
  },
  beforeUnmount() {
    document.removeEventListener('click', this.handleClickOutside)
    if (this.refreshAbortController) {
      this.refreshAbortController.abort()
      this.refreshAbortController = null
    }
  },
  methods: {
    async loadInitialData() {
      this.isLoading = true
      try {
        const [boardsData, summaryData] = await Promise.all([
          getBoards(),
          getDashboardSummary()
        ])
        this.boards = boardsData.boards || []
        this.dashboardSummary = summaryData
        if (summaryData?.lastUpdated) {
          this.lastUpdated = summaryData.lastUpdated
        }
      } catch (error) {
        console.error('Failed to load initial data:', error)
      } finally {
        this.isLoading = false
      }
    },

    navigateToDashboard() {
      this.currentView = 'dashboard'
      this.selectedTeam = null
      this.teamSprints = []
      this.teamSprintData = null
      this.teamTrendData = null
      this.teamViewMode = 'overview'
      this.loadInitialData()
    },

    handleSelectTeam(board) {
      this.selectedTeam = board
      this.teamSprints = []
      this.selectedSprint = null
      this.teamSprintData = null
      this.teamTrendData = null
      this.teamViewMode = 'overview'
      this.currentView = 'team-detail'
      this.loadTeamData(board.id)
    },

    async loadTeamData(boardId) {
      this.isTeamDetailLoading = true
      try {
        const [sprintsData, trendData] = await Promise.all([
          getSprintsForBoard(boardId),
          getBoardTrend(boardId)
        ])
        this.teamSprints = sprintsData.sprints || []
        this.teamTrendData = trendData.sprints || []

        // Pre-select default sprint but don't load data unless in sprint-detail mode
        const activeSprint = this.teamSprints.find(s => s.state === 'active')
        this.selectedSprint = activeSprint || [...this.teamSprints]
          .filter(s => s.state === 'closed')
          .sort((a, b) => new Date(b.startDate) - new Date(a.startDate))[0] || null

        if (this.teamViewMode === 'sprint-detail' && this.selectedSprint) {
          await this.loadSprintData(this.selectedSprint.id)
        }
      } catch (error) {
        console.error('Failed to load team data:', error)
      } finally {
        this.isTeamDetailLoading = false
      }
    },

    async loadSprintData(sprintId) {
      try {
        const data = await getSprintData(sprintId)
        this.teamSprintData = data
      } catch (error) {
        console.error('Failed to load sprint data:', error)
        this.teamSprintData = null
      }
    },

    async handleSelectSprint(sprintId) {
      this.selectedSprint = this.teamSprints.find(s => s.id === sprintId) || null
      this.teamSprintData = null
      this.teamViewMode = 'sprint-detail'
      this.isTeamDetailLoading = true
      try {
        await this.loadSprintData(sprintId)
      } finally {
        this.isTeamDetailLoading = false
      }
    },

    async handleSwitchMode(mode) {
      this.teamViewMode = mode
      if (mode === 'sprint-detail' && !this.teamSprintData && this.selectedSprint) {
        this.isTeamDetailLoading = true
        try {
          await this.loadSprintData(this.selectedSprint.id)
        } finally {
          this.isTeamDetailLoading = false
        }
      }
    },

    async refreshData(hardRefresh) {
      this.isRefreshing = true

      if (this.refreshMode === 'background') {
        try {
          await apiRefreshData({ hardRefresh })
          this.showToast(
            hardRefresh
              ? 'Full refresh started — data will update in the background'
              : 'Refresh started — data will update in the background'
          )
        } catch (error) {
          console.error('Refresh error:', error)
          this.showToast(`Failed to start refresh: ${error.message}`, 'error')
        } finally {
          this.isRefreshing = false
        }
        return
      }

      // Foreground mode with progress
      this.refreshProgress = {
        totalBoards: 0,
        completedBoards: 0,
        currentBoard: '',
        totalSprints: 0,
        completedSprints: 0,
        currentSprint: ''
      }
      this.refreshAbortController = new AbortController()

      const progressHandler = (event) => {
        if (event.type === 'refresh-start') {
          this.refreshProgress.totalBoards = event.totalBoards
        } else if (event.type === 'board-start') {
          this.refreshProgress.currentBoard = event.board
          this.refreshProgress.totalSprints = 0
          this.refreshProgress.completedSprints = 0
          this.refreshProgress.currentSprint = ''
        } else if (event.type === 'sprint') {
          this.refreshProgress.currentBoard = event.board
          this.refreshProgress.totalSprints = event.totalSprints
          this.refreshProgress.completedSprints = event.sprintIndex + 1
          this.refreshProgress.currentSprint = event.sprint
        } else if (event.type === 'board-complete') {
          this.refreshProgress.completedBoards += 1
        }
      }

      const completeHandler = () => {
        this.isRefreshing = false
        this.refreshAbortController = null
        this.loadInitialData()
      }

      const errorHandler = (error) => {
        console.error('Foreground refresh error:', error)
        this.showToast(`Refresh failed: ${error.message}`, 'error')
        this.isRefreshing = false
        this.refreshAbortController = null
      }

      // Use polling in production (API Gateway doesn't support SSE), SSE in local dev
      const refreshFn = isProduction() ? refreshDataPolling : refreshDataForeground

      try {
        await refreshFn({
          hardRefresh,
          signal: this.refreshAbortController.signal,
          onProgress: progressHandler,
          onComplete: completeHandler,
          onError: errorHandler
        })
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Refresh error:', error)
          this.showToast(`Failed to start refresh: ${error.message}`, 'error')
        }
        this.isRefreshing = false
        this.refreshAbortController = null
      }
    },

    async handleSettingsSaved() {
      this.showToast('Board settings saved')
      this.navigateToDashboard()
    },

    async handleSignOut() {
      this.showUserMenu = false
      await this.signOut()
    },

    handleClickOutside(event) {
      if (!event.target.closest('.relative')) {
        this.showUserMenu = false
        this.showRefreshMenu = false
      }
    },

    formatDateTime(dateString) {
      const date = new Date(dateString)
      return date.toLocaleString()
    },

    showToast(message, type = 'success', duration = 3000) {
      const id = Date.now()
      this.toasts.push({ id, message, type, duration })
    },

    removeToast(id) {
      this.toasts = this.toasts.filter(t => t.id !== id)
    },

    openCreateFilter() {
      this.editingFilter = null
      this.showFilterEditor = true
    },

    openEditFilter(id) {
      this.editingFilter = this.filters.find(f => f.id === id) || null
      this.showFilterEditor = true
    },

    handleSaveFilter({ name, boardIds }) {
      if (this.editingFilter) {
        this.updateFilter(this.editingFilter.id, { name, boardIds })
      } else {
        this.createFilter({ name, boardIds })
      }
      this.showFilterEditor = false
      this.editingFilter = null
    },

    handleDeleteFilter(id) {
      this.deleteFilter(id)
    },

    getUserInitials(user) {
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
  }
}
</script>
