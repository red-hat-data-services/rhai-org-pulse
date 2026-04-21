<script setup>
import { ref, computed } from 'vue'
import { useAIImpact } from '../composables/useAIImpact.js'
import { useAutofix } from '../composables/useAutofix.js'
import { useAssessments } from '../composables/useAssessments.js'
import PhaseSidebar from '../components/PhaseSidebar.vue'
import PhaseContent from '../components/PhaseContent.vue'
import AutofixContent from '../components/AutofixContent.vue'
import ComingSoonPlaceholder from '../components/ComingSoonPlaceholder.vue'
import RFEDetailPanel from '../components/RFEDetailPanel.vue'

const selectedPhase = ref('rfe-review')
const selectedRFE = ref(null)
const timeWindow = ref('week')
const filter = ref('all')
const searchQuery = ref('')
const chartExpanded = ref(true)
const sortBy = ref('default')
const passFailFilter = ref('all')
const priorityFilter = ref('all')
const statusFilter = ref('all')

const { rfeData, loading, error, load } = useAIImpact(timeWindow)
const { assessments, loadAssessments, loadAssessmentDetail } = useAssessments()

// Load assessments alongside RFE data
loadAssessments()

const autofixTimeWindow = ref('month')
const { autofixData, loading: autofixLoading, error: autofixError, load: autofixLoad } = useAutofix(autofixTimeWindow)

const metrics = computed(() => rfeData.value?.metrics || null)
const trendData = computed(() => rfeData.value?.trendData || [])
const breakdown = computed(() => rfeData.value?.breakdown || [])

const phases = [
  { id: 'rfe-review', name: 'RFE Review', order: 1, status: 'active' },
  { id: 'architecture', name: 'Architecture & Design', order: 2, status: 'coming-soon' },
  { id: 'implementation', name: 'Implementation', order: 3, status: 'coming-soon' },
  { id: 'qe-validation', name: 'QE / Validation', order: 4, status: 'coming-soon' },
  { id: 'security', name: 'Security Review', order: 5, status: 'coming-soon' },
  { id: 'documentation', name: 'Documentation', order: 6, status: 'coming-soon' },
  { id: 'build-release', name: 'Build & Release', order: 7, status: 'coming-soon' },
]

const workflows = [
  { id: 'autofix', name: 'Jira AutoFix', status: 'active' }
]

const isPhase = computed(() => phases.some(p => p.id === selectedPhase.value))
const isWorkflow = computed(() => workflows.some(w => w.id === selectedPhase.value))
const activePhase = computed(() => phases.find(p => p.id === selectedPhase.value))

const timeWindowCutoff = computed(() => {
  const days = timeWindow.value === 'week' ? 7 : timeWindow.value === '3months' ? 90 : 30
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
})

const filteredRFEs = computed(() => {
  if (!rfeData.value?.issues) return []
  return rfeData.value.issues.filter(rfe => {
    const matchesTime = new Date(rfe.created) >= timeWindowCutoff.value
    const matchesFilter = filter.value === 'all' || rfe.aiInvolvement === filter.value
    const q = searchQuery.value.toLowerCase()
    const matchesSearch = !q ||
      rfe.summary.toLowerCase().includes(q) ||
      rfe.key.toLowerCase().includes(q) ||
      (rfe.creatorDisplayName && rfe.creatorDisplayName.toLowerCase().includes(q))
    return matchesTime && matchesFilter && matchesSearch
  })
})

const filteredAssessments = computed(() => {
  const rfeKeys = new Set(filteredRFEs.value.map(r => r.key))
  const result = {}
  for (const [key, assessment] of Object.entries(assessments.value)) {
    if (rfeKeys.has(key)) {
      result[key] = assessment
    }
  }
  return result
})

function handleRetry() {
  load()
  loadAssessments()
}

function handleSelect(id) {
  selectedPhase.value = id
  selectedRFE.value = null
}
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
    <PhaseSidebar
      :phases="phases"
      :workflows="workflows"
      :selectedPhase="selectedPhase"
      @select="handleSelect"
    />

    <!-- Phase views -->
    <template v-if="isPhase && activePhase?.status === 'active'">
      <PhaseContent
        :phase="activePhase"
        :loading="loading"
        :error="error"
        :rfeData="rfeData"
        :metrics="metrics"
        :trendData="trendData"
        :breakdown="breakdown"
        :filteredRFEs="filteredRFEs"
        :timeWindow="timeWindow"
        :filter="filter"
        :searchQuery="searchQuery"
        :chartExpanded="chartExpanded"
        :assessments="assessments"
        :filteredAssessments="filteredAssessments"
        :sortBy="sortBy"
        :passFailFilter="passFailFilter"
        :priorityFilter="priorityFilter"
        :statusFilter="statusFilter"
        @update:timeWindow="timeWindow = $event"
        @update:filter="filter = $event"
        @update:searchQuery="searchQuery = $event"
        @update:chartExpanded="chartExpanded = $event"
        @update:sortBy="sortBy = $event"
        @update:passFailFilter="passFailFilter = $event"
        @update:priorityFilter="priorityFilter = $event"
        @update:statusFilter="statusFilter = $event"
        @selectRFE="selectedRFE = $event"
        @retry="handleRetry"
      />

      <RFEDetailPanel
        v-if="selectedRFE"
        :rfe="selectedRFE"
        :phases="phases"
        :jiraHost="rfeData?.jiraHost"
        :assessment="assessments[selectedRFE?.key] || null"
        :loadAssessmentDetail="loadAssessmentDetail"
        @close="selectedRFE = null"
      />
    </template>

    <!-- Workflow views -->
    <AutofixContent
      v-else-if="isWorkflow && selectedPhase === 'autofix'"
      :loading="autofixLoading"
      :error="autofixError"
      :autofixData="autofixData"
      :timeWindow="autofixTimeWindow"
      @update:timeWindow="autofixTimeWindow = $event"
      @retry="autofixLoad"
    />

    <!-- Coming soon placeholder for inactive phases -->
    <ComingSoonPlaceholder
      v-else-if="isPhase"
      :phaseName="activePhase?.name || 'this phase'"
    />
  </div>
</template>
