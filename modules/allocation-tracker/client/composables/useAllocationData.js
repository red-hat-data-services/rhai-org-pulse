/**
 * Shared state composable for the Allocation Tracker module.
 * Replaces the monolithic App.vue data/methods from the standalone app.
 *
 * Manages all reactive state for org, project, and team views,
 * plus data-fetching methods and the transformSprintData() helper.
 */

import { ref, computed, reactive } from 'vue'
import {
  getProjects,
  getOrgSummary,
  getProjectSummary,
  getBoards,
  getSprintsForBoard,
  getSprintIssues,
  refreshData as apiRefreshData
} from '../services/api.js'

// ─── Module-level reactive state (shared across views) ───

const orgName = ref('AI Engineering')
const projects = ref([])
const orgSummary = ref(null)
const projectSummaries = reactive({})
const configError = ref(null)

const selectedProject = ref(null)
const selectedProjectSummary = ref(null)
const boards = ref([])
const boardSprintData = reactive({})

const selectedTeam = ref(null)
const teamSprints = ref([])
const selectedSprint = ref(null)
const teamSprintData = ref(null)
const isTeamDetailLoading = ref(false)

const metricMode = ref('points')

const isLoading = ref(false)
const isRefreshing = ref(false)
const lastUpdated = ref(null)

const isDataStale = computed(() => {
  if (!lastUpdated.value) return false
  const age = Date.now() - new Date(lastUpdated.value).getTime()
  return age > 60 * 60 * 1000 // 1 hour
})

// ─── Data fetching methods ───

async function loadInitialData() {
  isLoading.value = true
  configError.value = null
  try {
    const orgConfig = await getProjects()
    orgName.value = orgConfig.orgName || 'AI Engineering'
    projects.value = orgConfig.projects || []

    if (projects.value.length === 0) {
      configError.value = 'No projects configured. Add projects to the organization configuration.'
      return
    }

    await loadOrgData()
  } catch (error) {
    console.error('Failed to load initial data:', error)
    configError.value = 'Failed to load organization configuration. Please try again.'
  } finally {
    isLoading.value = false
  }
}

async function loadOrgData() {
  try {
    const [orgSummaryResult, ...projectSummaryResults] = await Promise.all([
      getOrgSummary(),
      ...projects.value.map(p => getProjectSummary(p.key).then(s => ({ key: p.key, summary: s })))
    ])
    orgSummary.value = orgSummaryResult
    for (const { key, summary } of projectSummaryResults) {
      projectSummaries[key] = summary
    }
    if (orgSummaryResult?.lastUpdated) {
      lastUpdated.value = orgSummaryResult.lastUpdated
    }
  } catch (error) {
    console.error('Failed to load org data:', error)
  }
}

async function handleSelectProject(project) {
  selectedProject.value = project
  isLoading.value = true
  try {
    const [boardsData, summaryData] = await Promise.all([
      getBoards(project.key),
      getProjectSummary(project.key)
    ])
    boards.value = boardsData.boards || []
    selectedProjectSummary.value = summaryData
    // Clear and repopulate boardSprintData
    Object.keys(boardSprintData).forEach(k => delete boardSprintData[k])
    if (summaryData?.boards) {
      Object.assign(boardSprintData, summaryData.boards)
    }
    if (summaryData?.lastUpdated) {
      lastUpdated.value = summaryData.lastUpdated
    }
  } catch (error) {
    console.error('Failed to load project data:', error)
    boards.value = []
  } finally {
    isLoading.value = false
  }
}

async function handleSelectTeam(board) {
  selectedTeam.value = board
  teamSprints.value = []
  selectedSprint.value = null
  teamSprintData.value = null
  await loadTeamSprints(board.id)
}

async function loadTeamSprints(boardId) {
  isTeamDetailLoading.value = true
  try {
    const projectKey = selectedProject.value?.key
    const data = await getSprintsForBoard(boardId, { projectKey })
    teamSprints.value = data.sprints || []

    // Restore previously selected sprint, or default to active/most recent closed
    const savedSprintId = getSavedSprintId(boardId)
    const savedSprint = savedSprintId ? teamSprints.value.find(s => s.id === savedSprintId) : null
    const activeSprint = teamSprints.value.find(s => s.state === 'active')
    const selected = savedSprint || activeSprint || [...teamSprints.value]
      .filter(s => s.state === 'closed')
      .sort((a, b) => new Date(b.completeDate || 0) - new Date(a.completeDate || 0))[0] || null

    if (selected) {
      selectedSprint.value = selected
      await loadSprintIssues(selected.id)
    }
  } catch (error) {
    console.error('Failed to load team sprints:', error)
  } finally {
    isTeamDetailLoading.value = false
  }
}

async function loadSprintIssues(sprintId) {
  try {
    const projectKey = selectedProject.value?.key
    const data = await getSprintIssues(sprintId, { projectKey })
    teamSprintData.value = transformSprintData(data)
  } catch (error) {
    console.error('Failed to load sprint issues:', error)
    teamSprintData.value = null
  }
}

async function handleSelectSprint(sprintId) {
  selectedSprint.value = teamSprints.value.find(s => s.id === sprintId) || null
  if (selectedTeam.value) {
    saveSprintId(selectedTeam.value.id, sprintId)
  }
  teamSprintData.value = null
  isTeamDetailLoading.value = true
  try {
    await loadSprintIssues(sprintId)
  } finally {
    isTeamDetailLoading.value = false
  }
}

async function handleRefreshData(hardRefresh) {
  isRefreshing.value = true
  try {
    const projectKey = selectedProject.value?.key
    await apiRefreshData(projectKey, { hardRefresh })
  } catch (error) {
    console.error('Refresh error:', error)
    throw error
  } finally {
    isRefreshing.value = false
  }
}

// ─── Shared bucket helpers ───

const BUCKET_KEYS = ['tech-debt-quality', 'new-features', 'learning-enablement', 'uncategorized']

function emptyBucket() {
  return { points: 0, count: 0, completedPoints: 0, completedCount: 0 }
}

/**
 * Aggregate bucket data across boards from a project/org summary.
 * Normalizes server fields (count/issueCount) into a single `count` field.
 * Returns { buckets, totalPoints, totalCount }.
 */
function aggregateBuckets(boards) {
  const buckets = Object.fromEntries(BUCKET_KEYS.map(k => [k, emptyBucket()]))
  let totalPoints = 0
  let totalCount = 0

  for (const boardData of Object.values(boards)) {
    if (!boardData?.summary?.buckets) continue
    totalPoints += boardData.summary.totalPoints || 0
    totalCount += boardData.summary.totalCount || 0
    for (const [key, bucket] of Object.entries(boardData.summary.buckets)) {
      if (!buckets[key]) continue
      buckets[key].points += bucket.points || 0
      buckets[key].count += bucket.count || bucket.issueCount || 0
      buckets[key].completedPoints += bucket.completedPoints || 0
      buckets[key].completedCount += bucket.completedCount || 0
    }
  }

  return { buckets, totalPoints, totalCount }
}

// ─── transformSprintData ───

function transformSprintData(data) {
  const issuesByBucket = Object.fromEntries(BUCKET_KEYS.map(k => [k, []]))
  for (const issue of (data.issues || [])) {
    const bucket = issuesByBucket[issue.bucket]
    if (bucket) bucket.push(issue)
  }

  const summary = { ...data.summary }
  const totalPoints = summary.totalPoints || 0

  let completedPoints = 0
  if (summary.buckets) {
    summary.buckets = Object.fromEntries(
      Object.entries(summary.buckets).map(([key, bucket]) => {
        completedPoints += bucket.completedPoints || 0
        return [key, {
          ...bucket,
          count: bucket.count || bucket.issueCount || 0,
          completedCount: bucket.completedCount || 0,
          percentage: totalPoints > 0 ? Math.round((bucket.points / totalPoints) * 100) : 0
        }]
      })
    )
  }
  summary.completedPoints = completedPoints

  return {
    sprint: {
      id: data.sprintId,
      name: data.sprintName,
      state: data.sprintState,
      startDate: data.startDate,
      endDate: data.endDate
    },
    summary,
    issues: issuesByBucket
  }
}

// ─── localStorage helpers for sprint selection persistence ───

function getSavedSprintId(boardId) {
  try {
    const saved = JSON.parse(localStorage.getItem('alloc_selectedSprints') || '{}')
    return saved[boardId] || null
  } catch {
    return null
  }
}

function saveSprintId(boardId, sprintId) {
  try {
    const saved = JSON.parse(localStorage.getItem('alloc_selectedSprints') || '{}')
    saved[boardId] = sprintId
    localStorage.setItem('alloc_selectedSprints', JSON.stringify(saved))
  } catch {
    // Ignore localStorage errors
  }
}

// ─── Export composable ───

export function useAllocationData() {
  return {
    // Org-level state
    orgName,
    projects,
    orgSummary,
    projectSummaries,
    configError,

    // Project-level state
    selectedProject,
    selectedProjectSummary,
    boards,
    boardSprintData,

    // Team-level state
    selectedTeam,
    teamSprints,
    selectedSprint,
    teamSprintData,
    isTeamDetailLoading,

    // UI state
    metricMode,
    isLoading,
    isRefreshing,
    lastUpdated,
    isDataStale,

    // Methods
    loadInitialData,
    loadOrgData,
    handleSelectProject,
    handleSelectTeam,
    loadTeamSprints,
    handleSelectSprint,
    handleRefreshData,
    transformSprintData,
    aggregateBuckets
  }
}
