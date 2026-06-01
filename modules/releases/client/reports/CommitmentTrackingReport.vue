<template>
  <div>
    <!-- Report Shell with back button and title -->
    <div class="flex items-center gap-3 mb-4">
      <button
        @click="goBack"
        class="p-1.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
        title="Back to Reports"
      >
        <ArrowLeft :size="18" />
      </button>
      <div>
        <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Commitment Tracking</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400">Track committed vs. delivered features per release phase</p>
      </div>
    </div>

    <!-- Filter bar with snapshot creation -->
    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-6">
      <div class="flex flex-wrap items-center gap-4 mb-3">
        <div class="flex items-center gap-2">
          <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Release:</label>
          <select
            v-model="selectedVersion"
            @change="handleFilterChange"
            class="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          >
            <option value="">Select a release...</option>
            <option v-for="r in releases" :key="r.version" :value="r.version">
              {{ r.version }}
            </option>
          </select>
        </div>

        <div class="flex items-center gap-2">
          <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Phase:</label>
          <select
            v-model="selectedPhase"
            @change="handleFilterChange"
            class="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          >
            <option value="">Select a phase...</option>
            <option value="EA1">EA1</option>
            <option value="EA2">EA2</option>
            <option value="GA">GA</option>
          </select>
        </div>
      </div>

      <!-- Snapshot creation (always show when version+phase selected) -->
      <div v-if="selectedVersion && selectedPhase"
           class="border-t border-gray-200 dark:border-gray-700 pt-3">
        <div class="flex items-center justify-between">
          <div>
            <p v-if="!data && error?.includes('No snapshot')" class="text-sm text-gray-600 dark:text-gray-400">
              No baseline snapshot exists for <span class="font-medium">{{ selectedVersion }} {{ selectedPhase }}</span>
            </p>
            <p v-else class="text-sm text-gray-600 dark:text-gray-400">
              Create a new baseline snapshot for <span class="font-medium">{{ selectedVersion }} {{ selectedPhase }}</span>
            </p>
            <p v-if="snapshotError" class="text-xs text-red-600 dark:text-red-400 mt-1">
              {{ snapshotError }}
            </p>
          </div>
          <button
            @click="createSnapshot"
            :disabled="creatingSnapshot"
            class="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ creatingSnapshot ? 'Creating...' : 'Create Snapshot' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-4 text-red-700 dark:text-red-400 text-sm">
      {{ error }}
    </div>

    <!-- Empty state -->
    <div v-else-if="!selectedVersion || !selectedPhase" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center text-gray-400 dark:text-gray-500">
      <p class="text-lg mb-2">Select a release and phase to view commitment tracking</p>
      <p class="text-sm">Choose a release version and phase (EA1, EA2, or GA) from the filters above.</p>
    </div>

    <!-- Data view -->
    <div v-else-if="data">
      <!-- OKR Status Banner -->
      <div
        class="rounded-lg border px-4 py-3 mb-6 flex items-center gap-3"
        :class="okrStatusClass"
      >
        <component :is="okrIcon" :size="20" />
        <div>
          <div class="font-semibold">{{ okrStatusText }}</div>
          <div class="text-xs opacity-90">
            {{ data.metrics.delivered }} of {{ data.metrics.committed }} committed features delivered
            ({{ data.metrics.percentDelivered }}%)
          </div>
        </div>
      </div>

      <!-- Metrics Cards -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <!-- Committed -->
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Committed</div>
          <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ data.metrics.committed }}</div>
          <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            At planning freeze
          </div>
        </div>

        <!-- Delivered -->
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Delivered</div>
          <div class="text-2xl font-bold text-green-600 dark:text-green-400">{{ data.metrics.delivered }}</div>
          <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {{ data.metrics.percentDelivered }}% of committed
          </div>
        </div>

        <!-- Added -->
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Added</div>
          <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">{{ data.metrics.added }}</div>
          <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            After freeze
          </div>
        </div>

        <!-- Removed -->
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Removed</div>
          <div class="text-2xl font-bold text-amber-600 dark:text-amber-400">{{ data.metrics.removed }}</div>
          <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            After freeze
          </div>
        </div>
      </div>

      <!-- Feature Changes Tables -->
      <div class="space-y-4">
        <!-- Delivered Features -->
        <div v-if="data.features.delivered.length > 0" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <button
            @click="toggleSection('delivered')"
            class="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div class="flex items-center gap-2">
              <component :is="expandedSections.delivered ? ChevronDown : ChevronRight" :size="16" class="text-gray-400" />
              <span class="font-semibold text-gray-900 dark:text-gray-100">
                Delivered Features ({{ data.features.delivered.length }})
              </span>
            </div>
            <span class="text-xs text-green-600 dark:text-green-400 font-medium">Completed</span>
          </button>
          <div v-if="expandedSections.delivered" class="border-t border-gray-200 dark:border-gray-700 p-4">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <FeatureCard
                v-for="feature in data.features.delivered"
                :key="feature.key"
                :feature="feature"
                variant="delivered"
              />
            </div>
          </div>
        </div>

        <!-- Added Features -->
        <div v-if="data.features.added.length > 0" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <button
            @click="toggleSection('added')"
            class="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div class="flex items-center gap-2">
              <component :is="expandedSections.added ? ChevronDown : ChevronRight" :size="16" class="text-gray-400" />
              <span class="font-semibold text-gray-900 dark:text-gray-100">
                Added Features ({{ data.features.added.length }})
              </span>
            </div>
            <span class="text-xs text-blue-600 dark:text-blue-400 font-medium">After Freeze</span>
          </button>
          <div v-if="expandedSections.added" class="border-t border-gray-200 dark:border-gray-700 p-4">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <FeatureCard
                v-for="feature in data.features.added"
                :key="feature.key"
                :feature="feature"
                variant="added"
              />
            </div>
          </div>
        </div>

        <!-- Removed Features -->
        <div v-if="data.features.removed.length > 0" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <button
            @click="toggleSection('removed')"
            class="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div class="flex items-center gap-2">
              <component :is="expandedSections.removed ? ChevronDown : ChevronRight" :size="16" class="text-gray-400" />
              <span class="font-semibold text-gray-900 dark:text-gray-100">
                Removed Features ({{ data.features.removed.length }})
              </span>
            </div>
            <span class="text-xs text-amber-600 dark:text-amber-400 font-medium">After Freeze</span>
          </button>
          <div v-if="expandedSections.removed" class="border-t border-gray-200 dark:border-gray-700 p-4">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <FeatureCard
                v-for="feature in data.features.removed"
                :key="feature.key"
                :feature="feature"
                variant="removed"
              />
            </div>
          </div>
        </div>

        <!-- In Progress Features -->
        <div v-if="data.features.inProgress.length > 0" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <button
            @click="toggleSection('inProgress')"
            class="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div class="flex items-center gap-2">
              <component :is="expandedSections.inProgress ? ChevronDown : ChevronRight" :size="16" class="text-gray-400" />
              <span class="font-semibold text-gray-900 dark:text-gray-100">
                In Progress ({{ data.features.inProgress.length }})
              </span>
            </div>
            <span class="text-xs text-yellow-600 dark:text-yellow-400 font-medium">Not Delivered</span>
          </button>
          <div v-if="expandedSections.inProgress" class="border-t border-gray-200 dark:border-gray-700 p-4">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <FeatureCard
                v-for="feature in data.features.inProgress"
                :key="feature.key"
                :feature="feature"
                variant="in-progress"
              />
            </div>
          </div>
        </div>

        <!-- Not Started Features -->
        <div v-if="data.features.notStarted.length > 0" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <button
            @click="toggleSection('notStarted')"
            class="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div class="flex items-center gap-2">
              <component :is="expandedSections.notStarted ? ChevronDown : ChevronRight" :size="16" class="text-gray-400" />
              <span class="font-semibold text-gray-900 dark:text-gray-100">
                Not Started ({{ data.features.notStarted.length }})
              </span>
            </div>
            <span class="text-xs text-red-600 dark:text-red-400 font-medium">Not Delivered</span>
          </button>
          <div v-if="expandedSections.notStarted" class="border-t border-gray-200 dark:border-gray-700 p-4">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <FeatureCard
                v-for="feature in data.features.notStarted"
                :key="feature.key"
                :feature="feature"
                variant="not-started"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Snapshot metadata -->
      <div class="mt-6 text-xs text-gray-500 dark:text-gray-400 text-center">
        Snapshot created: {{ formatDate(data.snapshot.snapshotAt) }}
        ({{ data.snapshot.trigger }})
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import { ArrowLeft, ChevronRight, ChevronDown, CheckCircle, AlertTriangle, XCircle } from 'lucide-vue-next'
import { useCommitmentTracking } from './composables/useCommitmentTracking'
import FeatureCard from './components/FeatureCard.vue'

const nav = inject('moduleNav')

const { data, loading, error, loadCommitment, releases, loadReleases } = useCommitmentTracking()

const selectedVersion = ref('')
const selectedPhase = ref('')
const creatingSnapshot = ref(false)
const snapshotError = ref(null)
const expandedSections = ref({
  delivered: false,
  added: false,
  removed: false,
  inProgress: false,
  notStarted: false
})

// OKR status (90% threshold)
const okrStatusClass = computed(() => {
  if (!data.value) return ''
  const pct = data.value.metrics.percentDelivered
  if (pct >= 90) {
    return 'border-green-200 dark:border-green-700/50 bg-green-50/60 dark:bg-green-900/20 text-green-700 dark:text-green-300'
  } else if (pct >= 70) {
    return 'border-yellow-200 dark:border-yellow-500/30 bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
  } else {
    return 'border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400'
  }
})

const okrIcon = computed(() => {
  if (!data.value) return CheckCircle
  const pct = data.value.metrics.percentDelivered
  if (pct >= 90) return CheckCircle
  if (pct >= 70) return AlertTriangle
  return XCircle
})

const okrStatusText = computed(() => {
  if (!data.value) return ''
  const pct = data.value.metrics.percentDelivered
  if (pct >= 90) return '✓ Meeting OKR (≥90%)'
  if (pct >= 70) return '⚠ Below OKR Target'
  return '✗ Significantly Below OKR'
})

function formatDate(isoDate) {
  if (!isoDate) return 'Unknown'
  const date = new Date(isoDate)
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function toggleSection(section) {
  expandedSections.value[section] = !expandedSections.value[section]
}

function handleFilterChange() {
  if (selectedVersion.value && selectedPhase.value) {
    loadCommitment(selectedVersion.value, selectedPhase.value)
  }
}

function goBack() {
  nav.navigateTo('reports')
}

async function createSnapshot() {
  if (!selectedVersion.value || !selectedPhase.value) return
  creatingSnapshot.value = true
  snapshotError.value = null
  try {
    const response = await fetch(`/api/modules/releases/delivery/commitment/snapshot/${selectedVersion.value}/${selectedPhase.value}`, {
      method: 'POST'
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Server error: ${response.status}`)
    }
    // Reload commitment data to show the new snapshot
    await loadCommitment(selectedVersion.value, selectedPhase.value)
  } catch (err) {
    console.error('[CommitmentTracking] Snapshot creation failed:', err)
    snapshotError.value = err.message
  } finally {
    creatingSnapshot.value = false
  }
}

onMounted(() => {
  loadReleases()
})
</script>
